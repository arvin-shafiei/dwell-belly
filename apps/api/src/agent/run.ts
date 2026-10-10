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
}

/** Internal: the case's abort signal travels with the options so every await can be cut off. */
type WorkOptions = RunOptions & { signal: AbortSignal };

export interface RunResult {
  bundle: CaseBundle;
  trace: Trace;
  outcome: Outcome;
  understanding?: Understanding;
  decision?: Decision;
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

class Recorder {
  readonly events: TraceEvent[] = [];
  private readonly started = Date.now();
  private stage = "start";
  private nodeStart = 0;
  private nodeCost = 0;
  totalCost = 0;

  t() { return Date.now() - this.started; }
  get current() { return this.stage; }

  begin(nodeId: string, nodeType: string) {
    this.stage = nodeId;
    this.nodeStart = Date.now();
    this.nodeCost = 0;
    this.events.push({ t: this.t(), kind: "node_start", nodeId, nodeType: nodeType as never });
  }
  call(runner: "claude" | "jev", u: ModelUsage) {
    this.nodeCost += u.costUsd;
    this.totalCost += u.costUsd;
    this.events.push({ t: this.t(), kind: "model_call", nodeId: this.stage, runner, model: u.model,
      latencyMs: u.latencyMs, tokensIn: u.tokensIn, tokensOut: u.tokensOut, costUsd: u.costUsd, ok: true });
  }
  end(summary: string, output?: NodeOutput, status: "ok" | "error" | "skipped" = "ok") {
    this.events.push({ t: this.t(), kind: "node_end", nodeId: this.stage, status, summary: summary.slice(0, 80),
      output, latencyMs: Date.now() - this.nodeStart, costUsd: this.nodeCost });
  }
  /** A node whose result is a view over an earlier model call: no work of its own. */
  view(nodeId: string, nodeType: string, summary: string, output?: NodeOutput) {
    this.begin(nodeId, nodeType);
    this.end(summary, output);
  }
  edge(from: string, to: string, when?: string) {
    this.events.push({ t: this.t(), kind: "edge", from, to, when });
  }
}

function nodeConfig<T>(flow: Flow, type: string): T | undefined {
  return flow.nodes.find((n) => n.type === type)?.config as T | undefined;
}

const toNext = (a: GatedAction["action"]): NextAction =>
  ({ recipient: a.recipient, channel: a.channel, message: a.message, undoable: true });

function caseBlock(bundle: CaseBundle): string {
  const unread = bundle.unreadable.length ? `\n\nFiles that could not be read: ${bundle.unreadable.join("; ")}` : "";
  return `<case id="${bundle.id}">\n${bundleText(bundle)}\n</case>${unread}`;
}

async function work(bundle: CaseBundle, opts: WorkOptions, rec: Recorder, result: RunResult): Promise<void> {
  const { flow, signal } = opts;
  // Once the case has timed out, nothing below may touch the result that was already reported.
  const models: Models = {
    async structured(call) {
      const res = await opts.models.structured({ ...call, signal });
      signal.throwIfAborted();
      return res;
    },
  };
  const gateNode = nodeConfig<Partial<GateConfig> & { critic?: "claude" | "jev" }>(flow, "safety_gate");
  const gateConfig = { ...DEFAULT_GATE, ...gateNode };
  // A judgement that throws or is cut off counts as unavailable, never as a failed case.
  const quick = async <T>(call: Promise<T | null> | undefined): Promise<T | null> => {
    const value = call ? await call.catch(() => null) : null;
    signal.throwIfAborted();
    return value;
  };
  const block = caseBlock(bundle);

  rec.begin("ingest", "ingest");
  const understood = await models.structured({ system: UNDERSTAND_SYSTEM, user: block, schema: Understanding, media: bundle.media });
  rec.call("claude", understood.usage);
  const u = result.understanding = understood.output;
  rec.end(`${bundle.documents.length} files, ${bundle.media.length} attachments read`);

  rec.view("history", "history_lookup", `${u.commitments.length} open commitments, ${u.deadlines.length} deadlines`);
  rec.begin("triage", "triage");
  const fast = await quick(opts.judge?.triage?.(bundleText(bundle)));
  if (fast) rec.call("jev", fast.usage);
  rec.end(`${fast?.caseType ?? u.case_type} · ${fast?.urgency ?? u.urgency}`, { type: "triage", caseType: fast?.caseType ?? u.case_type, urgency: fast?.urgency ?? u.urgency, p: 1 });

  const rules = nodeConfig<{ rules: Record<string, PanelRule> }>(flow, "perspectives")?.rules;
  rec.begin("perspectives", "perspectives");
  if (opts.panel && rules) {
    // The panel is optional: whatever goes wrong inside it, the case carries on without its notes.
    const panel = await opts.panel({ summary: u.summary, case: bundleText(bundle) }, rules)
      .catch((err): PanelResult => ({ ok: false, error: err instanceof Error ? err.message : String(err), seats: [], forceHuman: false, notes: [], model: "", latencyMs: 0, tokensIn: 0, costUsd: 0 }));
    signal.throwIfAborted();
    result.panel = panel;
    if (panel.ok) {
      rec.call("jev", { model: panel.model, latencyMs: panel.latencyMs, tokensIn: panel.tokensIn, tokensOut: 0, costUsd: panel.costUsd });
      rec.end(`${panel.notes.length} flags raised${panel.forceHuman ? " · needs a human" : ""}`, { type: "perspectives", seats: panel.seats });
    } else {
      rec.end(`skipped: ${panel.error}`, undefined, "skipped");
    }
  } else {
    rec.end("skipped: no Jev key", undefined, "skipped");
  }

  rec.begin("clash", "clash_check");
  const clashAt = nodeConfig<{ clash_at?: number }>(flow, "clash_check")?.clash_at ?? 0.5;
  const scored = await quick(opts.judge?.clash?.(u.claims.map((c) => ({ who: c.who, says: c.says }))));
  if (scored) rec.call("jev", scored.usage);
  // The analysis's own conflicts always count; Jev's score can add a clash, never remove one.
  const clashed = u.conflicts.length > 0 || (scored ? scored.p >= clashAt : false);
  rec.end(u.conflicts.length ? `${u.conflicts.length} conflict: ${u.conflicts[0].about}` : clashed ? "sources may conflict" : "no conflict",
    { type: "clash_check", clash: clashed, p: scored?.p ?? 1, claims: u.claims.slice(0, 6).map((c) => ({ who: c.who, says: c.says })) });

  // Dates are compared in code and handed over as text; models get this arithmetic wrong.
  let clock = "";
  try {
    const now = caseNow(bundle);
    clock = clockBrief(now, deadlines([...u.deadlines, ...u.commitments.map((c) => c.due)], now));
  } catch { /* an unreadable clock is the same as no clock */ }

  const notes = result.panel?.ok ? result.panel.notes : [];
  const brief = [
    `<analysis>\n${JSON.stringify(u, null, 1)}\n</analysis>`,
    notes.length ? `<reviewer_notes>\n${notes.map((n) => `- ${n}`).join("\n")}\n</reviewer_notes>` : "",
    clashed && u.conflicts.length === 0 ? "A quick check suggests two sources in this case may contradict each other. Look for it before deciding." : "",
    clock ? `<clock>\n${clock}\n</clock>` : "",
    result.panel?.forceHuman ? "A reviewer has determined that a person at the desk must decide this case: use escalate_to_human." : "",
    block,
  ].filter(Boolean).join("\n\n");

  rec.begin("planner", "planner");
  let decided = await models.structured({ system: DECIDE_SYSTEM, user: brief, schema: Decision, media: bundle.media, tier: "strong" });
  rec.call("claude", decided.usage);
  let d = decided.output;

  const critique = async (actions: Decision["actions"]) => {
    if (actions.length === 0) return null;
    if (gateNode?.critic === "jev") {
      const risk = await quick(opts.judge?.messageRisk?.(block, actions.map((a, index) => ({ index, to: a.recipient, channel: a.channel, message: a.message }))));
      if (risk) { rec.call("jev", risk.usage); return risk; }
    }
    const user = `${block}\n\n<analysis_instruction_like_text>\n${JSON.stringify(u.instruction_like_text)}\n</analysis_instruction_like_text>\n\n` +
      `<outgoing_messages>\n${JSON.stringify(actions.map((a, index) => ({ index, to: a.recipient, channel: a.channel, message: a.message })), null, 1)}\n</outgoing_messages>`;
    const res = await models.structured({ system: CRITIC_SYSTEM, user, schema: Critique, media: bundle.media, effort: "low" });
    rec.call("claude", res.usage);
    if (res.output.actions.length === actions.length) return res.output;
    // The wrong number of scores cannot be matched to messages. Ask once more on the stronger model
    // before giving up; an unmatched reply leaves every message held for a person.
    const again = await models.structured({ system: CRITIC_SYSTEM, user: `${user}\n\nReturn exactly ${actions.length} entries in "actions", one per outgoing message, with index 0 to ${actions.length - 1}.`, schema: Critique, media: bundle.media, effort: "low", tier: "strong" });
    rec.call("claude", again.usage);
    return again.output;
  };

  const planned = () => (d.decision_type === "wait_no_action" ? [] : d.actions);
  rec.end(`${d.decision_type}: ${d.why}`, planned()[0]
    ? { type: "planner", nextAction: toNext(planned()[0]), wontDo: d.wont_do.map((w) => w.item) }
    : { type: "planner", wontDo: d.wont_do.map((w) => w.item) });

  rec.begin("gate", "safety_gate");
  let gated = gate(planned(), u, await critique(planned()), gateConfig, block);
  const objections = gated.filter((g) => g.verdict !== "allow" && g.worst !== null);
  if (objections.length) {
    // One chance to rewrite with the objections spelled out, then the verdicts stand.
    const feedback = objections.map((g) => `- Message to ${g.action.recipient}: ${g.reasons.join("; ")}`).join("\n");
    decided = await models.structured({
      system: DECIDE_SYSTEM,
      user: `${brief}\n\n<gate_objections>\nYour previous messages were stopped by the safety check:\n${feedback}\nRewrite so each message stays within the desk's role, or drop it and escalate that part.\n</gate_objections>`,
      schema: Decision,
      media: bundle.media,
      tier: "strong",
    });
    rec.call("claude", decided.usage);
    d = decided.output;
    result.revised = true;
    gated = gate(planned(), u, await critique(planned()), gateConfig, block);
  }
  result.decision = d;
  result.gated = gated;
  const top = gated.reduce<GatedAction | null>((a, g) => (!a || g.risk > a.risk ? g : a), null);
  const overall = gated.some((g) => g.verdict === "block") ? "block" : gated.some((g) => g.verdict === "ask") ? "ask" : "allow";
  rec.end(gated.length ? `${gated.filter((g) => g.verdict === "allow").length} of ${gated.length} messages cleared` : "nothing to send",
    { type: "safety_gate", risk: top?.risk ?? 0, decision: overall, allowBelow: gateConfig.allow_below, blockAbove: gateConfig.block_above });

  // A panel rule with effect force_human is enforced here, in code: nothing goes out until a person decides.
  const forced = result.panel?.ok === true && result.panel.forceHuman;
  const cleared = forced ? [] : gated.filter((g) => g.verdict === "allow");
  const held = gated.filter((g) => g.verdict === "ask" || (forced && g.verdict === "allow"));
  const blocked = gated.filter((g) => g.verdict === "block");
  const waiting = d.decision_type === "wait_no_action" && !forced;

  const delivered: { g: GatedAction; res: DeliveryResult }[] = [];
  const undelivered: { g: GatedAction; res: DeliveryResult }[] = [];
  if (cleared.length) {
    rec.edge("gate", "action", "allow");
    rec.begin("action", "action");
    const transports = opts.transports ?? [sandboxTransport()];
    const ledger: DeliveryLedger = new Map();
    for (const g of cleared) {
      const res = await deliver(g.action, transports, { ledger });
      signal.throwIfAborted();
      (res.status === "recorded" ? delivered : undelivered).push({ g, res });
    }
    rec.end(`${delivered.length} of ${cleared.length} message(s) accepted by the outbox`,
      delivered[0] ? { type: "action", done: toNext(delivered[0].g.action), ok: true } : undefined, delivered.length ? "ok" : "error");
    rec.edge("action", "verify");
    // verify() only restates what the transport accepted; nothing downstream has been checked.
    const checks = [...delivered, ...undelivered].map(({ res }) => verify(res));
    const awaiting = d.waiting_for.map((w) => `${w.what} from ${w.from} by ${w.by}`).join("; ");
    rec.view("verify", "verify", undelivered.length ? `${undelivered.length} message(s) not delivered` : "accepted by the outbox; receipt and reply unverified",
      { type: "verify", ok: undelivered.length === 0, p: 1, note: `${checks.map((c) => c.note).join(" ")}${awaiting ? ` Waiting for: ${awaiting}` : ""}`.slice(0, 600) });
  }

  // Wanting to act but having nothing to send is not "no action needed": a person has to pick it up.
  const nothingPlanned = !waiting && gated.length === 0;
  const needsHuman = forced || d.decision_type === "escalate_to_human" || held.length > 0 || blocked.length > 0 || undelivered.length > 0 || nothingPlanned;
  const last = cleared.length ? "verify" : "gate";

  if (needsHuman) {
    rec.edge(last, "human", cleared.length ? undefined : "ask");
    const h = d.handover;
    const stoppedLine = [
      ...[...held, ...blocked].map((g) => `to ${g.action.recipient}: ${g.reasons.join("; ") || "held until a person decides"}`),
      ...undelivered.map(({ g }) => `to ${g.action.recipient}: could not be delivered on any channel`),
    ].join(" | ");
    const stopped = held.length + blocked.length + undelivered.length;
    // Why the agent stopped, most binding reason first. A person reads this line before anything else.
    const forcedNote = forced ? rules && result.panel?.seats.flatMap((seat) => seat.raised.map((q) => rules[`${seat.id}.${q}`]))
      .find((rule) => rule?.effect === "force_human")?.note : undefined;
    const firstStopped = [...held, ...blocked][0];
    const whyStopped: { reason: StopReason; line: string } =
      forced ? { reason: "rule_requires_person", line: forcedNote ?? "A configured rule requires a person to decide before anything is sent." }
      : d.decision_type === "escalate_to_human" ? { reason: "agent_judged_unsafe", line: h?.why_a_person || d.why }
      : firstStopped ? { reason: "message_too_risky", line: `The safety check stopped the message to ${firstStopped.action.recipient}: ${firstStopped.reasons.join("; ") || "it could not be checked"}.` }
      : undelivered.length ? { reason: "delivery_failed", line: `The message to ${undelivered[0].g.action.recipient} was cleared but could not be delivered on any channel.` }
      : { reason: "no_clear_action", line: `The agent judged that something should be done but found no message it could safely send: ${d.why}` };
    // The planner picks the decisive statements when it escalates. Otherwise take the two sides of
    // the first conflict, and failing that the statements made by whoever owns the decision.
    const sides = u.conflicts[0]?.between.toLowerCase() ?? "";
    const fromAnalysis = u.claims.filter((c) => sides.includes(c.who.toLowerCase().split(",")[0])).concat(u.claims.filter((c) => c.who === u.decision_owner));
    const evidence = (h?.key_evidence?.length ? h.key_evidence : fromAnalysis.length ? fromAnalysis : u.claims).slice(0, 3);
    const heldOptions = [
      ...held.map((g) => ({ label: `Approve the message to ${g.action.recipient}`, effect: `Sends the drafted message to ${g.action.recipient} via ${g.action.channel}: ${g.action.purpose}`, undoable: false })),
      ...(held.length ? [{ label: "Send nothing", effect: "The drafted message is discarded and the case stays open with the desk.", undoable: true }] : []),
    ];
    const card: DecisionCard = result.card = {
      routeTo: h?.route_to ?? "desk supervisor",
      summary: h?.summary ?? (stopped ? `${stopped} message(s) did not go out (${stoppedLine})` : d.why),
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
    rec.view("human", "human_decision", `Card for ${card.routeTo}; no human available, fallback logged`, { type: "human_decision", card });
    rec.edge("human", "log");
  } else {
    rec.edge(last, "log");
  }

  for (const { g, res } of delivered) result.outbox.push({ action: g.action, status: "recorded", note: res.note });
  for (const { g, res } of undelivered) result.outbox.push({ action: g.action, status: "failed", note: res.note });
  for (const g of held) result.outbox.push({ action: g.action, status: "held_for_human", note: g.reasons.join("; ") || "A reviewer rule requires a person to decide before anything is sent." });
  for (const g of blocked) result.outbox.push({ action: g.action, status: "blocked", note: g.reasons.join("; ") });

  const onlyBlocked = blocked.length > 0 && delivered.length + undelivered.length + held.length === 0;
  if (waiting) result.outcome = "no_action";
  else if (onlyBlocked && d.decision_type !== "escalate_to_human" && !forced) result.outcome = "blocked";
  else if (needsHuman) result.outcome = "escalated";
  else result.outcome = d.decision_type === "ask_for_info" ? "asked_for_info" : "acted";
}

export async function runCase(bundle: CaseBundle, opts: RunOptions): Promise<RunResult> {
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
    const running = work(bundle, { ...opts, signal: abort.signal }, rec, result);
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
    rec.end(`failed: ${result.error}`, undefined, "error");
    // Whatever was half done is not reported as sent.
    result.outbox = [];
  } finally {
    clearTimeout(timer);
  }

  rec.view("log", "case_log", `outcome: ${result.outcome}`);
  const first = result.outbox.find((o) => o.status === "recorded");
  rec.events.push({ t: rec.t(), kind: "run_end", outcome: result.outcome, totalCostUsd: rec.totalCost, totalLatencyMs: rec.t(),
    nextAction: first ? toNext(first.action) : undefined, error: result.error });
  return result;
}
