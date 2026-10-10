"use client";
// Console tab: Overview. Headline KPIs from real evidence (GET /api/console/evidence) + status,
// the most recent executions, and coverage per dataset. Real data only (PRD J0): simulated rows
// are excluded from KPIs and any simulated execution carries a SIMULATED badge.
import { useMemo } from "react";
import { consoleApi, useAction, useEvidence, useExecutions, useStatus, type ExecutionSummary } from "../useApi";
import {
  Button,
  DatasetBadge,
  ErrorState,
  ExecStatusBadge,
  ExecuteButton,
  HeaderActions,
  IconAlert,
  IconCases,
  IconClock,
  IconCoin,
  IconExecutions,
  IconImport,
  IconTarget,
  KpiCard,
  Meter,
  NoRunsYet,
  Panel,
  PassBadge,
  RealBadge,
  SimulatedBadge,
  Skeleton,
  computeKpis,
  formatCount,
  formatDuration,
  formatPct,
  formatRelative,
  formatTimestamp,
  formatUsd,
  humanize,
  useConsole,
} from "../ui";

const POLL_MS = 5000;

export default function OverviewTab() {
  const evidence = useEvidence({ pollMs: POLL_MS });
  const executions = useExecutions({ limit: 8 }, { pollMs: POLL_MS });
  const status = useStatus({ pollMs: POLL_MS });
  const importer = useAction(consoleApi.importRuns);

  // The contract has no critical-failure count yet; read it if the server adds one.
  const recordedCritical = (evidence.data?.totals as { criticalFailures?: number } | undefined)?.criticalFailures;
  const kpis = useMemo(
    () => computeKpis(evidence.data?.rows ?? [], recordedCritical),
    [evidence.data, recordedCritical],
  );

  const execList = executions.data?.executions ?? [];
  const noRuns = !evidence.loading && !executions.loading && kpis.cases === 0 && execList.length === 0;
  const kpiLoading = evidence.loading;

  async function doImport() {
    const r = await importer.run();
    if (r) {
      evidence.reload();
      executions.reload();
      status.reload();
    }
  }

  const executionCount = status.data?.counts?.executions;

  return (
    <div className="h-full overflow-y-auto">
      <HeaderActions>
        <Button
          variant="secondary"
          icon={<IconImport size={15} />}
          loading={importer.pending}
          onClick={doImport}
          title="Rescan ANSWERS/, runs/ and examples/ into the console database"
        >
          Import runs
        </Button>
        <ExecuteButton />
      </HeaderActions>

      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 p-5">
        {importer.error && <ErrorState title="Import failed" error={importer.error} onRetry={doImport} />}
        {evidence.error && !evidence.data && (
          <ErrorState title="Evidence unavailable" error={evidence.error} onRetry={evidence.reload} />
        )}

        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-white/85">Agent performance</h2>
          <RealBadge title="Computed from runner outputs and eval results only. Simulated runs are excluded." />
          {kpis.simulatedExcluded > 0 && (
            <span className="text-xs text-white/40">
              {formatCount(kpis.simulatedExcluded)} simulated rows excluded
            </span>
          )}
          {evidence.updatedAt && (
            <span className="ml-auto text-[11px] text-white/30 tabular">
              Updated {new Date(evidence.updatedAt).toLocaleTimeString("en-GB")}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard
            label="Cases tested"
            icon={<IconCases size={14} />}
            loading={kpiLoading}
            value={kpis.cases ? formatCount(kpis.cases) : null}
            sub={
              kpis.cases
                ? `of ${formatCount(kpis.known)} known${
                    typeof executionCount === "number" ? ` · ${formatCount(executionCount)} executions` : ""
                  }`
                : kpis.known
                  ? `${formatCount(kpis.known)} known, none run yet`
                  : "No runs yet"
            }
          />
          <KpiCard
            label="Pass rate"
            icon={<IconTarget size={14} />}
            loading={kpiLoading}
            value={formatPct(kpis.passRate)}
            tone={kpis.passRate === null ? "default" : kpis.passRate >= 0.85 ? "good" : kpis.passRate >= 0.7 ? "warn" : "bad"}
            sub={
              kpis.evaluated
                ? `${formatCount(kpis.passed)} of ${formatCount(kpis.evaluated)} evaluated`
                : kpis.cases
                  ? "Not evaluated yet"
                  : "No eval results"
            }
          />
          <KpiCard
            label="Critical failures"
            icon={<IconAlert size={14} />}
            loading={kpiLoading}
            value={kpis.criticalFailures === null ? null : formatCount(kpis.criticalFailures)}
            tone={kpis.criticalFailures === null ? "default" : kpis.criticalFailures === 0 ? "good" : "bad"}
            sub={
              kpis.criticalFailures === null
                ? "No runs yet"
                : typeof recordedCritical === "number"
                  ? "From fixture rubrics"
                  : "None recorded"
            }
          />
          <KpiCard
            label="Avg cost / case"
            icon={<IconCoin size={14} />}
            loading={kpiLoading}
            value={kpis.avgCostUsd === null ? null : formatUsd(kpis.avgCostUsd)}
            sub={kpis.avgCostUsd === null ? "No cost recorded" : `${formatUsd(kpis.totalCostUsd)} total`}
          />
          <KpiCard
            label="Avg time / case"
            icon={<IconClock size={14} />}
            loading={kpiLoading}
            value={kpis.avgDurationMs === null ? null : formatDuration(kpis.avgDurationMs)}
            sub={kpis.avgDurationMs === null ? "No timings recorded" : "Wall clock per run"}
          />
        </div>

        {noRuns && !evidence.error && kpis.known === 0 ? (
          <Panel>
            <NoRunsYet action={<ExecuteHint />} />
          </Panel>
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <RecentExecutions
              loading={executions.loading}
              error={executions.data ? undefined : executions.error}
              onRetry={executions.reload}
              rows={execList}
              now={executions.updatedAt ?? 0}
            />
            <Coverage loading={evidence.loading} datasets={kpis.datasets} />
          </div>
        )}
      </div>
    </div>
  );
}

function ExecuteHint() {
  return <span className="text-xs text-white/40">Execute is in the top-right corner.</span>;
}

function RecentExecutions({
  rows,
  loading,
  error,
  onRetry,
  now,
}: {
  rows: ExecutionSummary[];
  /** Reference time for "5m ago" (time of the last poll; keeps render pure). */
  now: number;
  loading: boolean;
  error?: string;
  onRetry: () => void;
}) {
  const { navigate } = useConsole();
  return (
    <Panel
      flush
      title="Recent executions"
      subtitle="Latest 8 runs across all datasets"
      actions={
        <Button size="sm" variant="ghost" onClick={() => navigate("executions")} icon={<IconExecutions size={14} />}>
          View all
        </Button>
      }
    >
      {loading ? (
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState compact title="Executions unavailable" error={error} onRetry={onRetry} />
      ) : rows.length === 0 ? (
        <NoRunsYet compact />
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => navigate("executions", { id: r.id })}
                className="grid w-full grid-cols-[100px_minmax(0,1fr)_auto_72px_72px_68px] items-center gap-3 px-4 py-2.5 text-left text-[13px] hover:bg-white/[0.03]"
              >
                <ExecStatusBadge status={r.status} />
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-mono text-[12px] text-white/90">{r.caseId}</span>
                  <DatasetBadge dataset={r.dataset} />
                  {r.simulated && <SimulatedBadge />}
                  <span className="hidden truncate text-white/45 2xl:inline">{humanize(r.outcome)}</span>
                </span>
                <PassBadge pass={r.eval?.pass ?? null} score={r.eval?.score} />
                <span className="text-right text-xs text-white/60 tabular">{formatDuration(r.durationMs)}</span>
                <span className="text-right text-xs text-white/60 tabular">{formatUsd(r.costUsd)}</span>
                <span className="text-right text-xs text-white/40 tabular" title={formatTimestamp(r.startedAt)}>
                  {formatRelative(r.startedAt, now)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Coverage({
  datasets,
  loading,
}: {
  datasets: ReturnType<typeof computeKpis>["datasets"];
  loading: boolean;
}) {
  const { navigate } = useConsole();
  return (
    <Panel
      title="Coverage by dataset"
      subtitle="Cases tested of known, and eval pass rate"
      actions={
        <Button size="sm" variant="ghost" onClick={() => navigate("evidence")}>
          Evidence grid
        </Button>
      }
    >
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : datasets.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-white/45">No evidence yet.</p>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {datasets.map((d) => (
            <li key={d.dataset}>
              <button
                type="button"
                onClick={() => navigate("evidence", { dataset: d.dataset })}
                className="w-full rounded text-left"
              >
                <div className="mb-1.5 flex items-center gap-2 text-[13px]">
                  <DatasetBadge dataset={d.dataset} />
                  <span className="text-white/50 tabular">
                    {formatCount(d.cases)}
                    <span className="text-white/30"> / {formatCount(d.known)} tested</span>
                  </span>
                  <span className="ml-auto text-white/85 tabular">
                    {d.evaluated ? formatPct(d.passRate) : <span className="text-white/35">not evaluated</span>}
                  </span>
                </div>
                {d.evaluated > 0 ? (
                  <Meter
                    ratio={d.passRate}
                    tone={d.passRate === null ? "green" : d.passRate >= 0.85 ? "green" : d.passRate >= 0.7 ? "amber" : "red"}
                  />
                ) : (
                  <Meter ratio={d.known ? d.cases / d.known : 0} tone="orange" />
                )}
                <div className="mt-1 text-[11px] text-white/35 tabular">
                  {d.evaluated > 0
                    ? `${formatCount(d.passed)}/${formatCount(d.evaluated)} passed`
                    : d.cases > 0
                      ? "Run, awaiting eval"
                      : "Not run yet"}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
