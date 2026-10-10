import { describe, expect, it } from "vitest";
import type { Incident, WorkflowEvent } from "../../store";
import type { CityRun } from "../../cityState";
import { caseEvents, caseForIncident, incidentIdFromCaseId, kindFromLabel, mergeCases, resolveSelection, stateFromEvents, type MergeInput } from "./casesModel";

const inc = (id: string, createdAt: number, status: Incident["status"] = "active"): Incident => ({
  id, kind: "car_crash", edgeKey: "a|b", x: 10, z: 20, status, createdAt, note: `Crash ${id}`,
});
let n = 0;
const ev = (caseId: string, t: number, p: Partial<WorkflowEvent> = {}): WorkflowEvent => ({
  id: `e${n++}`, t, caseId, nodeId: "ingest", status: "start", summary: "Reading…", ...p,
});
const run = (p: Partial<CityRun>): CityRun => ({
  id: "x1", caseId: "city-inc-1-i1", title: "INC-001 · car crash", status: "success", outcome: "sent", startedAt: new Date(1_000_000).toISOString(),
  costUsd: 0.01, error: null, card: null, runId: "r1", ...p,
});
const base = (p: Partial<MergeInput>): MergeInput => ({
  incidents: [], workflow: [], runs: [], queue: [], labelIncident: {}, perfNow: 10_000, epochNow: 2_000_000, ...p,
});

describe("helpers", () => {
  it("reads the incident id from a city case id", () => {
    expect(incidentIdFromCaseId("city-inc-4-inc-ab-1")).toBe("inc-ab-1");
    expect(incidentIdFromCaseId("delivery-013")).toBeNull();
  });
  it("reads the incident kind from a feed label", () => {
    expect(kindFromLabel("INC-003 · car crash")).toBe("car_crash");
    expect(kindFromLabel("DLY-001 · 3 late")).toBeNull();
  });
  it("maps HUD lines to a plain state", () => {
    expect(stateFromEvents([])).toBe("waiting");
    expect(stateFromEvents([{ nodeId: "ingest", status: "start", summary: "Waiting: budget" }])).toBe("waiting");
    expect(stateFromEvents([{ nodeId: "triage", status: "ok", summary: "x" }])).toBe("working");
    expect(stateFromEvents([{ nodeId: "human", status: "ask", summary: "x" }])).toBe("person");
    expect(stateFromEvents([{ nodeId: "log", status: "ok", summary: "Done" }])).toBe("sent");
    expect(stateFromEvents([{ nodeId: "gate", status: "block", summary: "x" }, { nodeId: "log", status: "ok", summary: "Done" }])).toBe("stopped");
    expect(stateFromEvents([{ nodeId: "log", status: "error", summary: "x" }])).toBe("stopped");
  });
});

describe("mergeCases", () => {
  it("shows a waiting incident on its own", () => {
    const items = mergeCases(base({ incidents: [inc("i1", 9_000)] }));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ key: "inc:i1", state: "waiting", incidentId: "i1", pos: { x: 10, z: 20 }, title: "Car crash" });
  });

  it("merges an incident with its live case through the queue label", () => {
    const items = mergeCases(base({
      incidents: [inc("i1", 9_000)],
      workflow: [ev("INC-001 · car crash", 9_500), ev("INC-001 · car crash", 9_800, { nodeId: "triage", status: "ok", summary: "Problem: crash" })],
      labelIncident: { "INC-001 · car crash": "i1" },
    }));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ incidentId: "i1", state: "working", label: "INC-001 · car crash", note: "Crash i1", pos: { x: 10, z: 20 } });
  });

  it("merges a saved run with its feed lines and incident (no duplicates)", () => {
    const items = mergeCases(base({
      incidents: [inc("i1", 9_000)],
      workflow: [ev("INC-001 · car crash", 9_500, { executionId: "x1" }), ev("INC-001 · car crash", 9_900, { nodeId: "log", status: "ok", summary: "Done: sent", executionId: "x1" })],
      runs: [run({})],
    }));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ key: "ex:x1", incidentId: "i1", state: "sent", executionId: "x1", runId: "r1" });
  });

  it("links a run to a feed case by label when the feed has no execution id yet", () => {
    const items = mergeCases(base({ workflow: [ev("INC-001 · car crash", 9_500)], runs: [run({ status: "running" })] }));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ key: "ex:x1", incidentId: "i1", label: "INC-001 · car crash" });
  });

  it("keeps runs that only live in SQLite, with their state", () => {
    const card = { cardId: "c", summary: "s" } as unknown as CityRun["card"];
    const items = mergeCases(base({ runs: [run({ id: "a", runId: "ra", card }), run({ id: "b", runId: "rb", status: "error", caseId: "city-inc-2-i2", startedAt: new Date(1_500_000).toISOString() })] }));
    expect(items.map((i) => [i.key, i.state])).toEqual([["ex:b", "stopped"], ["ex:a", "person"]]);
  });

  it("drops cleared incidents with no case but keeps their case", () => {
    expect(mergeCases(base({ incidents: [inc("i9", 1, "cleared")] }))).toEqual([]);
    const items = mergeCases(base({ incidents: [inc("i1", 9_000, "cleared")], runs: [run({})] }));
    expect(items).toHaveLength(1);
    expect(items[0].pos).toBeNull();
    expect(items[0].note).toBe("Crash i1");
  });

  it("sorts newest first", () => {
    const items = mergeCases(base({ incidents: [inc("old", 1_000), inc("new", 9_000)] }));
    expect(items.map((i) => i.incidentId)).toEqual(["new", "old"]);
  });
});

describe("selection", () => {
  const items = mergeCases(base({
    incidents: [inc("i1", 9_000), inc("i2", 9_100)],
    workflow: [ev("INC-001 · car crash", 9_500)],
    labelIncident: { "INC-001 · car crash": "i1" },
  }));
  it("finds the case for a clicked incident", () => {
    expect(caseForIncident(items, "i2")?.key).toBe("inc:i2");
    expect(caseForIncident(items, "i1")?.label).toBe("INC-001 · car crash");
    expect(caseForIncident(items, "nope")).toBeNull();
  });
  it("follows the incident when the key changes", () => {
    expect(resolveSelection(items, { key: "inc:i1", incidentId: "i1" })?.label).toBe("INC-001 · car crash");
    expect(resolveSelection(items, null)).toBeNull();
  });
  it("lists only the selected case's lines", () => {
    const wf = [ev("A", 1), ev("B", 2), ev("A", 3)];
    expect(caseEvents(wf, { ...items[0], label: "A" }).map((e) => e.t)).toEqual([1, 3]);
    expect(caseEvents(wf, null)).toEqual([]);
  });
});
