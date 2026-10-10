import assert from "node:assert/strict";
import { test } from "node:test";
import { handleNote } from "./notes.ts";
import { keepsDetails } from "./translate.ts";

const spanish = async () => ({ ok: true as const, text: "Soy Fen con DL-003, espero hasta las 10:00.", language: "spa", confidence: 0.9 });
const base = { mode: "demo" as const, source: "live_human" as const, from: "Driver", n: 3, at: "t", audio: new Uint8Array([1]), filename: "n.webm", languageCode: "auto", caseText: "DL-003 at the gate." };

test("keepsDetails: every reference, time and number in the original must survive the translation", () => {
  assert.equal(keepsDetails("Soy Fen con DL-003, espero hasta las 10:00.", "It's Fen with DL-003, I'll wait until 10:00."), true);
  assert.equal(keepsDetails("Soy Fen con DL-003, espero hasta las 10:00.", "It's Fen with DL-003, I'll wait until 11:00."), false);
  assert.equal(keepsDetails("Llevo 20 minutos.", "I've been here twenty minutes."), false);
});

test("handleNote: a note in another language carries a marked English machine translation", async () => {
  const res = await handleNote(base, { transcribe: spanish, translate: async () => "It's Fen with DL-003, I'll wait until 10:00." });
  assert.ok(res.ok);
  assert.equal(res.event.body, "[spoken in Spanish] Soy Fen con DL-003, espero hasta las 10:00. [English, machine translation: It's Fen with DL-003, I'll wait until 10:00.]");
  assert.equal(res.translation, "It's Fen with DL-003, I'll wait until 10:00.");
});

test("handleNote: a translation that loses a detail is dropped and the driver's words stand alone", async () => {
  const res = await handleNote(base, { transcribe: spanish, translate: async () => "It's Fen, I'll wait until 11:00." });
  assert.ok(res.ok);
  assert.equal(res.event.body, "[spoken in Spanish] Soy Fen con DL-003, espero hasta las 10:00.");
  assert.equal(res.translation, undefined);
});

test("handleNote: a failing translator never blocks the note", async () => {
  const res = await handleNote(base, { transcribe: spanish, translate: async () => { throw new Error("down"); } });
  assert.ok(res.ok);
  assert.equal(res.event.body, "[spoken in Spanish] Soy Fen con DL-003, espero hasta las 10:00.");
});

test("handleNote: an English note is never sent for translation", async () => {
  let called = false;
  await handleNote(base, {
    transcribe: async () => ({ ok: true as const, text: "Gate's locked.", language: "eng", confidence: 0.9 }),
    translate: async () => { called = true; return "x"; },
  });
  assert.equal(called, false);
});
