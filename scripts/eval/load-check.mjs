// Loader robustness check, no API key and no model calls. Runs every raw case folder through the same
// loading steps the Reality runner takes before the first model call (apps/api/src/agent/cli.ts:
// folder discovery, loadFolder, findTools; then caseNow and bundleText from runCase) and reports any
// that throw. For bulk folders it also checks the escalation message actually reached the bundle, so a
// layout the loader silently skips shows up too. A set of deliberately broken folders (--probe) checks
// the edges no case set has: empty folders, unreadable files, symlink loops, binary text, odd names.
// Usage: node scripts/eval/load-check.mjs [dir ...] [--probe] [--quiet]
//   no dirs: data/raw/Delivery & Logistics, data/adversarial/raw, data/bulk/raw (whichever exist)
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { loadFolder, bundleText } from "../../apps/api/src/agent/load.ts";
import { findTools } from "../../apps/api/src/agent/tools.ts";
import { caseNow } from "../../apps/api/src/agent/clock.ts";
import { DATA } from "./cases.mjs";

const { values, positionals } = parseArgs({ allowPositionals: true, options: { probe: { type: "boolean", default: false }, quiet: { type: "boolean", default: false } } });
const DEFAULT_DIRS = [path.join(DATA, "raw", "Delivery & Logistics"), path.join(DATA, "adversarial", "raw"), path.join(DATA, "bulk", "raw")];

const exists = async (d) => readdir(d).then(() => true, () => false);
const norm = (s) => s.replace(/\r\n/g, "\n").replace(/^﻿/, "").replace(/\s+/g, " ").trim();

// The answer key for a bulk folder, to confirm the loader read the escalation. Null for other sets.
async function bulkCase(dir, name) {
  if (!dir.endsWith(path.join("bulk", "raw"))) return null;
  return JSON.parse(await readFile(path.join(DATA, "bulk", "delivery", `bulk-${name}.json`), "utf8").catch(() => "null"));
}

async function checkFolder(casesDir, name) {
  const dir = path.join(casesDir, name);
  const issues = [];
  const bundle = await loadFolder(dir, {});
  await findTools(dir);
  const text = bundleText(bundle);
  const now = caseNow(bundle);
  if (!bundle.documents.length) issues.push("no readable documents");
  if (!now) issues.push("caseNow found no time");
  const c = await bulkCase(casesDir, name);
  if (c) {
    const esc = norm(c.events.at(-1).body).slice(0, 80);
    if (!norm(text).includes(esc)) issues.push("escalation message not in the bundle");
    for (const a of c.attachments ?? []) {
      const got = bundle.documents.some((d) => d.name.endsWith(a.name));
      if (a.missing && got) issues.push(`missing attachment ${a.name} was loaded`);
      if (!a.missing && !got) issues.push(`attachment ${a.name} not loaded`);
    }
  }
  return { bundle, issues };
}

async function checkSet(casesDir) {
  // Same discovery as cli.ts: every subdirectory is a case.
  const names = (await readdir(casesDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const threw = [];
  const warned = [];
  const unreadable = {};
  let docs = 0;
  const started = Date.now();
  for (const name of names) {
    try {
      const { bundle, issues } = await checkFolder(casesDir, name);
      docs += bundle.documents.length;
      for (const u of bundle.unreadable) {
        const kind = u.replace(/^.*\(/, "(").replace(/\d+/g, "N");
        unreadable[kind] = (unreadable[kind] ?? 0) + 1;
      }
      if (issues.length) warned.push(`${name}: ${issues.join("; ")}`);
    } catch (err) {
      threw.push(`${name}: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`);
    }
  }
  console.log(`\n${path.relative(process.cwd(), casesDir) || casesDir}: ${names.length} folders, ${threw.length} threw, ${warned.length} with warnings, ${docs} documents, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  for (const t of threw) console.log(`  THREW ${t}`);
  for (const w of values.quiet ? warned.slice(0, 10) : warned) console.log(`  warn  ${w}`);
  if (values.quiet && warned.length > 10) console.log(`  ... ${warned.length - 10} more warnings`);
  const kinds = Object.entries(unreadable).sort((a, b) => b[1] - a[1]);
  if (kinds.length) console.log(`  listed as unreadable (by kind): ${kinds.map(([k, n]) => `${k} x${n}`).join(", ")}`);
  return threw.length;
}

// Deliberately broken folders that no case set contains.
async function probeDir() {
  const root = await mkdtemp(path.join(os.tmpdir(), "load-check-"));
  const make = async (name, files) => {
    const d = path.join(root, name);
    await mkdir(d, { recursive: true });
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(d, rel)), { recursive: true });
      await writeFile(path.join(d, rel), content);
    }
    return d;
  };
  await make("01-empty", {});
  await make("02-only-binary", { "scan.bin": Buffer.from([0, 1, 2, 3, 0, 255]) });
  await make("03-text-with-nul", { "index.md": "# Case 3\n\nhello\u0000world" });
  await make("04-invalid-utf8", { "index.md": Buffer.from([0x23, 0x20, 0xc3, 0x28, 0xa0, 0xa1, 0x0a]) });
  const unreadable = await make("05-unreadable-file", { "index.md": "# Case 5\n", "history.md": "secret" });
  await chmod(path.join(unreadable, "history.md"), 0o000);
  const lockedDir = await make("06-unreadable-subdir", { "index.md": "# Case 6\n", "attachments/a.txt": "x" });
  await chmod(path.join(lockedDir, "attachments"), 0o000);
  const loop = await make("07-symlink-loop", { "index.md": "# Case 7\n" });
  await symlink(loop, path.join(loop, "loop")).catch(() => {});
  const broken = await make("08-broken-symlink", { "index.md": "# Case 8\n" });
  await symlink(path.join(root, "nowhere.md"), path.join(broken, "history.md")).catch(() => {});
  await make("09-dir-named-like-file", { "history.md/inner.txt": "event text", "index.md": "# Case 9\n" });
  await make("10-unicode-names", { "índex — caso.md": "# Case 10\n2026-03-01 10:00 UTC", "attachments/фото.txt": "photo" });
  let deep = "11-deep";
  for (let i = 0; i < 40; i++) deep += "/d";
  await make(deep, { "index.md": "# Case 11\n" });
  await make("12-huge-text", { "history.md": "x".repeat(1_200_000) });
  await make("13-zero-byte-pdf", { "a.pdf": Buffer.alloc(0), "index.md": "# Case 13\n" });
  await make("14-bad-tools-json", { "tools.json": "{ not json", "index.md": "# Case 14\n" });
  await make("15-uppercase-ext", { "INDEX.MD": "# Case 15\n", "SCAN.PDF": Buffer.from("%PDF-1.4 junk"), "NOTE.TXT": "hello" });
  // A zip unpacked on macOS leaves this beside the case folders; cli.ts treats every subfolder as a case.
  await make("__MACOSX", { "16/._index.md": "junk" });
  return root;
}

async function main() {
  const dirs = positionals.length ? positionals : (await Promise.all(DEFAULT_DIRS.map(async (d) => ((await exists(d)) ? d : null)))).filter(Boolean);
  let threw = 0;
  for (const d of dirs) threw += await checkSet(d);
  let probeThrew = 0;
  if (values.probe) {
    const root = await probeDir();
    try {
      probeThrew = await checkSet(root);
    } finally {
      // Restore permissions so the temp folder can be removed.
      await chmod(path.join(root, "05-unreadable-file", "history.md"), 0o644).catch(() => {});
      await chmod(path.join(root, "06-unreadable-subdir", "attachments"), 0o755).catch(() => {});
      await rm(root, { recursive: true, force: true }).catch(() => {});
    }
  }
  console.log(`\n${threw ? `FAIL: ${threw} case folder(s) made the loader throw` : "OK: no case folder made the loader throw"}`);
  // The runner catches a loader throw (cli.ts writes a failure ANSWER.md), so a probe throw is a lost case, not a crash.
  if (values.probe) console.log(probeThrew ? `PROBES: ${probeThrew} broken folder(s) made the loader throw (the case would be answered as a system failure)` : "PROBES: none threw");
  process.exitCode = threw ? 1 : 0;
}

await main();
