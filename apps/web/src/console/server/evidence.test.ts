import { describe, expect, it } from "vitest";
import { buildEvidence, type EvidenceExecution } from "./evidence";

const ex = (o: Partial<EvidenceExecution> & { id: string; caseId: string; startedAt: string }): EvidenceExecution => ({
  dataset: "public", status: "success", outcome: "acted", durationMs: 1000, costUsd: 0.01, simulated: false,
  title: null, nextAction: "Email → A", gate: "allow", eval: null, ...o,
});

describe("buildEvidence", () => {
  it("joins each case with its latest finished run and latest verdict, and totals them", () => {
    const { rows, totals } = buildEvidence(
      [{ id: "delivery-001", dataset: "public", title: "One" }, { id: "gen-101", dataset: "generated", title: "Two" }],
      [
        ex({ id: "e1", caseId: "delivery-001", startedAt: "2026-10-10T10:00:00Z", eval: { pass: true, score: 0.9 }, costUsd: null, nextAction: "Email → A" }),
        ex({ id: "e2", caseId: "delivery-001", startedAt: "2026-10-10T11:00:00Z", outcome: "escalated", costUsd: 0.05, nextAction: null, gate: "ask" }),
        ex({ id: "e3", caseId: "delivery-001", startedAt: "2026-10-10T12:00:00Z", status: "running", outcome: null }),
        ex({ id: "sim", caseId: "gen-101", startedAt: "2026-10-10T12:00:00Z", simulated: true }),
        ex({ id: "r1", caseId: "Case-A", dataset: "reality", startedAt: "2026-10-10T09:00:00Z", title: "Reality A", costUsd: 0.02 }),
      ],
    );
    expect(rows).toEqual([
      { caseId: "delivery-001", dataset: "public", title: "One", decision: "escalated", nextAction: null, gate: "ask",
        pass: true, score: 0.9, costUsd: 0.05, durationMs: 1000, executionId: "e2" },
      { caseId: "gen-101", dataset: "generated", title: "Two", decision: null, nextAction: null, gate: null,
        pass: null, score: null, costUsd: null, durationMs: null, executionId: null },
      { caseId: "Case-A", dataset: "reality", title: "Reality A", decision: "acted", nextAction: "Email → A", gate: "allow",
        pass: null, score: null, costUsd: 0.02, durationMs: 1000, executionId: "r1" },
    ]);
    expect(totals).toEqual({ cases: 3, evaluated: 1, passed: 1, costUsd: 0.07 });
  });
});
