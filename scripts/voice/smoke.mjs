// Smoke test against the real ElevenLabs API, with no microphone needed: speak a known sentence with
// text-to-speech, transcribe it back through our own transcribe(), and fetch a WebRTC call token for
// the Desk Caller agent. Prints PASS or FAIL per check; exits 1 if any check fails.
// Usage: node --env-file=apps/api/.env.local scripts/voice/smoke.mjs
import { conversationToken, transcribe } from "../../apps/api/src/voice/elevenlabs.ts";

const API = "https://api.elevenlabs.io";
const KEY = process.env.ELEVENLABS_API_KEY;
const SENTENCE = "The gate at building four is locked and I can wait ten minutes.";
let failed = 0;
const report = (ok, name, detail) => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`); };

async function speak(text) {
  const voices = await fetch(`${API}/v1/voices?page_size=1`, { headers: { "xi-api-key": KEY }, signal: AbortSignal.timeout(10_000) });
  if (!voices.ok) throw new Error(`voices answered ${voices.status}`);
  const voiceId = (await voices.json()).voices?.[0]?.voice_id;
  if (!voiceId) throw new Error("no voice available");
  const res = await fetch(`${API}/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`text-to-speech answered ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

try {
  const audio = await speak(SENTENCE);
  report(audio.length > 1000, "text-to-speech produced audio", `${audio.length} bytes`);
  const heard = await transcribe(audio, { filename: "smoke.mp3" });
  const words = (s) => s.toLowerCase().replace(/[^a-z ]/g, "").split(/\s+/).filter(Boolean);
  const overlap = heard.ok ? words(SENTENCE).filter((w) => words(heard.text).includes(w)).length / words(SENTENCE).length : 0;
  report(heard.ok && overlap >= 0.8, "speech-to-text heard the sentence", heard.ok ? `"${heard.text}" (${Math.round(overlap * 100)}% words, confidence ${heard.confidence.toFixed(2)})` : heard.error);
} catch (err) {
  report(false, "speech round trip", err instanceof Error ? err.message : String(err));
}
const token = await conversationToken(process.env.ELEVENLABS_AGENT_ID ?? "");
report(token.ok, "conversation token for the Desk Caller agent", token.ok ? `${token.token.length} chars` : token.error);
process.exit(failed ? 1 : 0);
