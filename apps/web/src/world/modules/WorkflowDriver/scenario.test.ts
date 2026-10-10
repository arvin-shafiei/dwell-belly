import { describe, expect, it } from "vitest";
import type { WorkflowEvent } from "../../store";
import { MODIFIERS, SCENARIOS, getScenario, type Modifier } from "../../scenarios";
import { WorkflowEngine, type Case } from "./engine";

const ALL_MODIFIERS = Object.keys(MODIFIERS) as Modifier[];

/** Run one scenario to completion in its own engine. */
function runScenario(scenarioId: string, modifiers: Modifier[] = []) {
  const events: WorkflowEvent[] = [];
  const done: Case[] = [];
  const engine = new WorkflowEngine({
    seed: 11,
    background: false,
    emit: (e) => events.push(e),
    onCaseDone: (c) => done.push(c),
  });
  const c = engine.scenario({ runId: "r1", scenarioId, modifiers });
  for (let i = 0; i < 2000 && done.length === 0; i++) engine.advance(100);
  const results = events.filter((e) => e.status !== "start");
  const of = (node: string) => results.filter((e) => e.nodeId === node);
  return { c, done, events, results, nodes: results.map((e) => e.nodeId), of };
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const leadName = (r: string) => norm(r.split(",")[0]);

describe("scenario cases", () => {
  it("puts the scenario id in the case id", () => {
    const { c, events } = runScenario("delivery-024");
    expect(c.id).toMatch(/^CASE-\d{4} · delivery-024$/);
    expect(events.every((e) => e.caseId === c.id)).toBe(true);
    expect(c.scenarioId).toBe("delivery-024");
    expect(c.runId).toBe("r1");
  });

  it("ingests the real messages", () => {
    const s = getScenario("delivery-024")!;
    const { of } = runScenario("delivery-024");
    const ingest = of("ingest")[0].summary;
    expect(ingest).toContain(`${s.messages.length} msgs`);
    expect(ingest).toContain(s.request!.slice(0, 15));
    const withMods = runScenario("delivery-024", ["noise", "repeat_complaint"]).of("ingest")[0].summary;
    expect(withMods).toContain(`${s.messages.length + 2} msgs`);
  });

  it("plans the expected next action and names channel + recipient in the action", () => {
    const s = getScenario("delivery-024")!;
    const { of } = runScenario("delivery-024");
    expect(of("planner")[0].summary).toContain(s.expected!.summary.slice(0, 30));
    expect(of("action")[0].summary.startsWith(`${s.expected!.channel} → ${s.expected!.recipient}`)).toBe(true);
  });

  it.each(SCENARIOS.map((s) => s.id))("%s produces a valid case that matches expected", (id) => {
    const s = getScenario(id)!;
    const { done, results, nodes, of } = runScenario(id);
    expect(done).toHaveLength(1);
    expect(nodes[0]).toBe("ingest");
    expect(nodes[nodes.length - 1]).toBe("log");
    for (const e of results) expect(e.summary.length).toBeLessThanOrEqual(90);
    expect(["acted", "escalated"]).toContain(done[0].outcome);
    const action = norm(of("action")[0].summary);
    expect(action).toContain(norm(s.expected!.channel!));
    expect(action).toContain(leadName(s.expected!.recipient!));
  });

  it("finishes every scenario with every modifier", () => {
    for (const s of SCENARIOS) {
      for (const m of ALL_MODIFIERS) {
        const { done, nodes, results } = runScenario(s.id, [m]);
        expect(done, `${s.id} + ${m}`).toHaveLength(1);
        expect(done[0].outcome).toBeDefined();
        expect(nodes[nodes.length - 1]).toBe("log");
        for (const e of results) expect(e.summary.length).toBeLessThanOrEqual(90);
      }
    }
  });
});

describe("modifiers drive the path", () => {
  const ID = "delivery-024";

  it("conflicting_stories: clash fires", () => {
    const { c, of } = runScenario(ID, ["conflicting_stories"]);
    expect(c.clash).toBe(true);
    expect(of("clash")[0].summary).toMatch(/^Clash: driver/);
  });

  it("missing_context: missing info asks first, outcome asked_for_info", () => {
    const { done, of } = runScenario(ID, ["missing_context"]);
    expect(of("missing_info")[0].summary).toMatch(/ask/i);
    expect(of("action")[0].summary).toMatch(/\?/);
    expect(done[0].outcome).toBe("asked_for_info");
  });

  it("failed_action: verify fails then retries", () => {
    const { of, done } = runScenario(ID, ["failed_action"]);
    expect(of("verify").map((e) => e.status)).toEqual(["error", "ok"]);
    expect(of("verify")[0].summary).toMatch(/503/);
    expect(done[0].outcome).toBe("acted");
  });

  it.each(["needs_human", "time_pressure"] as Modifier[])("%s: gate asks a human", (m) => {
    const { of, nodes, done } = runScenario(ID, [m]);
    expect(of("gate")[0].summary).toMatch(/ask a human/);
    expect(nodes).toContain("human");
    expect(of("human").some((e) => e.status === "ask")).toBe(true);
    expect(done[0].outcome).toBe("escalated");
  });

  it("prompt_injection: gate blocks, no action", () => {
    const { of, nodes, done } = runScenario(ID, ["prompt_injection"]);
    expect(of("gate")[0].status).toBe("block");
    expect(of("gate")[0].summary).toMatch(/injection/);
    expect(nodes).not.toContain("action");
    expect(done[0].outcome).toBe("blocked");
  });

  it("out_of_policy: planner refuses the refund", () => {
    const { of } = runScenario(ID, ["out_of_policy"]);
    expect(of("planner")[0].summary).toMatch(/won't promise/i);
  });

  it("privacy_request: planner refuses to share details", () => {
    const { of } = runScenario(ID, ["privacy_request"]);
    expect(of("planner")[0].summary).toMatch(/won't share/i);
  });

  it("repeat_complaint: history finds the broken promise", () => {
    const { of } = runScenario(ID, ["repeat_complaint"]);
    expect(of("history")[0].summary).toMatch(/promise/i);
    expect(of("triage")[0].summary).toMatch(/· high ·/);
  });

  it("cascade: group merges", () => {
    const { of } = runScenario(ID, ["cascade"]);
    expect(of("group")[0].summary).toMatch(/merged/);
  });

  it("noise: ingest ignores it", () => {
    const { of } = runScenario(ID, ["noise"]);
    expect(of("ingest")[0].summary).toMatch(/noise ignored/);
  });

  it("do_nothing: no action, outcome no_action", () => {
    const { nodes, done } = runScenario(ID, ["do_nothing"]);
    expect(nodes).not.toContain("action");
    expect(nodes[nodes.length - 1]).toBe("log");
    expect(done[0].outcome).toBe("no_action");
  });

  it("injection beats everything else", () => {
    const { done } = runScenario(ID, ["needs_human", "missing_context", "prompt_injection"]);
    expect(done[0].outcome).toBe("blocked");
  });

  it("unknown scenario ids still make a case", () => {
    const { done } = runScenario("delivery-999");
    expect(done).toHaveLength(1);
  });
});
