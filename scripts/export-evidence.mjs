// Writes eval/results.md from the console database (runs/console.db): the latest scored run per case,
// summarised per case set in the same layout as scripts/eval/report.mjs. Read-only on the database.
// Usage: node scripts/export-evidence.mjs [--db runs/console.db] [--out eval/results.md] [--stdout]
// Same builder as GET /api/console/export/evidence-pack (apps/web/src/console/export/report.ts).
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

// The builder lives in the web app as plain TypeScript (Node strips the types). apps/web has no
// "type": "module", so Node warns once while loading it as ESM; that warning is noise here.
const emitWarning = process.emitWarning;
process.emitWarning = (warning, ...rest) => {
  if (rest.some((r) => r === "MODULE_TYPELESS_PACKAGE_JSON" || r?.code === "MODULE_TYPELESS_PACKAGE_JSON")) return;
  return emitWarning.call(process, warning, ...rest);
};
const { buildEvidencePack } = await import("../apps/web/src/console/export/report.ts");
const { loadPackInput } = await import("../apps/web/src/console/export/reportData.ts");
process.emitWarning = emitWarning;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const dbFile = path.resolve(root, opt("--db") ?? process.env.CONSOLE_DB_PATH ?? "runs/console.db");
const outFile = path.resolve(root, opt("--out") ?? "eval/results.md");
if (!existsSync(dbFile)) {
  console.error(`No console database at ${dbFile}. Run some cases in the console first.`);
  process.exit(1);
}

const db = new DatabaseSync(dbFile, { readOnly: true });
let input;
try {
  input = loadPackInput(db, path.relative(root, dbFile) || dbFile);
} finally {
  db.close();
}
const md = buildEvidencePack(input);

if (args.includes("--stdout")) {
  process.stdout.write(md);
} else {
  await writeFile(outFile, md);
  const passed = input.cases.filter((c) => c.pass).length;
  console.error(`Wrote ${path.relative(root, outFile)}: ${input.cases.length} scored cases (${passed} passing), ${input.testRuns.length} practice runs, from ${path.relative(root, dbFile)}.`);
}
