// Batch runner. Every subfolder of <casesDir> is one case; each gets ANSWER.md, REASONING.md and
// trace.json under <outDir>/<case>/. One bad case never stops the batch.
// Usage: npm run answer -- <casesDir> [outDir=ANSWERS] [--mode reality|practice] [--concurrency 8] [--resume]
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import type { Flow } from "../lib/flow.ts";
import { runPanel } from "../lib/panel.ts";
import { loadFolder } from "./load.ts";
import { claude } from "./models.ts";
import { renderAnswer, renderReasoning } from "./report.ts";
import { runCase } from "./run.ts";

const FLOW_FILE = path.resolve(import.meta.dirname, "..", "..", "flows", "default-incident.json");
const RETRY_PAUSE_MS = 20_000;
const RETRY_CONCURRENCY = 2;

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
      concurrency: { type: "string", default: "8" },
      resume: { type: "boolean", default: false },
    },
  });
  const [casesDir, outDir = "ANSWERS"] = positionals;
  if (!casesDir) throw new Error("Usage: npm run answer -- <casesDir> [outDir] [--mode reality|practice] [--concurrency 8] [--resume]");
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new Error("No ANTHROPIC_API_KEY. Put it in apps/api/.env.local; without it every case would only get a failure answer.");
  }

  const flow: Flow = JSON.parse(await readFile(FLOW_FILE, "utf8"));
  const models = claude();
  const panel = process.env.TYPESAFE_API_KEY ? runPanel : undefined;
  const runId = `${new Date().toISOString()}-${values.mode}`;
  const mode = values.mode === "practice" ? "practice" : "reality";

  const names = (await readdir(casesDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  if (names.length === 0) throw new Error(`No case folders found in ${casesDir}`);
  await mkdir(outDir, { recursive: true });
  console.log(`${names.length} cases, ${values.concurrency} at a time, mode ${mode}, Jev panel ${panel ? "on" : "off (no key)"}`);

  const lines = new Map<string, string>();
  const failed = new Set<string>();

  // Never throws: whatever happens, the case ends with a line in the log and an ANSWER.md on disk.
  async function answer(name: string, attempt: number): Promise<void> {
    const dir = path.join(outDir, name);
    const started = Date.now();
    const note = attempt > 1 ? ` (attempt ${attempt})` : "";
    try {
      if (values.resume && attempt === 1) {
        // A trace cut off by a killed run must read as "not done", never crash the resume.
        const prior = await readFile(path.join(dir, "trace.json"), "utf8").then(JSON.parse).catch(() => null);
        const ended = Array.isArray(prior?.events) ? prior.events.findLast((e: { kind?: string } | null) => e?.kind === "run_end") : undefined;
        if (ended && ended.outcome !== "error") { lines.set(name, `| ${name} | kept from an earlier run | ${ended.outcome} | | |`); return; }
      }
      const result = await runCase(await loadFolder(path.join(casesDir, name)), { flow, models, panel, mode, runId });
      // Render everything first, so the three files describe one and the same state.
      const files = { "ANSWER.md": renderAnswer(result), "REASONING.md": renderReasoning(result), "trace.json": JSON.stringify(result.trace, null, 1) };
      await mkdir(dir, { recursive: true });
      for (const [file, text] of Object.entries(files)) await writeFile(path.join(dir, file), text);
      const end = result.trace.events.findLast((e) => e.kind === "run_end");
      const cost = end?.kind === "run_end" ? end.totalCostUsd : 0;
      if (result.outcome === "error") failed.add(name); else failed.delete(name);
      const status = result.error ? `failed at ${result.failedAt}: ${result.error.replace(/\|/g, "/").slice(0, 200)}` : "ok";
      lines.set(name, `| ${name} | ${status}${note} | ${result.outcome} | ${((Date.now() - started) / 1000).toFixed(1)} s | $${cost.toFixed(3)} |`);
    } catch (err) {
      // runCase does not throw, so this is the loader or the disk. Still leave an answer behind.
      const message = err instanceof Error ? err.message : String(err);
      failed.add(name);
      await mkdir(dir, { recursive: true }).catch(() => {});
      await writeFile(path.join(dir, "ANSWER.md"),
        `# ${name}\n\n**Decision:** SYSTEM FAILURE: HANDED TO A HUMAN\n\nThe case could not be loaded or its answer could not be written (${message}). No action was taken. A person needs to handle this case from the original files.\n`).catch(() => {});
      await writeFile(path.join(dir, "REASONING.md"), `# Reasoning: ${name}\n\nThe run failed before any analysis: ${message}\n`).catch(() => {});
      lines.set(name, `| ${name} | failed outside the flow: ${message.replace(/\|/g, "/").slice(0, 200)}${note} | error | | |`);
    }
    console.log(lines.get(name));
  }

  await pool(names, Number(values.concurrency) || 1, (name) => answer(name, 1));

  // Rate limits and overloads fail many cases at once. One slower second pass recovers them
  // without anyone touching the outputs.
  if (failed.size) {
    console.log(`${failed.size} failed. Waiting ${RETRY_PAUSE_MS / 1000}s, then retrying them ${RETRY_CONCURRENCY} at a time.`);
    await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
    await pool([...failed], RETRY_CONCURRENCY, (name) => answer(name, 2));
  }

  const table = names.map((n) => lines.get(n) ?? `| ${n} | not run | error | | |`).join("\n");
  await writeFile(path.join(outDir, "RUNLOG.md"),
    `# Run log\n\nRun ${runId}. Generated by \`npm run answer\`; not edited by hand.\n\n| Case | Result | Outcome | Time | Cost |\n|---|---|---|---|---|\n${table}\n`);
  console.log(`Done. ${names.length - failed.size} answered, ${failed.size} failed (each still has an ANSWER.md). Log: ${path.join(outDir, "RUNLOG.md")}`);
}

await main();
// In-flight requests from a timed-out case must not keep the process alive after the log is written.
process.exit(0);
