// What the voice agent can do during a call, and how each result re-enters the case. A spoken promise
// is judged exactly like a written message (the gate's hard rules, then Jev's per-boundary scores
// against the flow's thresholds), and anything short of a clear "allow" within the time budget is a
// denial: the agent must never be left silent, and never be allowed to promise by default.
import type { ViewEvent } from "../agent/load.ts";
import { gate, type GateConfig } from "../agent/gate.ts";
import type { messageRisk as MessageRisk } from "../agent/judge.ts";
import type { Understanding } from "../agent/types.ts";
import type { DecisionCard } from "../lib/trace.ts";
import type { VoiceMode, VoiceSource } from "./policy.ts";
import { DENIAL } from "./wording.ts";

export { DENIAL } from "./wording.ts";
export const TOOL_BUDGET_MS = 2500;
const JEV_TIMEOUT_MS = 1000;

export interface CallState {
  callId: string;
  caseId: string;
  mode: VoiceMode;
  source: VoiceSource;
  /** The case as the agent read it; spoken promises are checked against it. */
  caseText: string;
  calleeName: string;
  card?: DecisionCard;
  /** Set once the card has been decided on this call. */
  decided?: string;
  startN: number;
  at: string;
}

export interface HumanDecision { optionId: string; label: string; by: "voice"; who: string; confirmation: string }

/** Resolves to null when the promise does not settle within ms. */
function within<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then((v) => { clearTimeout(timer); resolve(v); }, () => { clearTimeout(timer); resolve(null); });
  });
}

export async function checkCommitment(
  text: string,
  state: CallState,
  deps: { messageRisk?: (...args: Parameters<typeof MessageRisk>) => ReturnType<typeof MessageRisk>; gateConfig: GateConfig; budgetMs?: number },
): Promise<{ allowed: boolean; reply: string; rule?: string }> {
  const action = { recipient: state.calleeName, channel: "Call", kind: "status_update" as const, purpose: "spoken commitment", message: text };
  const critique = deps.messageRisk
    ? await within(deps.messageRisk(state.caseText, [{ index: 0, to: state.calleeName, channel: "Call", message: text }], { timeoutMs: JEV_TIMEOUT_MS }), deps.budgetMs ?? TOOL_BUDGET_MS)
    : null;
  // Only the party list is read from the analysis; the case text carries the names.
  const [g] = gate([action], { parties: [] } as unknown as Understanding, critique, deps.gateConfig, state.caseText);
  if (g.verdict === "allow") return { allowed: true, reply: text };
  return { allowed: false, reply: DENIAL, rule: g.reasons.join("; ") || g.verdict };
}

// One decision per call and option, so a repeated tool call cannot record a choice twice.
const decisions = new Map<string, HumanDecision>();

export function submitDecision(
  state: CallState,
  args: { option_id: string; spoken_confirmation: string },
): { ok: true; reply: string; decision: HumanDecision; duplicate: boolean } | { ok: false; reply: string } {
  if (!state.card) return { ok: false, reply: "There is no decision to make on this call." };
  const key = `${state.callId}:${args.option_id}`;
  const earlier = decisions.get(key);
  if (earlier) return { ok: true, reply: `That's already recorded: ${earlier.label}.`, decision: earlier, duplicate: true };
  // A choice made on an earlier call is on the card itself (`chosen`); one made on this call is in `decided`.
  const prior = state.decided ?? state.card.chosen;
  if (prior && prior !== args.option_id) return { ok: false, reply: "This decision has already been made." };
  const option = state.card.options.find((o) => o.id === args.option_id);
  if (!option) return { ok: false, reply: "I couldn't match that to an option. Please tell me again which option you choose." };
  const confirmation = args.spoken_confirmation?.trim();
  if (!confirmation) return { ok: false, reply: "Please confirm the choice out loud first." };
  const decision: HumanDecision = { optionId: option.id, label: option.label, by: "voice", who: state.calleeName, confirmation };
  decisions.set(key, decision);
  return { ok: true, reply: `Recorded: ${option.label}. Thank you.`, decision, duplicate: false };
}

export function recordFact(state: CallState, args: { field: string; value: string; speaker_role: string }): ViewEvent {
  return {
    n: state.startN, timestamp: state.at, stage: null, channel: "Call transcript",
    from: `${state.calleeName} (${args.speaker_role})`, to: "Desk",
    body: `Said on the call (${args.field}): ${args.value}`, source: state.source,
  };
}

export function requestHuman(state: CallState, args: { reason: string }): ViewEvent {
  return {
    n: state.startN, timestamp: state.at, stage: null, channel: "Call transcript",
    from: "Desk (voice agent)", to: "Desk supervisor",
    body: `A person is needed: ${args.reason}`, source: state.source,
  };
}

/** The finished call as case events: what the callee said is their claim; what the desk said is the desk's statement. */
export function transcriptToEvents(lines: { role: "user" | "agent"; message: string }[], state: CallState): ViewEvent[] {
  return lines
    .filter((l) => typeof l?.message === "string" && l.message.trim())
    .map((l, i) => ({
      n: state.startN + i, timestamp: state.at, stage: null, channel: "Call transcript",
      from: l.role === "user" ? state.calleeName : "Desk (voice agent)",
      to: l.role === "user" ? "Desk" : state.calleeName,
      body: l.message.trim(), source: state.source,
    }));
}
