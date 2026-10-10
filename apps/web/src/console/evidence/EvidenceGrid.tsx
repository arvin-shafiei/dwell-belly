"use client";
// "Results" (PRD J0, the coverage shot): every tested case with what we did and whether it was
// right, read from GET /api/console/evidence. Real results only. Datasets, scores, cost and
// filters are behind "Filters" / "Details".
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { cents, plainDataset, plainGate, plainOutcome, scrubLeaks } from "../../ui/plain";
import type { ConsoleApi, EvidenceRow } from "../types";
import { executeCase } from "../executions/ExecutionsView";
import { fmtDuration } from "../executions/logic";
import { useConsoleNav } from "../executions/nav";
import { caseName } from "../executions/plainView";
import { Badge, Button, SearchInput, Select, cx, getJson } from "../executions/ui";
import {
  EMPTY_FILTER, distinct, filterRows, groupByDataset, nextSort, resultNumbers, sortRows, wasRun,
  type EvidenceFilter, type PassFilter, type SortDir, type SortKey,
} from "./logic";

type Resp = ConsoleApi["GET /api/console/evidence"];

type Col = { key: SortKey; label: string; width: string; align?: "right" | "center"; detail?: boolean };
const COLS: Col[] = [
  { key: "caseId", label: "Case", width: "w-[34%]" },
  { key: "decision", label: "What we did", width: "w-auto" },
  { key: "dataset", label: "Cases", width: "w-[13%]", detail: true },
  { key: "gate", label: "Safety check", width: "w-[11%]", detail: true },
  { key: "score", label: "Score", width: "w-[7%]", align: "right", detail: true },
  { key: "costUsd", label: "Cost", width: "w-[7%]", align: "right", detail: true },
  { key: "durationMs", label: "Took", width: "w-[7%]", align: "right", detail: true },
  { key: "pass", label: "Right?", width: "w-[8%]", align: "center" },
];

function BigNumber({ n, label, color }: { n: number; label: string; color?: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-3xl font-semibold tabular-nums" style={{ color: color ?? "#fff" }}>{n}</span>{" "}
      <span className="text-lg text-white/60">{label}</span>
    </span>
  );
}

function RightMark({ pass }: { pass: boolean | null }) {
  if (pass === null) return <span className="text-white/25" title="Not checked yet">–</span>;
  return pass ? (
    <span className="text-lg font-semibold text-[#3ecf8e]" title="Right">✓</span>
  ) : (
    <span className="text-lg font-semibold text-[#ff5c5c]" title="Wrong">✗</span>
  );
}

function EmptyState({ failed }: { failed: boolean }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl bg-[#2a2a30] p-6 text-[15px] text-white/75">
      <h3 className="text-lg font-semibold text-white">No results yet</h3>
      <p className="mt-2 leading-relaxed">Run the cases, then check them:</p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5">
        <li><code className="rounded bg-black/30 px-1.5 py-0.5 text-[#ffb68a]">npm run answer</code></li>
        <li><code className="rounded bg-black/30 px-1.5 py-0.5 text-[#ffb68a]">npm run eval</code></li>
      </ol>
      <p className="mt-3 text-white/50">Then come back here.</p>
      {failed && <p className="mt-4 text-sm text-[#ff5c5c]">Couldn&apos;t load results.</p>}
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
  const [showFilters, setShowFilters] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
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
  const nums = useMemo(() => resultNumbers(visible), [visible]);
  const groups = useMemo(() => (grouped ? groupByDataset(visible) : null), [grouped, visible]);
  const datasets = useMemo(() => distinct(all, "dataset"), [all]);
  const gates = useMemo(() => distinct(all, "gate"), [all]);
  const isFiltered = filter.q !== "" || filter.dataset !== "all" || filter.pass !== "all" || filter.gate !== "all";
  const cols = COLS.filter((c) => showDetails || !c.detail);

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
    const run = wasRun(r);
    return (
      <tr
        key={key}
        tabIndex={r.executionId ? 0 : -1}
        onClick={() => open(r)}
        onKeyDown={(e) => {
          if (e.key === "Enter") open(r);
        }}
        className={cx(
          "group border-b border-white/[0.05] text-[14px]",
          r.executionId && "cursor-pointer hover:bg-white/[0.04] focus:bg-white/[0.06] focus:outline-none",
        )}
      >
        <td className="px-4 py-2.5">
          <div className="truncate text-white/90" title={r.title ?? undefined}>{caseName(r.caseId, r.title)}</div>
          <div className="flex items-center gap-2 truncate text-[11px] text-white/35">
            {r.caseId}
            {r.dataset === "city" && <Badge tone="warn">Practice case</Badge>}
          </div>
        </td>
        <td className="px-4 py-2.5">
          {run ? (
            <>
              <div className="text-white/85">{plainOutcome(r.decision)}</div>
              {r.nextAction && <div className="truncate text-[12px] text-white/45" title={scrubLeaks(r.nextAction)}>{scrubLeaks(r.nextAction)}</div>}
            </>
          ) : (
            <span className="text-white/35">Not run yet</span>
          )}
        </td>
        {showDetails && (
          <>
            <td className="truncate px-4 py-2.5 text-[13px] text-white/55">{plainDataset(r.dataset)}</td>
            <td className="truncate px-4 py-2.5 text-[13px] text-white/55">{plainGate(r.gate) || "–"}</td>
            <td className="px-4 py-2.5 text-right text-[13px] tabular-nums text-white/55">{r.score === null ? "–" : r.score.toFixed(2)}</td>
            <td className="px-4 py-2.5 text-right text-[13px] tabular-nums text-white/55">{cents(r.costUsd) || "–"}</td>
            <td className="px-4 py-2.5 text-right text-[13px] tabular-nums text-white/55">{fmtDuration(r.durationMs)}</td>
          </>
        )}
        <td className="px-4 py-2.5 text-center">
          <RightMark pass={r.pass} />
        </td>
        <td className="px-3 py-2 text-right">
          {r.executionId ? (
            <span className="text-[13px] text-white/25 group-hover:text-[#ff6a1a]">Open →</span>
          ) : (
            <Button className="!px-3 !py-1 !text-[13px]" disabled={executing !== null} onClick={() => void execute(r)}>
              {executing === key ? "Starting…" : "Run"}
            </Button>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#1f1f23] text-white">
      <div className="shrink-0 space-y-3 border-b border-white/10 px-6 py-5">
        {data && all.length > 0 && (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <BigNumber n={nums.run} label={nums.run === 1 ? "case" : "cases"} />
            <span className="text-2xl text-white/20">·</span>
            <BigNumber n={nums.right} label="right" color="#3ecf8e" />
            <span className="text-2xl text-white/20">·</span>
            <BigNumber n={nums.wrong} label="wrong" color={nums.wrong ? "#ff5c5c" : undefined} />
            {nums.unchecked > 0 && <span className="ml-2 text-sm text-white/40">{nums.unchecked} not checked yet</span>}
            {nums.known > nums.run && <span className="ml-2 text-sm text-white/40">{nums.known - nums.run} not run yet</span>}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" onClick={() => setShowFilters((v) => !v)} className={cx("hover:text-white/85", isFiltered || showFilters ? "text-[#ff6a1a]" : "text-white/50")}>
            {showFilters ? "Hide filters" : "Filters"}
          </button>
          <button type="button" onClick={() => setShowDetails((v) => !v)} className={cx("hover:text-white/85", showDetails ? "text-[#ff6a1a]" : "text-white/50")}>
            {showDetails ? "Hide details" : "Details"}
          </button>
          {error && data && <span className="text-xs text-[#ff5c5c]">Something went wrong. Try again.</span>}
          <Button className="ml-auto" onClick={load}>Refresh</Button>
        </div>
        {showFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-64">
              <SearchInput value={filter.q} onChange={(q) => setFilter((f) => ({ ...f, q }))} placeholder="Find a case" />
            </div>
            <Select<PassFilter>
              label="Right or wrong"
              value={filter.pass}
              onChange={(pass) => setFilter((f) => ({ ...f, pass }))}
              options={[
                { value: "all", label: "Right and wrong" },
                { value: "pass", label: "Right" },
                { value: "fail", label: "Wrong" },
                { value: "unevaluated", label: "Not checked" },
              ]}
            />
            <Select
              label="Cases"
              value={filter.dataset}
              onChange={(dataset) => setFilter((f) => ({ ...f, dataset }))}
              options={[{ value: "all", label: "All cases" }, ...datasets.map((d) => ({ value: d, label: plainDataset(d) }))]}
            />
            <Select
              label="Safety check"
              value={filter.gate}
              onChange={(gate) => setFilter((f) => ({ ...f, gate }))}
              options={[{ value: "all", label: "Any safety check" }, ...gates.map((g) => ({ value: g, label: plainGate(g) }))]}
            />
            <label className="ml-1 inline-flex cursor-pointer select-none items-center gap-1.5 text-sm text-white/70">
              <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} className="accent-[#ff6a1a]" />
              Group by cases
            </label>
            {isFiltered && (
              <Button className="!px-2 !py-1" onClick={() => setFilter(EMPTY_FILTER)}>
                Clear
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {data === null && !error ? (
          <p className="p-6 text-sm text-white/40">Loading…</p>
        ) : all.length === 0 ? (
          <EmptyState failed={!!error} />
        ) : (
          <table className={cx("w-full table-fixed border-collapse", showDetails ? "min-w-[1000px]" : "min-w-[640px]")}>
            <thead className="sticky top-0 z-10 bg-[#26262b]">
              <tr className="border-b border-white/10">
                {cols.map((c) => {
                  const active = sort.key === c.key;
                  return (
                    <th
                      key={c.key}
                      className={cx(c.width, "px-4 py-2.5 text-[13px] font-medium", c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left")}
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                    >
                      <button
                        type="button"
                        onClick={() => setSort((s) => nextSort(s, c.key))}
                        className={cx("inline-flex items-center gap-1", active ? "text-white" : "text-white/50 hover:text-white/80")}
                      >
                        {c.label}
                        <span className="w-2 text-[9px] text-white/40">{active ? (sort.dir === "asc" ? "▲" : "▼") : ""}</span>
                      </button>
                    </th>
                  );
                })}
                <th className="w-[96px]" />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={cols.length + 1} className="p-6 text-center text-sm text-white/40">
                    No cases match.
                  </td>
                </tr>
              ) : groups ? (
                groups.map((g) => {
                  const isCollapsed = collapsed.has(g.dataset);
                  const gn = resultNumbers(g.rows);
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
                        <td colSpan={cols.length + 1} className="px-4 py-2 text-sm">
                          <span className="mr-2 inline-block w-3 text-white/40">{isCollapsed ? "▸" : "▾"}</span>
                          <span className="font-medium text-white">{plainDataset(g.dataset)}</span>
                          <span className="ml-3 tabular-nums text-white/45">
                            {gn.run} cases · {gn.right} right · {gn.wrong} wrong
                          </span>
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
