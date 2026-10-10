"use client";
// Evidence grid (PRD J0, the coverage shot): one row per tested case across every dataset,
// read from GET /api/console/evidence. Real results only.
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { ConsoleApi, EvidenceRow } from "../types";
import { executeCase } from "../executions/ExecutionsView";
import { fmtCost, fmtDuration } from "../executions/logic";
import { useConsoleNav } from "../executions/nav";
import { Badge, Button, GateBadge, PassBadge, SearchInput, Select, cx, getJson } from "../executions/ui";
import {
  EMPTY_FILTER, distinct, filterRows, fmtPct, groupByDataset, nextSort, sortRows, totalsOf,
  type EvidenceFilter, type PassFilter, type SortDir, type SortKey, type Totals,
} from "./logic";

type Resp = ConsoleApi["GET /api/console/evidence"];

const COLS: { key: SortKey; label: string; width: string; align?: "right" | "center" }[] = [
  { key: "caseId", label: "Case", width: "w-[19%]" },
  { key: "dataset", label: "Dataset", width: "w-[9%]" },
  { key: "decision", label: "Decision", width: "w-[11%]" },
  { key: "nextAction", label: "Next action", width: "w-auto" },
  { key: "gate", label: "Gate", width: "w-[7%]", align: "center" },
  { key: "pass", label: "Eval", width: "w-[6%]", align: "center" },
  { key: "score", label: "Score", width: "w-[6%]", align: "right" },
  { key: "costUsd", label: "Cost", width: "w-[7%]", align: "right" },
  { key: "durationMs", label: "Time", width: "w-[7%]", align: "right" },
];

function Item({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 px-4 first:pl-0">
      <div className="text-[10px] uppercase tracking-wide text-white/40">{label}</div>
      <div className="font-mono text-xl font-semibold tabular-nums text-white">
        {value}
        {sub && <span className="ml-1 text-xs font-normal text-white/35">{sub}</span>}
      </div>
    </div>
  );
}

function TotalsBar({ t, all, filtered }: { t: Totals; all: Resp["totals"] | null; filtered: boolean }) {
  return (
    <div className="flex flex-wrap items-end divide-x divide-white/10">
      <Item label="Cases" value={String(t.cases)} sub={filtered && all ? `of ${all.cases}` : undefined} />
      <Item label="Evaluated" value={String(t.evaluated)} />
      <Item label="Passed" value={String(t.passed)} />
      <div className="min-w-[160px] px-4">
        <div className="text-[10px] uppercase tracking-wide text-white/40">Pass rate</div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xl font-semibold tabular-nums text-white">{fmtPct(t.passRate)}</span>
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
            <span className="block h-full rounded-full bg-[#3ecf8e]" style={{ width: `${(t.passRate ?? 0) * 100}%` }} />
          </span>
        </div>
      </div>
      <Item label="Total cost" value={fmtCost(t.costUsd)} />
    </div>
  );
}

function EmptyState({ error }: { error: string | null }) {
  return (
    <div className="mx-auto mt-16 max-w-lg rounded-xl bg-[#2a2a30] p-6 text-sm text-white/70 ring-1 ring-white/10">
      <h3 className="text-base font-semibold text-white">No evidence yet</h3>
      <p className="mt-2 leading-relaxed">
        The grid shows only real runner outputs and eval results. To fill it, from the repo root:
      </p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[13px]">
        <li>
          <code className="rounded bg-black/30 px-1.5 py-0.5 text-[#ffb68a]">npm run answer</code> runs the agent over the cases and writes
          trace.json, ANSWER.md and REASONING.md per case.
        </li>
        <li>
          <code className="rounded bg-black/30 px-1.5 py-0.5 text-[#ffb68a]">npm run eval</code> scores them (pass/fail, score) into{" "}
          <code className="text-white/80">runs/</code>.
        </li>
        <li>Then refresh this tab (the console imports ANSWERS/, runs/ and examples/).</li>
      </ol>
      {error && <p className="mt-4 rounded bg-[#ff5c5c]/10 p-2 text-xs text-[#ff5c5c]">{error}</p>}
    </div>
  );
}

export default function EvidenceGrid() {
  const { go } = useConsoleNav();
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<EvidenceFilter>(EMPTY_FILTER);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "caseId", dir: "asc" });
  const [grouped, setGrouped] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [executing, setExecuting] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    getJson<Resp>("/api/console/evidence").then(
      (d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      },
      (err: Error) => {
        if (alive) setError(err.message);
      },
    );
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const all = useMemo(() => data?.rows ?? [], [data]);
  const visible = useMemo(() => sortRows(filterRows(all, filter), sort.key, sort.dir), [all, filter, sort]);
  const totals = useMemo(() => totalsOf(visible), [visible]);
  const groups = useMemo(() => (grouped ? groupByDataset(visible) : null), [grouped, visible]);
  const datasets = useMemo(() => distinct(all, "dataset"), [all]);
  const gates = useMemo(() => distinct(all, "gate"), [all]);
  const isFiltered = filter.q !== "" || filter.dataset !== "all" || filter.pass !== "all" || filter.gate !== "all";

  const execute = async (r: EvidenceRow) => {
    const key = `${r.dataset}/${r.caseId}`;
    setExecuting(key);
    setError(null);
    try {
      const ex = await executeCase({ caseId: r.caseId, dataset: r.dataset });
      go("executions", { id: ex.id });
    } catch (err) {
      setError((err as Error).message);
      setExecuting(null);
    }
  };

  const open = (r: EvidenceRow) => {
    if (r.executionId) go("executions", { id: r.executionId });
  };

  const renderRow = (r: EvidenceRow) => {
    const key = `${r.dataset}/${r.caseId}`;
    return (
      <tr
        key={key}
        tabIndex={r.executionId ? 0 : -1}
        onClick={() => open(r)}
        onKeyDown={(e) => {
          if (e.key === "Enter") open(r);
        }}
        className={cx(
          "group border-b border-white/[0.04] text-xs",
          r.executionId ? "cursor-pointer hover:bg-white/[0.05] focus:bg-white/[0.06] focus:outline-none" : "text-white/60",
        )}
      >
        <td className="truncate px-3 py-1.5" title={r.title ?? r.caseId}>
          <span className="font-medium text-white/90">{r.caseId}</span>
          {r.title && <span className="ml-2 text-white/40">{r.title}</span>}
        </td>
        <td className="truncate px-3 py-1.5 text-white/55">{r.dataset}</td>
        <td className="truncate px-3 py-1.5 text-white/80">{r.decision ? r.decision.replaceAll("_", " ") : <span className="text-white/30">–</span>}</td>
        <td className="truncate px-3 py-1.5 text-white/65" title={r.nextAction ?? undefined}>
          {r.nextAction ?? <span className="text-white/30">–</span>}
        </td>
        <td className="px-3 py-1.5 text-center">
          <GateBadge gate={r.gate} />
        </td>
        <td className="px-3 py-1.5 text-center">
          <PassBadge pass={r.pass} />
        </td>
        <td className="px-3 py-1.5 text-right font-mono tabular-nums text-white/75">{r.score === null ? "–" : r.score.toFixed(2)}</td>
        <td className="px-3 py-1.5 text-right font-mono tabular-nums text-white/75">{fmtCost(r.costUsd)}</td>
        <td className="px-3 py-1.5 text-right font-mono tabular-nums text-white/75">{fmtDuration(r.durationMs)}</td>
        <td className="px-2 py-1 text-right">
          {r.executionId ? (
            <span className="text-[11px] text-white/25 group-hover:text-[#ff6a1a]">Open →</span>
          ) : (
            <Button
              className="!px-2 !py-0.5 text-[11px]"
              disabled={executing !== null}
              onClick={() => void execute(r)}
              title="No execution recorded for this case. Run it now."
            >
              {executing === key ? "Starting…" : "▶ Execute"}
            </Button>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#1f1f23] text-white">
      <div className="shrink-0 space-y-3 border-b border-white/10 px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div>
            <h2 className="text-sm font-semibold">Evidence</h2>
            <p className="text-[11px] text-white/40">Every tested case, every dataset. Real runner and eval output only.</p>
          </div>
          <div className="ml-auto">
            <TotalsBar t={totals} all={data?.totals ?? null} filtered={isFiltered} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-64">
            <SearchInput value={filter.q} onChange={(q) => setFilter((f) => ({ ...f, q }))} placeholder="Search case, decision, recipient…" />
          </div>
          <Select
            label="Dataset"
            value={filter.dataset}
            onChange={(dataset) => setFilter((f) => ({ ...f, dataset }))}
            options={[{ value: "all", label: "All datasets" }, ...datasets.map((d) => ({ value: d, label: d }))]}
          />
          <Select<PassFilter>
            label="Eval"
            value={filter.pass}
            onChange={(pass) => setFilter((f) => ({ ...f, pass }))}
            options={[
              { value: "all", label: "All results" },
              { value: "pass", label: "Passed" },
              { value: "fail", label: "Failed" },
              { value: "unevaluated", label: "Not evaluated" },
            ]}
          />
          <Select
            label="Gate"
            value={filter.gate}
            onChange={(gate) => setFilter((f) => ({ ...f, gate }))}
            options={[{ value: "all", label: "All gates" }, ...gates.map((g) => ({ value: g, label: g }))]}
          />
          <label className="ml-1 inline-flex cursor-pointer select-none items-center gap-1.5 text-xs text-white/70">
            <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} className="accent-[#ff6a1a]" />
            Group by dataset
          </label>
          {isFiltered && (
            <Button className="!px-2 !py-1" onClick={() => setFilter(EMPTY_FILTER)}>
              Clear
            </Button>
          )}
          <Button className="ml-auto !px-2 !py-1" onClick={load} title="Reload">
            ↻ Refresh
          </Button>
        </div>
        {error && data && <p className="rounded bg-[#ff5c5c]/10 px-2 py-1 text-[11px] text-[#ff5c5c]">{error}</p>}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {data === null && !error ? (
          <p className="p-6 text-xs text-white/40">Loading…</p>
        ) : all.length === 0 ? (
          <EmptyState error={error} />
        ) : (
          <table className="w-full min-w-[980px] table-fixed border-collapse">
            <thead className="sticky top-0 z-10 bg-[#26262b] shadow-[0_1px_0_rgba(255,255,255,0.08)]">
              <tr>
                {COLS.map((c) => {
                  const active = sort.key === c.key;
                  return (
                    <th
                      key={c.key}
                      className={cx(c.width, "px-3 py-2 text-[10px] font-semibold uppercase tracking-wide", c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left")}
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                    >
                      <button
                        type="button"
                        onClick={() => setSort((s) => nextSort(s, c.key))}
                        className={cx("inline-flex items-center gap-1 uppercase", active ? "text-[#ff6a1a]" : "text-white/45 hover:text-white/80")}
                      >
                        {c.label}
                        <span className="w-2 text-[9px]">{active ? (sort.dir === "asc" ? "▲" : "▼") : ""}</span>
                      </button>
                    </th>
                  );
                })}
                <th className="w-[92px]" />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={COLS.length + 1} className="p-6 text-center text-xs text-white/40">
                    No cases match these filters.
                  </td>
                </tr>
              ) : groups ? (
                groups.map((g) => {
                  const isCollapsed = collapsed.has(g.dataset);
                  return (
                    <Fragment key={g.dataset}>
                      <tr
                        className="cursor-pointer border-b border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                        onClick={() =>
                          setCollapsed((s) => {
                            const n = new Set(s);
                            if (n.has(g.dataset)) n.delete(g.dataset);
                            else n.add(g.dataset);
                            return n;
                          })
                        }
                      >
                        <td colSpan={COLS.length + 1} className="px-3 py-1.5 text-xs">
                          <span className="mr-2 inline-block w-3 text-white/40">{isCollapsed ? "▸" : "▾"}</span>
                          <span className="font-semibold text-white">{g.dataset}</span>
                          <span className="ml-3 font-mono tabular-nums text-white/45">
                            {g.totals.cases} cases · {g.totals.evaluated} evaluated · {g.totals.passed} passed ·{" "}
                            {fmtCost(g.totals.costUsd)}
                          </span>
                          {g.totals.evaluated > 0 && (
                            <span className="ml-3">
                              <Badge tone={g.totals.passed === g.totals.evaluated ? "ok" : "warn"}>{fmtPct(g.totals.passRate)} pass</Badge>
                            </span>
                          )}
                        </td>
                      </tr>
                      {!isCollapsed && g.rows.map(renderRow)}
                    </Fragment>
                  );
                })
              ) : (
                visible.map(renderRow)
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
