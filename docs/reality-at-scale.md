# Reality Test at scale: can the runner finish ~2,500 cases between 16:30 and 17:00?

Written 14:30 BST, 10 Oct. Read-only audit of `main` at `d6ba149` (`apps/api/src/agent/{reality,cli,run,models}.ts`). No model calls were made. Patches below are text for Anson to apply; nothing in `apps/api` was edited.

## Verdict

**No, not as shipped.** At the default `--concurrency 8` the measured rate is about 18 cases/min (50 cases in 165 s), so 2,500 cases take **about 2 h 15 min**. At 16:58 roughly 500 cases would be done and **about 2,000 case folders would have no `ANSWER.md` at all**. `RUNLOG.md` and `INDEX.md` would be missing too, because both are written only at the end.

With the four fixes in P0/P1 (higher concurrency, a model-call throttle that backs off on 429, a hard deadline that writes a hand-to-a-person answer for every case not reached, and a faster retry pass), every case gets an answer by the freeze. How many get a *real* analysis depends on the account's rate-limit tier. See section 1.

**Before 16:30, check the org's tier and limits on the Console Rate limits page** (platform.claude.com/usage/limits): RPM, ITPM and OTPM for Opus 5.5 and Sonnet 5.5, and the monthly spend cap. That one number decides the concurrency.

---

## 1. Throughput maths

### Per-case work (from code and saved traces)

Calls per case on the normal path (`run.ts` `work()` at 695-731, flow `default-incident.json`, which has no planner stances and no `critic: "jev"`):

| Step | Model | Calls | Tokens in / out (mean of saved traces in `runs/api/*/trace.json`) |
|---|---|---|---|
| ingest (`run.ts:274`) | Sonnet 5.5 | 1 | ~2.6k / ~0.9k |
| triage, panel, clash | Jev | 3 (in parallel, 8 s timeout, fail soft) | ~1.2k / 0 |
| planner (`run.ts:448`) | **Opus 5.5** | 1 | ~7.0k / ~2.5k |
| critic (`run.ts:481`) | Sonnet 5.5 | 1 | ~2.4k / ~0.2k |
| when the gate objects: re-plan (`:497`) and second critic | Opus + Sonnet | +1 each | +7k / +2.5k on Opus |
| critic returns the wrong count (`:486`) | Opus | +1, rare | small |

So each case makes **2–3 Sonnet calls and 1–2 Opus calls**, 4–5 Claude requests in all. Output is about **2.5–3.3k tokens on Opus** and **~1.1–1.3k on Sonnet**. The system prompts are small (prompts.ts is 9.9k characters for all three), so caching saves little and almost all input counts toward ITPM.

Cost: **$0.054/case** in the measured 50-case batch; the 6 saved API traces average $0.084. **2,500 cases cost $135 to $210.** Start tier has a **$500/month spend cap** (Build $1,000). The cap's 429 says "You have reached your API usage limits", which matches `ACCOUNT_REFUSAL` (`cli.ts:74`, "usage limit"), so the runner stops at once and gives every remaining case a failure answer. Check what has been spent this month.

### Case throughput by concurrency (latency only, no rate limits)

Throughput = 60 × C / L cases/min, with per-case latency L = 17–32 s (measured).

| Concurrency | Cases/min | Time for 2,500 | Meets ~20 min of model time? |
|---|---|---|---|
| 8 (default) | 15–28 (measured 18) | 90–165 min (measured rate: ~137 min) | No |
| 16 | 30–56 | 45–83 min | No |
| 32 | 60–113 | 22–42 min | No (only in the best case) |
| 64 | 120–226 | 11–21 min | Yes, if rate limits allow |
| 96 | 180–340 | 7–14 min | Rate-limit bound |

The working budget is smaller than 30 min. You have to get the cases, unzip, start the run, then replay, index, `git add` 10k files, commit and push before 17:00. **Plan on about 20 minutes of model time (16:33 to 16:53), which needs about 125 cases/min.**

### Which Anthropic limit binds first (per-model buckets; Opus 5.5 and Sonnet 5.5 are separate)

Published standard limits (platform.claude.com/docs/en/api/rate-limits):

| Tier | Opus 5.5 RPM / ITPM / OTPM | Sonnet 5.5 RPM / ITPM / OTPM |
|---|---|---|
| Start | 1,000 / 2M / **400k** | 1,000 / 2M / 400k |
| Build | 5,000 / 5M / 1M | 5,000 / 5M / 1M |
| Scale | 10,000 / 10M / 2M | 10,000 / 10M / 2M |

New orgs can also sit in a lower **Evaluation tier**, with limits below Start. Sharp ramps can trip **acceleration limits** (a 429 even under the headline limit).

At **125 cases/min**:
- **Opus OTPM: 125 × 2.5–3.3k = 310–410k/min. This binds first on Start tier.** The ceiling is about **120–160 cases/min**, which is just enough at best.
- Opus ITPM: 125 × 7–9k = 0.9–1.1M (half the 2M limit). Opus RPM: 125–250, which is fine.
- Sonnet: about 160k OTPM, about 0.9M ITPM and 250–375 RPM. Fine.
- On Build tier or above, nothing binds below about 300 cases/min. Concurrency and latency are the only limits.

**What this means:** on Start tier, 2,500 cases in 20 minutes sits right at the Opus output-token ceiling. Expect some 429s, so the throttle (P0-2) and the deadline (P0-1) are what keep the batch safe. On Build tier, concurrency 64–96 finishes with time to spare.

---

## 2. Failure modes at scale

| # | Area | What the code does now | Risk at 2,500 |
|---|---|---|---|
| F1 | **No global deadline** | `pool` (`cli.ts:124`) runs until every case is done. RUNLOG is written at `:137` and INDEX at `reality.ts:38`, both only at the end. | **Critical.** If someone kills the run at 16:58, every case it never reached has no ANSWER.md (this breaks the rule that every case is handed to a person), and there is no RUNLOG and no INDEX. |
| F2 | **429 / 529** | SDK `maxRetries: 2` (`models.ts:60`); the SDK honours `retry-after`. After that the call throws, the case becomes `error`, and it lands in `failed`. | **High.** A 429 storm turns hundreds of cases into `error` within a minute. There is no backoff across cases: all 8–64 workers keep firing. |
| F3 | **Retry pass** | After a 20 s pause, failed cases rerun **2 at a time** (`cli.ts:21-22, 130-134`). | **Critical at scale.** 300 failed cases × 25 s ÷ 2 = **about 62 min**. That alone blows the deadline. |
| F4 | `reality.ts` second pass | Runs only when `code !== 0` or `incomplete()` finds missing files. `error` outcomes already have all four files, and cli exits 0 (`cli.ts:144`). | Medium. Cases that ended in `error` are never rerun by `reality.ts`. That is safe for the deadline but leaves recoverable cases unrecovered. Once a deadline exists, this pass must also respect it. |
| F5 | Per-case timeout | `CASE_TIMEOUT_MS = 300_000` (`run.ts:17`), with `timeoutMs` override in RunOptions (`run.ts:33`); per-call timeout is 150 s (`models.ts:26`). | Medium. A stuck case holds a worker slot for 5 minutes, and an in-flight case at 16:59 isn't cut off. Fix: tie `timeoutMs` to the deadline. |
| F6 | Resume after crash | `--resume` skips cases whose `trace.json` ends in a non-error `run_end` (`cli.ts:83-88`). It reads a truncated trace as not done. | OK. Resume works and is cheap: 2,500 small reads. |
| F7 | Never crash mid-batch | `answer()` catches everything and writes a failure ANSWER.md (`:111-119`). `runCase` never throws. | OK. A loader or disk failure writes only ANSWER.md and REASONING.md, so `incomplete()` flags them and `reality.ts` reruns them. Fine. |
| F8 | Output ordering | Each case writes into its own folder. RUNLOG rows are sorted by name (`:136`). `case-history.jsonl` uses `appendFile` with one short line per case. | OK. |
| F9 | Memory and file handles | Each case keeps its bundle (attachments as base64) only while it runs. `ulimit -n` here is 1,048,576. One shared SDK client. | OK at C ≤ 128. One trace.json is ~11 KB, so all outputs come to roughly 60–80 MB in about 10k files. `git add` and push take about a minute. Budget for it. |
| F10 | ElevenLabs | No retry on 429 (`voice/elevenlabs.ts:28`); 30 s timeout. A failure becomes "transcription failed" in `unreadable`. | Medium at high concurrency. Plan concurrency limits are small, so audio cases quietly lose their transcript. Cap transcription at 4 at a time (P1-3). |
| F11 | Jev | 8 s timeout, one retry on 429/529 (`jev.ts:9-12, 93`). Fails soft through `quick()`. | Low. Adds up to about 9 s to a case when TypeSafe is throttling. |
| F12 | Spend cap | A 429 with no `retry-after`, matched by `ACCOUNT_REFUSAL`, sets `refused`. Every remaining case then gets a failure answer immediately. | OK in behaviour. Check the cap headroom ($135–210 needed). |
| F13 | Partial ANSWERS | Every case the runner reaches gets an ANSWER.md that hands it to a person (report.ts `error` → "SYSTEM FAILURE: HANDED TO A HUMAN"). | Covered only for cases it reaches. See F1. |

---

## 3. Prioritised fixes (each about 2–10 min to apply)

Order: **P0-1 and P0-2 are the ones that matter.** P0-3 is a one-line change. The rest are nice to have.

### P0-1. Deadline mode: answer every case by the freeze (`cli.ts`, plus `reality.ts` passthrough)

After the soft stop, each new case runs through `runCase` with a models object that refuses at once. That produces the normal `error` result with all four files. Its ANSWER.md reads "SYSTEM FAILURE: HANDED TO A HUMAN" with "What failed: Time ran out before this case could be analysed. No action was taken.", and no tokens are spent. Cases still running at the hard stop are cut off through `timeoutMs` and get the same kind of answer. Nothing is left without an answer, and the retry pass and the `reality.ts` rerun are both skipped once time is up.

```diff
--- a/apps/api/src/agent/cli.ts
+++ b/apps/api/src/agent/cli.ts
@@ -18,8 +18,24 @@ import { caseKeyterms, withReferenceCheck } from "../voice/references.ts";
 const FLOW_FILE = path.resolve(import.meta.dirname, "..", "..", "flows", "default-incident.json");
-const RETRY_PAUSE_MS = 20_000;
-const RETRY_CONCURRENCY = 2;
+const RETRY_PAUSE_MS = 5_000;
+// Cases still waiting this close to the hard stop are not started: they could not finish.
+const SOFT_STOP_MS = 75_000;
+
+/** "16:57" (today, local time) or an ISO timestamp. Unset means no deadline. */
+function parseDeadline(s: string | undefined): number {
+  if (!s) return Infinity;
+  const hm = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
+  if (hm) { const d = new Date(); d.setHours(Number(hm[1]), Number(hm[2]), 0, 0); return d.getTime(); }
+  const t = Date.parse(s);
+  if (Number.isNaN(t)) throw new Error(`--deadline must be HH:MM or an ISO time, not "${s}"`);
+  return t;
+}
+
+/** Used once time is up: every call fails at once, so the case is handed to a person and costs nothing. */
+const outOfTime: Models = { async structured() { throw new Error("Time ran out before this case could be analysed. No action was taken."); } };
@@ -33,9 +49,10 @@ async function main() {
     options: {
       mode: { type: "string", default: "reality" },
-      concurrency: { type: "string", default: "8" },
+      concurrency: { type: "string", default: "48" },
       resume: { type: "boolean", default: false },
       flow: { type: "string" },
+      deadline: { type: "string" },
     },
   });
@@
   const runId = `${new Date().toISOString()}-${values.mode}`;
   const mode = values.mode === "practice" ? "practice" : "reality";
+  const hardStop = parseDeadline(values.deadline ?? process.env.REALITY_DEADLINE);
+  const softStop = hardStop - SOFT_STOP_MS;
+  const late = () => Date.now() >= softStop;
@@ async function answer(name: string, attempt: number): Promise<void> {
       if (refused) throw new Error(`not attempted: the model account refused an earlier case (${refused})`);
-      const bundle = await loadFolder(path.join(casesDir, name), { transcribe: transcribeAudio, keyterms: caseKeyterms, checkReferences: withReferenceCheck });
+      const outOfTimeNow = late();
+      const bundle = await loadFolder(path.join(casesDir, name), { transcribe: outOfTimeNow ? undefined : transcribeAudio, keyterms: caseKeyterms, checkReferences: withReferenceCheck });
@@
-      const result = await runCase(bundle, { flow, models, panel, judge: quick, mode, runId });
+      const result = await runCase(bundle, {
+        flow, mode, runId,
+        models: outOfTimeNow ? outOfTime : models,
+        panel: outOfTimeNow ? undefined : panel,
+        judge: outOfTimeNow ? undefined : quick,
+        // A case in flight at the hard stop is cut off and handed to a person like any other failure.
+        timeoutMs: Math.max(5_000, Math.min(300_000, hardStop - Date.now())),
+      });
@@
-  } else if (failed.size) {
-    console.log(`${failed.size} failed. Waiting ${RETRY_PAUSE_MS / 1000}s, then retrying them ${RETRY_CONCURRENCY} at a time.`);
+  } else if (failed.size && !late()) {
+    const retryAt = Math.max(2, Math.floor((Number(values.concurrency) || 8) / 2));
+    console.log(`${failed.size} failed. Waiting ${RETRY_PAUSE_MS / 1000}s, then retrying them ${retryAt} at a time.`);
     await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
-    await pool([...failed], RETRY_CONCURRENCY, (name) => answer(name, 2));
+    await pool([...failed], retryAt, (name) => answer(name, 2));
   }
```

One more guard in the retry: a retried case that starts after the soft stop already gets `outOfTime` through `late()`, so it is handed over cheaply. It does not overwrite a better answer, because it only reruns cases that already failed.

`Models` is already imported as a type through `./models.ts`. Add `type Models` to the import on `cli.ts:13`:

```diff
-import { chosenModels, claude } from "./models.ts";
+import { chosenModels, claude, type Models } from "./models.ts";
```

`reality.ts`: pass the deadline through, default to 48, and skip the second pass after the deadline:

```diff
--- a/apps/api/src/agent/reality.ts
+++ b/apps/api/src/agent/reality.ts
@@ -14,3 +14,4 @@
-function answer(casesDir: string, outDir: string, concurrency: string, resume: boolean): Promise<number> {
-  const args = [CLI, casesDir, outDir, "--mode", "reality", "--concurrency", concurrency, ...(resume ? ["--resume"] : [])];
+function answer(casesDir: string, outDir: string, concurrency: string, resume: boolean, deadline?: string): Promise<number> {
+  const args = [CLI, casesDir, outDir, "--mode", "reality", "--concurrency", concurrency, ...(resume ? ["--resume"] : []),
+    ...(deadline ? ["--deadline", deadline] : [])];
@@ -24 +25 @@
-  const { values, positionals } = parseArgs({ allowPositionals: true, options: { concurrency: { type: "string", default: "8" } } });
+  const { values, positionals } = parseArgs({ allowPositionals: true, options: { concurrency: { type: "string", default: "48" }, deadline: { type: "string" } } });
@@ -29,7 +30,9 @@
-  let code = await answer(casesDir, outDir, values.concurrency, false);
+  const deadline = values.deadline ?? process.env.REALITY_DEADLINE;
+  let code = await answer(casesDir, outDir, values.concurrency, false, deadline);
   let gaps = await incomplete(casesDir, outDir);
-  if (code !== 0 || gaps.length) {
+  const timeLeft = !deadline || Date.now() < new Date(new Date().toDateString() + " " + deadline).getTime() - 120_000;
+  if ((code !== 0 || gaps.length) && timeLeft) {
     console.log(`\n${gaps.length} case(s) incomplete after the first pass. Rerunning only those.`);
-    code = await answer(casesDir, outDir, values.concurrency, true);
+    code = await answer(casesDir, outDir, values.concurrency, true, deadline);
```

(The `timeLeft` line assumes the `HH:MM` form. If an ISO deadline might be passed, reuse `parseDeadline` by exporting it from a tiny shared module.)

Run it as: `npm run reality -- <cases> ANSWERS --concurrency 64 --deadline 16:54`. That leaves about 6 minutes for replay, index, `git add`, commit and push.

### P0-2. Throttle model calls and back off on 429/529 (`cli.ts` only; wraps `models`)

With a high case concurrency, this caps how many Claude calls are in flight. It starts at 16 to stay clear of acceleration limits, climbs as calls succeed, and drops by 30% on a 429 or 529. The SDK's own retries (which honour `retry-after`) still run inside each call.

```diff
--- a/apps/api/src/agent/cli.ts
+++ b/apps/api/src/agent/cli.ts
@@ imports
+import Anthropic from "@anthropic-ai/sdk";
@@ after pool()
+/** Caps in-flight model calls: starts low, grows on success, shrinks on 429/529 (AIMD). */
+function throttled(inner: Models, max: number): Models {
+  let limit = Math.min(16, max);
+  let active = 0;
+  const waiting: (() => void)[] = [];
+  const pump = () => { while (active < Math.floor(limit) && waiting.length) { active++; waiting.shift()!(); } };
+  return {
+    async structured(call) {
+      await new Promise<void>((go) => { waiting.push(go); pump(); });
+      try {
+        const res = await inner.structured(call);
+        limit = Math.min(max, limit + 0.5);
+        return res;
+      } catch (err) {
+        if (err instanceof Anthropic.APIError && (err.status === 429 || err.status === 529)) {
+          limit = Math.max(4, limit * 0.7);
+          console.warn(`model busy (${err.status}); in-flight calls now capped at ${Math.floor(limit)}`);
+        }
+        throw err;
+      } finally { active--; pump(); }
+    },
+  };
+}
@@ main()
-  const models = claude(undefined, chosen);
+  // Room for about 3 in-flight calls per running case; the throttle trims it if the API pushes back.
+  const models = throttled(claude(undefined, chosen), Math.max(8, 3 * (Number(values.concurrency) || 8)));
```

### P0-3. More SDK retries (`models.ts:60`, one line)

```diff
-export function claude(client: Anthropic = new Anthropic({ timeout: CALL_TIMEOUT_MS, maxRetries: 2 }), models: Record<Tier, string> = chosenModels()): Models {
+export function claude(client: Anthropic = new Anthropic({ timeout: CALL_TIMEOUT_MS, maxRetries: 5 }), models: Record<Tier, string> = chosenModels()): Models {
```

The SDK waits `retry-after` (or uses exponential backoff with jitter) between tries, and the per-case timeout plus the deadline still bound the total. Five retries ride out a 30–60 s 429 burst that would otherwise fail the case.

### P1-1. When Opus is rate-limited, decide on Sonnet instead of failing (`models.ts:62-95`)

On Start tier, the Opus output-token limit is the first thing to bind. Sonnet has its own bucket, and that bucket is mostly idle. With this change, if the strong-tier call still fails with 429/529 after its retries, the same request goes once to the fast model. The trace records the model that actually answered (`usage.model = res.model`), so the logs stay accurate. Sonnet as the decider was run-2-era quality, not run-4. That is still better than handing the case to a person.

```diff
   return {
-    async structured({ system, user, schema, media = [], effort = "medium", tier = "fast", signal }) {
+    async structured(call) {
+      try { return await once(call, models[call.tier ?? "fast"]); }
+      catch (err) {
+        const busy = err instanceof Anthropic.APIError && (err.status === 429 || err.status === 529) && !/usage limit/i.test(err.message);
+        if (!busy || (call.tier ?? "fast") !== "strong" || models.fast === models.strong) throw err;
+        return once(call, models.fast);
+      }
+    },
+  };
+
+  async function once<S extends z.ZodType>({ system, user, schema, media = [], effort = "medium", signal }: StructuredCall<S>, model: string) {
       const started = Date.now();
-      const model = models[tier];
       const price = PRICES[model];
       ... (body unchanged) ...
       return { output: res.parsed_output as z.infer<typeof schema>, usage };
-    },
-  };
+  }
```

(Close the function correctly: `once` sits inside `claude()` after the `return`, so it is a hoisted function declaration.)

### P1-2. Progress line with ETA (`cli.ts:121`), so the operator can see the problem by 16:40, not at 16:58

```diff
-    console.log(lines.get(name));
+    console.log(lines.get(name));
+    const done = lines.size, rate = done / ((Date.now() - batchStart) / 60_000);
+    if (done % 25 === 0) console.log(`-- ${done}/${names.length} done, ${rate.toFixed(0)}/min, ETA ${Math.ceil((names.length - done) / Math.max(rate, 0.1))} min`);
```

(Set `const batchStart = Date.now();` just before the first `pool(...)` call at `:124`.)

### P1-3. Cap ElevenLabs transcription at 4 at a time (`cli.ts:55-57`)

At a case concurrency of 64, audio cases would trip ElevenLabs' concurrency limit. That client does not retry on 429, so the transcript is lost silently.

```diff
+  let sttActive = 0; const sttWaiting: (() => void)[] = [];
+  const sttSlot = async <T>(fn: () => Promise<T>) => { if (sttActive >= 4) await new Promise<void>((go) => sttWaiting.push(go)); sttActive++; try { return await fn(); } finally { sttActive--; sttWaiting.shift()?.(); } };
   const transcribeAudio = process.env.ELEVENLABS_API_KEY
-    ? (audio: Uint8Array, filename: string, opts?: { keyterms?: string[] }) => transcribe(audio, { filename, keyterms: opts?.keyterms })
+    ? (audio: Uint8Array, filename: string, opts?: { keyterms?: string[] }) => sttSlot(() => transcribe(audio, { filename, keyterms: opts?.keyterms }))
     : undefined;
```

### P2. Cheaper fast path for obvious cases: not recommended today

A triage-gated single-call path (Sonnet decides when Jev triage says routine) would cut Opus output by roughly half. But it changes behaviour on the scored core with no eval run behind it. The emergency lever already exists without code: if the tier check at 16:30 shows Evaluation or a low Start allowance and the count is above ~1,500, run with `AGENT_MODEL=claude-sonnet-5-5`. That moves the planner into the Sonnet bucket, at the cost of unmeasured quality. P1-1 does the same thing automatically, and only for the cases that need it, so it is the better default.

---

## 4. Runbook for 16:30 (with P0 applied)

1. Before 16:30: on the Console limits page, note the tier and the Opus 5.5 OTPM. Check the spend cap headroom is at least $250.
2. Count the cases: `ls <cases> | wc -l`. Pick a concurrency: Start tier 48–64; Build tier or higher 96.
3. `REALITY_DEADLINE=16:54 npm run reality -- <cases> ANSWERS --concurrency 64`
4. Watch the ETA line (P1-2). If ETA goes past 16:53 and 429 warnings keep coming, leave it running: the deadline handles the tail.
5. When it exits (by ~16:55), it has already run replay and written the index. Then `git add ANSWERS && git commit && git push`. Pushing 10k small files takes about a minute.

## 5. Not verified

- The org's actual tier and limits, which can only be read from the Console or from headers on a paid call.
- Latency under 64-way load: the 17–32 s figure came from concurrency 8.
- TypeSafe and ElevenLabs plan limits.
- How often the gate objects and forces a re-plan, and so the extra Opus call rate; the estimate used here is 0–30%.
- None of the patches above have been compiled or run. They are written against the line numbers at `d6ba149`.
