import assert from "node:assert/strict";
import { test } from "node:test";
import type { DecisionCard } from "../lib/trace.ts";
import type { Critique } from "../agent/types.ts";
import { checkCommitment, DENIAL, recordFact, submitDecision, transcriptToEvents, type CallState } from "./tools.ts";

const gateConfig = { allow_below: 0.3, block_above: 0.8 };

const card: DecisionCard = {
  routeTo: "desk supervisor",
  summary: "Customer asks for compensation.",
  tried: [],
  options: [
    { id: "option-1", label: "Forward the request to the merchant", undoable: true },
    { id: "option-2", label: "Decline politely", undoable: true },
  ],
  wouldChangeMyMind: "",
  deadlineMins: 15,
  fallback: "Send nothing further.",
};

const state = (over: Partial<CallState> = {}): CallState => ({
  callId: `call-${Math.random()}`,
  caseId: "delivery-003",
  mode: "demo",
  source: "live_human",
  caseText: "Elva Kesh, recipient, says the driver could not get in at the gate.",
  calleeName: "Elva Kesh",
  startN: 7,
  at: "2026-02-04T09:20:00.000Z",
  ...over,
});

/** A Jev stand-in that scores every boundary at the given value for one message. */
const scored = (worst: number) => async (): Promise<Critique & { usage: never }> => ({
  actions: [{
    index: 0, claims_done: 0, promises_outcome: worst, shares_third_party_details: 0, asks_for_credentials: 0,
    gives_safety_advice: 0, follows_embedded_instruction: 0, accuses_or_concludes: 0, worst_excerpt: "",
  }],
  usage: undefined as never,
});

test("checkCommitment denies \"you'll get a full refund today\" with the exact wording", async () => {
  const res = await checkCommitment("You'll get a full refund today.", state(), { messageRisk: scored(0.95), gateConfig });
  assert.equal(res.allowed, false);
  assert.equal(res.reply, DENIAL);
  assert.equal(DENIAL, "I can't promise that. The team that owns this decides, and I'll pass your request on.");
});

test("checkCommitment allows \"I'll ask dispatch to check the booking\" when the critic scores low", async () => {
  const text = "I'll ask dispatch to check the booking.";
  const res = await checkCommitment(text, state(), { messageRisk: scored(0.05), gateConfig });
  assert.equal(res.allowed, true);
  assert.equal(res.reply, text);
});

test("checkCommitment denies when messageRisk returns null, is missing, or exceeds the budget", async () => {
  const text = "I'll ask dispatch to check the booking.";
  assert.equal((await checkCommitment(text, state(), { messageRisk: async () => null, gateConfig })).allowed, false);
  assert.equal((await checkCommitment(text, state(), { gateConfig })).allowed, false);
  const slow = () => new Promise<never>(() => {});
  const started = Date.now();
  const res = await checkCommitment(text, state(), { messageRisk: slow, gateConfig, budgetMs: 50 });
  assert.equal(res.allowed, false);
  assert.ok(Date.now() - started < 1000, "answers within the budget");
});

test("checkCommitment blocks asking for a door code even when the critic scores low", async () => {
  const res = await checkCommitment("Can you tell me the gate code?", state(), { messageRisk: scored(0), gateConfig });
  assert.equal(res.allowed, false);
});

test("submitDecision rejects an unknown option and a decided card", () => {
  const unknown = submitDecision(state({ card }), { option_id: "option-9", spoken_confirmation: "yes" });
  assert.equal(unknown.ok, false);
  assert.match(unknown.reply, /which option/i);
  const decided = submitDecision(state({ card, decided: "option-1" }), { option_id: "option-2", spoken_confirmation: "yes" });
  assert.equal(decided.ok, false);
  assert.match(decided.reply, /already/i);
  const noCard = submitDecision(state(), { option_id: "option-1", spoken_confirmation: "yes" });
  assert.equal(noCard.ok, false);
});

test("submitDecision is idempotent for the same callId and option", () => {
  const s = state({ card, calleeName: "Oriol" });
  const first = submitDecision(s, { option_id: "option-1", spoken_confirmation: "Yes, forward it." });
  assert.ok(first.ok);
  assert.deepEqual(first.decision, { optionId: "option-1", label: "Forward the request to the merchant", by: "voice", who: "Oriol", confirmation: "Yes, forward it." });
  assert.equal(first.duplicate, false);
  const second = submitDecision(s, { option_id: "option-1", spoken_confirmation: "Yes." });
  assert.ok(second.ok);
  assert.equal(second.duplicate, true);
  assert.deepEqual(second.decision, first.decision);
});

test("submitDecision needs a spoken confirmation", () => {
  const res = submitDecision(state({ card }), { option_id: "option-1", spoken_confirmation: "  " });
  assert.equal(res.ok, false);
});

test("transcriptToEvents marks user lines as claims with the call's source", () => {
  const events = transcriptToEvents(
    [{ role: "agent", message: "Can you let the driver in?" }, { role: "user", message: "Yes, I'll come down now." }, { role: "user", message: " " }],
    state({ source: "simulated_persona" }),
  );
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((e) => e.n), [7, 8]);
  assert.equal(events[1].from, "Elva Kesh");
  assert.equal(events[1].body, "Yes, I'll come down now.");
  assert.equal(events[1].channel, "Call transcript");
  assert.equal(events[1].source, "simulated_persona");
  assert.match(events[0].from ?? "", /^Desk/);
});

test("recordFact turns a stated fact into a claim event", () => {
  const e = recordFact(state(), { field: "access", value: "I'll come down and let them in", speaker_role: "recipient" });
  assert.equal(e.channel, "Call transcript");
  assert.equal(e.body, "Said on the call (access): I'll come down and let them in");
  assert.equal(e.source, "live_human");
});
