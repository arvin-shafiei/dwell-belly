// Runs one case through the incident flow and returns everything the report and the views need.
// Three writing-model calls on the normal path (understand, decide, critic), plus one revision
// when the gate objects. runCase never throws: a failure becomes an "error" outcome that still
// produces an answer handing the case to a person.
import type { Flow } from "../lib/flow.ts";
import { runPanel, type PanelResult, type PanelRule } from "../lib/panel.ts";
import type { DecisionCard, NextAction, NodeOutput, Outcome, StopReason, Trace, TraceEvent } from "../lib/trace.ts";
import { caseNow, clockBrief, deadlines } from "./clock.ts";
import { gate, type GateConfig } from "./gate.ts";
import type { clash, messageRisk, triage } from "./judge.ts";
import { bundleText } from "./load.ts";
import type { Models, ModelUsage } from "./models.ts";
import { deliver, sandboxTransport, verify, type DeliveryLedger, type DeliveryResult, type Transport } from "./outbox.ts";
import { CRITIC_SYSTEM, DECIDE_SYSTEM, UNDERSTAND_SYSTEM } from "./prompts.ts";
import { Critique, Decision, Understanding, type CaseBundle, type GatedAction, type OutboxEntry } from "./types.ts";

const CASE_TIMEOUT_MS = 300_000;
const DEFAULT_GATE: GateConfig = { allow_below: 0.3, block_above: 0.8 };
const PANEL_HOLD = "A configured reviewer rule requires a person to approve this commitment.";

export interface RunOptions {
  flow: Flow;
  models: Models;
  mode: Trace["mode"];
  runId: string;
  /** Jev panel. Left out, or failing, the flow carries on without its notes. */
  panel?: typeof runPanel;
  /** Jev's quick judgements. Each returns null when Jev is unavailable, and the flow falls back. */
  judge?: { triage?: typeof triage; clash?: typeof clash; messageRisk?: typeof messageRisk };
  /** Where cleared messages go. Default: a sandbox outbox that reaches nobody and says so. */
  transports?: Transport[];
  /** Whole-case limit. A case past it becomes a failure answer and its model calls are aborted. */
  timeoutMs?: number;
  /**
   * A person's answer to the decision card of an earlier run of this case. Trusted: it comes only
   * from the desk through the API body, never from case text. Left out, the run is unchanged.
   */
  humanDecision?: HumanDecision;
}

/** A desk person's choice on a decision card, as the console and the voice layer send it. */
export interface HumanDecision {
  optionId: string;
  label: string;
  by: "tap" | "voice";
  who: string;
  /** The read-back the person confirmed, when the choice was spoken. */
  confirmation?: string;
  cardId?: string;
}

/** What a choice means for the run: go ahead with what it names, or send nothing further. */
export function decisionKind(d: HumanDecision): "approve" | "reject" | "fallback" {
  const id = d.optionId.trim().toLowerCase();
  if (id === "fallback" || /^\s*(use the )?(safe )?fallback\b/i.test(d.label)) return "fallback";
  // A label is a rejection only when it LEADS with a reject word ("Hold for now", "Send nothing"), so an
  // approving option that merely mentions holding ("Sign off redirect or hold") still approves.
  if (id === "reject" || /^\s*(send nothing|nothing (is )?sent|reject|decline|do not|don't|discard|hold|no action|cancel|keep\b[^.]*\bhold|wait)\b/i.test(d.label)) return "reject";
  return "approve";
}

/** Validates a humanDecision from a request body. Undefined when absent, null when malformed. */
export function parseHumanDecision(raw: unknown): HumanDecision | undefined | null {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.optionId !== "string" || !d.optionId.trim() || typeof d.label !== "string" || typeof d.who !== "string") return null;
  if (d.by !== "tap" && d.by !== "voice") return null;
  return {
    optionId: d.optionId.trim().slice(0, 80), label: d.label.slice(0, 300), by: d.by, who: d.who.slice(0, 120),
    ...(typeof d.confirmation === "string" ? { confirmation: d.confirmation.slice(0, 500) } : {}),
    ...(typeof d.cardId === "string" ? { cardId: d.cardId.slice(0, 80) } : {}),
  };
}

/** The case's abort signal travels with the options so every await can be cut off. */
export type WorkOptions = RunOptions & { signal: AbortSignal };

/** One planner's seat: a name for the views and the angle it argues from. Set in the planner node's config. */
export interface Stance { id: string; name: string; brief: string }

export interface RunResult {
  bundle: CaseBundle;
  trace: Trace;
  outcome: Outcome;
  understanding?: Understanding;
  decision?: Decision;
  /** The drafts from each planner seat, when the flow runs more than one. */
  candidates?: { stance: string; decision: Decision }[];
  panel?: PanelResult;
  gated: GatedAction[];
  outbox: OutboxEntry[];
  card?: DecisionCard;
  revised: boolean;
  failedAt?: string;
  error?: string;
}

/**
 * The result as it is saved beside the trace: everything the report needs, and none of the case's
 * own text or attachments. ANSWER.md and REASONING.md can be re-rendered from it with no model call.
 */
export function savedResult(r: RunResult): RunResult {
  return {
    ...r,
    bundle: {
      ...r.bundle,
      documents: r.bundle.documents.map((d) => ({ name: d.name, text: "", chars: d.chars ?? d.text.length })),
      media: r.bundle.media.map((m) => ({ name: m.name, mediaType: m.mediaType, base64: "" })),
    },
  };
}

function summariseCandidates(r: RunResult) {
  return (r.candidates ?? []).map((c) => ({ seat: c.stance, decision: c.decision.decision_type, why: c.decision.why, to: c.decision.actions.map((a) => a.recipient) }));
}

export class Recorder {
  readonly events: TraceEvent[] = [];
  private readonly started = Date.now();
  private stage = "start";
  /** True between begin() and end(): a failure now belongs to the node that is still running. */
  open = false;
  private nodeStart = 0;
  private nodeCost = 0;
  totalCost = 0;

  t() { return Date.now() - this.started; }
  get current() { return this.stage; }
  /** Names the node being worked on, so a failure is reported against it even before it records anything. */
  at(nodeId: string) { this.stage = nodeId; }

  begin(nodeId: string, nodeType: string) {
    this.stage = nodeId;
    this.nodeStart = Date.now();
    this.nodeCost = 0;
    this.open = true;
    this.events.push({ t: this.t(), kind: "node_start", nodeId, nodeType: nodeType as never });
  }
  call(runner: "claude" | "jev", u: ModelUsage) {
    this.nodeCost += u.costUsd;
    this.totalCost += u.costUsd;
    this.events.push({ t: this.t(), kind: "model_call", nodeId: this.stage, runner, model: u.model,
      latencyMs: u.latencyMs, tokensIn: u.tokensIn, tokensOut: u.tokensOut, costUsd: u.costUsd, ok: true });
  }
  end(summary: string, output?: NodeOutput, status: "ok" | "error" | "skipped" = "ok") {
    this.open = false;
    this.events.push({ t: this.t(), kind: "node_end", nodeId: this.stage, status, summary: summary.slice(0, 80),
      output, latencyMs: Date.now() - this.nodeStart, costUsd: this.nodeCost });
  }
  /** A node whose result is a view over an earlier model call: no work of its own. */
  view(nodeId: string, nodeType: string, summary: string, output?: NodeOutput) {
    this.begin(nodeId, nodeType);
    this.end(summary, output);
  }
  /** A node that ran at the same time as others: recorded whole once it is done, with its own timing. */
  done(nodeId: string, nodeType: string, r: { calls: { runner: "claude" | "jev"; usage: ModelUsage }[]; latencyMs: number; summary: string; output?: NodeOutput; status?: "ok" | "error" | "skipped" }) {
    const cost = r.calls.reduce((sum, c) => sum + c.usage.costUsd, 0);
    this.totalCost += cost;
    this.events.push({ t: this.t(), kind: "node_start", nodeId, nodeType: nodeType as never });
    for (const c of r.calls) {
      this.events.push({ t: this.t(), kind: "model_call", nodeId, runner: c.runner, model: c.usage.model, latencyMs: c.usage.latencyMs,
        tokensIn: c.usage.tokensIn, tokensOut: c.usage.tokensOut, costUsd: c.usage.costUsd, ok: true });
    }
    this.events.push({ t: this.t(), kind: "node_end", nodeId, status: r.status ?? "ok", summary: r.summary.slice(0, 80), output: r.output, latencyMs: r.latencyMs, costUsd: cost });
  }
  edge(from: string, to: string, when?: string) {
    this.events.push({ t: this.t(), kind: "edge", from, to, when });
  }
  /** Attaches "how it decided" lines to the step that just finished, for the views and REASONING.md. */
  explain(lines: (string | false | null | undefined)[]) {
    const last = this.events.findLast((e) => e.kind === "node_end");
    const detail = lines.filter((l): l is string => typeof l === "string" && l.trim().length > 0).map((l) => l.replace(/\s+/g, " ").trim().slice(0, 240)).slice(0, 6);
    if (last?.kind === "node_end" && detail.length) last.detail = detail;
  }
}

export function nodeConfig<T>(flow: Flow, type: string): T | undefined {
  return flow.nodes.find((n) => n.type === type)?.config as T | undefined;
}

export const toNext = (a: GatedAction["action"]): NextAction =>
  ({ recipient: a.recipient, channel: a.channel, message: a.message, undoable: true });

function caseBlock(bundle: CaseBundle): string {
  const unread = bundle.unreadable.length ? `\n\nFiles that could not be read: ${bundle.unreadable.join("; ")}` : "";
  return `<case id="${bundle.id}">\n${bundleText(bundle)}\n</case>${unread}`;
}

/** The safety gate's node config: its two thresholds, and which critic scores the messages. */
export type GateNodeConfig = Partial<GateConfig> & { critic?: "claude" | "jev" };
type Delivery = { g: GatedAction; res: DeliveryResult };
type Timed<T> = { value: T; ms: number };

/**
 * One case's working state, shared by the steps below. runCase calls the steps in a fixed order;
 * the graph executor (graph.ts) calls the same steps in the order the flow's edges choose, each
 * with its own node's id and config.
 */
export interface CaseState {
  bundle: CaseBundle;
  opts: WorkOptions;
  rec: Recorder;
  result: RunResult;
  /** The writing models, cut off once the case is aborted. */
  models: Models;
  /** The case as one tagged text block for the prompts. */
  block: string;
  u?: Understanding;
  /** Set by a clash check. Undefined when no clash check ran on this path. */
  clashed?: boolean;
  /** The perspectives rules that were applied, for the decision card's rule note. */
  rules?: Record<string, PanelRule>;
  /** Extra lines for the planner from steps runCase does not have (the group check). */
  extraNotes: string[];
  brief: string;
  d?: Decision;
  gateConfig: GateConfig;
  /** A configured rule held an otherwise cleared commitment. */
  forced: boolean;
  cleared: GatedAction[];
  held: GatedAction[];
  blocked: GatedAction[];
  delivered: Delivery[];
  undelivered: Delivery[];
  /** A human_decision node was reached, so a person is asked whatever else happened. Graph only. */
  humanAsked: boolean;
  /** The human step was answered by opts.humanDecision. */
  humanAnswered: boolean;
  /** Messages a person chose not to send (a rejecting humanDecision). Never delivered. */
  refused: GatedAction[];
  /** Held messages an approving humanDecision released. In a graph they go out on the branch after the human step. */
  released: Set<GatedAction>;
}

export function openCase(bundle: CaseBundle, opts: WorkOptions, rec: Recorder, result: RunResult): CaseState {
  const { signal } = opts;
  // Once the case has timed out, nothing below may touch the result that was already reported.
  const models: Models = {
    async structured(call) {
      const res = await opts.models.structured({ ...call, signal });
      signal.throwIfAborted();
      return res;
    },
  };
  return {
    bundle, opts, rec, result, models, block: caseBlock(bundle), extraNotes: [], brief: "",
    gateConfig: DEFAULT_GATE, forced: false, cleared: [], held: [], blocked: [], delivered: [], undelivered: [], humanAsked: false,
    humanAnswered: false, refused: [], released: new Set(),
  };
}

/** A judgement that throws or is cut off counts as unavailable, never as a failed case. */
async function quick<T>(s: CaseState, call: Promise<T | null> | undefined): Promise<T | null> {
  const value = call ? await call.catch(() => null) : null;
  s.opts.signal.throwIfAborted();
  return value;
}

async function timed<T>(work: Promise<T>): Promise<Timed<T>> {
  const from = Date.now();
  const value = await work;
  return { value, ms: Date.now() - from };
}

function understood(s: CaseState): Understanding {
  if (!s.u) throw new Error("the case has not been read yet: the flow must start at an ingest node");
  return s.u;
}

export async function ingestStep(s: CaseState, nodeId: string): Promise<void> {
  const { rec, bundle } = s;
  rec.begin(nodeId, "ingest");
  const res = await s.models.structured({ system: UNDERSTAND_SYSTEM, user: s.block, schema: Understanding, media: bundle.media });
  rec.call("claude", res.usage);
  s.u = s.result.understanding = res.output;
  rec.end(`${bundle.documents.length} files, ${bundle.media.length} attachments read`);
  const u = res.output;
  const onRecord = u.claims.filter((c) => c.basis !== "unverified_claim").length;
  rec.explain([
    u.summary,
    `${u.claims.length} statements found: ${onRecord} from a record or an owning team, ${u.claims.length - onRecord} unverified.`,
    `Who decides: ${u.decision_owner}.`,
    u.instruction_like_text.length ? "Part of the case reads like instructions to an automated system. Treated as content, not followed." : null,
    bundle.unreadable.length ? `Could not read: ${bundle.unreadable.join("; ")}` : null,
  ]);
}

export function historyStep(s: CaseState, nodeId: string): void {
  const u = understood(s);
  s.rec.view(nodeId, "history_lookup", `${u.commitments.length} open commitments, ${u.deadlines.length} deadlines`);
  s.rec.explain([
    ...u.commitments.slice(0, 3).map((c) => `Already asked: ${c.what} (${c.status.replaceAll("_", " ")}, owed by ${c.owed_by}).`),
    ...u.deadlines.slice(0, 2).map((d) => `Deadline: ${d}`),
    u.commitments.length + u.deadlines.length === 0 ? "Nothing has been asked of anyone yet, and no deadline is stated." : null,
  ]);
}

export const triageStart = (s: CaseState) => timed(quick(s, s.opts.judge?.triage?.(bundleText(s.bundle))));

/** Records the triage node and returns the case type and urgency it settled on. */
export function triageEnd(s: CaseState, nodeId: string, triaged: Timed<Awaited<ReturnType<typeof triage>>>): { caseType: string; urgency: string } {
  const u = understood(s);
  const fast = triaged.value;
  // The quick check sorts by the delivery problem underneath, so a solicitor's letter about a lost
  // parcel comes back as "lost". When the analysis itself names a formal matter, that is the kind.
  const formal = /solicitor|legal|court|tribunal|regulator|ombudsman|police|journalist|press enquiry|subject access|data[- ]protection|gdpr/i.test(u.case_type);
  const caseType = formal ? "formal_request" : fast?.caseType ?? u.case_type;
  const urgency = fast?.urgency ?? u.urgency;
  s.rec.done(nodeId, "triage", { calls: fast ? [{ runner: "jev", usage: fast.usage }] : [], latencyMs: triaged.ms,
    summary: `${caseType} · ${urgency}`,
    output: { type: "triage", caseType, urgency, p: 1 } });
  s.rec.explain([
    `Kind of problem: ${String(caseType).replaceAll("_", " ")}. Urgency: ${urgency}.`,
    u.hazards.length ? `Possible hazard: ${u.hazards[0]}` : null,
    u.vulnerable_or_distressed.toLowerCase() !== "none" ? `About the person: ${u.vulnerable_or_distressed}` : null,
  ]);
  return { caseType, urgency };
}

export function panelStart(s: CaseState, rules: Record<string, PanelRule> | undefined): Promise<Timed<PanelResult | null>> {
  const u = understood(s);
  s.rules = rules;
  return timed(s.opts.panel && rules
    ? s.opts.panel({ summary: u.summary, case: bundleText(s.bundle) }, rules)
      .catch((err): PanelResult => ({ ok: false, error: err instanceof Error ? err.message : String(err), seats: [], forceHuman: false, notes: [], model: "", latencyMs: 0, tokensIn: 0, costUsd: 0 }))
    : Promise.resolve(null));
}

export function panelEnd(s: CaseState, nodeId: string, panelled: Timed<PanelResult | null>): void {
  const { rec, result } = s;
  const panel = panelled.value;
  if (panel) result.panel = panel;
  if (panel?.ok) {
    rec.done(nodeId, "perspectives", { latencyMs: panelled.ms,
      calls: [{ runner: "jev", usage: { model: panel.model, latencyMs: panel.latencyMs, tokensIn: panel.tokensIn, tokensOut: 0, costUsd: panel.costUsd } }],
      summary: `${panel.notes.length} flags raised${panel.forceHuman ? " · needs a human" : ""}`, output: { type: "perspectives", seats: panel.seats } });
    rec.explain([
      ...panel.seats.filter((seat) => seat.raised.length).slice(0, 4).map((seat) => `${seat.name} spoke up (${seat.raised.map((q) => q.replaceAll("_", " ")).join(", ")}).`),
      panel.seats.every((seat) => seat.raised.length === 0) ? "Five reviewers looked at the case. None raised a concern." : null,
      panel.forceHuman ? "One concern means a person must decide before anything is sent." : null,
    ]);
  } else {
    rec.done(nodeId, "perspectives", { calls: [], latencyMs: panelled.ms, summary: panel ? `skipped: ${panel.error}` : "skipped: no Jev key", status: "skipped" });
  }
}

export function clashStart(s: CaseState) {
  const u = understood(s);
  return timed(quick(s, s.opts.judge?.clash?.(u.claims.map((c) => ({ who: c.who, says: c.says })))));
}

/** Records the clash check and returns whether the sources conflict. */
export function clashEnd(s: CaseState, nodeId: string, clashScored: Timed<Awaited<ReturnType<typeof clash>>>, clashAt: number): boolean {
  const u = understood(s);
  const scored = clashScored.value;
  // The analysis's own conflicts always count; Jev's score can add a clash, never remove one.
  const clashed = s.clashed = u.conflicts.length > 0 || (scored ? scored.p >= clashAt : false);
  s.rec.done(nodeId, "clash_check", { calls: scored ? [{ runner: "jev", usage: scored.usage }] : [], latencyMs: clashScored.ms,
    summary: u.conflicts.length ? `${u.conflicts.length} conflict: ${u.conflicts[0].about}` : clashed ? "sources may conflict" : "no conflict",
    output: { type: "clash_check", clash: clashed, p: scored?.p ?? 1, claims: u.claims.slice(0, 6).map((c) => ({ who: c.who, says: c.says })) } });
  s.rec.explain([
    ...u.conflicts.slice(0, 2).map((c) => `Disagreement between ${c.between}: ${c.about.replace(/[.\s]+$/, "")}. What would settle it: ${c.what_would_settle_it}`),
    u.conflicts.length ? "Neither side is treated as proven." : clashed ? "A quick check suggests two sources may contradict each other." : "The sources agree with each other.",
    ...u.missing_info.slice(0, 2).map((m) => `Missing: ${m.what} (held by ${m.who_has_it}).`),
  ]);
  return clashed;
}

const squash = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase();

/** "Already sent by the desk" events a re-run carries, as recipient and message. */
function alreadySent(bundle: CaseBundle): { to: string; message: string }[] {
  const out: { to: string; message: string }[] = [];
  for (const doc of bundle.documents) {
    for (const m of doc.text.matchAll(/^To: ([^\n]*)\nAlready sent by the desk: ([\s\S]*?)(?=\n\nEvent \d+ \||$(?![\s\S]))/gm)) {
      out.push({ to: squash(m[1]), message: squash(m[2]) });
    }
  }
  return out;
}

function planned(s: CaseState) {
  const actions = !s.d || s.d.decision_type === "wait_no_action" ? [] : s.d.actions;
  if (!s.opts.humanDecision) return actions;
  // On a re-run that answers a card, a message the desk already sent is not sent a second time.
  const sent = alreadySent(s.bundle);
  return actions.filter((a) => !sent.some((x) => x.to === squash(a.recipient) && x.message === squash(a.message)));
}

/** The desk's answer, for the planner. Outside <case>, because it comes from the desk, not the case. */
function deskDecisionBlock(d: HumanDecision): string {
  const kind = decisionKind(d);
  const doNow = kind === "approve"
    ? "Carry out this choice and nothing beyond it. Every message still goes through the safety check."
    : "The person chose not to send anything further. Propose no messages.";
  return `<desk_decision>\nA person at the desk has answered the decision card for this case. This comes from the desk itself, not from the case.\n` +
    `Decided by: ${d.who} (${d.by === "voice" ? "by voice" : "on screen"})\nChosen option: ${d.label} (${d.optionId})\n` +
    `${d.confirmation ? `Read back and confirmed: ${d.confirmation}\n` : ""}${doNow}\n` +
    `Messages marked "Already sent by the desk" in the case have gone out; do not send them again.\n</desk_decision>`;
}

const recipientWords = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !["the", "of", "and", "team", "at"].includes(w));

/** A held message implements an approved option when the option names its recipient. */
function implementsOption(d: HumanDecision, g: GatedAction): boolean {
  const said = new Set(recipientWords(`${d.label} ${d.confirmation ?? ""}`));
  const named = recipientWords(g.action.recipient.split(",")[0]);
  return named.length > 0 && named.every((w) => said.has(w));
}

export async function planStep(s: CaseState, nodeId: string, stances: Stance[]): Promise<void> {
  const { rec, result, bundle, opts } = s;
  const u = understood(s);
  // Dates are compared in code and handed over as text; models get this arithmetic wrong.
  let clock = "";
  try {
    const now = caseNow(bundle);
    clock = clockBrief(now, deadlines([...u.deadlines, ...u.commitments.map((c) => c.due)], now));
  } catch { /* an unreadable clock is the same as no clock */ }

  const notes = [...(result.panel?.ok ? result.panel.notes : []), ...s.extraNotes];
  const brief = s.brief = [
    `<analysis>\n${JSON.stringify(u, null, 1)}\n</analysis>`,
    notes.length ? `<reviewer_notes>\n${notes.map((n) => `- ${n}`).join("\n")}\n</reviewer_notes>` : "",
    s.clashed && u.conflicts.length === 0 ? "A quick check suggests two sources in this case may contradict each other. Look for it before deciding." : "",
    clock ? `<clock>\n${clock}\n</clock>` : "",
    opts.humanDecision ? deskDecisionBlock(opts.humanDecision) : "",
    result.panel?.forceHuman ? "A reviewer flagged a possible decision beyond the desk's authority. Check the evidence: promises or commitments need a person; safe requests to owners, questions, factual updates and safety alerts can still go out. The flag alone is not a reason to escalate the whole case." : "",
    s.block,
  ].filter(Boolean).join("\n\n");

  rec.begin(nodeId, "planner");
  // With stances in the planner's config, several planners draft at once, each arguing from a
  // different seat, and the strong model then chooses between them or combines them. Without
  // stances there is one planner. A draft that fails is dropped; the rest still count.
  let proposals = "";
  if (stances.length > 1) {
    const drafts = await Promise.all(stances.map((stance) =>
      s.models.structured({ system: `${DECIDE_SYSTEM}\n\nYour seat on this case: ${stance.brief}`, user: brief, schema: Decision, media: bundle.media, tier: "fast" })
        .then((res) => ({ stance, res }), () => null)));
    opts.signal.throwIfAborted();
    const usable = drafts.filter((x) => x !== null);
    for (const { res } of usable) rec.call("claude", res.usage);
    result.candidates = usable.map(({ stance, res }) => ({ stance: stance.name, decision: res.output }));
    if (usable.length) {
      proposals = `\n\n<proposals>\nColleagues each drafted a response from a different seat. Weigh them against the principles: choose the strongest, or combine parts of several. Being more cautious is not in itself better, and neither is doing more. The decision you return is the desk's final one.\n${
        usable.map(({ stance, res }) => `\n<proposal seat="${stance.name}">\n${JSON.stringify(res.output, null, 1)}\n</proposal>`).join("")}\n</proposals>`;
    }
  }
  const decided = await s.models.structured({ system: DECIDE_SYSTEM, user: brief + proposals, schema: Decision, media: bundle.media, tier: "strong" });
  rec.call("claude", decided.usage);
  const d = s.d = decided.output;
  const first = planned(s)[0];
  rec.end(`${d.decision_type}: ${d.why}`, first
    ? { type: "planner", nextAction: toNext(first), wontDo: d.wont_do.map((w) => w.item), candidates: summariseCandidates(result) }
    : { type: "planner", wontDo: d.wont_do.map((w) => w.item), candidates: summariseCandidates(result) });
  rec.explain([
    d.headline,
    `Why: ${d.why}`,
    ...d.wont_do.slice(0, 3).map((w) => `Will not: ${w.item} (${w.reason})`),
    result.candidates?.length ? `${result.candidates.length} drafts were weighed before this one was chosen.` : null,
  ]);
}

/** Overall verdict of a gate run: the worst verdict any message got. */
export type GateVerdict = "allow" | "ask" | "block";

export async function gateStep(s: CaseState, nodeId: string, node: GateNodeConfig | undefined): Promise<GateVerdict> {
  const { rec, result, bundle, opts } = s;
  const u = understood(s);
  if (!s.d) throw new Error(`safety gate "${nodeId}" was reached before any planner had proposed something`);
  const gateConfig = s.gateConfig = { ...DEFAULT_GATE, ...node };
  const block = s.block;

  const critique = async (actions: Decision["actions"]) => {
    if (actions.length === 0) return null;
    if (node?.critic === "jev") {
      const risk = await quick(s, opts.judge?.messageRisk?.(block, actions.map((a, index) => ({ index, to: a.recipient, channel: a.channel, message: a.message }))));
      if (risk) { rec.call("jev", risk.usage); return risk; }
    }
    const user = `${block}\n\n<analysis_instruction_like_text>\n${JSON.stringify(u.instruction_like_text)}\n</analysis_instruction_like_text>\n\n` +
      `<outgoing_messages>\n${JSON.stringify(actions.map((a, index) => ({ index, to: a.recipient, channel: a.channel, message: a.message })), null, 1)}\n</outgoing_messages>`;
    const res = await s.models.structured({ system: CRITIC_SYSTEM, user, schema: Critique, media: bundle.media, effort: "low" });
    rec.call("claude", res.usage);
    if (res.output.actions.length === actions.length) return res.output;
    // The wrong number of scores cannot be matched to messages. Ask once more on the stronger model
    // before giving up; an unmatched reply leaves every message held for a person.
    const again = await s.models.structured({ system: CRITIC_SYSTEM, user: `${user}\n\nReturn exactly ${actions.length} entries in "actions", one per outgoing message, with index 0 to ${actions.length - 1}.`, schema: Critique, media: bundle.media, effort: "low", tier: "strong" });
    rec.call("claude", again.usage);
    return again.output;
  };

  rec.begin(nodeId, "safety_gate");
  let gated = gate(planned(s), u, await critique(planned(s)), gateConfig, block);
  const objections = gated.filter((g) => g.verdict !== "allow" && g.worst !== null);
  if (objections.length) {
    // One chance to rewrite with the objections spelled out, then the verdicts stand.
    const feedback = objections.map((g) => `- Message to ${g.action.recipient}: ${g.reasons.join("; ")}`).join("\n");
    const decided = await s.models.structured({
      system: DECIDE_SYSTEM,
      user: `${s.brief}\n\n<gate_objections>\nYour previous messages were stopped by the safety check:\n${feedback}\nRewrite so each message stays within the desk's role, or drop it and escalate that part.\n</gate_objections>`,
      schema: Decision,
      media: bundle.media,
      tier: "strong",
    });
    rec.call("claude", decided.usage);
    s.d = decided.output;
    result.revised = true;
    gated = gate(planned(s), u, await critique(planned(s)), gateConfig, block);
  }
  // PRD D2.16: panel flags apply to commitments, never to an entire case. A message's kind
  // does not bypass the critic or hard rules; only already-cleared coordination can go out.
  const coordination = new Set(["request_to_owner", "question", "status_update", "safety_alert"]);
  const panelHolds = (g: GatedAction) => result.panel?.ok === true && result.panel.forceHuman &&
    g.verdict === "allow" && !coordination.has(g.action.kind);
  s.forced = gated.some(panelHolds);
  gated = gated.map((g) => panelHolds(g) ? {
    ...g, verdict: "ask" as const, risk: Math.max(g.risk, gateConfig.allow_below),
    reasons: [PANEL_HOLD],
  } : g);
  const hd = opts.humanDecision;
  let refused: GatedAction[] = [];
  if (hd && decisionKind(hd) === "approve") {
    // The person's approval answers "ask": a held message the chosen option names goes out. A
    // blocked message never does, and the critic and hard rules above have already run.
    s.released = new Set();
    gated = gated.map((g) => {
      if (g.verdict !== "ask" || !implementsOption(hd, g)) return g;
      const ok: GatedAction = { ...g, verdict: "allow", worst: null, reasons: [`Approved by ${hd.who} (${hd.by}): ${hd.label}`] };
      s.released.add(ok);
      return ok;
    });
    s.forced = gated.some((g) => g.verdict === "ask" && g.reasons[0] === PANEL_HOLD);
  } else if (hd) {
    // The person chose to send nothing further: whatever the gate would allow or hold stays unsent.
    refused = gated.filter((g) => g.verdict !== "block");
    s.forced = false;
  }
  result.decision = s.d;
  result.gated = gated;
  const top = gated.reduce<GatedAction | null>((a, g) => (!a || g.risk > a.risk ? g : a), null);
  const overall: GateVerdict = gated.some((g) => g.verdict === "block") ? "block" : gated.some((g) => g.verdict === "ask") ? "ask" : "allow";
  const chose = hd ? ` · desk chose: ${hd.label}` : "";
  rec.end(gated.length ? `${gated.filter((g) => g.verdict === "allow").length} of ${gated.length} messages cleared${chose}` : `nothing to send${chose}`,
    { type: "safety_gate", risk: top?.risk ?? 0, decision: overall, allowBelow: gateConfig.allow_below, blockAbove: gateConfig.block_above });
  rec.explain([
    ...gated.slice(0, 4).map((g) => g.verdict === "allow"
      ? `Message to ${g.action.recipient}: clear to send (risk ${g.risk.toFixed(2)}, below ${gateConfig.allow_below}).`
      : `Message to ${g.action.recipient}: ${g.verdict === "block" ? "stopped" : "held for a person"} (${g.reasons.join("; ") || "could not be checked"}).`),
    gated.length === 0 ? "No message was drafted, so there was nothing to check." : null,
    result.revised ? "The first draft was stopped and rewritten once." : null,
  ]);

  s.refused = refused;
  s.cleared = gated.filter((g) => g.verdict === "allow" && !refused.includes(g));
  s.held = gated.filter((g) => g.verdict === "ask" && !refused.includes(g));
  s.blocked = gated.filter((g) => g.verdict === "block");
  return overall;
}

/** The decision owes nobody a message, and no rule overrode that. */
export const isWaiting = (s: CaseState) => s.d?.decision_type === "wait_no_action" && !s.forced;

/** Hands messages the gate cleared to the outbox. Never anything the gate held or blocked. */
export async function actionStep(s: CaseState, nodeId: string, toSend: GatedAction[]): Promise<void> {
  const { rec, opts } = s;
  rec.begin(nodeId, "action");
  const transports = opts.transports ?? [sandboxTransport()];
  const ledger: DeliveryLedger = new Map();
  const before = s.delivered.length;
  for (const g of toSend) {
    const res = await deliver(g.action, transports, { ledger });
    opts.signal.throwIfAborted();
    (res.status === "recorded" ? s.delivered : s.undelivered).push({ g, res });
  }
  const now = s.delivered.slice(before);
  rec.end(`${now.length} of ${toSend.length} message(s) accepted by the outbox`,
    now[0] ? { type: "action", done: toNext(now[0].g.action), ok: true } : undefined, now.length ? "ok" : "error");
  rec.explain([
    // The message itself is the output of the run, so it is shown, not only described.
    ...now.slice(0, 2).flatMap(({ g }) => [`Recorded for ${g.action.recipient} by ${g.action.channel}: ${g.action.purpose}`, `It says: "${g.action.message}"`]),
    ...s.undelivered.slice(0, 2).map(({ g }) => `Could not be delivered to ${g.action.recipient} on any channel.`),
    "No live system is connected, so nothing has reached a recipient yet.",
  ]);
}

/** States what the outbox accepted. Returns false when any message could not be delivered. */
export function verifyStep(s: CaseState, nodeId: string): boolean {
  const { delivered, undelivered } = s;
  // verify() only restates what the transport accepted; nothing downstream has been checked.
  const checks = [...delivered, ...undelivered].map(({ res }) => verify(res));
  const awaiting = (s.d?.waiting_for ?? []).map((w) => `${w.what} from ${w.from} by ${w.by}`).join("; ");
  s.rec.view(nodeId, "verify", undelivered.length ? `${undelivered.length} message(s) not delivered` : "accepted by the outbox; receipt and reply unverified",
    { type: "verify", ok: undelivered.length === 0, p: 1, note: `${checks.map((c) => c.note).join(" ")}${awaiting ? ` Waiting for: ${awaiting}` : ""}`.slice(0, 600) });
  s.rec.explain([
    undelivered.length ? `${undelivered.length} message(s) were not accepted by any channel.` : "Every message was recorded. Receipt and replies are not yet confirmed.",
    ...(s.d?.waiting_for ?? []).slice(0, 3).map((w) => `Now waiting for: ${w.what}, from ${w.from}${w.by.trim() ? `, by ${w.by}` : ""}.`),
  ]);
  return undelivered.length === 0;
}

/** Whether a person has to pick the case up, for any reason runCase knows, or because a human node was reached. */
export function needsHuman(s: CaseState): boolean {
  // A person already chose to send nothing further; what is left is theirs, not a new card.
  if (s.opts.humanDecision && decisionKind(s.opts.humanDecision) !== "approve") return false;
  // Wanting to act but having nothing to send is not "no action needed": a person has to pick it up.
  const nothingPlanned = !isWaiting(s) && s.result.gated.length === 0;
  return s.humanAsked || s.forced || s.d?.decision_type === "escalate_to_human" || s.held.length > 0 || s.blocked.length > 0 || s.undelivered.length > 0 || nothingPlanned;
}

/** The decision card for the person, from everything the case has done so far. */
export function humanCard(s: CaseState): DecisionCard {
  const { d, held, blocked, delivered, undelivered, forced, rules, result } = s;
  const u = understood(s);
  const h = d?.handover;
  const stoppedLine = [
    ...[...held, ...blocked].map((g) => `to ${g.action.recipient}: ${g.reasons.join("; ") || "held until a person decides"}`),
    ...undelivered.map(({ g }) => `to ${g.action.recipient}: could not be delivered on any channel`),
  ].join(" | ");
  const stopped = held.length + blocked.length + undelivered.length;
  // Why the agent stopped, most binding reason first. A person reads this line before anything else.
  const ruleNote = () => rules && result.panel?.seats.flatMap((seat) => seat.raised.map((q) => rules[`${seat.id}.${q}`]))
    .find((rule) => rule?.effect === "force_human")?.note;
  const forcedNote = forced ? ruleNote() : undefined;
  const firstStopped = [...held, ...blocked][0];
  const whyStopped: { reason: StopReason; line: string } =
    forced ? { reason: "rule_requires_person", line: forcedNote ?? "A configured rule requires a person to decide before anything is sent." }
    : d?.decision_type === "escalate_to_human" ? { reason: "agent_judged_unsafe", line: h?.why_a_person || d.why }
    : firstStopped ? { reason: "message_too_risky", line: `The safety check stopped the message to ${firstStopped.action.recipient}: ${firstStopped.reasons.join("; ") || "it could not be checked"}.` }
    : undelivered.length ? { reason: "delivery_failed", line: `The message to ${undelivered[0].g.action.recipient} was cleared but could not be delivered on any channel.` }
    // Graph only: the flow sent the case to a person before anything was planned.
    : !d && result.panel?.ok && result.panel.forceHuman ? { reason: "rule_requires_person", line: ruleNote() ?? "A configured rule requires a person to decide before anything is planned." }
    : { reason: "no_clear_action", line: `The agent judged that something should be done but found no message it could safely send: ${d?.why ?? "no plan was made on this path of the flow"}` };
  // The planner picks the decisive statements when it escalates. Otherwise take the two sides of
  // the first conflict, and failing that the statements made by whoever owns the decision.
  const sides = u.conflicts[0]?.between.toLowerCase() ?? "";
  const fromAnalysis = u.claims.filter((c) => sides.includes(c.who.toLowerCase().split(",")[0])).concat(u.claims.filter((c) => c.who === u.decision_owner));
  const evidence = (h?.key_evidence?.length ? h.key_evidence : fromAnalysis.length ? fromAnalysis : u.claims).slice(0, 3);
  const heldOptions = [
    ...held.map((g) => ({ label: `Approve the message to ${g.action.recipient}`, effect: `Sends the drafted message to ${g.action.recipient} via ${g.action.channel}: ${g.action.purpose}`, undoable: false })),
    ...(held.length ? [{ label: "Send nothing", effect: "The drafted message is discarded and the case stays open with the desk.", undoable: true }] : []),
  ];
  return {
    routeTo: h?.route_to ?? "desk supervisor",
    summary: h?.summary ?? (stopped ? `${stopped} message(s) did not go out (${stoppedLine})` : d?.why ?? u.summary),
    whyStopped,
    evidence,
    alreadyDone: delivered.map(({ g }) => `Message recorded for ${g.action.recipient} via ${g.action.channel}: ${g.action.purpose}`),
    clash: h?.clash || u.conflicts[0]?.about,
    tried: u.commitments.map((c) => `${c.what} (${c.status})`).slice(0, 5),
    // A blocked message is never offered for approval; only held ones are.
    options: (h?.options?.length ? h.options : heldOptions).slice(0, 3).map((o, i) => ({ id: `option-${i + 1}`, ...o })),
    wouldChangeMyMind: h?.would_change_my_mind ?? "",
    deadlineMins: u.urgency === "high" ? 15 : 60,
    fallback: h?.safe_fallback ?? (stopped ? "Hold the stopped messages; send nothing further." : "Take no further action until a person at the desk has decided."),
  };
}

/** Writes the card for a person. Nobody answers during a run, so the card's safe fallback stands. */
export function humanStep(s: CaseState, nodeId: string): DecisionCard {
  const card = s.result.card = humanCard(s);
  s.rec.view(nodeId, "human_decision", `Card for ${card.routeTo}; no human available, fallback logged`, { type: "human_decision", card });
  s.rec.explain([
    card.whyStopped ? `Why a person is needed: ${card.whyStopped.line}` : null,
    `This goes to ${card.routeTo.replace(/[.\s]+$/, "")}.`,
    ...card.options.slice(0, 3).map((o) => `Option: ${o.label}${o.undoable ? "" : " (cannot be undone)"}`),
    `Nobody was available during this run. Meanwhile: ${card.fallback}`,
  ]);
  return card;
}

/** Records the desk's answer on the card: who chose which option, and how. The run goes on from there. */
export function answerStep(s: CaseState, nodeId: string, d: HumanDecision): void {
  s.humanAnswered = true;
  const card: DecisionCard = { ...humanCard(s), chosen: d.optionId };
  s.rec.view(nodeId, "human_decision", `Answered by ${d.who} (${d.by}): ${d.label}`,
    { type: "human_decision", card, decidedBy: d.who, source: d.by, label: d.label, kind: decisionKind(d), ...(d.confirmation ? { confirmation: d.confirmation } : {}) } as NodeOutput);
}

/** Fills the outbox and the outcome from what the steps did. */
export function settle(s: CaseState): void {
  const { result, delivered, undelivered, held, blocked, d, forced } = s;
  for (const { g, res } of delivered) result.outbox.push({ action: g.action, status: "recorded", note: res.note });
  for (const { g, res } of undelivered) result.outbox.push({ action: g.action, status: "failed", note: res.note });
  for (const g of held) result.outbox.push({ action: g.action, status: "held_for_human", note: g.reasons.join("; ") || "A reviewer rule requires a person to decide before anything is sent." });
  for (const g of blocked) result.outbox.push({ action: g.action, status: "blocked", note: g.reasons.join("; ") });
  const hd = s.opts.humanDecision;
  for (const g of s.refused) result.outbox.push({ action: g.action, status: "blocked", note: `Not sent: ${hd?.who ?? "a person"} chose "${hd?.label ?? "send nothing"}" on the decision card.` });

  const onlyBlocked = blocked.length > 0 && delivered.length + undelivered.length + held.length === 0;
  if (hd && decisionKind(hd) !== "approve") result.outcome = "no_action";
  else if (isWaiting(s) && !s.humanAsked) result.outcome = "no_action";
  else if (onlyBlocked && d?.decision_type !== "escalate_to_human" && !forced) result.outcome = "blocked";
  else if (needsHuman(s)) result.outcome = "escalated";
  else result.outcome = d?.decision_type === "ask_for_info" ? "asked_for_info" : "acted";
}

async function work(bundle: CaseBundle, opts: WorkOptions, rec: Recorder, result: RunResult): Promise<void> {
  const { flow, signal } = opts;
  const s = openCase(bundle, opts, rec, result);

  await ingestStep(s, "ingest");
  historyStep(s, "history");
  // Triage, the perspectives panel and the clash check do not depend on each other, so they run at
  // the same time. Each is optional: a failure in one is recorded as skipped and the others stand.
  const rules = nodeConfig<{ rules: Record<string, PanelRule> }>(flow, "perspectives")?.rules;
  const clashAt = nodeConfig<{ clash_at?: number }>(flow, "clash_check")?.clash_at ?? 0.5;
  for (const to of ["triage", "perspectives", "clash"]) rec.edge("history", to);
  const [triaged, panelled, clashScored] = await Promise.all([triageStart(s), panelStart(s, rules), clashStart(s)]);
  signal.throwIfAborted();
  triageEnd(s, "triage", triaged);
  panelEnd(s, "perspectives", panelled);
  clashEnd(s, "clash", clashScored, clashAt);
  for (const from of ["triage", "perspectives", "clash"]) rec.edge(from, "planner");

  await planStep(s, "planner", nodeConfig<{ stances?: Stance[] }>(flow, "planner")?.stances ?? []);
  await gateStep(s, "gate", nodeConfig<GateNodeConfig>(flow, "safety_gate"));

  if (s.cleared.length) {
    rec.edge("gate", "action", "allow");
    await actionStep(s, "action", s.cleared);
    rec.edge("action", "verify");
    verifyStep(s, "verify");
  }

  const last = s.cleared.length ? "verify" : "gate";
  if (opts.humanDecision) {
    rec.edge(last, "human", s.cleared.length ? undefined : "ask");
    answerStep(s, "human", opts.humanDecision);
    rec.edge("human", "log");
    if (needsHuman(s)) result.card = humanCard(s);
  } else if (needsHuman(s)) {
    rec.edge(last, "human", s.cleared.length ? undefined : "ask");
    humanStep(s, "human");
    rec.edge("human", "log");
  } else {
    rec.edge(last, "log");
  }
  settle(s);
}

/**
 * Runs `body` under the case time limit and turns any failure into an "error" outcome that hands
 * the case to a person. Shared by runCase and the graph executor; `finish` writes the case log.
 */
export async function runGuarded(
  bundle: CaseBundle,
  opts: RunOptions,
  body: (bundle: CaseBundle, opts: WorkOptions, rec: Recorder, result: RunResult) => Promise<void>,
  finish: (rec: Recorder, result: RunResult) => void,
  options: { closeOpenNodeOnly?: boolean } = {},
): Promise<RunResult> {
  const rec = new Recorder();
  const result: RunResult = {
    bundle, outcome: "error", gated: [], outbox: [], revised: false,
    trace: { version: 1, runId: opts.runId, caseId: bundle.id, flowId: opts.flow.id, mode: opts.mode, events: rec.events },
  };
  rec.events.push({ t: 0, kind: "run_start", title: bundle.title,
    // No case text in the trace: an excerpt could carry instruction-like text into a judged output.
    inputs: bundle.documents.map((d, i) => ({ n: i + 1, channel: "file", from: d.name, excerpt: `${d.text.length} characters` })) });

  const abort = new AbortController();
  const limit = opts.timeoutMs ?? CASE_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const running = body(bundle, { ...opts, signal: abort.signal }, rec, result);
    // If the timer wins, the abandoned work rejects later; that rejection is expected.
    running.catch(() => {});
    await Promise.race([
      running,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`case exceeded ${limit / 1000}s`)), limit); }),
    ]);
  } catch (err) {
    abort.abort();
    result.outcome = "error";
    result.failedAt = rec.current;
    result.error = err instanceof Error ? err.message : String(err);
    // runCase always closes the stage it was on; the graph closes only a node that is still open.
    if (!options.closeOpenNodeOnly || rec.open) rec.end(`failed: ${result.error}`, undefined, "error");
    // Whatever was half done is not reported as sent.
    result.outbox = [];
  } finally {
    clearTimeout(timer);
  }

  finish(rec, result);
  const first = result.outbox.find((o) => o.status === "recorded");
  rec.events.push({ t: rec.t(), kind: "run_end", outcome: result.outcome, totalCostUsd: rec.totalCost, totalLatencyMs: rec.t(),
    nextAction: first ? toNext(first.action) : undefined, error: result.error });
  return result;
}

export async function runCase(bundle: CaseBundle, opts: RunOptions): Promise<RunResult> {
  return runGuarded(bundle, opts, work, (rec, result) => rec.view("log", "case_log", `outcome: ${result.outcome}`));
}
