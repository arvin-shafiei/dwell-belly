// Re-renders ANSWER.md and REASONING.md from each case's saved result.json, with no model call
// and no key. It shows that the answer files are a pure function of the recorded run.
// Usage: npm run replay -- [outDir=ANSWERS] [--write]   (without --write it only reports differences)
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { renderAnswer, renderReasoning } from "./report.ts";
import type { RunResult } from "./run.ts";

export interface ReplayReport { same: string[]; different: string[]; unreadable: string[] }

export async function replay(outDir: string, write: boolean): Promise<ReplayReport> {
  const report: ReplayReport = { same: [], different: [], unreadable: [] };
  const names = (await readdir(outDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  for (const name of names) {
    const dir = path.join(outDir, name);
    try {
      const result = JSON.parse(await readFile(path.join(dir, "result.json"), "utf8")) as RunResult;
      const rendered = { "ANSWER.md": renderAnswer(result), "REASONING.md": renderReasoning(result) };
      let same = true;
      for (const [file, text] of Object.entries(rendered)) {
        const onDisk = await readFile(path.join(dir, file), "utf8").catch(() => null);
        if (onDisk !== text) same = false;
        if (write) await writeFile(path.join(dir, file), text);
      }
      (same ? report.same : report.different).push(name);
    } catch {
      report.unreadable.push(name);
    }
  }
  return report;
}

// Only when run as a script; the tests import replay() directly.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { write: { type: "boolean", default: false } } });
  const outDir = positionals[0] ?? "ANSWERS";
  const r = await replay(outDir, values.write);
  console.log(`${r.same.length} identical to what is on disk, ${r.different.length} different, ${r.unreadable.length} without a readable result.json`);
  if (r.different.length) console.log(`Different: ${r.different.join(", ")}`);
  if (r.unreadable.length) console.log(`No result.json: ${r.unreadable.join(", ")}`);
  process.exitCode = r.different.length ? 1 : 0;
}
