// Pure helpers for the Executions tab: list filtering, polling decision, formatting,
// and turning a Trace's flat event list into a timeline of node steps.
import type { ExecutionRecord, Trace } from "../types";
import type { DecisionCard, NextAction, TraceEvent } from "../../../../api/src/lib/trace";

export type ExecutionSummary = Omit<ExecutionRecord, "trace" | "answerMd" | "reasoningMd">;
export type ExecStatus = ExecutionRecord["status"];

export interface ExecFilter {
  status: ExecStatus | "all";
  dataset: string | "all";
  q?: string;
}

export function filterExecutions<T extends ExecutionSummary>(rows: T[], f: ExecFilter): T[] {
  const q = (f.q ?? "").trim().toLowerCase();
  return rows.filter(
    (r) =>
      (f.status === "all" || r.status === f.status) &&
      (f.dataset === "all" || r.dataset === f.dataset) &&
      (!q || r.caseId.toLowerCase().includes(q) || (r.outcome ?? "").toLowerCase().includes(q)),
  );
}

/** Newest first; running ones float to the top. */
export function sortExecutions<T extends ExecutionSummary>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if ((a.status === "running") !== (b.status === "running")) return a.status === "running" ? -1 : 1;
    return b.startedAt.localeCompare(a.startedAt);
  });
}

export function datasetsOf(rows: { dataset: string }[]): string[] {
  return [...new Set(rows.map((r) => r.dataset))].sort();
}

export function anyRunning(rows: { status: ExecStatus }[]): boolean {
  return rows.some((r) => r.status === "running");
}

export function fmtDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "–";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s - m * 60)}s`;
}

export function fmtCost(usd: number | null | undefined): string {
  if (usd == null || !Number.isFinite(usd)) return "–";
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(usd < 10 ? 3 : 2)}`;
}

export function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}

/** "3m ago", "2h ago", or a date for anything older than a day. */
export function fmtStarted(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const d = Math.max(0, now - t) / 1000;
  if (d < 45) return "just now";
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return new Date(t).toISOString().slice(0, 16).replace("T", " ");
}

// ---- Timeline -------------------------------------------------------------------------

type Ev<K extends TraceEvent["kind"]> = Extract<TraceEvent, { kind: K }>;
export type ModelCall = Ev<"model_call">;

export interface GateInfo {
  risk: number;
  decision: "allow" | "ask" | "block";
  allowBelow: number;
  blockAbove: number;
}

export type TimelineItem =
  | { kind: "run_start"; t: number; title: string; inputs: Ev<"run_start">["inputs"] }
  | {
      kind: "node";
      t: number;
      nodeId: string;
      nodeType: string;
      status: "running" | "ok" | "error" | "skipped";
      summary: string | null;
      latencyMs: number | null;
      costUsd: number | null;
      calls: ModelCall[];
      output: Ev<"node_end">["output"] | null;
      gate: GateInfo | null;
      card: DecisionCard | null;
      action: { done: NextAction; ok: boolean } | null;
    }
  | { kind: "edge"; t: number; from: string; to: string; when: string | null }
  | {
      kind: "run_end";
      t: number;
      outcome: string;
      totalCostUsd: number;
      totalLatencyMs: number;
      nextAction: NextAction | null;
      error: string | null;
    };

type NodeItem = Extract<TimelineItem, { kind: "node" }>;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function gateOf(output: unknown): GateInfo | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Record<string, unknown>;
  if (o.type !== "safety_gate") return null;
  const risk = num(o.risk), allowBelow = num(o.allowBelow), blockAbove = num(o.blockAbove);
  if (risk == null || allowBelow == null || blockAbove == null) return null;
  const d = o.decision;
  return { risk, allowBelow, blockAbove, decision: d === "allow" || d === "block" ? d : "ask" };
}

export function cardOf(output: unknown): DecisionCard | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Record<string, unknown>;
  if (o.type !== "human_decision" || !o.card || typeof o.card !== "object") return null;
  const c = o.card as Partial<DecisionCard>;
  return {
    routeTo: String(c.routeTo ?? ""),
    summary: String(c.summary ?? ""),
    clash: c.clash,
    tried: Array.isArray(c.tried) ? c.tried.map(String) : [],
    options: Array.isArray(c.options) ? c.options : [],
    wouldChangeMyMind: String(c.wouldChangeMyMind ?? ""),
    deadlineMins: Number(c.deadlineMins ?? 0),
    fallback: String(c.fallback ?? ""),
    chosen: c.chosen,
  };
}

function actionOf(output: unknown): { done: NextAction; ok: boolean } | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Record<string, unknown>;
  if (o.type !== "action" || !o.done || typeof o.done !== "object") return null;
  return { done: o.done as NextAction, ok: o.ok !== false };
}

/**
 * Fold the flat trace into timeline items: node_start opens a step, model_calls attach to the
 * open step for that node, node_end closes it. Edges and run start/end stay as their own items.
 */
export function buildTimeline(trace: Trace | null | undefined): TimelineItem[] {
  if (!trace?.events?.length) return [];
  const items: TimelineItem[] = [];
  const open = new Map<string, NodeItem>();
  const newNode = (t: number, nodeId: string, nodeType: string): NodeItem => ({
    kind: "node", t, nodeId, nodeType, status: "running", summary: null, latencyMs: null, costUsd: null,
    calls: [], output: null, gate: null, card: null, action: null,
  });
  for (const ev of trace.events) {
    switch (ev.kind) {
      case "run_start":
        items.push({ kind: "run_start", t: ev.t, title: ev.title, inputs: ev.inputs ?? [] });
        break;
      case "node_start": {
        const n = newNode(ev.t, ev.nodeId, ev.nodeType);
        open.set(ev.nodeId, n);
        items.push(n);
        break;
      }
      case "model_call": {
        let n = open.get(ev.nodeId);
        if (!n) {
          n = newNode(ev.t, ev.nodeId, ev.nodeId);
          open.set(ev.nodeId, n);
          items.push(n);
        }
        n.calls.push(ev);
        break;
      }
      case "node_end": {
        let n = open.get(ev.nodeId);
        if (!n) {
          n = newNode(ev.t - (ev.latencyMs ?? 0), ev.nodeId, ev.nodeId);
          items.push(n);
        }
        open.delete(ev.nodeId);
        n.status = ev.status;
        n.summary = ev.summary;
        n.latencyMs = ev.latencyMs;
        n.costUsd = ev.costUsd;
        n.output = ev.output ?? null;
        n.gate = gateOf(ev.output);
        n.card = cardOf(ev.output);
        n.action = actionOf(ev.output);
        break;
      }
      case "edge":
        items.push({ kind: "edge", t: ev.t, from: ev.from, to: ev.to, when: ev.when ?? null });
        break;
      case "run_end":
        items.push({
          kind: "run_end", t: ev.t, outcome: ev.outcome, totalCostUsd: ev.totalCostUsd,
          totalLatencyMs: ev.totalLatencyMs, nextAction: ev.nextAction ?? null, error: ev.error ?? null,
        });
        break;
    }
  }
  return items;
}

/** Positions (0..100 %) for drawing risk against the gate's thresholds on a 0..1 bar. */
export function gateBar(g: GateInfo): { risk: number; allow: number; block: number } {
  const pct = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 10;
  return { risk: pct(g.risk), allow: pct(g.allowBelow), block: pct(g.blockAbove) };
}

export function traceTotals(trace: Trace | null | undefined): { calls: number; tokensIn: number; tokensOut: number; costUsd: number } {
  const calls = (trace?.events ?? []).filter((e): e is ModelCall => e.kind === "model_call");
  return {
    calls: calls.length,
    tokensIn: calls.reduce((s, c) => s + (c.tokensIn || 0), 0),
    tokensOut: calls.reduce((s, c) => s + (c.tokensOut || 0), 0),
    costUsd: calls.reduce((s, c) => s + (c.costUsd || 0), 0),
  };
}
