import assert from "node:assert/strict";
import { test } from "node:test";
import { traceToResult } from "./agents.mjs";
import { loadCases } from "./cases.mjs";
import { problems } from "./gen-cases.mjs";
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
