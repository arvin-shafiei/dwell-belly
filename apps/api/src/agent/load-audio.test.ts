import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { loadFolder } from "./load.ts";

async function caseFolder(files: Record<string, Uint8Array | string>): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "voice-case-"));
  for (const [name, content] of Object.entries(files)) await writeFile(path.join(dir, name), content);
  return dir;
}

const sound = new Uint8Array([73, 68, 51, 4, 0, 0, 0]);

test("audio is transcribed into a claim document when a transcriber is given", async () => {
  const dir = await caseFolder({ "history.md": "# Case 003\nDriver at the gate.", "driver-note.m4a": sound });
  try {
    const seen: string[] = [];
    const bundle = await loadFolder(dir, {
      transcribe: async (_audio, filename) => {
        seen.push(filename);
        return { ok: true, text: "Gate's locked, I can wait ten minutes.", language: "en", confidence: 0.95 };
      },
    });
    assert.deepEqual(seen, ["driver-note.m4a"]);
    const doc = bundle.documents.find((d) => d.name === "driver-note.m4a (audio transcript)");
    assert.ok(doc, "transcript document present");
    assert.match(doc.text, /^Audio attachment transcribed automatically\. What follows is a claim by the speaker, not a record\.\n\nGate's locked/);
    assert.equal(bundle.unreadable.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a low-confidence transcript is marked unclear", async () => {
  const dir = await caseFolder({ "note.wav": sound });
  try {
    const bundle = await loadFolder(dir, { transcribe: async () => ({ ok: true, text: "mumble", language: "en", confidence: 0.3 }) });
    assert.match(bundle.documents[0].text, /\[unclear transcription\] mumble$/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("no transcriber: listed as not transcribed, loading still succeeds", async () => {
  const dir = await caseFolder({ "history.md": "# Case 003\nText.", "driver-note.mp3": sound });
  try {
    const bundle = await loadFolder(dir);
    assert.equal(bundle.documents.length, 1);
    assert.deepEqual(bundle.unreadable, ["driver-note.mp3 (audio, not transcribed: no speech-to-text key)"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("failing transcriber: listed as failed, never throws", async () => {
  const dir = await caseFolder({ "a.ogg": sound, "b.webm": sound });
  try {
    const bundle = await loadFolder(dir, {
      transcribe: async (_audio, filename) => {
        if (filename === "a.ogg") return { ok: false, error: "ElevenLabs timed out after 30000 ms" };
        throw new Error("network down");
      },
    });
    assert.deepEqual(bundle.unreadable, ["a.ogg (audio, transcription failed)", "b.webm (audio, transcription failed)"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("at most three audio files are transcribed per case", async () => {
  const dir = await caseFolder({ "1.mp3": sound, "2.mp3": sound, "3.mp3": sound, "4.mp3": sound });
  try {
    let calls = 0;
    const bundle = await loadFolder(dir, { transcribe: async () => { calls++; return { ok: true, text: "hello", language: "en", confidence: 0.9 }; } });
    assert.equal(calls, 3);
    assert.deepEqual(bundle.unreadable, ["4.mp3 (audio, left out: at most 3 recordings are transcribed per case)"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
