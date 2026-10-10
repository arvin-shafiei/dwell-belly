"use client";
// n8n-style executions view: filterable list on the left, the selected execution on the right.
// Polls every 3 s while anything is running.
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ConsoleApi, ExecutionRecord } from "../types";
import ExecutionDetail from "./ExecutionDetail";
import {
  anyRunning, datasetsOf, filterExecutions, fmtCost, fmtDuration, fmtStarted, sortExecutions,
  type ExecFilter, type ExecutionSummary,
} from "./logic";
import { useConsoleNav } from "./nav";
import { Badge, Button, SearchInput, Select, SimulatedBadge, StatusDot, cx, getJson } from "./ui";

const POLL_MS = 3000;

type ListResp = ConsoleApi["GET /api/console/executions?limit&dataset"];
type DetailResp = ConsoleApi["GET /api/console/executions/:id"];
type ExecResp = ConsoleApi["POST /api/console/execute"];

export async function executeCase(body: { caseId: string; dataset?: string; workflowId?: string }): Promise<ExecutionRecord> {
  const r = await getJson<ExecResp>("/api/console/execute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.execution;
}

function Row({ e, selected, onClick }: { e: ExecutionSummary; selected: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cx(
          "group w-full border-l-2 px-3 py-2 text-left transition-colors",
          selected ? "border-[#ff6a1a] bg-white/[0.07]" : "border-transparent hover:bg-white/[0.04]",
        )}
      >
        <div className="flex items-center gap-2">
          <StatusDot status={e.status} />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white/90">{e.caseId}</span>
          {e.simulated && <SimulatedBadge />}
          {e.eval && <Badge tone={e.eval.pass ? "ok" : "err"}>{e.eval.pass ? "pass" : "fail"}</Badge>}
        </div>
        <div className="mt-1 flex items-center gap-2 pl-4 text-[11px] text-white/45">
          <span className="truncate">{e.dataset}</span>
          <span className="text-white/20">·</span>
          <span className={cx("truncate", e.status === "error" && "text-[#ff5c5c]/80")}>
            {e.status === "running" ? "running…" : (e.outcome ?? e.status).replaceAll("_", " ")}
          </span>
          <span className="ml-auto flex shrink-0 gap-2 font-mono tabular-nums">
            <span>{fmtDuration(e.durationMs)}</span>
            <span>{fmtCost(e.costUsd)}</span>
          </span>
        </div>
        <div className="mt-0.5 pl-4 font-mono text-[10px] tabular-nums text-white/30" title={e.startedAt}>
          {fmtStarted(e.startedAt)}
        </div>
      </button>
    </li>
  );
}

export default function ExecutionsView() {
  const { params, go } = useConsoleNav();
  const selectedId = params?.get("id") ?? null;

  const [list, setList] = useState<ExecutionSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ExecFilter>({ status: "all", dataset: "all", q: "" });
  const [detail, setDetail] = useState<{ id: string; data: ExecutionRecord | null; error: string | null } | null>(null);
  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    try {
      const r = await getJson<ListResp>("/api/console/executions?limit=500");
      setList(r.executions);
      setListError(null);
    } catch (err) {
      setListError((err as Error).message);
      setList((l) => l ?? []);
    }
  }, []);

  const rows = useMemo(() => sortExecutions(filterExecutions(list ?? [], filter)), [list, filter]);
  const datasets = useMemo(() => datasetsOf(list ?? []), [list]);
  const activeId = selectedId ?? rows[0]?.id ?? null;

  const loadDetail = useCallback(async (id: string) => {
    try {
      const r = await getJson<DetailResp>(`/api/console/executions/${encodeURIComponent(id)}`);
      setDetail({ id, data: r.execution, error: null });
    } catch (err) {
      setDetail((d) => ({ id, data: d?.id === id ? d.data : null, error: (err as Error).message }));
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (activeId) void loadDetail(activeId);
  }, [activeId, loadDetail]);

  const current = detail && detail.id === activeId ? detail : null;
  const listRunning = anyRunning(list ?? []);
  const detailRunning = current?.data?.status === "running";

  useEffect(() => {
    if (!listRunning && !detailRunning) return;
    const t = setInterval(() => {
      void loadList();
      if (activeId) void loadDetail(activeId);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [listRunning, detailRunning, activeId, loadList, loadDetail]);

  const rerun = async (e: ExecutionRecord) => {
    setRerunning(true);
    setRerunError(null);
    try {
      const ex = await executeCase({ caseId: e.caseId, dataset: e.dataset, workflowId: e.workflowId });
      setDetail({ id: ex.id, data: ex, error: null });
      go("executions", { id: ex.id });
      void loadList();
    } catch (err) {
      setRerunError((err as Error).message);
    } finally {
      setRerunning(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full bg-[#1f1f23] text-white">
      <aside className="flex w-[340px] shrink-0 flex-col border-r border-white/10 xl:w-[380px]">
        <div className="shrink-0 space-y-2 border-b border-white/10 p-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Executions</h2>
            <span className="font-mono text-[11px] tabular-nums text-white/40">
              {list ? `${rows.length}${rows.length !== list.length ? ` / ${list.length}` : ""}` : ""}
            </span>
            {listRunning && (
              <span className="flex items-center gap-1 text-[10px] text-[#ff6a1a]">
                <StatusDot status="running" size={6} /> live
              </span>
            )}
            <Button className="ml-auto !px-2 !py-1" onClick={() => void loadList()} title="Refresh">
              ↻
            </Button>
          </div>
          <SearchInput value={filter.q ?? ""} onChange={(q) => setFilter((f) => ({ ...f, q }))} placeholder="Search case id or outcome" />
          <div className="flex gap-2">
            <Select
              label="Status"
              value={filter.status}
              onChange={(status) => setFilter((f) => ({ ...f, status }))}
              options={[
                { value: "all", label: "All statuses" },
                { value: "running", label: "Running" },
                { value: "success", label: "Success" },
                { value: "error", label: "Error" },
              ]}
            />
            <Select
              label="Dataset"
              value={filter.dataset}
              onChange={(dataset) => setFilter((f) => ({ ...f, dataset }))}
              options={[{ value: "all", label: "All datasets" }, ...datasets.map((d) => ({ value: d, label: d }))]}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {listError && <p className="m-3 rounded bg-[#ff5c5c]/10 p-2 text-[11px] text-[#ff5c5c]">Could not load executions. {listError}</p>}
          {list === null ? (
            <p className="p-4 text-xs text-white/40">Loading…</p>
          ) : rows.length === 0 ? (
            <div className="p-4 text-xs leading-relaxed text-white/45">
              {list.length === 0 ? (
                <>
                  No executions yet. Run cases with <code className="text-[#ffb68a]">npm run answer</code>, then import them, or
                  press Execute on a case in the Evidence tab.
                </>
              ) : (
                "No executions match these filters."
              )}
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {rows.map((e) => (
                <Row key={e.id} e={e} selected={e.id === activeId} onClick={() => go("executions", { id: e.id }, true)} />
              ))}
            </ul>
          )}
        </div>
      </aside>
      <section className="min-w-0 flex-1">
        <ExecutionDetail
          execution={current?.data ?? null}
          loading={!!activeId && !current}
          error={rerunError ?? current?.error ?? null}
          onRerun={rerun}
          rerunning={rerunning}
        />
      </section>
    </div>
  );
}
