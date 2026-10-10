// The one interface between the agent and everything that shows or scores it (2D view, 3D view,
// eval, REASONING.md). From docs/plans/2026-10-10-3d-workflow-viz-design.md §4.
import type { NodeType, Runner } from "./flow.ts";

export const TRACE_VERSION = 1;

export interface Trace {
  version: typeof TRACE_VERSION;
  runId: string;
  caseId: string;
  flowId: string;
  mode: "practice" | "reality" | "demo";
  synthetic?: boolean;
  events: TraceEvent[];
}

/** t = ms since run start. */
type Base = { t: number };

export type TraceEvent =
  | (Base & { kind: "run_start"; title: string; inputs: InputRef[] })
  | (Base & { kind: "node_start"; nodeId: string; nodeType: NodeType })
  | (Base & { kind: "model_call"; nodeId: string; runner: Exclude<Runner, "code">;
              model: string; latencyMs: number; tokensIn: number; tokensOut: number;
              costUsd: number; ok: boolean; error?: string })
  | (Base & { kind: "node_end"; nodeId: string; status: "ok" | "error" | "skipped";
              summary: string; output?: NodeOutput; latencyMs: number; costUsd: number })
  | (Base & { kind: "edge"; from: string; to: string; when?: "allow" | "ask" | "block" | string })
  | (Base & { kind: "run_end"; outcome: Outcome; totalCostUsd: number; totalLatencyMs: number;
              nextAction?: NextAction; error?: string });

export type Outcome = "acted" | "asked_for_info" | "escalated" | "blocked" | "no_action" | "error";

export interface InputRef { n: number; channel: string; from: string; excerpt: string }

export interface NextAction {
  recipient: string;
  channel: string;
  message: string;
  undoable: boolean;
}

/** Why the agent stopped. One per card, so a person sees the kind of problem before reading anything. */
export type StopReason =
  | "rule_requires_person"     // a configured rule (e.g. formal legal action) forbids acting alone
  | "agent_judged_unsafe"      // the planner itself decided a person must choose
  | "message_too_risky"        // the safety check held or blocked a drafted message
  | "delivery_failed"          // a cleared message could not be delivered on any channel
  | "no_clear_action";         // the agent wanted to act but had nothing safe to send

export interface DecisionCard {
  routeTo: string;
  summary: string;
  /** The headline: why this case could not be decided without a person, in one line. */
  whyStopped?: { reason: StopReason; line: string };
  /** The two or three statements the decision turns on. Everything else in the thread can stay collapsed. */
  evidence?: { who: string; says: string; basis: "system_record" | "owning_team_statement" | "unverified_claim" }[];
  /** What the agent has already done safely, so the person knows what is and is not in hand. */
  alreadyDone?: string[];
  clash?: string;
  tried: string[];
  /** `effect` says exactly what happens if this option is chosen: who is told what, on which channel. */
  options: { id: string; label: string; undoable: boolean; effect?: string }[];
  wouldChangeMyMind: string;
  deadlineMins: number;
  fallback: string;
  chosen?: string;
}

export type NodeOutput =
  | { type: "triage"; caseType: string; urgency: "low" | "medium" | "high"; p: number }
  | { type: "clash_check"; clash: boolean; p: number; claims: { who: string; says: string }[] }
  | { type: "missing_info"; missing: boolean; ask?: NextAction }
  | { type: "planner"; nextAction: NextAction; wontDo: string[] }
  | { type: "safety_gate"; risk: number; decision: "allow" | "ask" | "block"; allowBelow: number; blockAbove: number }
  | { type: "human_decision"; card: DecisionCard }
  | { type: "action"; done: NextAction; ok: boolean }
  | { type: "verify"; ok: boolean; p: number; note?: string }
  | { type: string; [k: string]: unknown };
