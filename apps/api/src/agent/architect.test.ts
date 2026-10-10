import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { Flow, FlowEdge, FlowNode } from "../lib/flow.ts";
import { BRANCHING_EXAMPLE, buildFlow, NODE_TYPES, validateFlow } from "./architect.ts";
import type { Models } from "./models.ts";

const FLOW_FILE = path.resolve(import.meta.dirname, "..", "..", "flows", "default-incident.json");
const base: Flow = JSON.parse(await readFile(FLOW_FILE, "utf8"));
const usage = { model: "fake", latencyMs: 1, tokensIn: 10, tokensOut: 5, costUsd: 0.001 };

/** A fresh copy of the default flow with one change applied. */
function variant(change: (flow: Flow) => void): Flow {
  const flow: Flow = structuredClone(base);
  change(flow);
  return flow;
}
const node = (id: string, type: string, config?: Record<string, unknown>) => ({ id, type, runs_on: ["code"], config }) as FlowNode;
const without = (edges: FlowEdge[], from: string, to: string) => edges.filter((e) => !(e.from === from && e.to === to));
const has = (problems: string[], pattern: RegExp) => assert.ok(problems.some((p) => pattern.test(p)), `expected ${pattern} in ${JSON.stringify(problems)}`);

/** The reply format the model fills in, built from a stored flow. */
function draftOf(flow: Flow) {
  return {
    id: flow.id, name: flow.name, business: flow.business,
    nodes: flow.nodes.map((n) => {
      const rules = (n.config?.rules ?? null) as Record<string, { at_least: number; effect: string; note: string }> | null;
      return {
        id: n.id, type: n.type, runs_on: n.runs_on,
        gate: n.type === "safety_gate" && n.config ? { allow_below: n.config.allow_below, block_above: n.config.block_above } : null,
        rules: rules ? Object.entries(rules).map(([question, r]) => ({ question, ...r })) : null,
      };
    }),
    edges: flow.edges.map((e) => ({ from: e.from, to: e.to, when: e.when ?? null })),
  };
}

/** Replies in order; an Error is thrown as the model call's failure. Records each user prompt. */
function fake(replies: unknown[]): Models & { prompts: string[]; systems: string[] } {
  const prompts: string[] = [];
  const systems: string[] = [];
  return {
    prompts,
    systems,
    async structured({ system, user }) {
      prompts.push(user);
      systems.push(system);
      const reply = replies.shift();
      if (reply instanceof Error) throw reply;
      if (reply === undefined) throw new Error("no scripted reply");
      return { output: reply as never, usage };
    },
  };
}

test("the default flow has no problems", () => {
  assert.deepEqual(validateFlow(base), []);
});

test("every node type of the default flow is a known type", () => {
  for (const n of base.nodes) assert.ok(NODE_TYPES.includes(n.type), n.type);
});

test("unknown node type", () => {
  has(validateFlow(variant((f) => { f.nodes[2] = node("triage", "refund_bot"); })), /"triage" has unknown type "refund_bot"/);
});

test("duplicate node id", () => {
  has(validateFlow(variant((f) => { f.nodes.push(node("triage", "triage")); })), /duplicate node id "triage"/);
});

test("edge pointing at a missing node", () => {
  has(validateFlow(variant((f) => { f.edges.push({ from: "verify", to: "archive" }); })), /verify -> archive points at missing node "archive"/);
});

test("no ingest node", () => {
  const problems = validateFlow(variant((f) => {
    f.nodes = f.nodes.filter((n) => n.id !== "ingest");
    f.edges = without(f.edges, "ingest", "history");
  }));
  has(problems, /no ingest node/);
  // The walk falls back to the node nothing points at, so the rest is not reported as unreachable.
  assert.ok(!problems.some((p) => /unreachable/.test(p)), JSON.stringify(problems));
});

test("no case_log node", () => {
  has(validateFlow(variant((f) => {
    f.nodes = f.nodes.filter((n) => n.id !== "log");
    f.edges = f.edges.filter((e) => e.to !== "log");
  })), /no case_log node/);
});

test("no human_decision node", () => {
  has(validateFlow(variant((f) => {
    f.nodes = f.nodes.filter((n) => n.id !== "human");
    f.edges = f.edges.filter((e) => e.to !== "human" && e.from !== "human");
  })), /no human_decision node/);
});

test("an action reachable around the safety gate", () => {
  has(validateFlow(variant((f) => { f.edges.push({ from: "planner", to: "action" }); })), /action node "action" can be reached without passing a safety_gate/);
});

test("an action behind a gate only on a side branch is still caught", () => {
  // The gate exists and is reachable, but the path that acts never goes through it.
  const problems = validateFlow(variant((f) => {
    f.nodes.push(node("replan", "replan_route"));
    f.edges.push({ from: "triage", to: "replan" }, { from: "replan", to: "log" });
  }));
  has(problems, /replan_route node "replan" can be reached without passing a safety_gate/);
  assert.ok(!problems.some((p) => /action node "action"/.test(p)), JSON.stringify(problems));
});

test("a gate's block exit must not lead to an action", () => {
  has(validateFlow(variant((f) => {
    f.edges = without(f.edges, "gate", "log");
    f.edges.push({ from: "gate", to: "action", when: "block" });
  })), /"action" can be reached from a safety_gate "block" exit/);
});

test("a gate's ask exit must pass a human before an action", () => {
  has(validateFlow(variant((f) => {
    f.nodes.push(node("tracker", "promise_tracker"));
    f.edges = without(f.edges, "gate", "human");
    f.edges.push({ from: "gate", to: "tracker", when: "ask" }, { from: "tracker", to: "action" }, { from: "tracker", to: "human" });
  })), /"action" can be reached from a safety_gate "ask" exit without passing a human_decision/);
});

test("safety gate thresholds", () => {
  const gateWith = (config: Record<string, unknown> | undefined) => validateFlow(variant((f) => { f.nodes.find((n) => n.id === "gate")!.config = config; }));
  const complaint = /safety_gate "gate" needs numeric config allow_below < block_above/;
  has(gateWith(undefined), complaint);
  has(gateWith({ allow_below: 0.8, block_above: 0.3 }), complaint);
  has(gateWith({ allow_below: 0.5, block_above: 0.5 }), complaint);
  has(gateWith({ allow_below: "0.3", block_above: 0.8 }), complaint);
  has(gateWith({ allow_below: -0.1, block_above: 0.8 }), complaint);
  has(gateWith({ allow_below: 0.3, block_above: 1.2 }), complaint);
  has(gateWith({ allow_below: Number.NaN, block_above: 0.8 }), complaint);
  assert.deepEqual(gateWith({ allow_below: 0, block_above: 1 }), []);
});

test("unreachable nodes", () => {
  has(validateFlow(variant((f) => { f.nodes.push(node("learner", "learner"), node("group", "group_check")); })), /unreachable from the start: learner, group/);
});

test("cycles", () => {
  has(validateFlow(variant((f) => { f.edges.push({ from: "verify", to: "planner" }); })), /cycle: planner -> gate -> .*verify -> planner/);
  has(validateFlow(variant((f) => { f.edges.push({ from: "triage", to: "triage" }); })), /cycle: triage -> triage/);
});

test("a long chain does not overflow the walk", () => {
  const nodes = [node("ingest", "ingest"), ...Array.from({ length: 20_000 }, (_, i) => node(`t${i}`, "triage")), node("human", "human_decision"), node("log", "case_log")];
  const edges = nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id }));
  assert.deepEqual(validateFlow({ id: "long", name: "long", business: "", nodes, edges }), []);
});

test("malformed input is reported, not thrown", () => {
  assert.deepEqual(validateFlow(null as never), ["flow has no nodes or edges list"]);
  assert.deepEqual(validateFlow({ nodes: "x" } as never), ["flow has no nodes or edges list"]);
  const problems = validateFlow({ id: "x", name: "x", business: "", nodes: [null, { id: 3 }], edges: [{ from: "a" }] } as never);
  has(problems, /2 node\(s\) have no id or type/);
  has(problems, /1 edge\(s\) have no from or to/);
  has(problems, /no ingest node/);
});

test("buildFlow returns a valid flow from one call", async () => {
  const models = fake([draftOf(base)]);
  const res = await buildFlow("  A regional courier that delivers chilled food to homes.  ", models);
  assert.equal(res.ok, true);
  assert.deepEqual(res.problems, []);
  assert.deepEqual(res.flow, base);
  assert.deepEqual(res.usage, [usage]);
  assert.equal(models.prompts.length, 1);
  assert.match(models.prompts[0], /<business_description>\nA regional courier that delivers chilled food to homes\.\n<\/business_description>/);
  // The stored default flow is the worked example, and every node type is offered.
  assert.ok(models.systems[0].includes('"id": "default-incident"'));
  for (const type of NODE_TYPES) assert.ok(models.systems[0].includes(`- ${type}: `), type);
});

test("buildFlow retries once with the problems listed", async () => {
  const broken = variant((f) => { f.edges.push({ from: "planner", to: "action" }); });
  const models = fake([draftOf(broken), draftOf(base)]);
  const res = await buildFlow("A furniture retailer with two-person deliveries.", models);
  assert.equal(res.ok, true);
  assert.deepEqual(res.flow, base);
  assert.equal(res.usage.length, 2);
  assert.match(models.prompts[1], /- action node "action" can be reached without passing a safety_gate/);
  assert.match(models.prompts[1], /<previous_attempt>/);
});

test("buildFlow gives up after the second invalid flow and hands back no flow", async () => {
  const broken = draftOf(variant((f) => { f.nodes.find((n) => n.id === "gate")!.config = undefined; }));
  const models = fake([broken, structuredClone(broken), draftOf(base)]);
  const res = await buildFlow("A pharmacy courier.", models);
  assert.equal(res.ok, false);
  assert.equal(res.flow, undefined);
  has(res.problems, /safety_gate "gate" needs numeric config/);
  assert.equal(res.usage.length, 2);
  assert.equal(models.prompts.length, 2);
});

test("buildFlow reports a model failure without throwing", async () => {
  const res = await buildFlow("A parcel carrier.", fake([new Error("Request timed out.")]));
  assert.deepEqual(res, { ok: false, problems: ["model call failed: Request timed out."], usage: [] });
});

test("buildFlow keeps the first call's usage when the retry fails", async () => {
  const broken = variant((f) => { f.edges.push({ from: "planner", to: "action" }); });
  const res = await buildFlow("A parcel carrier.", fake([draftOf(broken), new Error("overloaded")]));
  assert.equal(res.ok, false);
  assert.deepEqual(res.problems, ["model call failed: overloaded"]);
  assert.equal(res.usage.length, 1);
});

test("buildFlow treats a reply in the wrong shape as a problem and retries", async () => {
  const unknownType = draftOf(base);
  unknownType.nodes[0].type = "teleport" as never;
  const models = fake([{ nodes: "none" }, unknownType]);
  const res = await buildFlow("A parcel carrier.", models);
  assert.equal(res.ok, false);
  assert.equal(res.flow, undefined);
  assert.match(models.prompts[1], /reply did not match the flow format at /);
  has(res.problems, /reply did not match the flow format at nodes\.0\.type/);
});

test("buildFlow with an empty description makes no model call", async () => {
  const models = fake([draftOf(base)]);
  for (const description of ["", "   \n", undefined as never]) {
    assert.deepEqual(await buildFlow(description, models), { ok: false, problems: ["no business description given"], usage: [] });
  }
  assert.equal(models.prompts.length, 0);
});

test("a gate with no thresholds in the reply is rejected rather than defaulted", async () => {
  const draft = draftOf(base);
  draft.nodes.find((n) => n.type === "safety_gate")!.gate = null;
  const res = await buildFlow("A parcel carrier.", fake([draft, structuredClone(draft)]));
  assert.equal(res.ok, false);
  has(res.problems, /safety_gate "gate" needs numeric config/);
});

test("a gate exit label is matched whatever its case or spacing", () => {
  has(validateFlow(variant((f) => {
    f.edges = without(f.edges, "gate", "log");
    f.edges.push({ from: "gate", to: "action", when: "Block" });
  })), /"action" can be reached from a safety_gate "block" exit/);
  has(validateFlow(variant((f) => {
    f.nodes.push(node("tracker", "promise_tracker"));
    f.edges = without(f.edges, "gate", "human");
    f.edges.push({ from: "gate", to: "tracker", when: " ASK " }, { from: "tracker", to: "action" }, { from: "tracker", to: "human" });
  })), /"action" can be reached from a safety_gate "ask" exit without passing a human_decision/);
  assert.deepEqual(validateFlow(variant((f) => { f.edges.push({ from: "gate", to: "log", when: 7 as never }); })), []);
});

test("buildFlow does not throw on a reply that cannot be written back into the retry prompt", async () => {
  const loop: Record<string, unknown> = { nodes: "none" };
  loop.self = loop;
  for (const reply of [{ nodes: BigInt(1) }, loop]) {
    const models = fake([reply, draftOf(base)]);
    const res = await buildFlow("A parcel carrier.", models);
    assert.equal(res.ok, true);
    assert.match(models.prompts[1], /reply did not match the flow format at /);
  }
});

// ---- Branching decision trees -------------------------------------------------------------------

const strict = (flow: Flow) => validateFlow(flow, { strictBranches: true });
/** A fresh copy of the branching example with one change applied. */
function branchy(change: (flow: Flow) => void = () => {}): Flow {
  const flow: Flow = structuredClone(BRANCHING_EXAMPLE);
  change(flow);
  return flow;
}
const outOf = (flow: Flow, id: string) => flow.edges.filter((e) => e.from === id);
const decisionPoints = (flow: Flow) => flow.nodes.filter((n) => outOf(flow, n.id).length >= 2).map((n) => n.id);

test("the default flow is still valid with default options and with strict branches", () => {
  assert.deepEqual(validateFlow(base), []);
  assert.deepEqual(validateFlow(base, {}), []);
  assert.deepEqual(strict(base), []);
});

test("the branching example is a real decision tree and passes the strict check", () => {
  const flow = branchy();
  assert.deepEqual(strict(flow), []);
  assert.deepEqual(validateFlow(flow), []);
  assert.ok(flow.nodes.length >= 15 && flow.nodes.length <= 30, `${flow.nodes.length} nodes`);
  const beyondGates = decisionPoints(flow).filter((id) => flow.nodes.find((n) => n.id === id)!.type !== "safety_gate");
  assert.ok(beyondGates.length >= 3, JSON.stringify(beyondGates));
  for (const id of decisionPoints(flow)) for (const e of outOf(flow, id)) assert.ok(e.when, `${e.from} -> ${e.to} has no when`);
  const triageLabels = outOf(flow, "triage").map((e) => e.when);
  for (const label of ["damage", "missing_parcel", "cold_chain"]) assert.ok(triageLabels.includes(label), label);
  assert.ok(flow.edges.some((e) => e.when === "retry"));
  assert.ok(flow.nodes.filter((n) => n.type === "case_log").length >= 2);
});

test("a branch with no when label is rejected in strict mode only", () => {
  const flow = branchy((f) => { delete f.edges.find((e) => e.from === "triage" && e.when === "damage")!.when; });
  has(strict(flow), /node "triage" branches \d+ ways, so every edge out of it needs a "when" label: triage -> info_damage has none/);
  assert.deepEqual(validateFlow(flow), []);
});

test("two branches with the same when label are rejected", () => {
  const flow = branchy((f) => { f.edges.find((e) => e.from === "triage" && e.when === "cold_chain")!.when = " Damage "; });
  has(strict(flow), /node "triage" has more than one edge labelled "damage"/);
});

test("a safety_gate exit must be labelled allow, ask or block in strict mode", () => {
  const flow = branchy((f) => { f.edges.find((e) => e.from === "gate" && e.when === "allow")!.when = "maybe"; });
  has(strict(flow), /safety_gate "gate" exit gate -> action is labelled "maybe"; use allow, ask or block/);
});

test("an action left ungated on one branch only is caught", () => {
  const problems = strict(branchy((f) => { f.edges.push({ from: "triage", to: "action_group", when: "billing" }); }));
  has(problems, /action node "action_group" can be reached without passing a safety_gate/);
  assert.ok(!problems.some((p) => /node "action"\b/.test(p)), JSON.stringify(problems));
});

test("a branch that never reaches a case_log is rejected in strict mode only", () => {
  const flow = branchy((f) => {
    f.nodes.push(node("planner_billing", "planner"));
    f.edges.push({ from: "triage", to: "planner_billing", when: "billing" });
  });
  has(strict(flow), /branch ends at "planner_billing" \(planner\) without reaching a case_log/);
  assert.deepEqual(validateFlow(flow), []);
});

test("the single verify -> action retry loop is allowed in both modes", () => {
  assert.deepEqual(validateFlow(branchy()), []);
  assert.deepEqual(strict(branchy()), []);
});

test("a retry edge that does not go back to the action it checks is a cycle", () => {
  has(strict(branchy((f) => { f.edges.find((e) => e.when === "retry")!.to = "planner"; })), /cycle: .*planner/);
  has(validateFlow(branchy((f) => { f.edges.find((e) => e.when === "retry")!.to = "planner"; })), /cycle: .*planner/);
});

test("a retry loop is allowed only once: the retried action must lead straight back to its verify", () => {
  const problems = strict(branchy((f) => { f.edges.push({ from: "action", to: "human_failed", when: "partial" }); }));
  has(problems, /cycle: /);
  has(problems, /edge verify -> action is labelled "retry"/);
});

test("a verify node with two retry edges is rejected", () => {
  const problems = strict(branchy((f) => {
    f.nodes.push(node("verify_ask", "verify"));
    f.edges = f.edges.filter((e) => !(e.from === "action_ask"));
    f.edges.push({ from: "action_ask", to: "verify_ask" }, { from: "verify_ask", to: "log_waiting", when: "ok" },
      { from: "verify_ask", to: "action_ask", when: "retry" }, { from: "verify_ask", to: "action", when: "Retry" });
  }));
  has(problems, /cycle: |labelled "retry"/);
});

test("a disallowed cycle on a branch is reported", () => {
  has(strict(branchy((f) => { f.edges.push({ from: "human_failed", to: "planner", when: "replan" }); })), /cycle: /);
});

test("buildFlow returns a branching flow from the model and checks it strictly", async () => {
  const models = fake([draftOf(BRANCHING_EXAMPLE)]);
  const res = await buildFlow("Frozen food, cold-chain vans.", models);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  assert.deepEqual(res.flow, BRANCHING_EXAMPLE);
  assert.ok(decisionPoints(res.flow!).length >= 4);
  // The prompt asks for a tree and shows the branching example.
  assert.ok(models.systems[0].includes(`"${BRANCHING_EXAMPLE.id}"`));
  assert.match(models.systems[0], /decision tree/i);
  assert.match(models.systems[0], /"retry"/);
});

test("buildFlow rejects a draft whose branch has no when label and retries with that problem", async () => {
  const unlabelled = draftOf(branchy((f) => { delete f.edges.find((e) => e.from === "triage" && e.when === "damage")!.when; }));
  const models = fake([unlabelled, draftOf(BRANCHING_EXAMPLE)]);
  const res = await buildFlow("A parcel carrier.", models);
  assert.equal(res.ok, true);
  assert.equal(models.prompts.length, 2);
  assert.match(models.prompts[1], /- node "triage" branches \d+ ways, so every edge out of it needs a "when" label/);
  assert.match(models.prompts[1], /<previous_attempt>/);
});

test("buildFlow rejects a draft with an unterminated branch after the retry", async () => {
  const open = draftOf(branchy((f) => {
    f.nodes.push(node("planner_billing", "planner"));
    f.edges.push({ from: "triage", to: "planner_billing", when: "billing" });
  }));
  const res = await buildFlow("A parcel carrier.", fake([open, structuredClone(open)]));
  assert.equal(res.ok, false);
  assert.equal(res.flow, undefined);
  has(res.problems, /branch ends at "planner_billing"/);
});
