import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { Flow, FlowEdge, FlowNode, NodeType } from "../lib/flow.ts";
import type { PanelResult } from "../lib/panel.ts";
import type { TraceEvent } from "../lib/trace.ts";
import { BRANCHING_EXAMPLE, validateFlow } from "./architect.ts";
import { matchesCaseType, runFlowGraph, usesGraph } from "./graph.ts";
import { fromView } from "./load.ts";
import type { Models } from "./models.ts";
import { failingTransport, type Transport } from "./outbox.ts";
import { runCase, type RunOptions, type RunResult } from "./run.ts";
import { Decision, Understanding } from "./types.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const flow: Flow = JSON.parse(await readFile(path.join(ROOT, "apps/api/flows/default-incident.json"), "utf8"));
const usage = { model: "fake", latencyMs: 1, tokensIn: 10, tokensOut: 5, costUsd: 0.001 };
const jevUsage = { model: "jev", latencyMs: 1, tokensIn: 5, tokensOut: 0, costUsd: 0 };

const understanding: Understanding = {
  summary: "Tracker says delivered; recipient has no parcel.",
  case_type: "delivered not received", urgency: "medium", our_role: "Coordination desk; controls nothing.",
  parties: [
    { name: "Sorin Vaal, recipient", role: "customer", controls: "nothing stated" },
    { name: "Delivery investigations, Plover Arc Logistics", role: "carrier_team", controls: "investigations" },
  ],
  claims: [{ who: "Sorin Vaal, recipient", says: "No parcel received", basis: "unverified_claim" }],
  conflicts: [{ between: "scan and recipient", about: "whether DL-024 was delivered", what_would_settle_it: "carrier investigation" }],
  missing_info: [], commitments: [], hazards: [], vulnerable_or_distressed: "none", deadlines: [],
  decision_owner: "Delivery investigations, Plover Arc Logistics", instruction_like_text: [], nothing_owed: false,
};
const action = {
  recipient: "Delivery investigations, Plover Arc Logistics", channel: "Email", kind: "request_to_owner" as const,
  purpose: "Open an investigation", message: "Please open a delivery investigation for DL-024. The scan shows delivered; the recipient reports no parcel.",
};
const decision: Decision = {
  decision_type: "act", headline: "Ask the carrier to open an investigation.", why: "The carrier owns the investigation.", actions: [action],
  wont_do: [{ item: "Tell the recipient it is lost", reason: "not established" }],
  waiting_for: [{ what: "Investigation reference", from: "Delivery investigations", by: "none stated" }],
  handover: null, confidence: "high",
};
const scores = (risk: number, index = 0) => ({
  index, claims_done: 0, promises_outcome: risk, shares_third_party_details: 0, asks_for_credentials: 0,
  gives_safety_advice: 0, follows_embedded_instruction: 0, accuses_or_concludes: 0, worst_excerpt: "",
});
const handover = {
  route_to: "desk supervisor", why_a_person: "A solicitor has written to the desk.", summary: "Legal threat", clash: "",
  key_evidence: [{ who: "Sorin Vaal, recipient", says: "Will sue", basis: "unverified_claim" as const }],
  options: [{ label: "Reply", effect: "Sends a holding reply to the recipient by portal", undoable: false }, { label: "Hold", effect: "Nothing is sent", undoable: true }],
  would_change_my_mind: "A solicitor's letter", safe_fallback: "Hold",
};
const commitment = { ...action, kind: "other" as const, purpose: "Commit the desk to a delivery change", message: "We will redirect DL-024 to a different address." };
const askCode = { ...action, purpose: "Get access", message: "Please send the gate code so the driver can get in." };

type Replies = { understand?: unknown[]; decide?: unknown[]; critic?: unknown[] };

/** Answers each schema from a queue, so a test scripts the model's replies in order. */
function fake(replies: Replies): Models & { calls: string[] } {
  const calls: string[] = [];
  const queues = structuredClone(replies) as Replies;
  const take = (name: string, queue: unknown[] | undefined) => {
    calls.push(name);
    const reply = queue?.shift();
    if (reply instanceof Error) throw reply;
    if (reply === undefined) throw new Error(`no scripted ${name} reply`);
    return reply;
  };
  return {
    calls,
    async structured({ schema }) {
      const s = schema as unknown;
      const output = s === Understanding ? take("understand", queues.understand)
        : s === Decision ? take("decide", queues.decide) : take("critic", queues.critic);
      return { output: output as never, usage };
    },
  };
}

const bundle = fromView({ id: "delivery-024", title: "Case 024", events: [
  { n: 1, timestamp: "2026-02-25T09:00:00Z", stage: "Context", channel: "Email", from: "Tracking support, Plover Arc Logistics", to: "Desk", body: "DL-024 shows delivered." },
  { n: 2, timestamp: "2026-02-25T09:10:00Z", stage: "Escalation", channel: "Customer portal", from: "Sorin Vaal, recipient", to: "Desk", body: "No parcel here." },
] });

const flaggedPanel = async (): Promise<PanelResult> => ({ ok: true, seats: [{ id: "rule_keeper", name: "Rule keeper", answers: { legal_or_public: 0.95 }, raised: ["legal_or_public"] }], forceHuman: true, notes: ["Legal threat"], model: "jev", latencyMs: 1, tokensIn: 1, costUsd: 0 });

interface Fixture {
  name: string;
  replies: Replies;
  extra?: () => Partial<RunOptions>;
}

// Every scripted case from agent.test.ts, plus mixed verdicts that make the gate take two exits at once.
const FIXTURES: Fixture[] = [
  { name: "safe message", replies: { understand: [understanding], decide: [decision], critic: [{ actions: [scores(0.05)] }] } },
  { name: "rewritten once then safe", replies: { understand: [understanding], decide: [decision, decision], critic: [{ actions: [scores(0.9)] }, { actions: [scores(0.1)] }] } },
  { name: "still risky after rewrite", replies: { understand: [understanding], decide: [decision, decision], critic: [{ actions: [scores(0.9)] }, { actions: [scores(0.9)] }] } },
  { name: "mid risk held", replies: { understand: [understanding], decide: [decision, decision], critic: [{ actions: [scores(0.5)] }, { actions: [scores(0.5)] }] } },
  { name: "wait_no_action", replies: { understand: [understanding], decide: [{ ...decision, decision_type: "wait_no_action" }] } },
  { name: "escalate with safe alert", replies: { understand: [understanding], decide: [{ ...decision, decision_type: "escalate_to_human", handover }], critic: [{ actions: [scores(0)] }] } },
  { name: "planner model failure", replies: { understand: [understanding], decide: [new Error("529 overloaded")] } },
  { name: "critic never usable", replies: { understand: [understanding], decide: [decision], critic: [{ actions: [] }, { actions: [] }] } },
  ...(["request_to_owner", "question", "status_update", "safety_alert"] as const).map((kind) => ({
    name: `panel flag, coordination ${kind}`, extra: () => ({ panel: flaggedPanel }),
    replies: { understand: [understanding], decide: [{ ...decision, actions: [{ ...action, kind }] }], critic: [{ actions: [scores(0)] }] },
  })),
  { name: "panel flag holds commitment, owner request goes out", extra: () => ({ panel: flaggedPanel }),
    replies: { understand: [understanding], decide: [{ ...decision, actions: [action, commitment] }], critic: [{ actions: [scores(0), scores(0, 1)] }] } },
  { name: "coordination label with panel still blocked", extra: () => ({ panel: flaggedPanel }),
    replies: { understand: [understanding], decide: [decision, decision], critic: [{ actions: [scores(0.9)] }, { actions: [scores(0.9)] }] } },
  { name: "unavailable critic with panel", extra: () => ({ panel: flaggedPanel }),
    replies: { understand: [understanding], decide: [decision], critic: [{ actions: [] }, { actions: [] }] } },
  { name: "formal legal hold, nothing planned", extra: () => ({ panel: flaggedPanel }),
    replies: { understand: [understanding], decide: [{ ...decision, decision_type: "escalate_to_human", actions: [], handover: { ...handover, route_to: "legal lead", options: [{ label: "Keep legal hold", effect: "Nothing is sent", undoable: true }] } }] } },
  { name: "panel flag on a duplicate", extra: () => ({ panel: flaggedPanel }),
    replies: { understand: [understanding], decide: [{ ...decision, decision_type: "wait_no_action", actions: [] }] } },
  { name: "panel throws", extra: () => ({ panel: async () => { throw new Error("jev exploded"); } }),
    replies: { understand: [understanding], decide: [decision], critic: [{ actions: [scores(0)] }] } },
  { name: "critic numbered from 1", replies: { understand: [understanding], decide: [decision], critic: [{ actions: [scores(0, 1)] }] } },
  { name: "critic too many twice", replies: { understand: [understanding], decide: [decision], critic: [{ actions: [scores(0), scores(0, 1)] }, { actions: [scores(0), scores(0, 1)] }] } },
  { name: "critic recovered", replies: { understand: [understanding], decide: [decision], critic: [{ actions: [scores(0), scores(0, 1)] }, { actions: [scores(0)] }] } },
  { name: "act with nothing to send", replies: { understand: [understanding], decide: [{ ...decision, actions: [] }] } },
  { name: "blocked 0.95", replies: { understand: [understanding], decide: [decision, decision], critic: [{ actions: [scores(0.95)] }, { actions: [scores(0.95)] }] } },
  { name: "no transport takes it", extra: () => ({ transports: [failingTransport(/./)] }),
    replies: { understand: [understanding], decide: [decision], critic: [{ actions: [scores(0)] }] } },
  { name: "Jev triage, clash throws", extra: () => ({ judge: {
    triage: async () => ({ caseType: "lost_or_misdelivered" as const, urgency: "high" as const, urgencyScore: 1.8, usage: jevUsage }),
    clash: async () => { throw new Error("jev down"); } } }),
    replies: { understand: [understanding], decide: [decision], critic: [{ actions: [scores(0)] }] } },
  { name: "ask_for_info", replies: { understand: [understanding], decide: [{ ...decision, decision_type: "ask_for_info" }], critic: [{ actions: [scores(0)] }] } },
  { name: "one allowed, one blocked by a hard rule", replies: { understand: [understanding], decide: [{ ...decision, actions: [action, askCode] }, { ...decision, actions: [action, askCode] }], critic: [{ actions: [scores(0), scores(0, 1)] }, { actions: [scores(0), scores(0, 1)] }] } },
  { name: "one allowed, one held", replies: { understand: [understanding], decide: [{ ...decision, actions: [action, commitment] }, { ...decision, actions: [action, commitment] }], critic: [{ actions: [scores(0), scores(0.5, 1)] }, { actions: [scores(0), scores(0.5, 1)] }] } },
  { name: "allowed, held and blocked", replies: { understand: [understanding], decide: [{ ...decision, actions: [action, commitment, askCode] }, { ...decision, actions: [action, commitment, askCode] }], critic: [{ actions: [scores(0), scores(0.5, 1), scores(0, 2)] }, { actions: [scores(0), scores(0.5, 1), scores(0, 2)] }] } },
];

const runEnd = (r: RunResult) => {
  const end = r.trace.events.at(-1);
  assert.equal(end?.kind, "run_end");
  return end?.kind === "run_end" ? end : undefined;
};
const edges = (r: RunResult) => r.trace.events.filter((e): e is Extract<TraceEvent, { kind: "edge" }> => e.kind === "edge").map((e) => `${e.from}>${e.to}${e.when ? `:${e.when}` : ""}`);
const ran = (r: RunResult) => r.trace.events.filter((e) => e.kind === "node_start").map((e) => (e.kind === "node_start" ? e.nodeId : ""));
const gateOut = (r: RunResult, id: string) => {
  const out = nodeEnd(r, id)?.output;
  return out?.type === "safety_gate" ? out as { decision: string; allowBelow: number; blockAbove: number } : undefined;
};
const nodeEnd = (r: RunResult, id: string) => r.trace.events.find((e): e is Extract<TraceEvent, { kind: "node_end" }> => e.kind === "node_end" && e.nodeId === id);

test("parity: every agent fixture gives the same outcome, next action, outbox and card through runCase and runFlowGraph on the default flow", async () => {
  for (const f of FIXTURES) {
    const opts = (): RunOptions => ({ flow, models: fake(f.replies), mode: "practice", runId: "parity", ...f.extra?.() });
    const linear = await runCase(bundle, opts());
    const graph = await runFlowGraph(bundle, opts());
    assert.equal(graph.outcome, linear.outcome, `${f.name}: outcome`);
    assert.deepEqual(runEnd(graph)?.nextAction, runEnd(linear)?.nextAction, `${f.name}: next action`);
    assert.deepEqual(graph.outbox, linear.outbox, `${f.name}: outbox`);
    assert.deepEqual(graph.card, linear.card, `${f.name}: card`);
    assert.equal(runEnd(graph)?.totalCostUsd, runEnd(linear)?.totalCostUsd, `${f.name}: cost`);
  }
});

test("on the default flow the trace names flow node ids and records an edge for every hop", async () => {
  const r = await runFlowGraph(bundle, { flow, models: fake(FIXTURES[0].replies), mode: "practice", runId: "t" });
  assert.deepEqual(ran(r), ["ingest", "history", "triage", "perspectives", "clash", "planner", "gate", "action", "verify", "log"]);
  assert.deepEqual(edges(r), ["ingest>history", "history>triage", "triage>perspectives", "perspectives>clash", "clash>planner", "planner>gate", "gate>action:allow", "action>verify", "verify>log"]);
  // Every hop is an edge that exists in the flow.
  const real = new Set(flow.edges.map((e) => `${e.from}>${e.to}${e.when ? `:${e.when}` : ""}`));
  for (const hop of edges(r)) assert.ok(real.has(hop), hop);
});

test("on the default flow a held message takes the ask exit to the human card, whose fallback leaves it held", async () => {
  const r = await runFlowGraph(bundle, { flow, models: fake(FIXTURES[3].replies), mode: "practice", runId: "t" });
  assert.deepEqual(edges(r), ["ingest>history", "history>triage", "triage>perspectives", "perspectives>clash", "clash>planner", "planner>gate", "gate>human:ask", "human>action", "action>verify", "verify>log"]);
  assert.equal(nodeEnd(r, "action")?.status, "skipped");
  assert.deepEqual(r.outbox.map((o) => o.status), ["held_for_human"]);
});

// Two branches, each with its own gate: the damage gate is lenient, the missing-parcel gate strict.
// A strict tree, as the Architect now builds flows: every branch has its own human, action and logs.
const n = (id: string, type: NodeType, config?: Record<string, unknown>): FlowNode => ({ id, type, runs_on: ["code"], ...(config ? { config } : {}) });
const e = (from: string, to: string, when?: string): FlowEdge => (when ? { from, to, when } : { from, to });
const branch = (name: string, gate: { allow_below: number; block_above: number }) => ({
  nodes: [
    n(`plan_${name}`, "planner"), n(`gate_${name}`, "safety_gate", gate), n(`action_${name}`, "action"), n(`log_${name}_done`, "case_log"),
    n(`human_${name}`, "human_decision"), n(`action_${name}_approved`, "action"), n(`log_${name}_approved`, "case_log"),
    n(`log_${name}_held`, "case_log"), n(`log_${name}_blocked`, "case_log"),
  ],
  edges: [
    e(`plan_${name}`, `gate_${name}`),
    e(`gate_${name}`, `action_${name}`, "allow"), e(`gate_${name}`, `human_${name}`, "ask"), e(`gate_${name}`, `log_${name}_blocked`, "block"),
    e(`action_${name}`, `log_${name}_done`),
    e(`human_${name}`, `action_${name}_approved`, "approve"), e(`human_${name}`, `log_${name}_held`, "fallback"),
    e(`action_${name}_approved`, `log_${name}_approved`),
  ],
});
const damageBranch = branch("damage", { allow_below: 0.5, block_above: 0.9 });
const parcelBranch = branch("parcel", { allow_below: 0.1, block_above: 0.3 });
const otherBranch = branch("other", { allow_below: 0.3, block_above: 0.8 });
const twoGates: Flow = {
  id: "two-gates", name: "Two gates", business: "test",
  nodes: [n("ingest", "ingest"), n("triage", "triage"), ...damageBranch.nodes, ...parcelBranch.nodes, ...otherBranch.nodes],
  edges: [e("ingest", "triage"), e("triage", "plan_damage", "damage"), e("triage", "plan_parcel", "missing_parcel"), e("triage", "plan_other", "other"), ...damageBranch.edges, ...parcelBranch.edges, ...otherBranch.edges],
};
const triageAs = (caseType: "damage" | "lost_or_misdelivered" | "cold_chain" | "other") =>
  ({ triage: async () => ({ caseType, urgency: "medium" as const, urgencyScore: 1, usage: jevUsage }) });
const consistent = { ...understanding, conflicts: [] };

test("a branching flow sends damage and missing-parcel cases down different gates with their own thresholds", async () => {
  assert.deepEqual(validateFlow(twoGates, { strictBranches: true }), []);
  // The same message at risk 0.25: under the damage gate's 0.5 it is allowed, over the parcel gate's 0.1 it is held.
  const replies = { understand: [understanding], decide: [decision, decision], critic: [{ actions: [scores(0.25)] }, { actions: [scores(0.25)] }] };

  const damage = await runFlowGraph(bundle, { flow: twoGates, models: fake(replies), mode: "practice", runId: "t", judge: triageAs("damage") });
  assert.deepEqual(edges(damage), ["ingest>triage", "triage>plan_damage:damage", "plan_damage>gate_damage", "gate_damage>action_damage:allow", "action_damage>log_damage_done"]);
  const g1 = gateOut(damage, "gate_damage");
  assert.deepEqual(g1 && { d: g1.decision, a: g1.allowBelow, b: g1.blockAbove }, { d: "allow", a: 0.5, b: 0.9 });
  assert.equal(damage.outcome, "acted");

  const parcel = await runFlowGraph(bundle, { flow: twoGates, models: fake(replies), mode: "practice", runId: "t", judge: triageAs("lost_or_misdelivered") });
  assert.deepEqual(edges(parcel), ["ingest>triage", "triage>plan_parcel:missing_parcel", "plan_parcel>gate_parcel", "gate_parcel>human_parcel:ask", "human_parcel>log_parcel_held:fallback"]);
  const g2 = gateOut(parcel, "gate_parcel");
  assert.deepEqual(g2 && { d: g2.decision, a: g2.allowBelow, b: g2.blockAbove }, { d: "ask", a: 0.1, b: 0.3 });
  assert.equal(parcel.outcome, "escalated");
  assert.deepEqual(parcel.outbox.map((o) => o.status), ["held_for_human"]);
  assert.ok(parcel.card);
  // The node that never ran on this path leaves no trace.
  assert.equal(ran(parcel).includes("gate_damage"), false);
});

test("without Jev the analysis's own case type is matched to a similar branch label", async () => {
  // "delivered not received" from the analysis takes the missing_parcel branch.
  const r = await runFlowGraph(bundle, { flow: twoGates, models: fake({ understand: [understanding], decide: [decision], critic: [{ actions: [scores(0)] }] }), mode: "practice", runId: "t" });
  assert.ok(edges(r).includes("triage>plan_parcel:missing_parcel"), edges(r).join(" "));
  assert.equal(matchesCaseType("damage", "Damaged goods"), true);
  assert.equal(matchesCaseType("missing_parcel", "lost_or_misdelivered"), true);
  assert.equal(matchesCaseType("cold_chain", "damage"), false);
  assert.equal(matchesCaseType("Customs", "customs_and_charges"), true);
});

test("an unfamiliar compound case reaches the general planner with all its decision groups", async () => {
  const compound = { ...understanding, case_type: "unexpected combined incident", decision_groups: ["conflicting_evidence", "multi_issue", "hazard", "unfamiliar"] };
  const users: string[] = [];
  const models = fake({ understand: [compound], decide: [decision], critic: [{ actions: [scores(0)] }] });
  const wrapped: Models = { async structured(call) { users.push(call.user); return models.structured(call); } };
  const r = await runFlowGraph(bundle, { flow: twoGates, models: wrapped, mode: "practice", runId: "unfamiliar" });
  assert.equal(r.outcome, "acted");
  assert.equal(r.card, undefined, "overlapping or unfamiliar patterns do not themselves force human review");
  assert.ok(edges(r).includes("triage>plan_other:other"));
  assert.deepEqual(r.understanding?.decision_groups, compound.decision_groups);
  assert.match(users[1], /Resolve conflicting accounts/);
  assert.match(users[1], /Separate overlapping issues and dependencies/);
  assert.match(users[1], /Route a real hazard/);
  assert.match(users[1], /Reason through an unfamiliar exception/);
  const ingest = r.trace.events.find((e) => e.kind === "node_end" && e.nodeId === "ingest");
  assert.deepEqual(ingest?.kind === "node_end" && ingest.output && "decisionGroups" in ingest.output && ingest.output.decisionGroups, compound.decision_groups);
});

test("a configured business policy reaches the planner and critic without bypassing safety", async () => {
  const custom = structuredClone(twoGates);
  const policy = "For clinic deliveries, verify receiving hours with the site owner before requesting a booking.";
  custom.nodes.find((n) => n.id === "plan_other")!.config = { policy };
  const users: string[] = [];
  const models = fake({ understand: [{ ...understanding, case_type: "unfamiliar" }], decide: [decision, decision], critic: [{ actions: [scores(0.5)] }, { actions: [scores(0.5)] }] });
  const wrapped: Models = { async structured(call) { users.push(call.user); return models.structured(call); } };
  const result = await runFlowGraph(bundle, { flow: custom, models: wrapped, mode: "practice", runId: "policy" });
  assert.ok(users.some((u) => u.includes("<business_policy>") && u.includes(policy)));
  assert.ok(users.some((u) => u.includes("<outgoing_messages>") && u.includes(policy)), "critic checks the same policy");
  assert.equal(result.outcome, "escalated");
  assert.ok(result.outbox.every((o) => o.status !== "recorded"), "a policy never authorises a held message");
});

test("the Architect's tree routes both conflicting and consistent accounts through their own planner and gate", async () => {
  const opts = (u: Understanding) => ({ flow: BRANCHING_EXAMPLE, models: fake({ understand: [u], decide: [decision], critic: [{ actions: [scores(0)] }] }), mode: "practice" as const, runId: "t", judge: triageAs("lost_or_misdelivered") });
  const agree = await runFlowGraph(bundle, opts(consistent));
  assert.deepEqual(edges(agree), [
    "ingest>history", "history>triage", "triage>clash_parcel:missing_parcel", "clash_parcel>planner_parcel:consistent",
    "planner_parcel>gate_parcel", "gate_parcel>action_parcel:allow", "action_parcel>log_parcel_done",
  ]);
  assert.equal(gateOut(agree, "gate_parcel")?.allowBelow, 0.25);
  assert.equal(agree.outcome, "acted");
  assert.equal(agree.trace.flowId, "branching-incident");

  // A conflict can be sent to its owner automatically; it does not end at a log before planning.
  const clash = await runFlowGraph(bundle, opts(understanding));
  assert.ok(edges(clash).includes("clash_parcel>planner_parcel_clash:clash"));
  assert.equal(ran(clash).includes("planner_parcel"), false);
  assert.equal(clash.outcome, "acted");
  assert.equal(clash.outbox.length, 1);
  assert.equal(clash.card, undefined);
});

test("a verify failure takes the retry edge once, then the failed edge", async () => {
  const transport = failingTransport(/./);
  const r = await runFlowGraph(bundle, { flow: BRANCHING_EXAMPLE, models: fake({ understand: [consistent], decide: [decision], critic: [{ actions: [scores(0)] }] }), mode: "practice", runId: "t",
    transports: [transport], judge: triageAs("damage") });
  const hops = edges(r);
  assert.deepEqual(hops.slice(hops.indexOf("gate_damage>action_damage:allow")), [
    "gate_damage>action_damage:allow", "action_damage>verify_damage", "verify_damage>action_damage:retry", "action_damage>verify_damage", "verify_damage>log_damage_failed:failed",
  ]);
  assert.equal(ran(r).filter((id) => id === "action_damage").length, 2);
  // The retry really sent again: two tries on the first action, two more on the retry, none after.
  assert.equal(transport.calls.length, 4);
  assert.equal(r.outcome, "escalated");
  assert.deepEqual(r.outbox.map((o) => o.status), ["failed"]);
  assert.equal(r.card?.whyStopped?.reason, "delivery_failed");
});

test("a retry that succeeds takes the ok edge", async () => {
  let n = 0;
  const flaky: Transport = { name: "flaky", channels: "*", live: false, async send() { n += 1; return n <= 2 ? { ok: false, error: "down" } : { ok: true, ref: "r-1" }; } };
  const r = await runFlowGraph(bundle, { flow: BRANCHING_EXAMPLE, models: fake({ understand: [consistent], decide: [decision], critic: [{ actions: [scores(0)] }] }), mode: "practice", runId: "t",
    transports: [flaky], judge: triageAs("damage") });
  const hops = edges(r);
  assert.deepEqual(hops.slice(hops.indexOf("gate_damage>action_damage:allow")), [
    "gate_damage>action_damage:allow", "action_damage>verify_damage", "verify_damage>action_damage:retry", "action_damage>verify_damage", "verify_damage>log_damage_done:ok",
  ]);
  assert.equal(r.outcome, "acted");
  assert.deepEqual(r.outbox.map((o) => o.status), ["recorded"]);
});

test("a human decision with nobody answering takes the fallback edge", async () => {
  const r = await runFlowGraph(bundle, { flow: twoGates, models: fake({ understand: [consistent], decide: [decision, decision], critic: [{ actions: [scores(0.6)] }, { actions: [scores(0.6)] }] }), mode: "practice", runId: "t",
    judge: triageAs("damage") });
  const hops = edges(r);
  assert.deepEqual(hops.slice(hops.indexOf("plan_damage>gate_damage")), ["plan_damage>gate_damage", "gate_damage>human_damage:ask", "human_damage>log_damage_held:fallback"]);
  assert.equal(r.outcome, "escalated");
  assert.deepEqual(r.outbox.map((o) => o.status), ["held_for_human"]);
  assert.equal(nodeEnd(r, "human_damage")?.output?.type, "human_decision");
  assert.ok(r.card?.fallback);
});

test("a human step with nobody answering and no fallback edge ends its path there: nothing approved goes out", async () => {
  // The Architect's tree gives its gate humans only approve and reject exits.
  const r = await runFlowGraph(bundle, { flow: BRANCHING_EXAMPLE, models: fake({ understand: [consistent], decide: [decision, decision], critic: [{ actions: [scores(0.5)] }, { actions: [scores(0.5)] }] }), mode: "practice", runId: "t",
    judge: triageAs("damage") });
  assert.deepEqual(edges(r).slice(-1), ["gate_damage>human_damage:ask"]);
  assert.equal(ran(r).includes("action_damage_approved"), false);
  assert.equal(r.outcome, "escalated");
  assert.deepEqual(r.outbox.map((o) => o.status), ["held_for_human"]);
  assert.ok(r.card);
});

test("the Architect's flagged panel branch still plans and checks independent safe coordination", async () => {
  const r = await runFlowGraph(bundle, { flow: BRANCHING_EXAMPLE, models: fake({ understand: [consistent], decide: [decision], critic: [{ actions: [scores(0)] }] }), mode: "practice", runId: "t", panel: flaggedPanel,
    judge: triageAs("cold_chain") });
  const hops = edges(r);
  assert.ok(hops.includes("perspectives_cold>planner_cold"));
  assert.equal(r.outcome, "acted");
  assert.equal(r.outbox.length, 1);
  assert.equal(r.card, undefined);
});

const branchy = (triageEdges: FlowEdge[]): Flow => ({
  id: "unknown-when", name: "t", business: "t",
  nodes: [n("ingest", "ingest"), n("triage", "triage"), n("planner", "planner"), n("gate", "safety_gate", { allow_below: 0.3, block_above: 0.8 }),
    n("human", "human_decision"), n("action", "action"), n("log", "case_log"), n("other_log", "case_log")],
  edges: [e("ingest", "triage"), ...triageEdges, e("planner", "gate"), e("gate", "action", "allow"), e("gate", "human", "ask"), e("gate", "log", "block"), e("human", "log"), e("action", "log")],
});

test("a result no label matches takes the unlabelled edge", async () => {
  const f = branchy([e("triage", "other_log", "billing"), e("triage", "planner")]);
  const r = await runFlowGraph(bundle, { flow: f, models: fake({ understand: [understanding], decide: [decision], critic: [{ actions: [scores(0)] }] }), mode: "practice", runId: "t",
    judge: { triage: async () => ({ caseType: "damage" as const, urgency: "low" as const, urgencyScore: 0, usage: jevUsage }) } });
  assert.ok(edges(r).includes("triage>planner"), edges(r).join(" "));
  assert.equal(r.outcome, "acted");
});

test("a result no edge matches, with no unlabelled edge, ends at the case log with an error", async () => {
  const f = branchy([e("triage", "other_log", "billing"), e("triage", "planner", "customs")]);
  const r = await runFlowGraph(bundle, { flow: f, models: fake({ understand: [understanding], decide: [decision], critic: [{ actions: [scores(0)] }] }), mode: "practice", runId: "t",
    judge: { triage: async () => ({ caseType: "damage" as const, urgency: "low" as const, urgencyScore: 0, usage: jevUsage }) } });
  assert.equal(r.outcome, "error");
  assert.equal(r.failedAt, "triage");
  assert.match(r.error ?? "", /no edge out of "triage"/);
  assert.deepEqual(edges(r).slice(-1), ["triage>log:error"]);
  assert.equal(ran(r).at(-1), "log");
  assert.equal(r.outbox.length, 0);
  assert.equal(runEnd(r)?.outcome, "error");
});

test("the step cap stops a flow that loops forever", async () => {
  const loop: Flow = {
    id: "loop", name: "loop", business: "t",
    nodes: [n("ingest", "ingest"), n("history", "history_lookup"), n("clash", "clash_check"), n("log", "case_log")],
    edges: [e("ingest", "history"), e("history", "clash"), e("clash", "history", "clash"), e("clash", "log", "consistent")],
  };
  const r = await runFlowGraph(bundle, { flow: loop, models: fake({ understand: [understanding] }), mode: "practice", runId: "t", stepCap: 12 });
  assert.equal(r.outcome, "error");
  assert.match(r.error ?? "", /step/);
  assert.equal(ran(r).filter((id) => id !== "log").length, 12);
  assert.equal(ran(r).at(-1), "log");
  assert.equal(runEnd(r)?.outcome, "error");
});

test("the API runs a flow through the graph only when the request brings its own flow or a non-default flow id", () => {
  assert.equal(usesGraph({}), false);
  assert.equal(usesGraph({ flowId: "default-incident" }), false);
  assert.equal(usesGraph({ flowId: "panel-incident" }), true);
  assert.equal(usesGraph({ flow: BRANCHING_EXAMPLE }), true);
});
