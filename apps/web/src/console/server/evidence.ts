// The evidence grid: one row per case across every dataset, joined with its latest execution and
// its latest eval verdict. Pure: the route passes the catalogue and the executions in.
import type { EvidenceRow } from "../types";
import type { CaseEntry } from "./catalogue";

export interface EvidenceExecution {
  id: string;
  caseId: string;
  dataset: string;
  status: "running" | "success" | "error";
  outcome: string | null;
  startedAt: string;
  durationMs: number | null;
  costUsd: number | null;
  simulated: boolean;
  title: string | null;
  nextAction: string | null;
  gate: string | null;
  eval: { pass: boolean; score: number } | null;
}

export interface EvidenceTotals { cases: number; evaluated: number; passed: number; costUsd: number }

const later = (a: EvidenceExecution, b: EvidenceExecution) => (a.startedAt > b.startedAt ? a : b);

export function buildEvidence(cases: CaseEntry[], executions: EvidenceExecution[]): { rows: EvidenceRow[]; totals: EvidenceTotals } {
  // Simulated runs (city/mock) are never evidence.
  const real = executions.filter((e) => !e.simulated);
  const latest = new Map<string, EvidenceExecution>(); // latest finished run per case
  const latestAny = new Map<string, EvidenceExecution>(); // falls back to a running one
  const latestEval = new Map<string, EvidenceExecution>();
  for (const e of real) {
    const prevAny = latestAny.get(e.caseId);
    latestAny.set(e.caseId, prevAny ? later(prevAny, e) : e);
    if (e.status !== "running") {
      const prev = latest.get(e.caseId);
      latest.set(e.caseId, prev ? later(prev, e) : e);
    }
    if (e.eval) {
      const prev = latestEval.get(e.caseId);
      latestEval.set(e.caseId, prev ? later(prev, e) : e);
    }
  }

  const row = (caseId: string, dataset: string, title: string | null): EvidenceRow => {
    const ex = latest.get(caseId) ?? latestAny.get(caseId) ?? null;
    const ev = latestEval.get(caseId)?.eval ?? null;
    return {
      caseId,
      dataset,
      title: title ?? ex?.title ?? null,
      decision: ex?.outcome ?? null,
      nextAction: ex?.nextAction ?? null,
      gate: ex?.gate ?? null,
      pass: ev ? ev.pass : null,
      score: ev ? ev.score : null,
      costUsd: ex?.costUsd ?? null,
      durationMs: ex?.durationMs ?? null,
      executionId: ex?.id ?? null,
    };
  };

  const rows = cases.map((c) => row(c.id, c.dataset, c.title));
  // Cases that were run but are not in the repo's datasets (Reality Test folders, ad hoc runs).
  const listed = new Set(cases.map((c) => c.id));
  const extra = [...latestAny.values()].filter((e) => !listed.has(e.caseId)).sort((a, b) => a.caseId.localeCompare(b.caseId, "en", { numeric: true }));
  for (const e of extra) rows.push(row(e.caseId, e.dataset, null));

  const totals: EvidenceTotals = {
    cases: rows.length,
    evaluated: rows.filter((r) => r.pass !== null).length,
    passed: rows.filter((r) => r.pass === true).length,
    costUsd: Math.round(rows.reduce((s, r) => s + (r.costUsd ?? 0), 0) * 1e6) / 1e6,
  };
  return { rows, totals };
}
