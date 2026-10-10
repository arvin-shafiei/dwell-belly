import assert from "node:assert/strict";
import { test } from "node:test";
import type { DecisionCard } from "../lib/trace.ts";
import { handleNote } from "./notes.ts";
import { buildSession, VARIABLES } from "./session.ts";

const ok = async () => ({ ok: true as const, text: "Gate's locked.", language: "en", confidence: 0.9 });

test("handleNote: 403 outside demo", async () => {
  const res = await handleNote({ mode: "reality", source: "live_human", from: "Driver", n: 3, at: "2026-02-04T09:12:00Z", transcript: "hi" }, { transcribe: ok });
  assert.deepEqual(res.ok ? null : res.status, 403);
});

test("handleNote: a transcript skips transcription", async () => {
  let called = false;
  const res = await handleNote(
    { mode: "demo", source: "live_human", from: "Fen Orlo, route driver", n: 3, at: "2026-02-04T09:12:00Z", transcript: "Typed instead." },
    { transcribe: async () => { called = true; return ok(); } },
  );
  assert.equal(called, false);
  assert.equal(res.ok && res.event.body, "Typed instead.");
  assert.equal(res.ok && res.event.channel, "Voice note");
});

test("handleNote: audio is transcribed into the event", async () => {
  const res = await handleNote({ mode: "demo", source: "live_human", from: "Driver", n: 3, at: "t", audio: new Uint8Array([1]), filename: "n.webm" }, { transcribe: ok });
  assert.equal(res.ok && res.event.body, "Gate's locked.");
});

test("handleNote: empty transcription → 422", async () => {
  const res = await handleNote(
    { mode: "demo", source: "live_human", from: "Driver", n: 3, at: "t", audio: new Uint8Array([1]), filename: "n.webm" },
    { transcribe: async () => ({ ok: false as const, error: "nothing heard in the recording" }) },
  );
  assert.equal(res.ok ? 0 : res.status, 422);
});

test("handleNote: provider failure → 502", async () => {
  const res = await handleNote(
    { mode: "demo", source: "live_human", from: "Driver", n: 3, at: "t", audio: new Uint8Array([1]), filename: "n.webm" },
    { transcribe: async () => ({ ok: false as const, error: "ElevenLabs credits are used up (402)" }) },
  );
  assert.equal(res.ok ? 0 : res.status, 502);
});

test("handleNote: neither audio nor transcript → 400", async () => {
  const res = await handleNote({ mode: "demo", source: "live_human", from: "Driver", n: 3, at: "t" }, { transcribe: ok });
  assert.equal(res.ok ? 0 : res.status, 400);
});

const card: DecisionCard = {
  routeTo: "desk supervisor",
  summary: "Customer asks for compensation for the wait.",
  whyStopped: { reason: "message_too_risky", line: "The customer wants compensation, which only the merchant can grant." },
  evidence: [{ who: "Elva Kesh, recipient", says: "I waited 40 minutes and want compensation.", basis: "unverified_claim" }],
  alreadyDone: ["Asked dispatch to let the driver wait 10 more minutes."],
  tried: [],
  options: [
    { id: "option-1", label: "Forward the request to the merchant", undoable: true, effect: "Email to Tallowmere refunds team" },
    { id: "option-2", label: "Decline politely", undoable: true },
  ],
  wouldChangeMyMind: "A merchant policy on wait compensation.",
  deadlineMins: 15,
  fallback: "Send nothing further.",
};

test("buildSession: 403 outside demo", () => {
  const res = buildSession({ mode: "practice", purpose: "call", caseId: "delivery-003", calleeRole: "recipient", calleeName: "Elva Kesh", brief: "b", goal: "g" });
  assert.equal(res.ok ? 0 : res.status, 403);
});

test("buildSession: brief ≤ 600 chars and questions ≤ 3", () => {
  const res = buildSession({
    mode: "demo", purpose: "call", caseId: "delivery-003", calleeRole: "recipient", calleeName: "Elva Kesh",
    brief: "x".repeat(2000), goal: "Get the driver in", questions: ["Q1?", "Q2?", "Q3?", "Q4?"],
  });
  assert.ok(res.ok);
  assert.ok(res.dynamicVariables.case_brief.length <= 600);
  assert.equal(res.dynamicVariables.questions, "1. Q1?\n2. Q2?\n3. Q3?");
  assert.match(res.callId, /^call-/);
  assert.equal(res.dynamicVariables.call_id, res.callId);
});

test("buildSession approval: options carry each effect and the brief leads with whyStopped", () => {
  const res = buildSession({ mode: "demo", purpose: "approval", caseId: "delivery-003", calleeRole: "manager", calleeName: "Oriol", brief: "", goal: "Get a decision", card });
  assert.ok(res.ok);
  assert.equal(res.dynamicVariables.options, "option-1: Forward the request to the merchant (does: Email to Tallowmere refunds team); option-2: Decline politely");
  assert.ok(res.dynamicVariables.case_brief.startsWith("The customer wants compensation, which only the merchant can grant."));
  assert.match(res.dynamicVariables.case_brief, /Elva Kesh, recipient: I waited 40 minutes/);
  assert.match(res.dynamicVariables.case_brief, /Already done: Asked dispatch/);
  assert.equal(res.dynamicVariables.call_purpose, "approval");
});

test("buildSession approval without a card → 400", () => {
  const res = buildSession({ mode: "demo", purpose: "approval", caseId: "delivery-003", calleeRole: "manager", calleeName: "Oriol", brief: "", goal: "g" });
  assert.equal(res.ok ? 0 : res.status, 400);
});

test("every dynamic variable is a string and all ten are present", () => {
  const res = buildSession({ mode: "demo", purpose: "call", caseId: "delivery-003", calleeRole: "recipient", calleeName: "Elva Kesh", brief: "b", goal: "g" });
  assert.ok(res.ok);
  assert.deepEqual(Object.keys(res.dynamicVariables).sort(), [...VARIABLES].sort());
  for (const v of Object.values(res.dynamicVariables)) assert.equal(typeof v, "string");
  assert.equal(VARIABLES.length, 10);
});
