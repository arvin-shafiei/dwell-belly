// Batch runner. Every subfolder of <casesDir> is one case; each gets ANSWER.md, REASONING.md and
// trace.json under <outDir>/<case>/. One bad case never stops the batch.
// Usage: npm run answer -- <casesDir> [outDir=ANSWERS] [--mode reality|practice] [--concurrency 24] [--resume] [--flow <file>]
//   [--deadline HH:MM] (or REALITY_DEADLINE): after it no case makes a model call; each remaining case is handed to a person at $0.
//   [--budget-usd N] (or REALITY_BUDGET_USD, default 18, "none" for no cap): stop starting real cases before spend would pass N.
//   [--profile cheap] (or REALITY_PROFILE): Sonnet decides, Haiku reads and checks. Not evaluated.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import type { Flow } from "../lib/flow.ts";
import { runPanel } from "../lib/panel.ts";
import { validateFlow } from "./architect.ts";
import { historyStore, record } from "./history.ts";
import * as judge from "./judge.ts";
import { loadFolder } from "./load.ts";
import { writeIndex } from "./answers-index.ts";
import { Budget, caseTimeout, metered, outOfBudget, outOfTime, parseBudget, parseDeadline, progressLine, SOFT_STOP_MS, throttled } from "./batch.ts";
import { chosenModels, claude } from "./models.ts";
import { renderAnswer, renderReasoning } from "./report.ts";
import { runCase, savedResult } from "./run.ts";
import { findTools } from "./tools.ts";
import { transcribe } from "../voice/elevenlabs.ts";
import { caseKeyterms, withReferenceCheck } from "../voice/references.ts";

const FLOW_FILE = path.resolve(import.meta.dirname, "..", "..", "flows", "default-incident.json");
const RETRY_PAUSE_MS = 5_000;
const DEFAULT_BUDGET_USD = 18;
// RUNLOG.md is rewritten every this many finished cases, INDEX.md every LOG_EVERY * 4, so a run
// stopped by hand still leaves both behind.
const LOG_EVERY = 25;

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => { while (next < items.length) await fn(items[next++]); };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      mode: { type: "string", default: "reality" },
      concurrency: { type: "string", default: "24" },
      resume: { type: "boolean", default: false },
      flow: { type: "string" },
      deadline: { type: "string" },
      "budget-usd": { type: "string" },
      profile: { type: "string" },
    },
  });
  const [casesDir, outDir = "ANSWERS"] = positionals;
  if (!casesDir) throw new Error("Usage: npm run answer -- <casesDir> [outDir] [--mode reality|practice] [--concurrency 24] [--resume] [--deadline HH:MM] [--budget-usd N] [--profile cheap]");
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new Error("No ANTHROPIC_API_KEY. Put it in apps/api/.env.local; without it every case would only get a failure answer.");
  }

  const flowFile = values.flow ? path.resolve(values.flow) : FLOW_FILE;
  const flow: Flow = JSON.parse(await readFile(flowFile, "utf8"));
  // A flow someone edited by hand or in the console must be sound before a batch is spent on it.
  const problems = validateFlow(flow);
  if (problems.length) throw new Error(`Flow ${flowFile} is not valid:\n- ${problems.join("\n- ")}`);
  if (values.profile) process.env.REALITY_PROFILE = values.profile;
  const chosen = chosenModels();
  const concurrency = Math.max(1, Number(values.concurrency) || 1);
  const hardStop = parseDeadline(values.deadline ?? process.env.REALITY_DEADLINE);
  // Cases still waiting this close to the hard stop are not started: they could not finish.
  const late = () => Date.now() >= hardStop - SOFT_STOP_MS;
  const budget = new Budget(parseBudget(values["budget-usd"] ?? process.env.REALITY_BUDGET_USD, DEFAULT_BUDGET_USD),
    process.env.REALITY_PROFILE?.trim().toLowerCase() === "cheap" ? 0.03 : 0.08);
  // Room for about 3 in-flight calls per running case; the throttle trims it if the API pushes back.
  const gate = throttled(claude(undefined, chosen), {
    start: 16, max: Math.max(8, 3 * concurrency), floor: 4,
    onBusy: (limit, status) => console.warn(`model busy (${status}); in-flight model calls now capped at ${limit}`),
  });
  const models = metered(gate, budget);
  const jev = Boolean(process.env.TYPESAFE_API_KEY);
  // Audio files in a case are transcribed only when a speech-to-text key is set; otherwise they are listed as not transcribed.
  const transcribeAudio = process.env.ELEVENLABS_API_KEY
    ? (audio: Uint8Array, filename: string, opts?: { keyterms?: string[] }) => transcribe(audio, { filename, keyterms: opts?.keyterms })
    : undefined;
  const panel = jev ? runPanel : undefined;
  const quick = jev ? judge : undefined;
  const runId = `${new Date().toISOString()}-${values.mode}`;
  const mode = values.mode === "practice" ? "practice" : "reality";

  const names = (await readdir(casesDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  if (names.length === 0) throw new Error(`No case folders found in ${casesDir}`);
  await mkdir(outDir, { recursive: true });
  console.log(`${names.length} cases, ${concurrency} at a time, mode ${mode}, deciding on ${chosen.strong}, reading and checking on ${chosen.fast}, Jev ${panel ? "on" : "off (no key)"}`);
  console.log(`Deadline ${Number.isFinite(hardStop) ? new Date(hardStop).toTimeString().slice(0, 5) : "none"}, budget ${Number.isFinite(budget.limitUsd) ? `$${budget.limitUsd.toFixed(2)}` : "none"}.`);

  const store = historyStore(path.join(outDir, "case-history.jsonl"));
  const lines = new Map<string, string>();
  // Set when the account itself is refused (bad key, no credit). Retrying or carrying on cannot help,
  // so the remaining cases get their failure answer at once and the operator is told why.
  let refused: string | null = null;
  const ACCOUNT_REFUSAL = /\b40[13]\b|authentication|invalid x-api-key|credit balance|usage limit|billing|permission/i;
  const failed = new Set<string>();
  // Cases handed to a person without analysis because time or money ran out. Not retried.
  const skipped = { time: 0, budget: 0 };
  let finishedCount = 0;
  let batchStart = Date.now();
  let total = names.length;

  // Writes are chained so two never overlap; a failed write is retried on the next one.
  let writing: Promise<unknown> = Promise.resolve();
  const runlog = () => {
    const table = names.map((n) => lines.get(n) ?? `| ${n} | not run yet | | | |`).join("\n");
    const notes = [
      `Spent $${budget.spent.toFixed(2)}${Number.isFinite(budget.limitUsd) ? ` of a $${budget.limitUsd.toFixed(2)} budget` : ""}.`,
      ...(budget.reachedAt ? [`Budget reached at ${budget.reachedAt.toTimeString().slice(0, 8)}: ${skipped.budget} case(s) were handed to a person without analysis, at no cost.`] : []),
      ...(skipped.time ? [`Deadline reached: ${skipped.time} case(s) were handed to a person without analysis, at no cost.`] : []),
    ].join("\n");
    return writeFile(path.join(outDir, "RUNLOG.md"),
      `# Run log\n\nRun ${runId}. Generated by \`npm run answer\`; not edited by hand.\n\n${notes}\n\n| Case | Result | Outcome | Time | Cost |\n|---|---|---|---|---|\n${table}\n`);
  };
  const saveLogs = (withIndex: boolean) => {
    writing = writing.then(() => runlog()).then(() => (withIndex ? writeIndex(outDir) : undefined)).catch((err) => console.warn(`could not write the run log: ${err instanceof Error ? err.message : err}`));
    return writing;
  };

  // Never throws: whatever happens, the case ends with a line in the log and an ANSWER.md on disk.
  async function answer(name: string, attempt: number): Promise<void> {
    const dir = path.join(outDir, name);
    const started = Date.now();
    const note = attempt > 1 ? ` (attempt ${attempt})` : "";
    let stop: "time" | "budget" | null = null;
    let inBudget = false;
    try {
      if (values.resume && attempt === 1) {
        // A trace cut off by a killed run must read as "not done", never crash the resume.
        const prior = await readFile(path.join(dir, "trace.json"), "utf8").then(JSON.parse).catch(() => null);
        const ended = Array.isArray(prior?.events) ? prior.events.findLast((e: { kind?: string } | null) => e?.kind === "run_end") : undefined;
        if (ended && ended.outcome !== "error") { lines.set(name, `| ${name} | kept from an earlier run | ${ended.outcome} | | |`); return; }
      }
      if (refused) throw new Error(`not attempted: the model account refused an earlier case (${refused})`);
      // Out of time or money: the case still runs through the flow, but every model call fails at
      // once, so it gets the normal four files handing it to a person, and costs nothing.
      stop = late() ? "time" : !budget.tryStart() ? "budget" : null;
      inBudget = !stop;
      const bundle = await loadFolder(path.join(casesDir, name), { transcribe: stop ? undefined : transcribeAudio, keyterms: caseKeyterms, checkReferences: withReferenceCheck });
      // Tools shipped with a case are recorded, not called: a manifest is case content, and an
      // unknown endpoint is not somewhere to send a customer's details unprompted.
      const found = await findTools(path.join(casesDir, name)).catch(() => ({ tools: [], unparsed: [] }));
      if (found.tools.length) bundle.tools = found.tools.map((t) => ({ name: t.name, description: t.description }));
      const result = stop
        ? await runCase(bundle, { flow, models: stop === "time" ? outOfTime : outOfBudget, mode, runId })
        // A case still running at the deadline is cut off and handed to a person like any other failure.
        : await runCase(bundle, { flow, models, panel, judge: quick, mode, runId, timeoutMs: caseTimeout(hardStop) });
      // The history lets later runs group related cases and chase promises. Losing a line of it must not lose the answer.
      await record(store, result, new Date()).catch(() => {});
      // Render everything first, so the three files describe one and the same state.
      const files = {
        "ANSWER.md": renderAnswer(result), "REASONING.md": renderReasoning(result),
        "trace.json": JSON.stringify(result.trace, null, 1), "result.json": JSON.stringify(savedResult(result), null, 1),
      };
      await mkdir(dir, { recursive: true });
      for (const [file, text] of Object.entries(files)) await writeFile(path.join(dir, file), text);
      const end = result.trace.events.findLast((e) => e.kind === "run_end");
      const cost = end?.kind === "run_end" ? end.totalCostUsd : 0;
      if (inBudget) { budget.finish(cost); inBudget = false; }
      if (stop) { skipped[stop]++; failed.delete(name); } else if (result.outcome === "error") failed.add(name); else failed.delete(name);
      if (result.error && ACCOUNT_REFUSAL.test(result.error)) refused = result.error.slice(0, 160);
      const status = stop ? `not analysed: ${stop === "time" ? "deadline" : "budget"} reached` : result.error ? `failed at ${result.failedAt}: ${result.error.replace(/\|/g, "/").slice(0, 200)}` : "ok";
      lines.set(name, `| ${name} | ${status}${note} | ${result.outcome} | ${((Date.now() - started) / 1000).toFixed(1)} s | $${cost.toFixed(3)} |`);
    } catch (err) {
      // runCase does not throw, so this is the loader or the disk. Still leave an answer behind.
      if (inBudget) budget.finish(0);
      const message = err instanceof Error ? err.message : String(err);
      failed.add(name);
      await mkdir(dir, { recursive: true }).catch(() => {});
      await writeFile(path.join(dir, "ANSWER.md"),
        `# ${name}\n\n**Decision:** SYSTEM FAILURE: HANDED TO A HUMAN\n\nThe case could not be loaded or its answer could not be written (${message}). No action was taken. A person needs to handle this case from the original files.\n`).catch(() => {});
      await writeFile(path.join(dir, "REASONING.md"), `# Reasoning: ${name}\n\nThe run failed before any analysis: ${message}\n`).catch(() => {});
      lines.set(name, `| ${name} | failed outside the flow: ${message.replace(/\|/g, "/").slice(0, 200)}${note} | error | | |`);
    }
    console.log(lines.get(name));
    finishedCount++;
    if (finishedCount % LOG_EVERY === 0 || finishedCount === total) {
      console.log(progressLine(finishedCount, total, batchStart, Date.now(), `$${budget.spent.toFixed(2)} spent, model calls in flight ${gate.active}/${gate.limit}`));
      void saveLogs(finishedCount % (LOG_EVERY * 4) === 0);
    }
  }

  // At the deadline, write the logs even if cases are still finishing, so a run stopped by hand has them.
  const atDeadline = Number.isFinite(hardStop) ? setTimeout(() => void saveLogs(true), Math.max(0, hardStop - Date.now())) : undefined;
  atDeadline?.unref();

  await pool(names, concurrency, (name) => answer(name, 1));

  // Rate limits and overloads fail many cases at once. One slower second pass recovers them
  // without anyone touching the outputs.
  if (refused) {
    console.error(`\nSTOPPED EARLY: the model account refused requests (${refused}). Check the key and the credit balance, then rerun with --resume.`);
  } else if (failed.size && late()) {
    console.log(`${failed.size} failed. Past the deadline, so they are not retried (each has an ANSWER.md handing it to a person).`);
  } else if (failed.size && budget.reachedAt) {
    console.log(`${failed.size} failed. The budget is spent, so they are not retried (each has an ANSWER.md handing it to a person).`);
  } else if (failed.size) {
    const retryAt = Math.max(2, Math.floor(concurrency / 2));
    console.log(`${failed.size} failed. Waiting ${RETRY_PAUSE_MS / 1000}s, then retrying them ${retryAt} at a time.`);
    await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
    const retry = [...failed];
    finishedCount = 0; total = retry.length; batchStart = Date.now();
    await pool(retry, retryAt, (name) => answer(name, 2));
  }

  clearTimeout(atDeadline);
  for (const n of names) if (!lines.has(n)) lines.set(n, `| ${n} | not run | error | | |`);
  await saveLogs(true);
  const handed = skipped.time + skipped.budget;
  console.log(`Done. ${names.length - failed.size - handed} answered, ${failed.size} failed, ${handed} not analysed (time ${skipped.time}, budget ${skipped.budget}); each has an ANSWER.md. Spent $${budget.spent.toFixed(2)}. Log: ${path.join(outDir, "RUNLOG.md")}`);
}

await main();
// In-flight requests from a timed-out case must not keep the process alive after the log is written.
process.exit(0);
