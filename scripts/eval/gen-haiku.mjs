// Generates a large batch of delivery cases on Claude Haiku 4.5, cheap and broad: every difficulty
// pattern in mutations.mjs crossed with everyday delivery themes. Same prompt and structural checks
// as gen-cases.mjs; drafts that fail the checks are dropped, never written.
// Usage: npm run gen:haiku -- [--target 600] [--concurrency 2] [--budget 2] [--stop 15:50] [--state file]
// Output: data/haiku/delivery/haiku-NNNN.json. Slots are deterministic, so a re-run skips ids already written.
// Guarded because the same key runs the real agent: <= 4 in flight (default 2), global back-off on 429/529,
// a hard wall-clock stop (Europe/London time) and a dollar cap that carries across runs via --state.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { problems } from "./checks.mjs";
import { HAIKU_DIR, loadPublicRaw } from "./cases.mjs";
import { SYSTEM, exemplar, rng } from "./gen-prompt.mjs";
import { MUTATIONS } from "./mutations.mjs";
import { GeneratedCaseDraft } from "./schema.mjs";

const { values: args } = parseArgs({
  options: {
    target: { type: "string", default: "600" },
    concurrency: { type: "string", default: "2" },
    budget: { type: "string", default: "2" },
    stop: { type: "string", default: "15:50" }, // Europe/London wall clock, today
    state: { type: "string", default: path.join(HAIKU_DIR, "..", ".spend.json") },
    seed: { type: "string", default: "7" },
    only: { type: "string" }, // comma-separated slot numbers, for testing
  },
});

const MODEL = "claude-haiku-4-5-20251001";
const USD_PER_MTOK = { input: 1, output: 5 };
const CONCURRENCY = Math.min(4, Number(args.concurrency));
const BUDGET = Number(args.budget);
const RESERVE_PER_CALL = 0.03; // worst-case cost of one in-flight call, so the cap is never overshot

// Everyday delivery situations the public set barely touches. The difficulty pattern decides the
// right answer; the theme only sets the scene.
export const THEMES = {
  weather: "weather disruption (snow, flooding, storm, heatwave) affecting this delivery",
  customs_hold: "a parcel held at customs (duty unpaid, missing commercial invoice, broker query)",
  lockers: "a parcel locker (full locker, expired code, oversized item, locker out of service)",
  neighbour: "a delivery left with or offered to a neighbour",
  age_restricted: "age-restricted goods (alcohol, knives, vapes) needing ID at the door",
  medication: "prescription medication or medical supplies in transit",
  pets_perishables: "live animals, pet supplies or perishable food with a short shelf life",
  phishing: "a fraud or phishing attempt (fake redelivery fee text, look-alike carrier email)",
  data_protection: "a data-protection request (subject access, erasure, someone asking for another person's details)",
  multilingual: "messages partly or wholly in another language (Polish, Spanish, Welsh, Urdu, French, Romanian)",
  carrier_strike: "a carrier strike or industrial action slowing the network",
  wrong_address: "a wrong-address loop (parcel bouncing between depot and a wrong address, repeat failed attempts)",
  electronics: "high-value electronics (laptops, phones, cameras) needing signature or going missing",
  b2b_pallets: "B2B pallet freight (tail-lift, booking slots, goods-in, short-shipped pallets)",
  returns_dispute: "a returns dispute (return not scanned, merchant says item not received back, wrong item returned)",
};

const pad = (n) => String(n).padStart(4, "0");
const now = () => new Date().toISOString().slice(11, 19);
const LOG = (line) => { const l = `${now()} ${line}`; console.log(l); };

// Today's Europe/London HH:MM as a UTC Date.
function londonDeadline(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false });
  const [lh, lm] = fmt.format(d).split(":").map(Number);
  const offsetMin = (lh * 60 + lm) - (d.getUTCHours() * 60 + d.getUTCMinutes());
  const off = ((offsetMin + 720) % 1440) - 720;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m) - off * 60000);
}
const DEADLINE = londonDeadline(args.stop);

// Strict JSON schema for structured outputs: every object closed, $schema dropped.
function closeObjects(node) {
  if (Array.isArray(node)) return node.forEach(closeObjects);
  if (!node || typeof node !== "object") return;
  if (node.type === "object") node.additionalProperties = false;
  for (const k of ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum"]) delete node[k];
  for (const v of Object.values(node)) closeObjects(v);
}
const JSON_SCHEMA = z.toJSONSchema(GeneratedCaseDraft);
delete JSON_SCHEMA.$schema;
closeObjects(JSON_SCHEMA);

const spend = { usd: 0, calls: 0, input: 0, output: 0, inflight: 0 };
let pauseUntil = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(user) {
  for (let attempt = 0; ; attempt++) {
    while (Date.now() < pauseUntil) await sleep(Math.min(1000, pauseUntil - Date.now()));
    const left = DEADLINE - Date.now();
    if (left <= 0) throw new Error("deadline");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: AbortSignal.timeout(Math.min(left, 180000)),
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        system: SYSTEM,
        messages: [{ role: "user", content: user }],
        output_config: { format: { type: "json_schema", schema: JSON_SCHEMA } },
      }),
    });
    if (res.status === 429 || res.status === 529 || res.status >= 500) {
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      const wait = Math.max(retryAfter * 1000, Math.min(120000, 5000 * 2 ** attempt)) + Math.random() * 2000;
      pauseUntil = Math.max(pauseUntil, Date.now() + wait); // every worker backs off, not only this one
      LOG(`backoff ${res.status}: all workers pause ${Math.round(wait / 1000)}s (attempt ${attempt + 1})`);
      if (attempt >= 6) throw new Error(`gave up after ${res.status}`);
      continue;
    }
    const body = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${body?.error?.message ?? "unknown"}`);
    const u = body.usage ?? {};
    const usd = ((u.input_tokens ?? 0) * USD_PER_MTOK.input + (u.output_tokens ?? 0) * USD_PER_MTOK.output) / 1e6;
    spend.usd += usd; spend.calls += 1; spend.input += u.input_tokens ?? 0; spend.output += u.output_tokens ?? 0;
    if (body.stop_reason !== "end_turn") throw new Error(`stop_reason ${body.stop_reason}`);
    const text = body.content?.find((c) => c.type === "text")?.text;
    return JSON.parse(text);
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  await mkdir(HAIKU_DIR, { recursive: true });
  const prior = JSON.parse(await readFile(args.state, "utf8").catch(() => "{}"));
  const priorUsd = prior.usd ?? 0;
  const saveState = () => writeFile(args.state, JSON.stringify({ usd: priorUsd + spend.usd, calls: (prior.calls ?? 0) + spend.calls, input: (prior.input ?? 0) + spend.input, output: (prior.output ?? 0) + spend.output }, null, 2));

  const seeds = await loadPublicRaw();
  const mutations = Object.keys(MUTATIONS);
  const themes = [...Object.keys(THEMES), null]; // null: the pattern alone, in the seed case's area
  const random = rng(Number(args.seed));
  const pick = () => seeds[Math.floor(random() * seeds.length)];
  // Slot k crosses mutation k mod 28 with theme (k * 5) mod 16: every pattern and every theme cycles evenly.
  const slots = Array.from({ length: Number(args.target) }, (_, i) => {
    const k = i + 1;
    return { k, id: `haiku-${pad(k)}`, mutation: mutations[i % mutations.length], theme: themes[(i * 5 + Math.floor(i / mutations.length)) % themes.length], example: pick(), setting: pick() };
  });
  const done = new Set((await readdir(HAIKU_DIR)).map((n) => n.replace(/\.json$/, "")));
  const only = args.only ? new Set(args.only.split(",").map(Number)) : null;
  const todo = slots.filter((s) => !done.has(s.id) && (!only || only.has(s.k)));
  LOG(`start: ${todo.length} slots to fill (${done.size} already written), $${priorUsd.toFixed(2)} spent before, budget $${BUDGET}, stop at ${DEADLINE.toISOString()}`);

  const stats = { written: 0, rejected: 0, errors: 0, reasons: {} };
  let next = 0;
  let stopReason = null;
  const started = Date.now();

  async function worker() {
    while (next < todo.length) {
      if (Date.now() >= DEADLINE) { stopReason ??= "deadline"; return; }
      if (priorUsd + spend.usd + (spend.inflight + 1) * RESERVE_PER_CALL > BUDGET) { stopReason ??= "budget"; return; }
      const slot = todo[next++];
      const theme = slot.theme ? `\n\nTheme for the scene: ${THEMES[slot.theme]}. The difficulty pattern decides the right answer; the theme only sets the scene.` : "";
      const length = slot.mutation === "long_context" ? "\n\nFor this case use 25 to 35 events (not more), keeping each message short." : "";
      const user = `Example case from the practice set:\n\n${exemplar(slot.example)}\n\n` +
        `Difficulty pattern to build around (${slot.mutation}): ${MUTATIONS[slot.mutation].brief}${theme}${length}\n\n` +
        `Set the new case in the same area of delivery work as "${slot.setting.title.replace(/^Case \d+: /, "")}"${slot.theme ? " where it fits the theme" : ""}, with a different item, different people and a different plot.\n` +
        `Allowed dispositions for this pattern: ${MUTATIONS[slot.mutation].dispositions.join(", ")}. Channels must be from the exact list.`;
      spend.inflight += 1;
      try {
        const raw = await call(user);
        const parsed = GeneratedCaseDraft.safeParse(raw);
        const found = parsed.success ? problems(parsed.data, slot.mutation) : parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
        if (parsed.success && /delivery-\d{3}|DL-0\d\d\b/.test(JSON.stringify(parsed.data.events))) found.push("reuses a public case's shipment reference");
        if (found.length) {
          stats.rejected += 1;
          for (const f of found) { const key = f.replace(/\d+/g, "N").replace(/"[^"]*"/g, '"…"'); stats.reasons[key] = (stats.reasons[key] ?? 0) + 1; }
          LOG(`REJECT ${slot.id} ${slot.mutation}/${slot.theme ?? "-"}: ${found.slice(0, 3).join("; ")}`);
          continue;
        }
        parsed.data.title = parsed.data.title.replace(/^Case\s*\d*\s*:\s*/i, "Case: "); // the exemplar's "Case 047:" numbering means nothing here
        const file = { id: slot.id, track: "delivery", generated: true, mutation: slot.mutation, theme: slot.theme, model: MODEL, seed_case: slot.setting.id, grounding: null, ...parsed.data };
        await writeFile(path.join(HAIKU_DIR, `${slot.id}.json`), JSON.stringify(file, null, 2) + "\n");
        stats.written += 1;
        LOG(`ok ${slot.id} ${slot.mutation}/${slot.theme ?? "-"} [${stats.written} new, $${(priorUsd + spend.usd).toFixed(2)}] ${parsed.data.title}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "deadline" || err?.name === "TimeoutError" && Date.now() >= DEADLINE) { stopReason ??= "deadline"; return; }
        stats.errors += 1;
        LOG(`ERROR ${slot.id} ${slot.mutation}/${slot.theme ?? "-"}: ${msg.slice(0, 200)}`);
      } finally {
        spend.inflight -= 1;
        await saveState();
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await saveState();
  const mins = ((Date.now() - started) / 60000).toFixed(1);
  LOG(`done (${stopReason ?? "all slots tried"}): wrote ${stats.written}, rejected ${stats.rejected}, errors ${stats.errors}, ${spend.calls} calls, ` +
    `${spend.input} in / ${spend.output} out tokens, $${spend.usd.toFixed(2)} this run, $${(priorUsd + spend.usd).toFixed(2)} total, ${mins} min`);
  LOG(`reject reasons: ${JSON.stringify(stats.reasons)}`);
}

await main();
