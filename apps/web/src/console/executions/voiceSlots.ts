// Pure helpers behind the voice mount slots (VoiceSlot.tsx). They turn what a voice component hands back
// (a voice-note event, a call's events and decision, an approval) into a POST /api/console/execute body.
// Prop shapes follow docs/superpowers/plans/2026-10-10-voice-layer.md Task 6 ("for Arvin's mount slots").
import type { CaseViewEvent, DecisionCard, ExecuteRequest, ExecutionRecord, HumanDecision, OutboxEntry } from "../types";

/** The voice components (apps/web/src/voice/*.tsx, owned by the voice layer) the slots try to load. */
export const VOICE_COMPONENTS = ["VoiceNoteButton", "CallDrawer", "ApproveByVoice"] as const;
export type VoiceComponentName = (typeof VOICE_COMPONENTS)[number];

/** Session request for a call (apps/api buildSession input, minus `mode`, which the drawer sets). */
export interface CallSessionRequest {
  mode: "demo";
  purpose: "call" | "approval";
  caseId: string;
  calleeRole: string;
  calleeName: string;
  brief: string;
  goal: string;
  questions?: string[];
  card?: DecisionCard;
  boundaries?: string[];
}

/** What the slot knows of the call state before the session exists (the drawer adds callId once connected). */
export interface CallStateSeed {
  caseId: string;
  mode: "demo";
  source: "live_human" | "simulated_persona";
  caseText: string;
  calleeName: string;
  card?: DecisionCard;
  startN: number;
  at: string;
}

/** Outbox rows a person could ring instead of writing: the planner chose a call, callback or phone channel. */
export function callableRows(outbox: OutboxEntry[] | null | undefined): OutboxEntry[] {
  return (outbox ?? []).filter((o) => /\b(call|callback|phone|telephone|ring)\b/i.test(o.action.channel));
}

const ROLE_WORDS = "recipient|customer|driver|courier|dispatcher|merchant|sender|seller|buyer|tenant|landlord|neighbour|neighbor|concierge|manager";
const escapeRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Who a person is in this case, read from its own messages: "Fen Orlo, route driver" as a sender, or
 * "recipient Elva Kesh" in a message. A pasted case keeps only its title and the agent's claims in the
 * run, so those are read too. Empty when the case does not say. */
export function partyRole(name: string, e: ExecutionRecord): string {
  const events = e.trace?.events ?? [];
  const start = events.find((x) => x.kind === "run_start");
  if (!start || start.kind !== "run_start" || !name.trim()) return "";
  const claims = events.flatMap((x) => {
    const out = x.kind === "node_end" ? (x.output as { type?: string; claims?: { who: string; says: string }[] } | undefined) : undefined;
    return out?.type === "clash_check" && Array.isArray(out.claims) ? out.claims : [];
  });
  const senders = [...start.inputs.map((i) => i.from), ...claims.map((c) => c.who)];
  const asSender = senders.find((f) => f.toLowerCase().startsWith(`${name.toLowerCase()}, `));
  if (asSender) return asSender.slice(name.length + 2).trim();
  const mentioned = new RegExp(`\\b(${ROLE_WORDS})\\s+${escapeRe(name)}\\b`, "i");
  for (const text of [start.title ?? "", ...start.inputs.map((i) => i.excerpt), ...claims.map((c) => c.says)]) {
    const m = mentioned.exec(text);
    if (m) return m[1].toLowerCase();
  }
  return "";
}

/** Why a run has no call button, in plain words. */
export function noCallLine(outbox: OutboxEntry[] | null | undefined): string {
  const first = (outbox ?? [])[0];
  return first
    ? `No call needed on this run: the agent chose ${first.action.channel} to ${first.action.recipient}.`
    : "No call needed on this run: the agent sent nothing.";
}

/** A card can be approved while it is still open. */
export function cardOpen(card: DecisionCard | null | undefined): card is DecisionCard {
  return Boolean(card && !card.chosen && card.options?.length);
}

/** The run's own messages as "From: sender" blocks, so a voice note on a pasted case (which the server
 * cannot look up by id) still has the case's references and names to guide transcription. */
export function noteCaseText(e: ExecutionRecord): string {
  const start = (e.trace?.events ?? []).find((x) => x.kind === "run_start");
  if (!start || start.kind !== "run_start") return "";
  return start.inputs.map((i) => `From: ${i.from}\n${i.excerpt}`).join("\n\n").slice(0, 8000);
}

export function noteRerun(e: ExecutionRecord, event: CaseViewEvent): ExecuteRequest {
  return { caseId: e.caseId, dataset: e.dataset, workflowId: e.workflowId, parentExecutionId: e.id, extraEvents: [event], voice: { trigger: "note" } };
}

export function callRerun(e: ExecutionRecord, r: { events: CaseViewEvent[]; decision?: HumanDecision; callId?: string }): ExecuteRequest {
  return {
    caseId: e.caseId,
    dataset: e.dataset,
    workflowId: e.workflowId,
    parentExecutionId: e.id,
    extraEvents: r.events,
    ...(r.decision ? { humanDecision: r.decision } : {}),
    voice: { trigger: r.decision ? "approval" : "call", ...(r.callId ? { callId: r.callId } : {}) },
  };
}

export function approvalRerun(e: ExecutionRecord, d: HumanDecision): ExecuteRequest {
  return { caseId: e.caseId, dataset: e.dataset, workflowId: e.workflowId, parentExecutionId: e.id, humanDecision: d, voice: { trigger: "approval" } };
}

/** The call brief for an outbox row, kept under the 600 characters the session allows. */
export function callRequest(e: ExecutionRecord & { title?: string | null }, row: OutboxEntry): CallSessionRequest {
  return {
    mode: "demo",
    purpose: "call",
    caseId: e.caseId,
    calleeRole: row.action.recipient,
    calleeName: row.action.recipient,
    brief: `${e.title ?? e.caseId}. ${row.action.message}`.slice(0, 600),
    goal: row.action.purpose,
  };
}

export function callStateSeed(e: ExecutionRecord, calleeName: string, simulated: boolean): CallStateSeed {
  const events = e.trace?.events ?? [];
  const start = events.find((x) => x.kind === "run_start");
  const caseText = start && start.kind === "run_start"
    ? start.inputs.map((i) => `${i.n} ${i.channel} ${i.from}: ${i.excerpt}`).join("\n").slice(0, 4000)
    : "";
  const lastN = start && start.kind === "run_start" ? start.inputs.reduce((m, i) => Math.max(m, i.n), 0) : 0;
  return {
    caseId: e.caseId,
    mode: "demo",
    source: simulated ? "simulated_persona" : "live_human",
    caseText,
    calleeName,
    ...(e.card ? { card: e.card } : {}),
    startN: lastN + 1,
    at: "",
  };
}
