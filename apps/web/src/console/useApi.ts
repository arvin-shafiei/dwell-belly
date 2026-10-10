"use client";
// Tiny fetch hooks for the console API (contract: ./types.ts ConsoleApi). Same-origin, JSON only.
//
//   const { data, error, loading, reload, updatedAt } = useEvidence({ pollMs: 5000 });
//   const res = await consoleApi.execute({ caseId: "delivery-024" });
//
// - `loading` is true only until the first response for the current path; polling refreshes
//   in the background (stale-while-revalidate), so tables don't flash.
// - Polling slows down 4x while the tab is hidden.
// - Errors keep the last good `data` so a blip doesn't blank the screen.
import { useCallback, useEffect, useState } from "react";
import type { ConsoleApi, EvidenceRow, ExecutionRecord, WorkflowRecord } from "./types";

export type ApiResponse<K extends keyof ConsoleApi> = ConsoleApi[K];
export type ExecutionSummary = ApiResponse<"GET /api/console/executions?limit&dataset">["executions"][number];
export type EvidenceResponse = ApiResponse<"GET /api/console/evidence">;
export type StatusResponse = ApiResponse<"GET /api/console/status">;
export type CaseOption = ApiResponse<"GET /api/console/cases?dataset&q">["cases"][number];

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function describe(status: number, body: unknown, path: string): string {
  const msg =
    body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
      ? (body as { error: string }).error
      : null;
  if (msg) return msg;
  if (status === 404) return `${path} is not available yet (HTTP 404).`;
  return `${path} failed (HTTP ${status}).`;
}

async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      signal,
      cache: "no-store",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    throw new ApiError("Network error: the console server is unreachable.", 0);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    if (res.ok) throw new ApiError(`${path} returned non-JSON.`, res.status);
  }
  if (!res.ok) throw new ApiError(describe(res.status, json, path.split("?")[0]), res.status);
  return json as T;
}

export const getJson = <T>(path: string, signal?: AbortSignal) => request<T>("GET", path, undefined, signal);
export const postJson = <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {});
export const putJson = <T>(path: string, body: unknown) => request<T>("PUT", path, body);

/** Build "/path?a=1&b=2", skipping null/undefined/"" values. */
export function withQuery(path: string, q: Record<string, string | number | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== null && v !== undefined && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
}

export interface ApiState<T> {
  data: T | undefined;
  error: string | undefined;
  /** First load for the current path is in flight. */
  loading: boolean;
  /** ms epoch of the last successful response. */
  updatedAt: number | undefined;
  /** Refetch now (keeps current data while loading). */
  reload: () => void;
}

export interface UseApiOptions {
  /** Poll interval in ms. 0/undefined = fetch once. */
  pollMs?: number;
}

interface Stored<T> {
  key: string | null;
  data?: T;
  error?: string;
  updatedAt?: number;
}

/** GET `path` (null = skip). Generic hook; prefer the typed wrappers below. */
export function useApi<T>(path: string | null, { pollMs }: UseApiOptions = {}): ApiState<T> {
  const [state, setState] = useState<Stored<T>>({ key: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ctrl = new AbortController();

    const tick = async () => {
      try {
        const data = await getJson<T>(path, ctrl.signal);
        if (!cancelled) setState({ key: path, data, updatedAt: Date.now() });
      } catch (e) {
        if (cancelled || ctrl.signal.aborted) return;
        const error = e instanceof Error ? e.message : String(e);
        setState((prev) =>
          prev.key === path ? { ...prev, error } : { key: path, error },
        );
      }
      if (!cancelled && pollMs && pollMs > 0) {
        const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
        timer = setTimeout(tick, hidden ? pollMs * 4 : pollMs);
      }
    };
    void tick();

    return () => {
      cancelled = true;
      ctrl.abort();
      if (timer) clearTimeout(timer);
    };
  }, [path, pollMs, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const current = path !== null && state.key === path;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: path !== null && !current,
    updatedAt: current ? state.updatedAt : undefined,
    reload,
  };
}

// ---- Typed wrappers, one per endpoint in ConsoleApi ----

export const useStatus = (opts: UseApiOptions = { pollMs: 5000 }) =>
  useApi<StatusResponse>("/api/console/status", opts);

export const useEvidence = (opts?: UseApiOptions) => useApi<EvidenceResponse>("/api/console/evidence", opts);

export const useExecutions = (q: { limit?: number; dataset?: string | null } = {}, opts?: UseApiOptions) =>
  useApi<ApiResponse<"GET /api/console/executions?limit&dataset">>(
    withQuery("/api/console/executions", { limit: q.limit, dataset: q.dataset }),
    opts,
  );

/** id null = skip. */
export const useExecution = (id: string | null, opts?: UseApiOptions) =>
  useApi<ApiResponse<"GET /api/console/executions/:id">>(
    id ? `/api/console/executions/${encodeURIComponent(id)}` : null,
    opts,
  );

export const useWorkflows = (opts?: UseApiOptions) =>
  useApi<ApiResponse<"GET /api/console/workflows">>("/api/console/workflows", opts);

/** enabled=false skips the request (e.g. until a picker opens). */
export const useCases = (q: { dataset?: string | null; q?: string | null } = {}, enabled = true, opts?: UseApiOptions) =>
  useApi<ApiResponse<"GET /api/console/cases?dataset&q">>(
    enabled ? withQuery("/api/console/cases", { dataset: q.dataset, q: q.q }) : null,
    opts,
  );

// ---- Mutations ----

export const consoleApi = {
  execute: (body: { caseId: string; dataset?: string; workflowId?: string }) =>
    postJson<ApiResponse<"POST /api/console/execute">>("/api/console/execute", body),
  importRuns: () => postJson<ApiResponse<"POST /api/console/import">>("/api/console/import"),
  saveWorkflow: (wf: WorkflowRecord) =>
    putJson<ApiResponse<"PUT /api/console/workflows/:id">>(
      `/api/console/workflows/${encodeURIComponent(wf.id)}`,
      wf,
    ),
};

/** Wrap an async action with pending/error state: const imp = useAction(consoleApi.importRuns). */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      setPending(true);
      setError(undefined);
      try {
        return await fn(...args);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [fn],
  );
  return { run, pending, error, clearError: useCallback(() => setError(undefined), []) };
}

export type { EvidenceRow, ExecutionRecord, WorkflowRecord };
