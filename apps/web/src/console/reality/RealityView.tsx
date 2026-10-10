"use client";
// Reality Test page: the unseen cases run once through the frozen agent at 16:30. Shows the
// runner's output folder (ANSWERS/) read-only: progress while it runs, then the results.
import { useMemo } from "react";
import {
  Badge,
  EmptyState,
  IconClock,
  KpiCard,
  Meter,
  Panel,
  Skeleton,
  Table,
  Td,
  Th,
  Tr,
  cx,
  formatDuration,
  useConsole,
} from "../ui";
import { cents } from "../../ui/plain";
import { useApi } from "../useApi";
import CaseDetail from "./CaseDetail";
import { TONE_CLASS, TileStatusDot } from "./tone";
import {
  LEGEND,
  STATUS_LABEL,
  STATUS_TONE,
  caseStatus,
  caseTitle,
  gridTiles,
  headline,
  runPhase,
  sortCases,
  tally,
  type RealityCase,
  type RealityResponse,
} from "./logic";

const RUN_COMMAND = "npm run reality -- reality/ ANSWERS";

export default function RealityView() {
  const { params, setParams } = useConsole();
  const openId = params.get("case");
  // Poll every 3 s until the run is done; then slowly, in case it is rerun.
  const probe = useApi<RealityResponse>("/api/console/reality", { pollMs: 3000 });
  const data = probe.data && Array.isArray(probe.data.cases) ? probe.data : undefined;
  const phase = runPhase(data);
  const t = useMemo(() => tally(data), [data]);
  const cases = useMemo(() => sortCases(data?.cases ?? []), [data]);
  const open = openId ? cases.find((c) => c.caseId === openId) : undefined;

  if (open) return <CaseDetail c={open} onBack={() => setParams({ case: null })} />;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-rv-title font-semibold text-white">Reality Test</h1>
          <p className="mt-1 text-[13px] text-white/55">
            Unseen cases, run once through the agent. These are the files the judges read.
          </p>
        </div>
        <Badge tone="neutral" title="Shown exactly as written by the run. Nothing here can change them.">
          Read-only
        </Badge>
      </header>

      {probe.loading && !data ? (
        <Skeleton className="h-48 w-full rounded-lg" />
      ) : phase === "waiting" ? (
        <Waiting error={probe.error && probe.error !== "This isn't ready yet." ? probe.error : undefined} />
      ) : (
        <>
          {phase === "running" ? <Progress done={t.done} total={t.total} /> : <Summary t={t} />}
          <Panel
            title={phase === "running" ? "Cases" : `All ${t.total} cases`}
            actions={<Legend />}
          >
            <TileGrid cases={cases} total={t.total} onOpen={(id) => setParams({ case: id })} />
          </Panel>
          <CaseTable cases={cases.filter((c) => caseStatus(c) !== "working")} onOpen={(id) => setParams({ case: id })} />
        </>
      )}
    </div>
  );
}

function Waiting({ error }: { error?: string }) {
  return (
    <Panel>
      <EmptyState icon={<IconClock size={20} />} title="Waiting for the Reality Test at 16:30">
        <p>Each case shows up here as soon as its answer is written.</p>
        <p className="mt-3 font-mono text-[11px] text-white/35">{RUN_COMMAND}</p>
        {error && <p className="mt-3 text-[12px] text-rv-red/80">{error}</p>}
      </EmptyState>
    </Panel>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <Panel>
      <div className="flex items-baseline gap-3">
        <span className="tabular text-rv-big font-semibold text-white">{done}</span>
        <span className="text-[15px] text-white/60">of {total} done</span>
        <span className="ml-auto flex items-center gap-2 text-[12px] text-white/45">
          <span className="rv-pulse inline-block h-2 w-2 rounded-full bg-rv-blue" />
          Running now
        </span>
      </div>
      <Meter ratio={total ? done / total : null} tone="green" className="mt-3" />
    </Panel>
  );
}

function Summary({ t }: { t: ReturnType<typeof tally> }) {
  const cost = cents(t.costUsd);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard label="Handled" value={t.handled} sub="Sent, or nothing needed" tone={t.handled ? "good" : "default"} />
      <KpiCard
        label="Handed to a person"
        value={t.person}
        sub={t.byStatus.stopped ? `${t.byStatus.stopped} stopped by the safety check` : "Needs a person"}
        tone={t.person ? "warn" : "default"}
      />
      <KpiCard label="Asked for info" value={t.asked} sub="Asked a question first" />
      <KpiCard
        label="Failed"
        value={t.failed}
        sub={cost ? `${t.total} cases · ${cost} in total` : `${t.total} cases`}
        tone={t.failed ? "bad" : "default"}
      />
    </div>
  );
}

function Legend() {
  return (
    <div className="hidden flex-wrap items-center gap-3 text-[11px] text-white/55 sm:flex">
      {LEGEND.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <TileStatusDot status={s} />
          {STATUS_LABEL[s]}
        </span>
      ))}
    </div>
  );
}

function TileGrid({ cases, total, onOpen }: { cases: RealityCase[]; total: number; onOpen: (id: string) => void }) {
  const tiles = gridTiles(cases, total);
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5">
      {tiles.map((tile) => {
        const clickable = tile.caseId !== null && tile.status !== "pending" && tile.status !== "working";
        const label = tile.status === "pending" ? "Not started" : STATUS_LABEL[tile.status];
        const cls =
          tile.status === "pending"
            ? "border border-dashed border-white/10 text-white/25"
            : tile.status === "working"
              ? "rv-pulse bg-white/[0.06] text-white/60 ring-1 ring-white/15 ring-inset"
              : TONE_CLASS[STATUS_TONE[tile.status]];
        return (
          <button
            key={tile.key}
            type="button"
            disabled={!clickable}
            onClick={clickable ? () => onOpen(tile.caseId!) : undefined}
            title={`${tile.caseId ?? `Case ${tile.label}`}: ${label}`}
            aria-label={`${tile.caseId ?? `Case ${tile.label}`}: ${label}`}
            className={cx(
              "tabular flex h-11 items-center justify-center rounded-md text-[12px] font-medium transition-colors",
              cls,
              clickable ? "cursor-pointer hover:brightness-125" : "cursor-default",
            )}
          >
            {tile.label}
          </button>
        );
      })}
    </div>
  );
}

function CaseTable({ cases, onOpen }: { cases: RealityCase[]; onOpen: (id: string) => void }) {
  if (!cases.length) return null;
  return (
    <Panel title="What the agent decided" subtitle="Click a case to read its answer file." flush>
      <div className="max-h-[60vh] overflow-auto">
        <Table>
          <thead>
            <tr>
              <Th className="w-12">#</Th>
              <Th>Case</Th>
              <Th>Result</Th>
              <Th>What it did</Th>
              <Th align="right">Time</Th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => {
              const s = caseStatus(c);
              return (
                <Tr key={c.caseId} onClick={() => onOpen(c.caseId)}>
                  <Td muted className="tabular">{String(c.n)}</Td>
                  <Td className="max-w-[16rem]">
                    <div className="truncate">{caseTitle(c)}</div>
                    <div className="truncate text-[11px] text-white/35">{c.caseId}</div>
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[s]} dot>{STATUS_LABEL[s]}</Badge>
                  </Td>
                  <Td className="max-w-[28rem]">
                    <div className="line-clamp-2 text-white/75">{headline(c)}</div>
                  </Td>
                  <Td align="right" muted>{formatDuration(c.durationMs)}</Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </Panel>
  );
}
