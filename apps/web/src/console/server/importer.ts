// Imports runner outputs from disk into SQLite. Idempotent: each file (or eval row) has a stable
// source key, so a rescan updates rows in place.
//   ANSWERS/**/trace.json (+ ANSWER.md, REASONING.md, result.json)   origin "answers"
//   examples/practice-run/**/trace.json (+ siblings)                origin "examples"
//   runs/**/*.json: eval outputs (scripts/eval/run-eval.mjs) and traces   origin "runs"
import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { ExecutionRecord } from "../types";
import { listCases } from "./catalogue";
import { repoRoot, setSetting } from "./db";
import { evalRowSummary, isEvalFile, isoFromEvalFilename, isTrace, resultJsonVerdict, summariseTrace } from "./mapping";
import { upsertExecution } from "./store";

async function walk(dir: string, match: (name: string) => boolean): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(full, match));
    else if (e.isFile() && match(e.name)) out.push(full);
  }
  return out.sort();
}

const readText = (file: string) => readFile(file, "utf8").catch(() => null);
async function readJson(file: string): Promise<unknown> {
  const t = await readText(file);
  if (t === null) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}
const idFor = (key: string) => `imp-${createHash("sha1").update(key).digest("hex").slice(0, 16)}`;
const mtimeIso = async (file: string) => (await stat(file)).mtime.toISOString();

type DatasetOf = (caseId: string) => string | null;

async function importTraceFile(
  file: string, root: string, origin: ExecutionRecord["origin"], datasetOf: DatasetOf, fallbackDataset: string,
): Promise<boolean> {
  const trace = await readJson(file);
  if (!isTrace(trace)) return false;
  const s = summariseTrace(trace);
  const dir = path.dirname(file);
  const isFolderTrace = path.basename(file) === "trace.json";
  const caseId = isFolderTrace ? path.basename(dir) : (s.caseId ?? path.basename(file, ".json"));
  const [answerMd, reasoningMd, result] = isFolderTrace
    ? await Promise.all([readText(path.join(dir, "ANSWER.md")), readText(path.join(dir, "REASONING.md")), readJson(path.join(dir, "result.json"))])
    : [null, null, null];
  const key = `${origin}:${path.relative(root, file)}`;
  upsertExecution({
    id: idFor(key),
    sourceKey: key,
    caseId,
    dataset: datasetOf(caseId) ?? (s.caseId ? datasetOf(s.caseId) : null) ?? fallbackDataset,
    workflowId: s.workflowId ?? "default-incident",
    status: s.status,
    outcome: s.outcome,
    startedAt: s.startedAt ?? await mtimeIso(file),
    durationMs: s.durationMs,
    costUsd: s.costUsd,
    origin,
    simulated: s.simulated,
    title: s.title,
    nextAction: s.nextAction,
    gate: s.gate,
    error: s.error,
    trace,
    answerMd,
    reasoningMd,
    eval: resultJsonVerdict(result),
  });
  return true;
}

async function importEvalFile(file: string, root: string, datasetOf: DatasetOf): Promise<number> {
  const data = await readJson(file);
  if (!isEvalFile(data)) return 0;
  const startedAt = isoFromEvalFilename(path.basename(file)) ?? await mtimeIso(file);
  const rel = path.relative(root, file);
  let n = 0;
  for (const row of data.rows) {
    const s = evalRowSummary(row);
    const key = `runs:${rel}#${row.id}`;
    upsertExecution({
      id: idFor(key),
      sourceKey: key,
      caseId: row.id,
      // The eval's own set is "public" or "generated"; the catalogue also tells grounded and fixtures apart.
      dataset: datasetOf(row.id) ?? s.set ?? "adhoc",
      workflowId: "default-incident",
      status: s.status,
      outcome: s.outcome,
      startedAt,
      durationMs: null,
      costUsd: null,
      origin: "runs",
      simulated: false,
      title: null,
      nextAction: s.nextAction,
      gate: null,
      error: s.error,
      trace: null,
      answerMd: null,
      reasoningMd: null,
      eval: s.eval,
    });
    n++;
  }
  return n;
}

/** Rescans ANSWERS/, runs/ and examples/practice-run/. Returns how many executions were written. */
export async function importAll(): Promise<number> {
  const root = repoRoot();
  const known = new Map((await listCases()).map((c) => [c.id, c.dataset]));
  const datasetOf: DatasetOf = (id) => known.get(id) ?? known.get(`delivery-${id}`) ?? null;
  let n = 0;

  for (const f of await walk(path.join(root, "ANSWERS"), (name) => name === "trace.json")) {
    if (await importTraceFile(f, root, "answers", datasetOf, "reality")) n++;
  }
  // Practice-run folders are exported public cases (examples/practice-run/README.md).
  for (const f of await walk(path.join(root, "examples", "practice-run"), (name) => name === "trace.json")) {
    if (await importTraceFile(f, root, "examples", datasetOf, "public")) n++;
  }
  for (const f of await walk(path.join(root, "runs"), (name) => name.endsWith(".json"))) {
    const evalRows = await importEvalFile(f, root, datasetOf);
    if (evalRows) n += evalRows;
    else if (await importTraceFile(f, root, "runs", datasetOf, "adhoc")) n++;
  }
  setSetting("last_import", new Date().toISOString());
  return n;
}

const g = globalThis as unknown as { __consoleImport?: Promise<number> };

/** Runs the import once per server process, the first time any GET needs executions. */
export function ensureImported(): Promise<number> {
  g.__consoleImport ??= importAll().catch((err) => {
    g.__consoleImport = undefined;
    throw err;
  });
  return g.__consoleImport;
}
