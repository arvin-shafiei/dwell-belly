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

test("handleNote: transcribes with the case's references as keyterms and the given language", async () => {
  let seen: { keyterms?: string[]; languageCode?: string } = {};
  await handleNote(
    { mode: "demo", source: "live_human", from: "Driver", n: 3, at: "t", audio: new Uint8Array([1]), filename: "n.webm", languageCode: "en",
      caseText: "From: Dispatch, carrier\nDL-6010 is booked for 10:00." },
    { transcribe: async (_a, opts) => { seen = opts; return ok(); } },
  );
  assert.ok(seen.keyterms?.includes("DL-6010") && seen.keyterms.includes("10:00"));
  assert.equal(seen.languageCode, "en");
});

test("handleNote: a reference the case does not contain is flagged as a possible mis-hearing", async () => {
  const res = await handleNote(
    { mode: "demo", source: "live_human", from: "Driver", n: 3, at: "t", audio: new Uint8Array([1]), filename: "n.webm", caseText: "DL-6010 is booked." },
    { transcribe: async () => ({ ok: true as const, text: "I'm at the gate with DL6210.", language: "en", confidence: 0.9 }) },
  );
  assert.ok(res.ok);
  assert.equal(res.event.body, "I'm at the gate with DL6210. [possible mis-hearing: DL6210 is not a reference in this case; confirm with the speaker]");
});

test("handleNote: languageCode auto lets the transcriber detect the language", async () => {
  let seen: { languageCode?: string } = { languageCode: "unset" };
  await handleNote(
    { mode: "demo", source: "live_human", from: "Driver", n: 3, at: "t", audio: new Uint8Array([1]), filename: "n.webm", languageCode: "auto" },
    { transcribe: async (_a, opts) => { seen = opts; return ok(); } },
  );
  assert.equal(seen.languageCode, undefined);
});

test("handleNote: a note heard in another language is marked with it, and the language comes back", async () => {
  const res = await handleNote(
    { mode: "demo", source: "live_human", from: "Driver", n: 3, at: "t", audio: new Uint8Array([1]), filename: "n.webm", languageCode: "auto", caseText: "DL-003 at the gate." },
    { transcribe: async () => ({ ok: true as const, text: "Stoję przy bramie z DL-003.", language: "pol", confidence: 0.9 }) },
  );
  assert.ok(res.ok);
  assert.equal(res.event.body, "[spoken in Polish] Stoję przy bramie z DL-003.");
  assert.equal(res.language, "Polish");
});

test("handleNote: an English note is left as it is", async () => {
  const res = await handleNote(
    { mode: "demo", source: "live_human", from: "Driver", n: 3, at: "t", audio: new Uint8Array([1]), filename: "n.webm", languageCode: "auto" },
    { transcribe: async () => ({ ok: true as const, text: "Gate's locked.", language: "eng", confidence: 0.9 }) },
  );
  assert.ok(res.ok);
  assert.equal(res.event.body, "Gate's locked.");
  assert.equal(res.language, "English");
});

test("noteKeyterms adds the case's place and person names to its references and times", async () => {
  const { noteKeyterms } = await import("./notes.ts");
  const terms = noteKeyterms("From: Fen Orlo, route driver\nI am at 7 Sedgeglass Mews for DL-003. The pedestrian gate is shut.\n\nFrom: Dispatch\nPlease contact recipient Elva Kesh. The driver can wait until 10:00 UTC.");
  for (const t of ["DL-003", "10:00", "Sedgeglass Mews", "Elva Kesh", "Fen Orlo"]) assert.ok(terms.some((x) => x.includes(t)), `missing ${t}: ${terms}`);
  assert.ok(terms.length <= 100);
});

test("handleNote: transcribes with the place and person names too", async () => {
  let seen: string[] = [];
  await handleNote(
    { mode: "demo", source: "live_human", from: "Driver", n: 3, at: "t", audio: new Uint8Array([1]), filename: "n.webm", caseText: "From: Fen Orlo\nI am at 7 Sedgeglass Mews." },
    { transcribe: async (_a, opts) => { seen = opts.keyterms ?? []; return ok(); } },
  );
  assert.ok(seen.some((t) => t.includes("Sedgeglass Mews")), `keyterms: ${seen}`);
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
