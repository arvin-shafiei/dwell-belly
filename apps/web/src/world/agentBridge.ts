// Bridge from the city to the real agent (apps/api POST /api/cases). A staged scenario becomes a case
// view, the agent runs it and returns its Trace, and the trace is turned into timed WorkflowEvents
// for the HUD. Only used when the HUD's agent toggle is on; otherwise the mock engine runs.
import type { Trace, TraceEvent } from "../../../api/src/lib/trace";
import type { CaseScenario, Modifier } from "./scenarios";
import { MODIFIERS } from "./scenarios";
import type { WorkflowEvent } from "./store";

export const AGENT_API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const RUN_TIMEOUT_MS = 330_000; // the runner allows 300 s per case

export interface ViewEvent {
  n: number;
  timestamp: string;
  stage: string | null;
  channel: string | null;
  from: string | null;
  to: string | null;
  body: string;
}

/**
 * What the agent gets: only the messages known at escalation plus each modifier's extra message.
 * No title, context or expected answer (they would leak the answer).
 */
export function toCaseView(s: CaseScenario, modifiers: readonly Modifier[]) {
  const events: ViewEvent[] = s.messages.map((m, i) => ({
    n: i + 1,
    timestamp: "",
    stage: i === s.messages.length - 1 ? "Escalation" : "Context",
    channel: m.channel,
    from: m.from,
    to: "Rivet Delivery Desk",
    body: m.body,
  }));
  for (const mod of modifiers) {
    events.push({ n: events.length + 1, timestamp: "", stage: "Escalation", channel: "Email", from: "Case update", to: "Rivet Delivery Desk", body: MODIFIERS[mod].extraMessage });
  }
  return { id: `city-${s.id}`, events, mode: "demo" as const };
}

/** One HUD event to show `atMs` after the replay starts. */
export interface TimedEvent {
  atMs: number;
  event: Omit<WorkflowEvent, "id" | "t">;
}

const MIN_NODE_MS = 600;
const MAX_NODE_MS = 2500;

function gateStatus(e: Extract<TraceEvent, { kind: "node_end" }>): WorkflowEvent["status"] {
  if (e.status === "error") return "error";
  const out = e.output as { type?: string; decision?: string } | undefined;
  if (out?.type === "safety_gate" && out.decision === "ask") return "ask";
  if (out?.type === "safety_gate" && out.decision === "block") return "block";
  if (out?.type === "human_decision") return "ask";
  return "ok";
}

/**
 * Turns a trace into HUD events with readable timing: each node shows for 0.6-2.5 s whatever its
 * real latency was. The final action line names channel and recipient so the HUD can check it
 * against the scenario's expected next action.
 */
export function traceToTimedEvents(trace: Trace, caseId: string): TimedEvent[] {
  const out: TimedEvent[] = [];
  let at = 0;
  for (const e of trace.events) {
    if (e.kind === "node_start") {
      out.push({ atMs: at, event: { caseId, nodeId: e.nodeId, status: "start", summary: `${e.nodeId}…`, source: "agent" } });
    } else if (e.kind === "node_end") {
      at += Math.min(MAX_NODE_MS, Math.max(MIN_NODE_MS, e.latencyMs));
      out.push({ atMs: at, event: { caseId, nodeId: e.nodeId, status: gateStatus(e), summary: e.summary || e.nodeId, source: "agent" } });
    } else if (e.kind === "run_end") {
      at += 400;
      const a = e.nextAction;
      const summary = a
        ? `${a.channel} → ${a.recipient}: ${a.message}`.slice(0, 140)
        : `Outcome: ${e.outcome}${e.error ? ` (${e.error})` : ""}`;
      out.push({ atMs: at, event: { caseId, nodeId: a ? "action" : "log", status: e.outcome === "error" ? "error" : "ok", summary, source: "agent" } });
      out.push({ atMs: at + 300, event: { caseId, nodeId: "log", status: "ok", summary: `Real agent · ${e.outcome} · $${e.totalCostUsd.toFixed(4)} · ${(e.totalLatencyMs / 1000).toFixed(1)} s`, source: "agent" } });
    }
  }
  return out;
}

export function outcomeOf(trace: Trace): "acted" | "asked_for_info" | "escalated" | "blocked" | "no_action" {
  const end = trace.events.find((e): e is Extract<TraceEvent, { kind: "run_end" }> => e.kind === "run_end");
  const o = end?.outcome;
  return o === "acted" || o === "asked_for_info" || o === "escalated" || o === "blocked" || o === "no_action" ? o : "escalated";
}

export async function checkAgent(signal?: AbortSignal): Promise<boolean> {
  try {
    const r = await fetch(`${AGENT_API}/api/health`, { signal, cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

export async function runAgent(view: ReturnType<typeof toCaseView>): Promise<Trace> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), RUN_TIMEOUT_MS);
  try {
    const r = await fetch(`${AGENT_API}/api/cases`, {
      method: "POST",
      headers: { "content-type": "text/plain" }, // a "simple" request: no CORS preflight needed
      body: JSON.stringify(view),
      signal: ctl.signal,
    });
    if (!r.ok) throw new Error(`agent API ${r.status}`);
    const body = (await r.json()) as { trace?: Trace } | Trace;
    const trace = "trace" in body && body.trace ? body.trace : (body as Trace);
    if (!trace?.events) throw new Error("agent API returned no trace");
    return trace;
  } finally {
    clearTimeout(timer);
  }
}
