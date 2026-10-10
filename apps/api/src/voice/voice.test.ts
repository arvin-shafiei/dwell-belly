import assert from "node:assert/strict";
import { test } from "node:test";
import { conversationToken, transcribe } from "./elevenlabs.ts";
import { noteToEvent } from "./notes.ts";
import { voiceAllowed } from "./policy.ts";

type FakeCall = { url: string; init: RequestInit };

/** A fetch stand-in that records the request and answers with the given status and JSON body. */
function fakeFetch(status: number, body: unknown, calls: FakeCall[] = []): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

const audio = new Uint8Array([1, 2, 3, 4]);

test("policy: reality refuses start_call and simulate, allows transcribe_attachment", () => {
  assert.equal(voiceAllowed("reality", "start_call").ok, false);
  assert.equal(voiceAllowed("reality", "simulate").ok, false);
  assert.equal(voiceAllowed("reality", "transcribe_note").ok, false);
  assert.equal(voiceAllowed("reality", "transcribe_attachment").ok, true);
  assert.equal(voiceAllowed("practice", "start_call").ok, false);
  assert.equal(voiceAllowed("demo", "start_call").ok, true);
  assert.equal(voiceAllowed("demo", "transcribe_note").ok, true);
});

test("policy: simulated_persona refused outside demo", () => {
  assert.equal(voiceAllowed("reality", "transcribe_attachment", "simulated_persona").ok, false);
  assert.equal(voiceAllowed("practice", "transcribe_attachment", "simulated_persona").ok, false);
  assert.equal(voiceAllowed("demo", "simulate", "simulated_persona").ok, true);
});

test("transcribe posts multipart to /v1/speech-to-text with xi-api-key and model_id scribe_v2", async () => {
  const calls: FakeCall[] = [];
  const res = await transcribe(audio, {
    filename: "note.webm",
    apiKey: "test-key",
    fetchImpl: fakeFetch(200, { text: "at the gate", language_code: "en", language_probability: 0.97, words: [] }, calls),
  });
  assert.deepEqual(res, { ok: true, text: "at the gate", language: "en", confidence: 0.97 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.elevenlabs.io/v1/speech-to-text");
  assert.equal(calls[0].init.method, "POST");
  assert.equal((calls[0].init.headers as Record<string, string>)["xi-api-key"], "test-key");
  const form = calls[0].init.body as FormData;
  assert.equal(form.get("model_id"), "scribe_v2");
  assert.ok(form.get("file"));
});

test("transcribe: empty text → ok:false nothing heard", async () => {
  const res = await transcribe(audio, { filename: "n.webm", apiKey: "k", fetchImpl: fakeFetch(200, { text: "   ", language_code: "en", language_probability: 0.9, words: [] }) });
  assert.equal(res.ok, false);
  assert.match(!res.ok ? res.error : "", /nothing heard/i);
});

test("transcribe: 401, 402, 429 → ok:false naming the status, never throws", async () => {
  for (const status of [401, 402, 429]) {
    const res = await transcribe(audio, { filename: "n.webm", apiKey: "k", fetchImpl: fakeFetch(status, { detail: { message: "SECRET-FROM-PROVIDER" } }) });
    assert.equal(res.ok, false);
    const error = !res.ok ? res.error : "";
    assert.match(error, new RegExp(String(status)));
    assert.doesNotMatch(error, /SECRET-FROM-PROVIDER/, "provider text must never be echoed");
  }
});

test("transcribe: timeout → ok:false", async () => {
  const never = ((_url: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)))) as typeof fetch;
  const res = await transcribe(audio, { filename: "n.webm", apiKey: "k", fetchImpl: never, timeoutMs: 20 });
  assert.equal(res.ok, false);
  assert.match(!res.ok ? res.error : "", /timed out/i);
});

test("transcribe: no key → ok:false", async () => {
  const saved = process.env.ELEVENLABS_API_KEY;
  delete process.env.ELEVENLABS_API_KEY;
  try {
    const res = await transcribe(audio, { filename: "n.webm", fetchImpl: fakeFetch(200, {}) });
    assert.equal(res.ok, false);
    assert.match(!res.ok ? res.error : "", /no ElevenLabs key/i);
  } finally {
    if (saved !== undefined) process.env.ELEVENLABS_API_KEY = saved;
  }
});

test("conversationToken: GET /v1/convai/conversation/token?agent_id=… → token", async () => {
  const calls: FakeCall[] = [];
  const res = await conversationToken("agent_123", { apiKey: "k", fetchImpl: fakeFetch(200, { token: "tok-1", conversation_id: "c1" }, calls) });
  assert.deepEqual(res, { ok: true, token: "tok-1" });
  assert.equal(calls[0].url, "https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=agent_123");
  assert.equal(calls[0].init.method ?? "GET", "GET");
  assert.equal((calls[0].init.headers as Record<string, string>)["xi-api-key"], "k");
});

test("conversationToken: missing token in the reply → ok:false", async () => {
  const res = await conversationToken("agent_123", { apiKey: "k", fetchImpl: fakeFetch(200, {}) });
  assert.equal(res.ok, false);
});

test("noteToEvent: [unclear transcription] prefix below 0.6, keeps source", () => {
  const clear = noteToEvent({ n: 3, at: "2026-02-04T09:12:00Z", from: "Fen Orlo, route driver", transcript: "Gate's locked.", source: "live_human", confidence: 0.92 });
  assert.deepEqual(clear, {
    n: 3, timestamp: "2026-02-04T09:12:00Z", stage: null, channel: "Voice note",
    from: "Fen Orlo, route driver", to: "Desk", body: "Gate's locked.", source: "live_human",
  });
  const unclear = noteToEvent({ n: 4, at: "2026-02-04T09:13:00Z", from: "Fen Orlo, route driver", transcript: "gate... mumble", source: "simulated_persona", confidence: 0.41 });
  assert.equal(unclear.body, "[unclear transcription] gate... mumble");
  assert.equal(unclear.source, "simulated_persona");
});
