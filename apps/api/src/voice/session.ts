// The per-call details handed to the "Desk Caller" agent as dynamic variables. Everything the voice
// agent may know or say comes from here, so the brief holds only what the callee is entitled to and
// every boundary is spelled out. All ten variables are always present and always strings: a missing
// one would stop the call from starting.
import { randomUUID } from "node:crypto";
import type { DecisionCard } from "../lib/trace.ts";
import { voiceAllowed, type VoiceMode } from "./policy.ts";

export const VARIABLES = [
  "call_purpose", "case_id", "call_id", "callee_role", "callee_name",
  "case_brief", "goal", "questions", "options", "boundaries",
] as const;
export type SessionVariables = Record<(typeof VARIABLES)[number], string>;

export const MAX_BRIEF = 600;
export const MAX_QUESTIONS = 3;

export const BOUNDARIES = [
  "Never promise money, compensation, refunds, exact times or outcomes; use propose_commitment first and say only what it allows.",
  "Never ask for, accept or read out door codes, PINs, passwords or anyone else's personal details.",
  "Never choose an option for the person; read their choice back and wait for a clear yes before submit_decision.",
  `Ask at most ${MAX_QUESTIONS} questions and keep the call short.`,
  "If the person is driving or not safe to talk, end the call politely.",
  "If the person is not who you expected, share nothing about the case.",
];

export interface SessionRequest {
  mode: VoiceMode;
  purpose: "approval" | "call";
  caseId: string;
  calleeRole: string;
  calleeName: string;
  brief: string;
  goal: string;
  questions?: string[];
  card?: DecisionCard;
  boundaries?: string[];
}

export type SessionResult =
  | { ok: true; callId: string; dynamicVariables: SessionVariables }
  | { ok: false; status: 400 | 403; error: string };

const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);

/** What the manager hears first: why the agent stopped, the statements the decision turns on, what is already done. */
function approvalBrief(card: DecisionCard): string {
  return [
    card.whyStopped?.line ?? card.summary,
    ...(card.evidence ?? []).map((e) => `${e.who}: ${e.says}`),
    card.alreadyDone?.length ? `Already done: ${card.alreadyDone.join("; ")}` : "",
  ].filter(Boolean).join("\n");
}

export function buildSession(req: SessionRequest): SessionResult {
  const allowed = voiceAllowed(req.mode, "start_call");
  if (!allowed.ok) return { ok: false, status: 403, error: allowed.reason };
  if (req.purpose === "approval" && !req.card) return { ok: false, status: 400, error: "an approval call needs the decision card" };

  const callId = `call-${randomUUID()}`;
  const options = req.card
    ? req.card.options.map((o) => `${o.id}: ${o.label}${o.effect ? ` (does: ${o.effect})` : ""}`).join("; ")
    : "none";
  const brief = req.purpose === "approval" && req.card ? approvalBrief(req.card) : req.brief;
  const questions = (req.questions ?? []).slice(0, MAX_QUESTIONS).map((q, i) => `${i + 1}. ${q}`).join("\n");

  return {
    ok: true,
    callId,
    dynamicVariables: {
      call_purpose: req.purpose,
      case_id: req.caseId,
      call_id: callId,
      callee_role: req.calleeRole,
      callee_name: req.calleeName,
      case_brief: clip(brief, MAX_BRIEF),
      goal: req.goal,
      questions: questions || "none",
      options,
      boundaries: [...BOUNDARIES, ...(req.boundaries ?? [])].join("\n"),
    },
  };
}
