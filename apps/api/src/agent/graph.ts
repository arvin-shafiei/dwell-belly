// Runs a case by walking the flow graph itself: start at the ingest node, run each node with its
// own config, and follow the outgoing edge whose "when" matches what the node found. Every node
// type runs the same step code runCase uses (run.ts), so a console-edited or Architect-built flow
// drives the real agent: two safety gates with different thresholds really gate differently, and
// a branch the case does not take never runs. The trace names flow node ids and records every hop.
//
// runCase stays the scored path (cli.ts and the default flow). graph.test.ts holds the two to the
// same outcome, next action, outbox and card on the default flow for every scripted agent case.
// TODO(lead): parity holds on the default flow; switching cli.ts to runFlowGraph is the lead's call.
import type { Flow, FlowEdge, FlowNode } from "../lib/flow.ts";
import type { PanelRule } from "../lib/panel.ts";
import { CASE_TYPES, type CaseType } from "./judge.ts";
import { groupCandidates, type Store } from "./history.ts";
import {
  actionStep, answerStep, clashEnd, decisionKind, clashStart, gateStep, historyStep, humanCard, humanStep, ingestStep, isWaiting, needsHuman, openCase,
  panelEnd, panelStart, planStep, runGuarded, settle, triageEnd, triageStart, verifyStep,
  type CaseState, type GateNodeConfig, type Recorder, type RunOptions, type RunResult, type Stance, type WorkOptions,
} from "./run.ts";
import type { CaseBundle, GatedAction } from "./types.ts";

export const DEFAULT_FLOW_ID = "default-incident";
/** Node runs per case. A validated flow has no loop but the single verify retry, so this only stops a broken one. */
export const DEFAULT_STEP_CAP = 60;

export interface GraphOptions extends RunOptions {
  /** Most node runs in one case before it is stopped as an error. */
  stepCap?: number;
  /** Case history read by a group_check node. Left out, every case is treated as single. */
  history?: Store;
}

/** The API runs the graph when a request brings its own flow, or names a stored flow other than the default. */
export function usesGraph(request: { flow?: unknown; flowId?: string }): boolean {
  return Boolean(request.flow) || (typeof request.flowId === "string" && request.flowId !== DEFAULT_FLOW_ID);
}

class FlowError extends Error {}

const norm = (s: unknown) => (typeof s === "string" ? s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") : "");
const labelOf = (e: FlowEdge) => norm(e.when);

// Words a flow author (or the Architect) may use for a node's result. The exact word always wins.
const SIMILAR: Record<string, string[]> = {
  allow: ["allowed", "pass", "passed", "safe", "clear", "cleared", "send"],
  ask: ["human", "review", "hold", "held", "approval", "escalate"],
  block: ["blocked", "stop", "stopped", "reject", "rejected"],
  missing: ["incomplete", "need_info", "needs_info", "insufficient", "ask"],
  complete: ["enough", "sufficient", "ok", "proceed"],
  clash: ["conflict", "conflicts", "conflicting", "inconsistent", "contradiction"],
  consistent: ["no_clash", "no_conflict", "agree", "ok"],
  force_human: ["human", "escalate", "needs_human"],
  brief: ["proceed", "continue", "plan", "ok"],
  linked: ["group", "grouped", "shared_cause"],
  single: ["alone", "unlinked", "not_linked"],
  ok: ["success", "verified", "done", "pass", "passed"],
  retry: ["again", "resend"],
  failed: ["fail", "failure", "error"],
  fallback: ["timeout", "no_answer", "unanswered", "default"],
  approve: ["approved", "accept", "accepted", "yes", "proceed", "go", "send"],
  reject: ["rejected", "decline", "declined", "no", "send_nothing", "hold"],
};

// What each triage case type tends to be called on a branch label, so "missing_parcel" catches
// lost_or_misdelivered and the analysis's own free-text type ("delivered not received") still routes.
const CASE_ALIASES: Record<CaseType, string[]> = {
  lost_or_misdelivered: ["missing_parcel", "missing", "lost", "not_received", "misdelivered", "wrong_delivery", "missing_item"],
  damage: ["damaged", "broken", "crushed"],
  cold_chain: ["temperature", "chilled", "frozen", "perishable"],
  customs_and_charges: ["customs", "duties", "duty", "import"],
  missed_or_failed_delivery: ["missed", "failed_delivery", "missed_delivery", "failed_attempt", "late", "delay", "delayed"],
  slot_change: ["slot", "reschedule", "rebook"],
  address: ["redirect", "wrong_address"],
  access: ["no_access", "gate", "entry"],
  returns: ["return", "collection"],
  freight: ["pallet", "pallets"],
  billing: ["refund", "invoice", "fee"],
  safety: ["hazard", "injury", "leak"],
  formal_request: ["legal", "solicitor", "regulator", "ombudsman", "police", "press", "data_request", "complaint"],
  other: [],
};

/** A case type or a branch label as one of the triage case types, or undefined if it reads as none. */
function canonicalType(text: string): CaseType | undefined {
  const t = norm(text);
  if (Object.hasOwn(CASE_TYPES, t)) return t as CaseType;
  const padded = `_${t}_`;
  for (const [type, aliases] of Object.entries(CASE_ALIASES) as [CaseType, string[]][]) {
    if (type !== "other" && [type, ...aliases].some((a) => padded.includes(`_${a}_`))) return type;
  }
  return undefined;
}

/** Whether a branch label names this case type, exactly or by a similar word. */
export function matchesCaseType(label: string, caseType: string): boolean {
  const l = norm(label);
  if (!l) return false;
  if (l === norm(caseType)) return true;
  const a = canonicalType(l);
  return a !== undefined && a !== "other" && a === canonicalType(caseType);
}

/** Edges whose label is this result, exactly or by a similar word. Exact matches first. */
function matching(out: FlowEdge[], result: string): FlowEdge[] {
  const exact = out.filter((e) => labelOf(e) === result);
  if (exact.length) return exact;
  const similar = out.find((e) => labelOf(e) && (SIMILAR[result] ?? []).includes(labelOf(e)));
  return similar ? [similar] : [];
}

/** What a node found, and which edges that leads along. */
interface Step {
  /** The results to route on, most specific first. Null: the node has no branches of its own. */
  results: string[] | null;
  /** Gate only: several exits can fire at once (some messages cleared, others held). */
  all?: boolean;
  /** Triage: match by case type, then "other". */
  caseType?: string;
  /** The node was already done and had nothing new to do; the walk does not continue from it. */
  joined?: boolean;
  /** Human step: with no edge for its result, the path ends here (the card's safe fallback) instead of failing. */
  endIfUnmatched?: boolean;
}

function choose(node: FlowNode, out: FlowEdge[], step: Step): FlowEdge[] {
  if (out.length === 0) return [];
  let hit: FlowEdge[] = [];
  if (step.caseType !== undefined) {
    const caseType = step.caseType;
    const typed = out.find((e) => labelOf(e) && matchesCaseType(e.when as string, caseType));
    hit = typed ? [typed] : out.filter((e) => labelOf(e) === "other");
  } else if (step.results && step.all) {
    hit = [...new Set(step.results.flatMap((r) => matching(out, r)))];
  } else if (step.results) {
    for (const r of step.results) if (!hit.length) hit = matching(out, r);
  }
  if (hit.length) return hit;
  const plain = out.filter((e) => !labelOf(e));
  if (plain.length) return plain;
  // A node with no branches of its own and a single labelled edge: there is only one way on.
  if (!step.results && step.caseType === undefined && out.length === 1) return out;
  if (step.endIfUnmatched) return [];
  const found = step.caseType ?? step.results?.join(" / ") ?? "a result";
  throw new FlowError(`no edge out of "${node.id}" matches "${found}" and it has no unlabelled edge (edges: ${out.map((e) => `${e.to}${e.when ? ` when ${e.when}` : ""}`).join(", ")})`);
}

/** Which gate exits fire: one per kind of verdict among the messages, as runCase acts on them. */
function gateExits(s: CaseState): string[] {
  const fired: string[] = [];
  if (s.cleared.some((g) => !s.released.has(g))) fired.push("allow");
  const nothingPlanned = !isWaiting(s) && s.result.gated.length === 0;
  if (s.held.length || s.forced || s.d?.decision_type === "escalate_to_human" || nothingPlanned) fired.push("ask");
  if (s.blocked.length) fired.push("block");
  // A person has already answered this case's card: the ask exit carries that answer to the human step.
  if (s.opts.humanDecision && !fired.includes("ask")) fired.splice(fired[0] === "allow" ? 1 : 0, 0, "ask");
  // Waiting with nothing to send: nothing is stopped, and the action step will find nothing to do.
  return fired.length ? fired : ["allow"];
}

export async function runFlowGraph(bundle: CaseBundle, opts: GraphOptions): Promise<RunResult> {
  let state: CaseState | undefined;
  const logs: string[] = [];
  const flow: Flow = opts.flow;
  const firstLog = flow.nodes?.find((n) => n.type === "case_log")?.id ?? "log";

  const body = async (b: CaseBundle, o: WorkOptions, rec: Recorder, result: RunResult) => {
    const s = state = openCase(b, o, rec, result);
    await walk(s, flow, opts, logs);
    settle(s);
    if (!result.decision && s.d) result.decision = s.d;
    // A case that needs a person always gets a card, built from where the case ended, even on a
    // path whose flow has no human_decision node.
    if (needsHuman(s)) result.card = humanCard(s);
  };

  const finish = (rec: Recorder, result: RunResult) => {
    if (result.outcome === "error") {
      const from = result.failedAt ?? rec.current;
      if (from !== firstLog) rec.edge(from, firstLog, "error");
      if (!logs.includes(firstLog)) logs.push(firstLog);
    }
    // A path can also end at a human step whose flow gives no edge for the safe fallback; no log is invented for it.
    const why = state && result.outcome !== "error" && result.card && !state.humanAsked ? "; card raised at the case log" : "";
    for (const id of logs) rec.view(id, "case_log", `outcome: ${result.outcome}${why}`);
  };

  return runGuarded(bundle, opts, body, finish, { closeOpenNodeOnly: true });
}

async function walk(s: CaseState, flow: Flow, opts: GraphOptions, logs: string[]): Promise<void> {
  const { rec } = s;
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  const outs = new Map<string, FlowEdge[]>();
  for (const e of flow.edges) outs.set(e.from, [...(outs.get(e.from) ?? []), e]);
  const start = flow.nodes.find((n) => n.type === "ingest");
  if (!start) throw new FlowError("the flow has no ingest node to start from");

  const cap = opts.stepCap ?? DEFAULT_STEP_CAP;
  const queue: { id: string; retry: boolean; fromHuman: boolean }[] = [{ id: start.id, retry: false, fromHuman: false }];
  const ranBefore = new Set<string>();
  const retried = new Set<string>();
  const handed = new Set<GatedAction>();
  let steps = 0;

  // People are asked last, so their card shows everything the agent already did on other branches.
  const next = () => {
    const i = queue.findIndex((q) => byId.get(q.id)?.type !== "human_decision");
    return queue.splice(i >= 0 ? i : 0, 1)[0];
  };

  while (queue.length) {
    const item = next();
    const node = byId.get(item.id);
    if (!node) throw new FlowError(`an edge points at "${item.id}", which is not a node in the flow`);
    rec.at(node.id);
    if (steps >= cap) throw new FlowError(`stopped after ${cap} steps: the flow loops without reaching a case log`);
    steps++;
    const step = await runNode(s, node, item, { ranBefore, retried, handed, outs, opts });
    ranBefore.add(node.id);
    if (step.joined) continue;
    for (const e of choose(node, outs.get(node.id) ?? [], step)) {
      rec.edge(e.from, e.to, e.when);
      const to = byId.get(e.to);
      if (to?.type === "case_log") {
        // A case log is where a path ends. It is written once the whole case is settled.
        if (!logs.includes(to.id)) logs.push(to.id);
        continue;
      }
      const retry = labelOf(e) === "retry" || (SIMILAR.retry.includes(labelOf(e)) && byId.get(e.from)?.type === "verify");
      const fromHuman = node.type === "human_decision";
      const pending = queue.find((q) => q.id === e.to);
      if (pending) { pending.retry ||= retry; pending.fromHuman ||= fromHuman; }
      else queue.push({ id: e.to, retry, fromHuman });
    }
  }
}

interface WalkMemory {
  ranBefore: Set<string>;
  retried: Set<string>;
  handed: Set<GatedAction>;
  outs: Map<string, FlowEdge[]>;
  opts: GraphOptions;
}

async function runNode(s: CaseState, node: FlowNode, via: { retry: boolean; fromHuman: boolean }, m: WalkMemory): Promise<Step> {
  const { rec, opts } = s;
  const config = node.config ?? {};
  switch (node.type) {
    case "ingest":
      await ingestStep(s, node.id);
      return { results: null };

    case "history_lookup":
      historyStep(s, node.id);
      return { results: null };

    case "triage": {
      const t = await triageStart(s);
      return { results: null, caseType: triageEnd(s, node.id, t).caseType };
    }

    case "perspectives": {
      const p = await panelStart(s, config.rules as Record<string, PanelRule> | undefined);
      opts.signal.throwIfAborted();
      panelEnd(s, node.id, p);
      const panel = s.result.panel;
      return { results: [panel?.ok && panel.forceHuman ? "force_human" : "brief"] };
    }

    case "clash_check": {
      const c = await clashStart(s);
      const at = typeof config.clash_at === "number" ? config.clash_at : 0.5;
      return { results: [clashEnd(s, node.id, c, at) ? "clash" : "consistent"] };
    }

    case "missing_info": {
      const missing = s.u?.missing_info ?? [];
      rec.view(node.id, "missing_info", missing.length ? `${missing.length} missing: ${missing[0].what}` : "nothing missing to act on",
        { type: "missing_info", missing: missing.length > 0 });
      return { results: [missing.length ? "missing" : "complete"] };
    }

    case "group_check": {
      const store = m.opts.history;
      if (!store) {
        rec.begin(node.id, "group_check");
        rec.end("no case history connected; treated as a single case", { type: "group_check", linked: false }, "skipped");
        return { results: ["single"] };
      }
      const group = await groupCandidates(store, s.result, new Date()).catch(() => null);
      opts.signal.throwIfAborted();
      if (group) s.extraNotes.push(`This case may share one cause with other open cases (${group.reason}). Consider whether one request to the owner covers them.`);
      rec.view(node.id, "group_check", group ? group.reason : "no linked open cases",
        { type: "group_check", linked: Boolean(group), size: group?.size ?? 1, members: group?.memberCaseIds ?? [] });
      return { results: [group ? "linked" : "single"] };
    }

    case "planner":
      await planStep(s, node.id, (config.stances as Stance[] | undefined) ?? []);
      return { results: null };

    case "safety_gate":
      await gateStep(s, node.id, config as GateNodeConfig);
      return { results: gateExits(s), all: true };

    case "human_decision": {
      const answer = opts.humanDecision;
      if (answer) {
        // Trusted: from the desk through the API body. Route by the option id, its label, then its kind.
        answerStep(s, node.id, answer);
        return { results: [norm(answer.optionId), norm(answer.label), decisionKind(answer)], endIfUnmatched: true };
      }
      s.humanAsked = true;
      humanStep(s, node.id);
      // Nobody answers during a run: the card's safe fallback stands, and held messages stay held.
      return { results: ["fallback"], endIfUnmatched: true };
    }

    case "action": {
      // Only gate-cleared messages, each handed over once; a retry resends what was not delivered.
      // Messages a person approved go out only on a branch that comes from the human step.
      const toSend = via.retry ? s.undelivered.splice(0).map((x) => x.g)
        : s.cleared.filter((g) => !m.handed.has(g) && (via.fromHuman || !s.released.has(g)));
      if (!toSend.length && m.ranBefore.has(node.id)) return { results: null, joined: true };
      if (!toSend.length) {
        rec.begin(node.id, "action");
        rec.end("nothing cleared to send", undefined, "skipped");
        return { results: null };
      }
      for (const g of toSend) m.handed.add(g);
      await actionStep(s, node.id, toSend);
      return { results: null };
    }

    case "verify": {
      if (s.delivered.length + s.undelivered.length === 0) {
        rec.begin(node.id, "verify");
        rec.end("nothing was sent, so nothing to verify", undefined, "skipped");
        return { results: ["ok"] };
      }
      if (verifyStep(s, node.id)) return { results: ["ok"] };
      const canRetry = !m.retried.has(node.id) && (m.outs.get(node.id) ?? []).some((e) => matching([e], "retry").length > 0);
      if (canRetry) {
        m.retried.add(node.id);
        return { results: ["retry"] };
      }
      return { results: ["failed"] };
    }

    default:
      // A node type the incident runtime does not run (watch-flow checks, route replanning, the
      // promise tracker, the learner): recorded as skipped, never treated as having acted.
      rec.begin(node.id, node.type);
      rec.end(`not run by the incident runtime (${node.type})`, undefined, "skipped");
      return { results: null };
  }
}
