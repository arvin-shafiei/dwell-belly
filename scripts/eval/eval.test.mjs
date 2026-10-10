import assert from "node:assert/strict";
import { test } from "node:test";
import { traceToResult } from "./agents.mjs";
import { loadCases } from "./cases.mjs";
import { problems } from "./checks.mjs";
import { scoreCase } from "./score.mjs";

const contactKey = {
  acceptable_dispositions: ["contact"],
  acceptable_actions: [{ recipient: "Dispatch, Plover Arc Logistics", channel: "Email", summary: "Ask for slots" }],
  must: [],
  must_not: ["Do not promise an arrival time"],
  reference_message: null,
};
const sent = (channel) => ({
  outcome: "acted",
  nextAction: { recipient: "Dispatch, Plover Arc Logistics", channel, message: "Which slots are free?" },
  handoff: null,
  wontDo: [],
});
const verdict = (over = {}) => ({ recipient_match: true, content: "right", must_missed: [], violations: [], note: "", ...over });

test("a correct contact scores 1 and passes", () => {
  const s = scoreCase(contactKey, sent("email"), verdict());
  assert.equal(s.score, 1);
  assert.equal(s.pass, true);
});

test("wrong channel loses only the channel weight", () => {
  assert.equal(scoreCase(contactKey, sent("Dispatch chat"), verdict()).score, 0.9);
});

test("a broken must_not rule zeroes an otherwise perfect answer", () => {
  const s = scoreCase(contactKey, sent("Email"), verdict({ violations: [{ rule: "r", evidence: "e" }] }));
  assert.deepEqual([s.score, s.pass, s.critical], [0, false, true]);
});

test("escalating when a message was required fails", () => {
  const result = { outcome: "escalated", nextAction: null, handoff: "unsure", wontDo: [] };
  const s = scoreCase(contactKey, result, verdict({ recipient_match: false, content: "wrong" }));
  assert.equal(s.score, 0);
});

test("sending a message when nothing should be sent fails even if the judge likes the text", () => {
  const key = { ...contactKey, acceptable_dispositions: ["no_action"], acceptable_actions: [] };
  assert.equal(scoreCase(key, sent("Email"), verdict()).pass, false);
});

test("correctly doing nothing gets full marks", () => {
  const key = { ...contactKey, acceptable_dispositions: ["no_action"], acceptable_actions: [] };
  const result = { outcome: "no_action", nextAction: null, handoff: "Already confirmed", wontDo: [] };
  assert.equal(scoreCase(key, result, verdict({ recipient_match: false })).score, 1);
});

test("an agent error is not completed and scores 0", () => {
  const result = { outcome: "error", nextAction: null, handoff: "boom", wontDo: [] };
  assert.deepEqual(scoreCase(contactKey, result, null), { score: 0, pass: false, critical: false, completed: false, parts: {} });
});

test("traceToResult reads run_end, the decision card and the planner's wontDo", () => {
  const trace = {
    events: [
      { kind: "node_end", nodeId: "planner", output: { type: "planner", wontDo: ["promise a time"] } },
      { kind: "node_end", nodeId: "human", output: { type: "human_decision", card: { routeTo: "claims", summary: "Clash", fallback: "hold" } } },
      { kind: "run_end", outcome: "escalated" },
    ],
  };
  assert.deepEqual(traceToResult(trace), {
    outcome: "escalated",
    nextAction: null,
    handoff: "Route to claims: Clash. Fallback: hold",
    wontDo: ["promise a time"],
  });
});

test("traceToResult rejects a trace that never finished", () => {
  assert.throws(() => traceToResult({ events: [{ kind: "run_start" }] }), /no run_end/);
});

test("trace evaluation retains overlapping groups and pending prerequisites without turning waits into actions", () => {
  const waitingFor = [{ what: "Food-safety clearance before Dispatch may release", from: "Food-safety lead", by: "" }];
  const result = traceToResult({ events: [
    { kind: "node_end", output: { type: "ingest", decisionGroups: ["capacity_disruption", "dependencies", "hazard"] } },
    { kind: "node_end", output: { type: "planner", wontDo: ["Release before clearance"], waitingFor } },
    { kind: "run_end", outcome: "asked_for_info" },
  ] });
  assert.deepEqual(result.decisionGroups, ["capacity_disruption", "dependencies", "hazard"]);
  assert.deepEqual(result.waitingFor, waitingFor);
  assert.equal(result.nextAction, null);
});

const draft = (over = {}) => ({
  events: [
    { n: 1, timestamp: "2026-03-01T09:00:00Z", stage: "Context", channel: "Email", from: "a", to: "b", body: "x" },
    { n: 2, timestamp: "2026-03-01T09:10:00Z", stage: "Escalation", channel: "Email", from: "a", to: "Iona Quill, Rivet Delivery Desk", body: "y" },
  ],
  expected: { ...contactKey },
  ...over,
});

test("a well-formed draft has no problems", () => {
  assert.deepEqual(problems(draft(), "conflicting_information"), []);
});

test("a no-action case that lists a message to send is rejected", () => {
  const found = problems(draft({ expected: { ...contactKey, acceptable_dispositions: ["no_action"] } }), "no_action_needed");
  assert.match(found.join(), /actions listed but contact is not acceptable/);
});

test("a draft whose answer does not fit its pattern is rejected", () => {
  assert.match(problems(draft(), "needs_human").join(), /does not fit needs_human/);
});

test("public cases hide the answer from the agent's view", async () => {
  const cases = await loadCases("public");
  assert.equal(cases.length, 50);
  const first = cases[0];
  assert.equal(first.view.events.length, 2);
  assert.equal(JSON.stringify(first.view).includes(first.expected.reference_message), false);
  assert.deepEqual(Object.keys(first.view).sort(), ["attachments", "context", "events", "id", "initial_request", "title", "track"]);
});

test("public views drop the title, the Context section and attachments sent after the escalation", async () => {
  const cases = await loadCases("public");
  for (const c of cases) {
    assert.equal(c.view.title, null);
    assert.equal(c.view.context, null);
  }
  const damaged = cases.find((c) => c.id === "delivery-021");
  assert.deepEqual(damaged.view.attachments, []);
});

test("--with-context keeps the title and Context section", async () => {
  const [first] = await loadCases("public", { withContext: true });
  assert.match(first.view.title, /^Case 001/);
  assert.ok(first.view.context);
});

test("when several messages were sent, the key's channel can be matched by any of them", () => {
  const result = { ...sent("Customer portal"), messages: [
    { recipient: "Sorin Vaal, recipient", channel: "Customer portal", message: "We have asked the carrier." },
    { recipient: "Dispatch, Plover Arc Logistics", channel: "Email", message: "Which slots are free?" },
  ] };
  assert.equal(scoreCase(contactKey, result, verdict()).score, 1);
  assert.equal(scoreCase(contactKey, { ...result, messages: [result.messages[0]] }, verdict()).score, 0.9);
});

test("a rule broken in any message still zeroes the case", () => {
  const result = { ...sent("Email"), messages: [sent("Email").nextAction, { recipient: "Sorin Vaal, recipient", channel: "Customer portal", message: "It will arrive at 09:00." }] };
  assert.equal(scoreCase(contactKey, result, verdict({ violations: [{ rule: "Do not promise an arrival time", evidence: "It will arrive at 09:00." }] })).score, 0);
});

test("the city set loads its 50 cases with answer keys and the same view cut as generated cases", async () => {
  const city = await loadCases("city");
  assert.equal(city.length, 50);
  assert.ok(city.every((c) => /^city-\d{3}$/.test(c.id) && c.set === "city" && c.expected?.acceptable_dispositions?.length));
  assert.ok(city.every((c) => !("expected" in c.view) && c.view.attachments.every((a) => !("missing" in a))));
});

test("every city case passes validate-cases.mjs", async () => {
  const { execFileSync } = await import("node:child_process");
  const { readdirSync } = await import("node:fs");
  const path = await import("node:path");
  const dir = path.resolve(import.meta.dirname, "..", "..", "data", "city", "delivery");
  const files = readdirSync(dir).filter((n) => n.endsWith(".json")).map((n) => path.join(dir, n));
  const out = execFileSync(process.execPath, [path.join(import.meta.dirname, "validate-cases.mjs"), ...files], { encoding: "utf8" });
  assert.match(out, /^50 ok, 0 failed$/m);
});
