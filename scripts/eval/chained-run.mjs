// Four real model runs on one accumulated history, not four independent snapshots.
// Calibration keys are used only by the grader after execution; messages remain sandboxed.
// Usage: node scripts/eval/chained-run.mjs [output.json]
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { runCase } from "../../apps/api/src/agent/run.ts";
import { fromView } from "../../apps/api/src/agent/load.ts";
import { claude, chosenModels } from "../../apps/api/src/agent/models.ts";
import { buildRerun } from "../../apps/web/src/console/server/rerun.ts";
import { traceToResult } from "./agents.mjs";
import { judge, scoreCase } from "./score.mjs";
import { spend } from "./claude.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const ids = ["gen-3401", "gen-3402", "gen-3403", "gen-3404"];
const read = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
const flow = await read("apps/api/flows/default-incident.json");
const output = path.resolve(process.argv[2] ?? path.join(root, "runs", `chain-${new Date().toISOString().replaceAll(":", "-")}.json`));
const executionFiles = ["apps/api/src/agent/run.ts", "apps/api/src/agent/prompts.ts", "apps/api/src/agent/types.ts", "apps/api/src/agent/models.ts", "apps/api/src/agent/gate.ts", "apps/api/src/agent/decision-patterns.ts", "apps/api/src/agent/decision-patterns.json", "apps/api/flows/default-incident.json", "apps/web/src/console/server/rerun.ts", "scripts/eval/chained-run.mjs", "scripts/eval/agents.mjs", "scripts/eval/score.mjs", ...ids.map((id) => `data/generated/delivery/${id}.json`)];
const hashes = Object.fromEntries(await Promise.all(executionFiles.map(async (file) => [file, createHash("sha256").update(await readFile(path.join(root, file))).digest("hex")])));
const report = { startedAt: new Date().toISOString(), scenario: "crash → customer change → receiving access → goods release → booking request", models: chosenModels(), jev_enabled: false, warning: "Actual sandbox executions on authored calibration cases with unreviewed synthetic keys and a model grader. No real booking or delivery, persistent automatic scheduler, or unseen generalisation established.", sourceHashes: hashes, steps: [], graderSpend: null };
let view;
let previousOutbox = [];
let previousSourceN = 0;
for (const id of ids) {
  const source = await read(`data/generated/delivery/${id}.json`);
  // Prior desk messages in the authored snapshots are illustrative; replay only the
  // messages actually recorded by the preceding agent run, plus new incoming evidence.
  const incoming = source.events.filter((e) => e.n > previousSourceN && e.from !== "Iona Quill, Rivet Delivery Desk");
  view = view ? buildRerun({ view, previousOutbox, newEvents: incoming, elapsedMs: 0 }).view
    : { id: "chained-DL-8400", title: source.title, context: source.context, initial_request: source.initial_request, events: incoming, attachments: [] };
  previousSourceN = Math.max(...source.events.map((e) => e.n));
  const run = await runCase(fromView(view), { flow, models: claude(), mode: "practice", runId: `chain-${id}-${Date.now()}` });
  const result = { ...traceToResult(run.trace), messages: run.outbox.filter((o) => o.status === "recorded").map((o) => ({ recipient: o.action.recipient, channel: o.action.channel, message: o.action.message })) };
  const step = { id, input: view, expected: source.expected, understanding: run.understanding, decision: run.decision, outbox: run.outbox, trace: run.trace, result, verdict: null, error: run.error ?? null };
  report.steps.push(step);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  if (run.outcome === "error") { process.exitCode = 1; break; }
  const judgement = await judge(view, source.expected, result);
  step.verdict = { ...scoreCase(source.expected, result, judgement), judgement };
  report.graderSpend = { ...spend };
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(`${id}: ${run.outcome}, score ${step.verdict.score}, ${run.outbox.length} sandbox messages, ${view.events.length} accumulated events`);
  if (!step.verdict.pass) process.exitCode = 1;
  previousOutbox = run.outbox;
}
console.log(`Actual chain evidence: ${output}`);
