"use client";
// Console tab: Overview, shown as "Home". Big plain numbers from real results
// (GET /api/console/evidence), a short list of recent cases (GET /api/console/executions?limit=8)
// and one button: "Run a case". Words follow docs/plans/ui-simplify-brief.md (via @/ui/plain).
// Honesty: city-made (simulated) cases never count in the numbers and are labelled "Practice case".
import { useMemo } from "react";
import { cents, plainOutcome, plainStatus } from "@/ui/plain";
import { useEvidence, useExecutions, type ExecutionSummary } from "../useApi";
import {
  ErrorState,
  ExecuteButton,
  HeaderActions,
  NoRunsYet,
  RealBadge,
  SimulatedBadge,
  Skeleton,
  StatusDot,
  computeKpis,
  cx,
  formatCount,
  formatRelative,
  formatTimestamp,
  stripCaseNo,
  useConsole,
  type Tone,
} from "../ui";

const POLL_MS = 5000;

/** Outcomes that mean a person had to step in (the agent asked for one, or the safety check stopped it). */
const NEEDS_PERSON = ["escalated", "blocked"];

export default function OverviewTab() {
  const evidence = useEvidence({ pollMs: POLL_MS });
  const executions = useExecutions({ limit: 8 }, { pollMs: POLL_MS });

  const kpis = useMemo(() => computeKpis(evidence.data?.rows ?? []), [evidence.data]);
  const sent = kpis.outcomes.acted ?? 0;
  const needPerson = NEEDS_PERSON.reduce((a, k) => a + (kpis.outcomes[k] ?? 0), 0);
  const recent = (executions.data?.executions ?? []).slice(0, 6);

  const loading = evidence.loading || executions.loading;
  const nothingYet = !loading && kpis.cases === 0 && recent.length === 0;

  return (
    <div className="h-full overflow-y-auto">
      <HeaderActions>
        <ExecuteButton />
      </HeaderActions>

      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-10 px-6 py-10">
        {evidence.error && !evidence.data && (
          <ErrorState title="Couldn't load the results" error={evidence.error} onRetry={evidence.reload} />
        )}

        {nothingYet && !evidence.error ? (
          <div className="rounded-xl border border-white/[0.07] bg-rv-card py-10">
            <NoRunsYet />
          </div>
        ) : (
          <>
            <section aria-label="Totals">
              <div className="mb-4 flex items-center gap-2">
                <RealBadge />
                <span className="text-[13px] text-white/40">Real cases only</span>
              </div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <BigNumber loading={evidence.loading} value={formatCount(kpis.cases)} word={kpis.cases === 1 ? "case handled" : "cases handled"} />
                <BigNumber loading={evidence.loading} value={formatCount(sent)} word="sent" tone="green" />
                <BigNumber
                  loading={evidence.loading}
                  value={formatCount(needPerson)}
                  word="needed a person"
                  tone={needPerson > 0 ? "amber" : undefined}
                />
                <BigNumber
                  loading={evidence.loading}
                  value={kpis.avgCostUsd === null ? "—" : `Avg ${cents(kpis.avgCostUsd)}`}
                  word="per case"
                />
              </div>
            </section>

            <section aria-label="Recent cases">
              <h2 className="mb-3 text-[15px] font-semibold text-white/90">Recent cases</h2>
              <RecentCases
                rows={recent}
                loading={executions.loading}
                error={executions.data ? undefined : executions.error}
                onRetry={executions.reload}
                now={executions.updatedAt ?? 0}
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function BigNumber({
  value,
  word,
  tone,
  loading,
}: {
  value: string;
  word: string;
  tone?: "green" | "amber";
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-rv-card px-6 py-6">
      {loading ? (
        <Skeleton className="h-10 w-24" />
      ) : (
        <div
          className={cx(
            "tabular text-[40px] leading-none font-semibold tracking-tight",
            tone === "green" ? "text-rv-green" : tone === "amber" ? "text-rv-amber" : "text-white",
          )}
        >
          {value}
        </div>
      )}
      <div className="mt-3 text-[15px] text-white/60">{word}</div>
    </div>
  );
}

/** One plain word for where a case ended up. */
function caseResult(r: ExecutionSummary): { label: string; tone: Tone } {
  if (r.status !== "success") return { label: plainStatus(r.status), tone: r.status === "running" ? "blue" : "red" };
  const label = plainOutcome(r.outcome);
  const tone: Tone =
    r.outcome === "acted"
      ? "green"
      : r.outcome && NEEDS_PERSON.includes(r.outcome)
        ? "amber"
        : r.outcome === "error"
          ? "red"
          : "neutral";
  return { label, tone };
}

function RecentCases({
  rows,
  loading,
  error,
  onRetry,
  now,
}: {
  rows: ExecutionSummary[];
  loading: boolean;
  error?: string;
  onRetry: () => void;
  /** Reference time for "5m ago" (time of the last poll; keeps render pure). */
  now: number;
}) {
  const { navigate } = useConsole();
  if (loading)
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  if (error) return <ErrorState title="Couldn't load recent cases" error={error} onRetry={onRetry} />;
  if (rows.length === 0)
    return (
      <div className="rounded-xl border border-white/[0.07] bg-rv-card">
        <NoRunsYet compact />
      </div>
    );

  return (
    <ul className="overflow-hidden rounded-xl border border-white/[0.07] bg-rv-card">
      {rows.map((r, i) => {
        const title = (r as { title?: string | null }).title;
        const res = caseResult(r);
        return (
          <li key={r.id} className={cx(i > 0 && "border-t border-white/[0.05]")}>
            <button
              type="button"
              onClick={() => navigate("executions", { id: r.id })}
              className="flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-white/[0.03]"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[15px] text-white/90">{title ? stripCaseNo(title) : r.caseId}</span>
                  {r.simulated && <SimulatedBadge />}
                </span>
                <span className="mt-0.5 block truncate text-xs text-white/35" title={formatTimestamp(r.startedAt)}>
                  {r.caseId} · {formatRelative(r.startedAt, now)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-sm text-white/80">
                <StatusDot tone={res.tone} pulse={r.status === "running"} />
                {res.label}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
