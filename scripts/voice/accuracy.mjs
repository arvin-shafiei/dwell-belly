// Voice accuracy check against the real ElevenLabs API. Real case messages (recipients, drivers, and
// adversarial messages full of references and times) are spoken with three different voices, then
// transcribed twice: the old way (no case context) and case-aware (the case's references as keyterms,
// English). Scores word error rate and how many critical details (references, times, numbers) survive.
// Each message's own text is left out of its keyterms, so the transcriber only gets what the rest of
// the case says, as in real use.
// Usage: node --env-file=apps/api/.env.local scripts/voice/accuracy.mjs [samples=14]
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { transcribe } from "../../apps/api/src/voice/elevenlabs.ts";
import { caseKeyterms, caseTextOf, unknownReferences } from "../../apps/api/src/voice/references.ts";

const API = "https://api.elevenlabs.io";
const KEY = process.env.ELEVENLABS_API_KEY;
const ROOT = path.resolve(import.meta.dirname, "..", "..");
const LIMIT = Number(process.argv[2]) || 14;

function samples() {
  const out = [];
  const practice = path.join(ROOT, "data/cases/delivery");
  for (const f of readdirSync(practice).sort()) {
    const c = JSON.parse(readFileSync(path.join(practice, f), "utf8"));
    for (const e of c.events) {
      const from = (e.from ?? "").toLowerCase();
      if (e.stage === "Escalation" && (from.includes("recipient") || from.includes("driver")) && e.body.length > 60 && e.body.length < 260) {
        out.push({ case: c.id, text: e.body, others: c.events.filter((x) => x !== e) });
      }
    }
  }
  const ordinary = out.filter((_, i) => i % Math.max(1, Math.floor(out.length / 8)) === 0).slice(0, 8);
  const adversarial = [];
  const advDir = path.join(ROOT, "data/adversarial/delivery");
  for (const f of readdirSync(advDir).filter((x) => x.endsWith(".json")).sort()) {
    const c = JSON.parse(readFileSync(path.join(advDir, f), "utf8"));
    const e = (c.events ?? []).find((x) => x.body?.length > 60 && x.body.length < 260 && /\d/.test(x.body)
      && !/^(dispatch|tracking|system)/i.test(x.from ?? ""));
    if (e) adversarial.push({ case: c.id ?? f, text: e.body, others: c.events.filter((x) => x !== e) });
    if (adversarial.length >= 6) break;
  }
  return [...ordinary, ...adversarial].slice(0, LIMIT);
}

const words = (s) => s.toLowerCase().replace(/[^a-z0-9£' ]/g, " ").split(/\s+/).filter(Boolean);
function wer(ref, hyp) {
  const r = words(ref), h = words(hyp);
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...Array(h.length).fill(0)]);
  for (let j = 1; j <= h.length; j++) d[0][j] = j;
  for (let i = 1; i <= r.length; i++) for (let j = 1; j <= h.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
  return r.length ? d[r.length][h.length] / r.length : 0;
}
const flat = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const critical = (s) => [...new Set(s.match(/\b[A-Z]{2,4}-?\d+\b|\b\d{1,2}:\d{2}\b|£\s?\d+(?:\.\d+)?|\b\d+\b/g) ?? [])];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(url, init, tries = 4) {
  for (let i = 0; ; i++) {
    const r = await fetch(url, init);
    if (r.status !== 429 || i >= tries) return r;
    await sleep(1500 * (i + 1));
  }
}
async function pickVoices() {
  const r = await api(`${API}/v1/voices?page_size=50`, { headers: { "xi-api-key": KEY } });
  const seen = new Set(), pick = [];
  for (const v of (await r.json()).voices) {
    const accent = v.labels?.accent ?? v.name;
    if (!seen.has(accent)) { seen.add(accent); pick.push(v); }
    if (pick.length === 3) break;
  }
  return pick;
}
async function speak(voiceId, text) {
  const r = await api(`${API}/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST", headers: { "xi-api-key": KEY, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
  });
  if (!r.ok) throw new Error(`text-to-speech answered ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}
async function retrying(fn) {
  for (let i = 0; ; i++) {
    const res = await fn();
    if (res.ok || !/429/.test(res.error) || i >= 4) return res;
    await sleep(1500 * (i + 1));
  }
}

function summarise(rows) {
  const ok = rows.filter((r) => !r.error);
  const plain = ok.filter((r) => r.crit === 0), refs = ok.filter((r) => r.crit > 0);
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const crit = ok.reduce((a, r) => a + r.crit, 0), lost = ok.reduce((a, r) => a + r.lost.length, 0);
  return {
    transcriptions: ok.length, errors: rows.length - ok.length,
    ordinaryWer: mean(plain.map((r) => r.wer)), referenceWer: mean(refs.map((r) => r.wer)),
    criticalSurvived: `${crit - lost}/${crit}`, criticalRate: crit ? (crit - lost) / crit : 1,
    misheardRefs: ok.reduce((a, r) => a + r.misheard, 0), flaggedRefs: ok.reduce((a, r) => a + r.flagged, 0),
  };
}

if (!KEY) throw new Error("ELEVENLABS_API_KEY is not set. Run with --env-file=apps/api/.env.local");
const set = samples();
const voices = await pickVoices();
console.log(`${set.length} messages x ${voices.length} voices: ${voices.map((v) => `${v.name.split(" -")[0]} (${v.labels?.accent ?? "?"})`).join(", ")}`);
const rows = { before: [], after: [] };
for (const v of voices) {
  for (const s of set) {
    let audio;
    try { audio = await speak(v.voice_id, s.text); } catch (e) { for (const m of ["before", "after"]) rows[m].push({ case: s.case, voice: v.name, error: String(e) }); continue; }
    const caseText = caseTextOf(s.others);
    for (const mode of ["before", "after"]) {
      const opts = mode === "after" ? { filename: "s.mp3", keyterms: caseKeyterms(caseText), languageCode: "en" } : { filename: "s.mp3" };
      const heard = await retrying(() => transcribe(audio, opts));
      if (!heard.ok) { rows[mode].push({ case: s.case, voice: v.name, error: heard.error }); continue; }
      const crit = critical(s.text);
      const lost = crit.filter((c) => !flat(heard.text).includes(flat(c)));
      // A mis-heard reference is one the transcript contains but the spoken text did not.
      const spokenRefs = new Set((s.text.match(/\b[A-Z]{2,4}-?\d+\b/g) ?? []).map(flat));
      const heardRefs = heard.text.match(/\b[A-Za-z]{2,4}-?\d+\b/g) ?? [];
      const misheard = heardRefs.filter((r) => /\d/.test(r) && !spokenRefs.has(flat(r)));
      const flagged = misheard.filter((r) => unknownReferences(r, `${caseText}\n${s.text}`).length > 0).length;
      rows[mode].push({ case: s.case, voice: v.name, wer: wer(s.text, heard.text), crit: crit.length, lost, misheard: misheard.length, flagged, heard: heard.text });
    }
  }
}
const before = summarise(rows.before), after = summarise(rows.after);
const pct = (x) => `${(x * 100).toFixed(1)}%`;
console.log("\n| | Before (no case context) | After (case-aware) |\n|---|---|---|");
console.log(`| Transcriptions | ${before.transcriptions} (${before.errors} errors) | ${after.transcriptions} (${after.errors} errors) |`);
console.log(`| Word error rate, ordinary messages | ${pct(before.ordinaryWer)} | ${pct(after.ordinaryWer)} |`);
console.log(`| Word error rate, reference-heavy messages | ${pct(before.referenceWer)} | ${pct(after.referenceWer)} |`);
console.log(`| Critical details survived (references, times, numbers) | ${before.criticalSurvived} (${pct(before.criticalRate)}) | ${after.criticalSurvived} (${pct(after.criticalRate)}) |`);
console.log(`| Mis-heard references | ${before.misheardRefs} | ${after.misheardRefs} |`);
mkdirSync(path.join(ROOT, "runs"), { recursive: true });
const file = path.join(ROOT, "runs", `voice-accuracy-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(file, JSON.stringify({ before, after, rows }, null, 1));
console.log(`\nFull results: ${path.relative(ROOT, file)}`);
