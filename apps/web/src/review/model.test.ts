import { describe, expect, it } from "vitest";
import { deadlineLabel, taskFromTrace } from "./model";

export function fixtureTrace(mode = "practice") {
  return {
    version: 1, caseId: "delivery-024", runId: "review-test-run", mode, flowId: "default-incident",
    events: [
      { kind: "run_start", t: 0, title: "Damaged parcel needs an owner decision" },
      { kind: "node_end", t: 1, nodeId: "triage", output: { type: "triage", urgency: "high" } },
      { kind: "node_end", t: 2, nodeId: "human", output: { type: "human_decision", card: {
        summary: "Customer reports damage; carrier has not confirmed the condition.", routeTo: "Claims team", clash: "Carrier scan says intact; customer reports damage.",
        tried: ["Requested the carrier's evidence"], wouldChangeMyMind: "A carrier inspection", deadlineMins: 15,
        options: [{ id: "investigate", label: "Ask claims team to investigate", undoable: true }, { id: "hold", label: "Hold the refund request", undoable: true }],
        fallback: "Hold the request and send nothing further",
      } } },
      { kind: "run_end", t: 3, outcome: "escalated", totalCostUsd: .03, totalLatencyMs: 2500 },
    ],
  };
}

describe("human review trace adapter", () => {
  it("uses the actual handover, urgency, options and deadline", () => {
    const task = taskFromTrace(fixtureTrace(), "2026-10-10T12:00:00Z", "test-id")!;
    expect(task.deadlineAt).toBe("2026-10-10T12:15:00.000Z");
    expect(task.options[0].id).toBe("investigate");
    expect(task).toMatchObject({ urgency: "high", routeTo: "Claims team", status: "pending", simulated: false });
    expect(deadlineLabel(task, Date.parse("2026-10-10T12:10:00Z"))).toBe("5m left");
  });
  it("does not revive an old card when a resumed case no longer needs a human", () => {
    const trace = fixtureTrace();
    trace.events.push({ kind: "run_start", t: 20, title: "Resolved with new evidence" });
    expect(taskFromTrace(trace, "2026-10-10T12:00:00Z", "test-id")).toBeNull();
  });
  it("accepts the future PRD card event and its explicit fallback option", () => {
    const trace = fixtureTrace();
    const card = trace.events[2].output!.card!;
    const future = { ...trace, events: [trace.events[0], { kind: "card", card: { ...card, fallback: undefined, fallbackOptionId: "hold" } }] };
    expect(taskFromTrace(future, "2026-10-10T12:00:00Z", "test-id")?.fallback).toBe("Hold the refund request");
  });
  it("keeps simulated traces labelled and rejects incomplete cards", () => {
    expect(taskFromTrace({ ...fixtureTrace("demo"), synthetic: true }, "2026-10-10T12:00:00Z", "test-id")?.simulated).toBe(true);
    expect(taskFromTrace({ events: [] }, "2026-10-10T12:00:00Z", "test-id")).toBeNull();
  });
});
