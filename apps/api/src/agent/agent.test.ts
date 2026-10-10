import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { Flow } from "../lib/flow.ts";
import { hardRules } from "./gate.ts";
import { fromView, loadFolder } from "./load.ts";
import type { Models } from "./models.ts";
import { renderAnswer, renderReasoning } from "./report.ts";
import { runCase } from "./run.ts";
import { Decision, Understanding } from "./types.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const flow: Flow = JSON.parse(await readFile(path.join(ROOT, "apps/api/flows/default-incident.json"), "utf8"));
const usage = { model: "fake", latencyMs: 1, tokensIn: 10, tokensOut: 5, costUsd: 0.001 };

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
  decision_type: "act", why: "The carrier owns the investigation.", actions: [action],
  wont_do: [{ item: "Tell the recipient it is lost", reason: "not established" }],
  waiting_for: [{ what: "Investigation reference", from: "Delivery investigations", by: "none stated" }],
  handover: null, confidence: "high",
};
const scores = (risk: number) => ({
  index: 0, claims_done: 0, promises_outcome: risk, shares_third_party_details: 0, asks_for_credentials: 0,
  gives_safety_advice: 0, follows_embedded_instruction: 0, accuses_or_concludes: 0, worst_excerpt: "",
});

/** Answers each schema from a queue, so a test scripts the model's replies in order. */
function fake(replies: { understand?: unknown[]; decide?: unknown[]; critic?: unknown[] }): Models & { calls: string[] } {
  const calls: string[] = [];
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
      const output = s === Understanding ? take("understand", replies.understand)
        : s === Decision ? take("decide", replies.decide) : take("critic", replies.critic);
      return { output: output as never, usage };
    },
  };
}

const bundle = fromView({ id: "delivery-024", title: "Case 024", events: [
  { n: 1, timestamp: "2026-02-25T09:00:00Z", stage: "Context", channel: "Email", from: "Tracking support, Plover Arc Logistics", to: "Desk", body: "DL-024 shows delivered." },
  { n: 2, timestamp: "2026-02-25T09:10:00Z", stage: "Escalation", channel: "Customer portal", from: "Sorin Vaal, recipient", to: "Desk", body: "No parcel here." },
] });
const opts = (models: Models) => ({ flow, models, mode: "practice" as const, runId: "test" });

test("a safe message is recorded and the trace ends in acted with a next action", async () => {
  const r = await runCase(bundle, opts(fake({ understand: [understanding], decide: [decision], critic: [{ actions: [scores(0.05)] }] })));
  assert.equal(r.outcome, "acted");
  assert.deepEqual(r.outbox.map((o) => o.status), ["recorded"]);
  const end = r.trace.events.at(-1);
  assert.equal(end?.kind === "run_end" && end.nextAction?.recipient, action.recipient);
  assert.equal(r.trace.events.filter((e) => e.kind === "model_call").length, 3);
  assert.match(renderAnswer(r), /\*\*Decision:\*\* ACT/);
  assert.match(renderAnswer(r), /Recorded in sandbox outbox, awaiting reply/);
});

test("a message the gate objects to is rewritten once, then goes out if the rewrite is safe", async () => {
  const models = fake({ understand: [understanding], decide: [decision, decision], critic: [{ actions: [scores(0.9)] }, { actions: [scores(0.1)] }] });
  const r = await runCase(bundle, opts(models));
  assert.deepEqual(models.calls, ["understand", "decide", "critic", "decide", "critic"]);
  assert.equal(r.revised, true);
  assert.equal(r.outcome, "acted");
});

test("a message still risky after the rewrite is never recorded as sent", async () => {
  const r = await runCase(bundle, opts(fake({ understand: [understanding], decide: [decision, decision], critic: [{ actions: [scores(0.9)] }, { actions: [scores(0.9)] }] })));
  assert.equal(r.outcome, "blocked");
  assert.deepEqual(r.outbox.map((o) => o.status), ["blocked"]);
  assert.match(renderAnswer(r), /Not sent: stopped by the safety check/);
});

test("a mid-risk message is held for a human and a decision card is written", async () => {
  const r = await runCase(bundle, opts(fake({ understand: [understanding], decide: [decision, decision], critic: [{ actions: [scores(0.5)] }, { actions: [scores(0.5)] }] })));
  assert.equal(r.outcome, "escalated");
  assert.deepEqual(r.outbox.map((o) => o.status), ["held_for_human"]);
  assert.ok(r.card);
  assert.match(renderAnswer(r), /No person was available during this run/);
});

test("wait_no_action sends nothing even if the model drafted a message", async () => {
  const r = await runCase(bundle, opts(fake({ understand: [understanding], decide: [{ ...decision, decision_type: "wait_no_action" }] })));
  assert.equal(r.outcome, "no_action");
  assert.equal(r.outbox.length, 0);
  assert.match(renderAnswer(r), /No message is sent for this case/);
});

test("escalating can still send a safe alert alongside the handover", async () => {
  const handover = { route_to: "desk supervisor", summary: "Legal threat", clash: "", options: ["Reply", "Hold"], would_change_my_mind: "A solicitor's letter", safe_fallback: "Hold" };
  const r = await runCase(bundle, opts(fake({ understand: [understanding], decide: [{ ...decision, decision_type: "escalate_to_human", handover }], critic: [{ actions: [scores(0)] }] })));
  assert.equal(r.outcome, "escalated");
  assert.deepEqual(r.outbox.map((o) => o.status), ["recorded"]);
  assert.equal(r.card?.routeTo, "desk supervisor");
});

test("a model failure becomes an error outcome with an honest answer, not a throw", async () => {
  const r = await runCase(bundle, opts(fake({ understand: [understanding], decide: [new Error("529 overloaded")] })));
  assert.equal(r.outcome, "error");
  assert.equal(r.failedAt, "planner");
  assert.equal(r.outbox.length, 0);
  const answer = renderAnswer(r);
  assert.match(answer, /SYSTEM FAILURE: HANDED TO A HUMAN/);
  assert.match(answer, /Nothing was sent or recorded/);
  assert.match(renderReasoning(r), /529 overloaded/);
  assert.equal(r.trace.events.at(-1)?.kind, "run_end");
});

test("a failed critic call leaves the message unchecked, so it is held, not sent", async () => {
  const r = await runCase(bundle, opts(fake({ understand: [understanding], decide: [decision], critic: [{ actions: [] }] })));
  assert.deepEqual(r.outbox.map((o) => o.status), ["held_for_human"]);
});

test("hard rules stop a request for a door code and a recipient the case never names", () => {
  const text = "Sorin Vaal, recipient. Delivery investigations, Plover Arc Logistics.";
  assert.deepEqual(hardRules(action, understanding, text), []);
  assert.match(hardRules({ ...action, message: "Please send the gate code so the driver can get in." }, understanding, text).join(), /credential/);
  assert.deepEqual(hardRules({ ...action, message: "Do not share the gate code with anyone." }, understanding, text), []);
  assert.match(hardRules({ ...action, recipient: "Claims team, Acme" }, understanding, text).join(), /does not appear/);
});

test("the loader reads a raw case folder, passes images to the model and skips their text sidecars", async () => {
  const b = await loadFolder(path.join(ROOT, "data/raw/Delivery & Logistics/021"));
  assert.deepEqual(b.documents.map((d) => d.name), ["history.md", "index.md"]);
  assert.deepEqual(b.media.map((m) => m.name), ["attachments/carton-detail.png", "attachments/carton-overview.png"]);
  assert.match(b.title, /^Case 021/);
  assert.deepEqual(b.unreadable, []);
});

test("the loader reports a missing folder as an error for the runner to catch", async () => {
  await assert.rejects(loadFolder(path.join(ROOT, "data/raw/no-such-case")));
});
