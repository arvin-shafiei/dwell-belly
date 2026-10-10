// "Execute" in the console: builds the case view the eval would send, POSTs it to the agent API
// (apps/api POST /api/cases), and records the run. A "running" row is written first.
import { randomUUID } from "node:crypto";
import { buildView } from "./catalogue";
import { summariseTrace, isTrace } from "./mapping";
import { getExecution, getWorkflow, upsertExecution, type ExecutionWrite, type StoredExecution } from "./store";

export const RUN_TIMEOUT_MS = 5 * 60_000;

export function agentUrl(): string {
  return (process.env.AGENT_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
}

export class ExecuteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function execute(input: { caseId: string; dataset?: string | null; workflowId?: string | null }): Promise<StoredExecution> {
  const built = await buildView(input.caseId, input.dataset);
  if (!built) {
    throw new ExecuteError(`Unknown case "${input.caseId}"${input.dataset ? ` in dataset "${input.dataset}"` : ""}`, 404);
  }
  const startedAt = new Date();
  const base: ExecutionWrite = {
    id: randomUUID(),
    sourceKey: null,
    caseId: built.entry.id,
    dataset: built.entry.dataset,
    workflowId: input.workflowId || "default-incident",
    status: "running",
    outcome: null,
    startedAt: startedAt.toISOString(),
    durationMs: null,
    costUsd: null,
    origin: "console",
    simulated: false,
    title: built.entry.title,
    nextAction: null,
    gate: null,
    error: null,
    trace: null,
    answerMd: null,
    reasoningMd: null,
    eval: null,
  };
  upsertExecution(base);

  const saved = getWorkflow(base.workflowId);
  const edited = saved?.source === "db" ? saved : null;

  try {
    const res = await fetch(`${agentUrl()}/api/cases`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // A workflow edited in the console runs as edited: the agent API validates the flow and
      // refuses an unsound one. An untouched workflow is left to the API's own flow file.
      body: JSON.stringify(edited ? { ...built.view, flow: edited.flow } : built.view),
      signal: AbortSignal.timeout(RUN_TIMEOUT_MS),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`agent API answered ${res.status}: ${text.slice(0, 500)}`);
    const body = JSON.parse(text) as { trace?: unknown; outcome?: string };
    const trace = body.trace ?? body;
    if (!isTrace(trace)) throw new Error("agent API response has no trace");
    const s = summariseTrace(trace);
    upsertExecution({
      ...base,
      status: s.status,
      outcome: s.outcome ?? body.outcome ?? null,
      durationMs: s.durationMs ?? Date.now() - startedAt.getTime(),
      costUsd: s.costUsd,
      simulated: s.simulated,
      title: s.title ?? base.title,
      nextAction: s.nextAction,
      gate: s.gate,
      error: s.error,
      trace,
    });
  } catch (err) {
    const c = err instanceof Error ? (err.cause as { message?: string; code?: string } | undefined) : undefined;
    const cause = c?.message || c?.code ? ` (${c.message || c.code})` : "";
    const message = err instanceof Error
      ? (err.name === "TimeoutError" ? `agent API did not answer within ${RUN_TIMEOUT_MS / 1000} s` : `${err.message}${cause}`)
      : String(err);
    upsertExecution({ ...base, status: "error", durationMs: Date.now() - startedAt.getTime(), error: message });
  }
  return getExecution(base.id)!;
}

export async function agentHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${agentUrl()}/api/health`, { signal: AbortSignal.timeout(2000), cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
