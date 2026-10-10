// The whole Reality Test run as one command, so nothing is done by hand under time pressure:
// answer every case, rerun any that are incomplete, confirm the answer files match their saved
// results, and write the index. It never commits or pushes; it prints what is left to do.
// Usage: npm run reality -- <casesDir> [outDir=ANSWERS] [--concurrency 8]
import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { incomplete, writeIndex } from "./answers-index.ts";
import { replay } from "./replay.ts";

const CLI = path.join(import.meta.dirname, "cli.ts");

function answer(casesDir: string, outDir: string, concurrency: string, resume: boolean): Promise<number> {
  const args = [CLI, casesDir, outDir, "--mode", "reality", "--concurrency", concurrency, ...(resume ? ["--resume"] : [])];
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { stdio: "inherit", env: process.env });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { concurrency: { type: "string", default: "8" } } });
  const [casesDir, outDir = "ANSWERS"] = positionals;
  if (!casesDir) throw new Error("Usage: npm run reality -- <casesDir> [outDir] [--concurrency 8]");
  const started = Date.now();

  let code = await answer(casesDir, outDir, values.concurrency, false);
  let gaps = await incomplete(casesDir, outDir);
  if (code !== 0 || gaps.length) {
    console.log(`\n${gaps.length} case(s) incomplete after the first pass. Rerunning only those.`);
    code = await answer(casesDir, outDir, values.concurrency, true);
    gaps = await incomplete(casesDir, outDir);
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
