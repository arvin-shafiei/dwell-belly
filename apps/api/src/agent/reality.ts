// The whole Reality Test run as one command, so nothing is done by hand under time pressure:
// answer every case, rerun any that are incomplete or ended in a system failure, confirm the answer
// files match their saved results, and write the index. It never commits or pushes; it prints what
// is left to do.
// Usage: npm run reality -- <casesDir> [outDir=ANSWERS] [--concurrency 24] [--deadline HH:MM]
//   [--budget-usd 18] [--profile cheap]   (or REALITY_DEADLINE, REALITY_BUDGET_USD, REALITY_PROFILE)
import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { incomplete, spentAndErrored, writeIndex } from "./answers-index.ts";
import { parseBudget, parseDeadline } from "./batch.ts";
import { replay } from "./replay.ts";

const CLI = path.join(import.meta.dirname, "cli.ts");
const DEFAULT_BUDGET_USD = 18;
// The rerun is skipped this close to the deadline: it could not finish, and the first pass already
// handed every case it could not reach to a person.
const RERUN_CUTOFF_MS = 120_000;

function answer(casesDir: string, outDir: string, flags: string[], resume: boolean): Promise<number> {
  const args = [CLI, casesDir, outDir, "--mode", "reality", ...flags, ...(resume ? ["--resume"] : [])];
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { stdio: "inherit", env: process.env });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      concurrency: { type: "string", default: "24" },
      deadline: { type: "string" },
      "budget-usd": { type: "string" },
      profile: { type: "string" },
    },
  });
  const [casesDir, outDir = "ANSWERS"] = positionals;
  if (!casesDir) throw new Error("Usage: npm run reality -- <casesDir> [outDir] [--concurrency 24] [--deadline HH:MM] [--budget-usd 18] [--profile cheap]");
  const started = Date.now();
  const deadlineText = values.deadline ?? process.env.REALITY_DEADLINE;
  const deadline = parseDeadline(deadlineText);
  const budget = parseBudget(values["budget-usd"] ?? process.env.REALITY_BUDGET_USD, DEFAULT_BUDGET_USD);
  const profile = values.profile ?? process.env.REALITY_PROFILE;
  const common = ["--concurrency", values.concurrency, ...(deadlineText ? ["--deadline", deadlineText] : []), ...(profile ? ["--profile", profile] : [])];
  const withBudget = (usd: number) => ["--budget-usd", Number.isFinite(usd) ? usd.toFixed(2) : "none"];

  let code = await answer(casesDir, outDir, [...common, ...withBudget(budget)], false);
  let gaps = await incomplete(casesDir, outDir);
  // Cases that ended in a system failure (a rate-limit storm, a timeout) are worth one more try
  // while there is time and money left. Cases handed over for time or budget are left alone.
  const { spentUsd, errored } = await spentAndErrored(casesDir, outDir);
  const left = budget - spentUsd;
  const timeLeft = Date.now() < deadline - RERUN_CUTOFF_MS;
  if ((code !== 0 || gaps.length || errored.length) && timeLeft && left > 0.25) {
    console.log(`\n${gaps.length} case(s) incomplete and ${errored.length} ended in a system failure after the first pass. Rerunning only those, with $${Number.isFinite(left) ? left.toFixed(2) : "unlimited"} left.`);
    code = await answer(casesDir, outDir, [...common, ...withBudget(left)], true);
    gaps = await incomplete(casesDir, outDir);
  } else if (gaps.length || errored.length) {
    console.log(`\n${gaps.length} case(s) incomplete and ${errored.length} ended in a system failure. Not rerun: ${!timeLeft ? "too close to the deadline" : "the budget is spent"}.`);
  }

  const checked = await replay(outDir, false);
  const index = await writeIndex(outDir);

  // The placeholder that held this folder's place must not ship beside real results.
  const placeholder = path.join(outDir, "README.md");
  if ((await readFile(placeholder, "utf8").catch(() => "")).startsWith("# [MISSING]")) await rm(placeholder);

  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(`\n==== Reality run finished in ${Math.floor(seconds / 60)} min ${seconds % 60} s ====`);
  console.log(`Cases indexed: ${index.cases}. ${Object.entries(index.counts).map(([k, n]) => `${k}: ${n}`).join(", ")}`);
  console.log(`Answer files matching their saved result: ${checked.same.length}. Different: ${checked.different.length}. No saved result: ${checked.unreadable.length}.`);
  if (gaps.length) {
    console.log(`STILL INCOMPLETE (${gaps.length}): ${gaps.map((g) => `${g.name} lacks ${g.missing.join(", ")}`).join("; ")}`);
    console.log("Each of these still has a failure ANSWER.md if the runner reached it. Check the key and credit, then run this command again: it only reruns failed cases.");
  }
  if (checked.different.length) console.log(`Answer files that do not match their saved result: ${checked.different.join(", ")}. Run npm run replay -- ${outDir} --write to regenerate them.`);
  console.log(`\nNext, by hand:\n  git add ${outDir}\n  git commit -m "Reality Test results"\n  git push\nThen put that commit's hash in SUBMISSION.md.`);
  process.exitCode = gaps.length || checked.different.length ? 1 : 0;
}

await main();
