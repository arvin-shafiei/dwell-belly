// Reads and writes console records in SQLite.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ExecutionRecord, Flow, Trace, WorkflowRecord } from "../types";
import { getDb, repoRoot, type SqlValue } from "./db";
import { layeredLayout } from "./mapping";

/** ExecutionRecord plus the server-side extras (requested as contract additions). */
export type StoredExecution = ExecutionRecord & { error: string | null; title: string | null; nextAction: string | null; gate: string | null };
export type ExecutionListItem = Omit<StoredExecution, "trace" | "answerMd" | "reasoningMd">;

type Row = Record<string, SqlValue>;
const str = (v: SqlValue | undefined) => (v === null || v === undefined ? null : String(v));
const num = (v: SqlValue | undefined) => (v === null || v === undefined ? null : Number(v));

function parseJson<T>(v: SqlValue | undefined): T | null {
  if (v === null || v === undefined) return null;
  try {
    return JSON.parse(String(v)) as T;
  } catch {
    return null;
  }
}

function toListItem(r: Row): ExecutionListItem {
  return {
    id: String(r.id),
    caseId: String(r.case_id),
    dataset: String(r.dataset),
    workflowId: String(r.workflow_id),
    status: String(r.status) as ExecutionRecord["status"],
    outcome: str(r.outcome),
    startedAt: String(r.started_at),
    durationMs: num(r.duration_ms),
    costUsd: num(r.cost_usd),
    origin: String(r.origin) as ExecutionRecord["origin"],
    simulated: Number(r.simulated) === 1,
    eval: r.eval_pass === null || r.eval_score === null
      ? null
      : { pass: Number(r.eval_pass) === 1, score: Number(r.eval_score), ...(r.eval_notes !== null ? { notes: String(r.eval_notes) } : {}) },
    error: str(r.error),
    title: str(r.title),
    nextAction: str(r.next_action),
    gate: str(r.gate),
  };
}

function toRecord(r: Row): StoredExecution {
  return { ...toListItem(r), trace: parseJson<Trace>(r.trace), answerMd: str(r.answer_md), reasoningMd: str(r.reasoning_md) };
}

const LIST_COLUMNS = `id, case_id, dataset, workflow_id, status, outcome, started_at, duration_ms, cost_usd, origin, simulated,
  title, next_action, gate, error, eval_pass, eval_score, eval_notes`;

export function listExecutions(opts: { limit?: number; dataset?: string | null } = {}): ExecutionListItem[] {
  const limit = Math.max(1, Math.min(5000, opts.limit ?? 200));
  const db = getDb();
  const rows = opts.dataset
    ? db.prepare(`SELECT ${LIST_COLUMNS} FROM executions WHERE dataset = ? ORDER BY started_at DESC LIMIT ?`).all(opts.dataset, limit)
    : db.prepare(`SELECT ${LIST_COLUMNS} FROM executions ORDER BY started_at DESC LIMIT ?`).all(limit);
  return rows.map(toListItem);
}

/** Every execution (list fields only), for the evidence join. */
export function allExecutions(): ExecutionListItem[] {
  return getDb().prepare(`SELECT ${LIST_COLUMNS} FROM executions ORDER BY started_at DESC`).all().map(toListItem);
}

export function getExecution(id: string): StoredExecution | null {
  const row = getDb().prepare("SELECT * FROM executions WHERE id = ?").get(id);
  return row ? toRecord(row) : null;
}

export interface ExecutionWrite {
  id: string;
  sourceKey: string | null;
  caseId: string;
  dataset: string;
  workflowId: string;
  status: ExecutionRecord["status"];
  outcome: string | null;
  startedAt: string;
  durationMs: number | null;
  costUsd: number | null;
  origin: ExecutionRecord["origin"];
  simulated: boolean;
  title: string | null;
  nextAction: string | null;
  gate: string | null;
  error: string | null;
  trace: Trace | null;
  answerMd: string | null;
  reasoningMd: string | null;
  eval: { pass: boolean; score: number; notes?: string } | null;
}

/** Insert, or replace the row with the same id or the same source_key (idempotent import). */
export function upsertExecution(e: ExecutionWrite) {
  const db = getDb();
  const params: SqlValue[] = [
    e.id, e.sourceKey, e.caseId, e.dataset, e.workflowId, e.status, e.outcome, e.startedAt, e.durationMs, e.costUsd,
    e.origin, e.simulated ? 1 : 0, e.title, e.nextAction, e.gate, e.error,
    e.trace ? JSON.stringify(e.trace) : null, e.answerMd, e.reasoningMd,
    e.eval ? (e.eval.pass ? 1 : 0) : null, e.eval ? e.eval.score : null, e.eval?.notes ?? null,
  ];
  const cols = `id, source_key, case_id, dataset, workflow_id, status, outcome, started_at, duration_ms, cost_usd,
    origin, simulated, title, next_action, gate, error, trace, answer_md, reasoning_md, eval_pass, eval_score, eval_notes`;
  const conflictCol = e.sourceKey ? "source_key" : "id";
  db.prepare(`INSERT INTO executions (${cols}) VALUES (${params.map(() => "?").join(", ")})
    ON CONFLICT(${conflictCol}) DO UPDATE SET
      case_id = excluded.case_id, dataset = excluded.dataset, workflow_id = excluded.workflow_id,
      status = excluded.status, outcome = excluded.outcome, started_at = excluded.started_at,
      duration_ms = excluded.duration_ms, cost_usd = excluded.cost_usd, origin = excluded.origin,
      simulated = excluded.simulated, title = excluded.title, next_action = excluded.next_action,
      gate = excluded.gate, error = excluded.error, trace = excluded.trace, answer_md = excluded.answer_md,
      reasoning_md = excluded.reasoning_md, eval_pass = excluded.eval_pass, eval_score = excluded.eval_score,
      eval_notes = excluded.eval_notes`).run(...params);
}

export function counts(): Record<string, number> {
  const db = getDb();
  const one = (sql: string) => Number(db.prepare(sql).get()?.n ?? 0);
  const out: Record<string, number> = {
    workflows: one("SELECT COUNT(*) AS n FROM workflows"),
    executions: one("SELECT COUNT(*) AS n FROM executions"),
    running: one("SELECT COUNT(*) AS n FROM executions WHERE status = 'running'"),
    errors: one("SELECT COUNT(*) AS n FROM executions WHERE status = 'error'"),
    evaluated: one("SELECT COUNT(*) AS n FROM executions WHERE eval_pass IS NOT NULL"),
  };
  for (const r of db.prepare("SELECT origin, COUNT(*) AS n FROM executions GROUP BY origin").all()) out[`origin_${r.origin}`] = Number(r.n);
  return out;
}

// ---------- workflows ----------

function toWorkflow(r: Row): WorkflowRecord {
  const flow = parseJson<Flow>(r.flow) ?? { id: String(r.id), name: String(r.name), business: "", nodes: [], edges: [] };
  const saved = parseJson<WorkflowRecord["positions"]>(r.positions) ?? {};
  return {
    id: String(r.id),
    name: String(r.name),
    flow,
    positions: Object.keys(saved).length ? saved : layeredLayout(flow),
    active: Number(r.active) === 1,
    updatedAt: String(r.updated_at),
    source: String(r.source) as WorkflowRecord["source"],
  };
}

/** Loads apps/api/flows/*.json into the table. Rows the editor saved (source "db") are left alone. */
export async function seedWorkflows() {
  const dir = path.join(repoRoot(), "apps", "api", "flows");
  const db = getDb();
  for (const name of (await readdir(dir).catch(() => [] as string[])).filter((n) => n.endsWith(".json")).sort()) {
    let flow: Flow;
    try {
      flow = JSON.parse(await readFile(path.join(dir, name), "utf8")) as Flow;
    } catch {
      continue;
    }
    const id = flow.id ?? name.replace(/\.json$/, "");
    const existing = db.prepare("SELECT source, flow FROM workflows WHERE id = ?").get(id);
    if (existing?.source === "db") continue;
    const text = JSON.stringify(flow);
    if (existing && existing.flow === text) continue;
    db.prepare(`INSERT INTO workflows (id, name, flow, positions, active, updated_at, source) VALUES (?, ?, ?, '{}', ?, ?, 'file')
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, flow = excluded.flow, updated_at = excluded.updated_at`)
      .run(id, flow.name ?? id, text, id === "default-incident" ? 1 : 0, new Date().toISOString());
  }
}

export async function listWorkflows(): Promise<WorkflowRecord[]> {
  await seedWorkflows();
  return getDb().prepare("SELECT * FROM workflows ORDER BY active DESC, name").all().map(toWorkflow);
}

export function getWorkflow(id: string): WorkflowRecord | null {
  const row = getDb().prepare("SELECT * FROM workflows WHERE id = ?").get(id);
  return row ? toWorkflow(row) : null;
}

/** Saves an edited workflow to SQLite (never to apps/api/flows). */
export function saveWorkflow(id: string, w: Pick<WorkflowRecord, "name" | "flow" | "positions" | "active">): WorkflowRecord {
  getDb().prepare(`INSERT INTO workflows (id, name, flow, positions, active, updated_at, source) VALUES (?, ?, ?, ?, ?, ?, 'db')
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, flow = excluded.flow, positions = excluded.positions,
      active = excluded.active, updated_at = excluded.updated_at, source = 'db'`)
    .run(id, w.name, JSON.stringify(w.flow), JSON.stringify(w.positions ?? {}), w.active ? 1 : 0, new Date().toISOString());
  return getWorkflow(id)!;
}
