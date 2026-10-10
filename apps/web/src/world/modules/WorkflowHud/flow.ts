// Pure helpers for the WorkflowHud: flow layout, per-case node status, case grouping, mock cost.
import type { WorkflowEvent } from "../../store";

export type Runner = "jev" | "claude" | "code";
export type NodeStatus = WorkflowEvent["status"];

export interface FlowNode {
  id: string;
  label: string;
  runner: Runner;
  col: number;
  row: number;
}

export interface FlowEdge {
  from: string;
  to: string;
  /** Gate branch label, if any. */
  when?: "allow" | "ask" | "block";
}

// Snake layout: row 0 left→right, row 1 right→left, gate fans out on rows 2–3.
export const FLOW_NODES: readonly FlowNode[] = [
  { id: "ingest", label: "Ingest", runner: "code", col: 0, row: 0 },
  { id: "history", label: "History", runner: "code", col: 1, row: 0 },
  { id: "triage", label: "Triage", runner: "jev", col: 2, row: 0 },
  { id: "clash", label: "Clash", runner: "jev", col: 3, row: 0 },
  { id: "missing_info", label: "Missing info", runner: "claude", col: 3, row: 1 },
  { id: "group", label: "Group", runner: "code", col: 2, row: 1 },
  { id: "planner", label: "Planner", runner: "claude", col: 1, row: 1 },
  { id: "gate", label: "Safety gate", runner: "jev", col: 0, row: 1 },
  { id: "action", label: "Action", runner: "code", col: 0, row: 2 },
  { id: "human", label: "Human", runner: "claude", col: 1, row: 2 },
  { id: "block", label: "Block", runner: "code", col: 3, row: 2 },
  { id: "verify", label: "Verify", runner: "jev", col: 0, row: 3 },
  { id: "log", label: "Case log", runner: "code", col: 3, row: 3 },
];

export const FLOW_EDGES: readonly FlowEdge[] = [
  { from: "ingest", to: "history" },
  { from: "history", to: "triage" },
  { from: "triage", to: "clash" },
  { from: "clash", to: "missing_info" },
  { from: "missing_info", to: "group" },
  { from: "group", to: "planner" },
  { from: "planner", to: "gate" },
  { from: "gate", to: "action", when: "allow" },
  { from: "gate", to: "human", when: "ask" },
  { from: "gate", to: "block", when: "block" },
  { from: "human", to: "action" },
  { from: "action", to: "verify" },
  { from: "verify", to: "log" },
  { from: "block", to: "log" },
];

export const RUNNER_OF: Record<string, Runner> = Object.fromEntries(FLOW_NODES.map((n) => [n.id, n.runner]));

/** Latest status per node for one case. Gate "block" also lights the virtual block node. */
export function nodeStatuses(events: readonly WorkflowEvent[], caseId: string): Record<string, NodeStatus> {
  const out: Record<string, NodeStatus> = {};
  for (const e of events) {
    if (e.caseId !== caseId) continue;
    out[e.nodeId] = e.status;
    if (e.nodeId === "gate" && e.status === "block") out.block = "block";
  }
  return out;
}

/** Which gate branch this case took, if decided yet. */
export function gateBranch(st: Record<string, NodeStatus>): FlowEdge["when"] | null {
  if (st.block || st.gate === "block") return "block";
  if (st.human || st.gate === "ask") return "ask";
  if (st.action || st.gate === "ok") return "allow";
  return null;
}

// Mock cost per model call (USD), an ESTIMATE for simulated cases only. Code is free.
const COST: Record<Runner, number> = { jev: 0.0004, claude: 0.011, code: 0 };

/** True for events replayed from a real agent trace (anything not produced by the mock engine). */
export function isReal(e: Pick<WorkflowEvent, "source">): boolean {
  return !!e.source && e.source !== "mock" && e.source !== "simulated_persona";
}

/**
 * Real events: the trace's own cost (run_end.totalCostUsd rides on the final log line), never an estimate.
 * Mock events: the per-call estimate above, which the HUD labels "est".
 */
export function eventCost(e: WorkflowEvent): number {
  if (isReal(e)) return e.costUsd ?? 0;
  // Only count completed calls, not "start" pings.
  if (e.status === "start") return 0;
  return COST[RUNNER_OF[e.nodeId] ?? "code"];
}

export type CaseState = "running" | "awaiting" | "blocked" | "error" | "closed";

export interface CaseSummary {
  caseId: string;
  last: WorkflowEvent;
  state: CaseState;
  cost: number;
  steps: number;
  firstT: number;
  /** The first real-trace event of the case (provenance: synthetic, origin), or null for a mock case. */
  prov: WorkflowEvent | null;
}

function stateOf(last: WorkflowEvent, closed: boolean, errored: boolean): CaseState {
  if (closed) return "closed";
  if (errored || last.status === "error") return "error";
  if (last.status === "block") return "blocked";
  if (last.status === "ask") return "awaiting";
  return "running";
}

/** Group events by case, newest case activity first. */
export function summariseCases(events: readonly WorkflowEvent[], limit = 12): CaseSummary[] {
  const map = new Map<string, { last: WorkflowEvent; cost: number; steps: number; firstT: number; closed: boolean; errored: boolean; prov: WorkflowEvent | null }>();
  for (const e of events) {
    let c = map.get(e.caseId);
    if (!c) {
      c = { last: e, cost: 0, steps: 0, firstT: e.t, closed: false, errored: false, prov: null };
      map.set(e.caseId, c);
    }
    c.last = e;
    if (!c.prov && isReal(e)) c.prov = e;
    c.cost += eventCost(e);
    if (e.status !== "start") c.steps++;
    if (e.nodeId === "log" && e.status === "ok") c.closed = true;
    if (e.status === "error") c.errored = true;
  }
  return [...map.entries()]
    .map(([caseId, c]) => ({
      caseId,
      last: c.last,
      state: stateOf(c.last, c.closed, c.errored),
      cost: c.cost,
      steps: c.steps,
      firstT: c.firstT,
      prov: c.prov,
    }))
    .sort((a, b) => b.last.t - a.last.t)
    .slice(0, limit);
}

/** Spend split by provenance: real trace costs vs the mock's estimate. Never summed together. */
export function spendSplit(events: readonly WorkflowEvent[]): { real: number; estimated: number } {
  let real = 0;
  let estimated = 0;
  for (const e of events) {
    if (isReal(e)) real += e.costUsd ?? 0;
    else estimated += eventCost(e);
  }
  return { real, estimated };
}

/** New "ask" events since lastId (events are newest-last). Returns them oldest-first. */
export function newAsks(events: readonly WorkflowEvent[], lastId: string | null): WorkflowEvent[] {
  const fresh: WorkflowEvent[] = [];
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.id === lastId) break;
    if (e.status === "ask") fresh.push(e);
  }
  return fresh.reverse();
}

export function formatClock(h: number): string {
  const total = Math.floor((((h % 24) + 24) % 24) * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function formatAge(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

export function formatCost(usd: number): string {
  if (usd === 0) return "$0";
  return usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(3)}`;
}
