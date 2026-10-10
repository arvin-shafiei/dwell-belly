// Deadline, budget and throttle for large Reality Test batches. No key, no network: the runner is
// spawned with a dummy key and a deadline or budget that is already spent, so no case calls a model.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { Flow } from "../lib/flow.ts";
import { incomplete, isCaseFolder, OUTPUT_FILES, spentAndErrored } from "./answers-index.ts";
import { Budget, caseTimeout, metered, OUT_OF_BUDGET, OUT_OF_TIME, outOfBudget, outOfTime, parseBudget, parseDeadline, progressLine, throttled } from "./batch.ts";
import { fromView, loadFolder } from "./load.ts";
import { chosenModels, CHEAP_MODELS, DEFAULT_MODELS, type Models } from "./models.ts";
import { renderAnswer } from "./report.ts";
import { runCase } from "./run.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const flow: Flow = JSON.parse(await readFile(path.join(ROOT, "apps/api/flows/default-incident.json"), "utf8"));
const bundle = fromView({ id: "delivery-024", title: "Case 024", events: [
  { n: 1, timestamp: "2026-02-25T09:00:00Z", stage: "Context", channel: "Email", from: "Tracking support", to: "Desk", body: "DL-024 shows delivered." },
] });
const usage = (costUsd = 0.01) => ({ model: "fake", latencyMs: 1, tokensIn: 1, tokensOut: 1, costUsd });
const tick = () => new Promise((r) => setImmediate(r));

test("parseDeadline reads HH:MM as today local time, ISO as given, and nothing as no deadline", () => {
  const now = new Date(2026, 9, 10, 15, 0, 0);
  assert.equal(parseDeadline("16:54", now), new Date(2026, 9, 10, 16, 54, 0, 0).getTime());
  assert.equal(parseDeadline("2026-10-10T15:54:00Z"), Date.parse("2026-10-10T15:54:00Z"));
  assert.equal(parseDeadline(undefined), Infinity);
  assert.equal(parseDeadline(""), Infinity);
  assert.throws(() => parseDeadline("25:00"), /HH:MM/);
  assert.throws(() => parseDeadline("soon"), /HH:MM/);
});

test("a case started near the deadline gets a timeout that ends at the deadline", () => {
  assert.equal(caseTimeout(1_000_000 + 60_000, 1_000_000), 60_000);
  assert.equal(caseTimeout(Infinity, 0), 300_000);
  assert.equal(caseTimeout(0, 1_000_000), 5_000, "never below the 5 s floor");
});

test("after the deadline a case is handed to a person with all its files, at no cost", async () => {
  const r = await runCase(bundle, { flow, models: outOfTime, mode: "reality", runId: "t" });
  assert.equal(r.outcome, "error");
  assert.equal(r.error, OUT_OF_TIME);
  const end = r.trace.events.findLast((e) => e.kind === "run_end");
  assert.equal(end?.kind === "run_end" && end.totalCostUsd, 0);
  assert.equal(r.outbox.length, 0, "nothing is sent");
  assert.match(renderAnswer(r), /SYSTEM FAILURE: HANDED TO A HUMAN/);
  assert.match(renderAnswer(r), /Time ran out before this case could be analysed\. No action was taken\./);
  const b = await runCase(bundle, { flow, models: outOfBudget, mode: "reality", runId: "t" });
  assert.equal(b.error, OUT_OF_BUDGET);
});

test("the budget refuses a case once spend plus running cases at the average cost would pass the limit", () => {
  const budget = new Budget(1, 0.25);
  assert.equal(budget.tryStart(), true);
  assert.equal(budget.tryStart(), true);
  assert.equal(budget.tryStart(), true);
  assert.equal(budget.tryStart(), true, "4 running x $0.25 estimate = $1.00, at the limit");
  assert.equal(budget.tryStart(), false, "a fifth would pass it");
  assert.ok(budget.reachedAt instanceof Date);
  // Real spend lands; the average of finished cases replaces the estimate.
  budget.add(0.1); budget.finish(0.1);
  budget.add(0.1); budget.finish(0.1);
  assert.equal(budget.averageUsd, 0.1);
  assert.equal(budget.running, 2);
  // spent 0.2 + (2 running + 1) x 0.1 = 0.5 <= 1
  assert.equal(budget.tryStart(), true);
  budget.add(0.75);
  assert.equal(budget.tryStart(), false, "0.95 spent + 4 x 0.1 > 1");
  assert.equal(parseBudget(undefined, 18), 18);
  assert.equal(parseBudget("12.5", 18), 12.5);
  assert.equal(parseBudget("none", 18), Infinity);
  assert.throws(() => parseBudget("lots", 18), /budget-usd/);
});

test("metered models add each call's real cost to the budget", async () => {
  const budget = new Budget(10);
  const inner: Models = { async structured() { return { output: {} as never, usage: usage(0.04) }; } };
  const m = metered(inner, budget);
  await m.structured({ system: "", user: "", schema: {} as never });
  await m.structured({ system: "", user: "", schema: {} as never });
  assert.ok(Math.abs(budget.spent - 0.08) < 1e-9);
});

/** A model whose calls stay pending until the test settles them. */
function controllable() {
  const pending: { resolve: () => void; reject: (e: unknown) => void }[] = [];
  const models: Models = {
    structured: () => new Promise((resolve, reject) => {
      pending.push({ resolve: () => resolve({ output: {} as never, usage: usage() }), reject });
    }),
  };
  return { models, pending };
}
const busy = (status: number) => Object.assign(new Error(`status ${status}`), { status });

test("the throttle starts at 16 in-flight calls, grows on success, and never passes its max", async () => {
  const { models, pending } = controllable();
  const t = throttled(models, { max: 20 });
  const calls = Array.from({ length: 30 }, () => t.structured({ system: "", user: "", schema: {} as never }));
  await tick();
  assert.equal(t.active, 16);
  assert.equal(t.waiting, 14);
  for (let i = 0; i < 16; i++) pending.shift()!.resolve();
  await tick(); await tick();
  assert.ok(t.limit > 16 && t.limit <= 20, `limit ${t.limit}`);
  assert.ok(t.active <= 20);
  while (pending.length) { pending.shift()!.resolve(); await tick(); await tick(); }
  await Promise.all(calls);
  assert.equal(t.limit, 20);
});

test("the throttle cuts 30% on a 429 or 529, never below 4, and lets other errors through untouched", async () => {
  const { models, pending } = controllable();
  const seen: number[] = [];
  const t = throttled(models, { max: 64, onBusy: (l) => seen.push(l) });
  const run = () => t.structured({ system: "", user: "", schema: {} as never }).catch((e) => e);
  const a = run(), b = run(), c = run();
  await tick();
  pending.shift()!.reject(busy(429));
  assert.equal((await a).status, 429, "the error still reaches the case");
  assert.equal(t.limit, 11, "16 x 0.7 = 11.2");
  pending.shift()!.reject(new Error("bad schema"));
  await b;
  assert.equal(t.limit, 11, "an ordinary error does not change the limit");
  for (let i = 0; i < 10; i++) { const p = run(); await tick(); pending.at(-1)!.reject(busy(529)); await p; }
  assert.equal(t.limit, 4, "floor");
  pending.shift()!.resolve();
  await c;
  assert.deepEqual(seen.slice(0, 2), [11, 7]);
});

test("a call waiting for a slot leaves the queue when its case is cut off", async () => {
  const { models, pending } = controllable();
  const t = throttled(models, { max: 4, start: 1, floor: 1 });
  const first = t.structured({ system: "", user: "", schema: {} as never });
  const abort = new AbortController();
  const second = t.structured({ system: "", user: "", schema: {} as never, signal: abort.signal }).catch((e) => e);
  await tick();
  assert.equal(t.waiting, 1);
  abort.abort(new Error("case exceeded"));
  assert.match(String((await second).message), /case exceeded/);
  assert.equal(t.waiting, 0);
  pending.shift()!.resolve();
  await first;
  assert.equal(t.active, 0);
});

test("the progress line shows done/total, rate and ETA", () => {
  const line = progressLine(50, 200, 0, 60_000 * 2, "$1.20 spent");
  assert.match(line, /^-- 50\/200 done \(25%\), 25\/min, ETA 6 min \(\d\d:\d\d\), \$1\.20 spent$/);
  assert.match(progressLine(0, 10, 0, 1000), /ETA unknown/);
});

test("the cheap profile decides on Sonnet and reads on Haiku; the default is unchanged", () => {
  assert.deepEqual(chosenModels({}), DEFAULT_MODELS);
  assert.deepEqual(chosenModels({ REALITY_PROFILE: "cheap" }), CHEAP_MODELS);
  assert.deepEqual(chosenModels({ REALITY_PROFILE: "cheap", AGENT_MODEL: "claude-opus-5-5" }), { ...CHEAP_MODELS, strong: "claude-opus-5-5" });
  assert.throws(() => chosenModels({ REALITY_PROFILE: "free" }), /cheap/);
});

function runCli(args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const env: NodeJS.ProcessEnv = { ...process.env, ANTHROPIC_API_KEY: "sk-dummy-no-network", TYPESAFE_API_KEY: "", ELEVENLABS_API_KEY: "", REALITY_DEADLINE: "", REALITY_BUDGET_USD: "", REALITY_PROFILE: "" };
    delete env.ANTHROPIC_AUTH_TOKEN;
    const child = spawn(process.execPath, [path.join(import.meta.dirname, "cli.ts"), ...args], { env });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code: code ?? 1, out }));
  });
}

async function caseFolders(n: number) {
  const cases = await mkdtemp(path.join(tmpdir(), "cases-"));
  for (let i = 1; i <= n; i++) {
    await mkdir(path.join(cases, String(i)));
    await writeFile(path.join(cases, String(i), "email.txt"), `From: Tracking support\n\nParcel DL-${i} shows delivered; the recipient says it is not there.\n`);
  }
  return cases;
}

test("a batch started after its deadline writes four files per case, a run log and an index, and spends nothing", async () => {
  const cases = await caseFolders(3);
  const out = await mkdtemp(path.join(tmpdir(), "answers-"));
  const { code, out: log } = await runCli([cases, out, "--deadline", new Date(Date.now() - 60_000).toISOString(), "--concurrency", "2"]);
  assert.equal(code, 0, log);
  for (const name of ["1", "2", "3"]) {
    for (const file of OUTPUT_FILES) assert.ok((await readFile(path.join(out, name, file), "utf8")).length > 0, `${name}/${file}`);
    assert.match(await readFile(path.join(out, name, "ANSWER.md"), "utf8"), /Time ran out before this case could be analysed/);
  }
  const runlog = await readFile(path.join(out, "RUNLOG.md"), "utf8");
  assert.match(runlog, /Deadline reached: 3 case\(s\) were handed to a person without analysis/);
  assert.match(runlog, /\| 1 \| not analysed: deadline reached \| error \|/);
  assert.match(await readFile(path.join(out, "INDEX.md"), "utf8"), /3 cases/);
  assert.doesNotMatch(log, /retrying/, "no retry pass after the deadline");
  assert.match(log, /-- 3\/3 done/);
  const { spentUsd, errored } = await spentAndErrored(cases, out);
  assert.equal(spentUsd, 0);
  assert.deepEqual(errored, [], "cases handed over for time are not rerun");
});

test("a batch with no budget left hands every case to a person and notes the budget in the run log", async () => {
  const cases = await caseFolders(2);
  const out = await mkdtemp(path.join(tmpdir(), "answers-"));
  const { code, out: log } = await runCli([cases, out, "--budget-usd", "0", "--concurrency", "2"]);
  assert.equal(code, 0, log);
  for (const name of ["1", "2"]) {
    for (const file of OUTPUT_FILES) assert.ok((await readFile(path.join(out, name, file), "utf8")).length > 0, `${name}/${file}`);
    assert.match(await readFile(path.join(out, name, "ANSWER.md"), "utf8"), /spending limit was reached before this case could be analysed/);
  }
  const runlog = await readFile(path.join(out, "RUNLOG.md"), "utf8");
  assert.match(runlog, /Budget reached at \d\d:\d\d:\d\d: 2 case\(s\) were handed to a person/);
  assert.match(runlog, /not analysed: budget reached/);
});

test("folders a macOS zip leaves behind are not cases: no run, no answer, not counted as incomplete", async () => {
  const cases = await caseFolders(1);
  await mkdir(path.join(cases, "__MACOSX", "1"), { recursive: true });
  await writeFile(path.join(cases, "__MACOSX", "1", "._email.txt"), "resource fork");
  await mkdir(path.join(cases, ".hidden"));
  const out = await mkdtemp(path.join(tmpdir(), "answers-"));
  const { code, out: log } = await runCli([cases, out, "--budget-usd", "0"]);
  assert.equal(code, 0, log);
  assert.match(log, /^1 cases,/m);
  assert.deepEqual((await readdir(out, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name), ["1"]);
  assert.deepEqual(await incomplete(cases, out), []);
  assert.equal(isCaseFolder({ name: "__MACOSX", isDirectory: () => true }), false);
  assert.equal(isCaseFolder({ name: ".git", isDirectory: () => true }), false);
  assert.equal(isCaseFolder({ name: "12", isDirectory: () => true }), true);
  assert.equal(isCaseFolder({ name: "12", isDirectory: () => false }), false);
});

test("an unreadable subfolder is listed as unreadable and the rest of the case is still read", { skip: process.getuid?.() === 0 }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "case-"));
  await writeFile(path.join(dir, "email.txt"), "Parcel DL-9 is late.");
  await mkdir(path.join(dir, "locked"));
  await writeFile(path.join(dir, "locked", "note.txt"), "secret");
  await chmod(path.join(dir, "locked"), 0o000);
  try {
    const bundle = await loadFolder(dir);
    assert.deepEqual(bundle.documents.map((d) => d.name), ["email.txt"]);
    assert.deepEqual(bundle.unreadable, ["locked/ (folder could not be read: EACCES)"]);
  } finally {
    await chmod(path.join(dir, "locked"), 0o755);
  }
  // The case folder itself still has to be readable.
  await assert.rejects(loadFolder(path.join(dir, "missing")), /ENOENT/);
});
