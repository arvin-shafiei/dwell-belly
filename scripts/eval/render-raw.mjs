// Writes every adversarial case as a raw case folder, the way the Reality Test arrives, so the real loader
// (apps/api/src/agent/load.ts) and `npm run answer` can be tested on it. Answer keys never reach the folder.
// Usage: npm run render:adversarial            (macOS: PDFs via cupsfilter, PNGs via qlmanage + sips)
// Output: data/adversarial/raw/<id>/ and data/adversarial/index.json
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ADVERSARIAL_DIR, DATA } from "./cases.mjs";

const RAW_DIR = path.join(DATA, "adversarial", "raw");
const DESK = "Iona Quill, Rivet Delivery Desk";

const pad = (n) => String(n).padStart(3, "0");
const when = (ts) => ts.replace("T", " ").replace(/(\.\d+)?Z$/, " UTC");
const plainTitle = (c) => c.title.replace(/^Case:\s*/, "");

function eventBlock(e, { dash, stage, anchors }) {
  const lines = [];
  if (anchors) lines.push(`<a id="event-${pad(e.n)}"></a>`);
  lines.push(`## ${when(e.timestamp)} ${dash} event ${pad(e.n)}`, "");
  if (stage) lines.push(`- **Stage:** ${e.stage}`);
  lines.push(`- **Channel:** ${e.channel}`, `- **From:** ${e.from}`, `- **To:** ${e.to}`, "", e.body, "");
  return lines.join("\n");
}

function historyMd(c, events, opts) {
  const head = [`# Case ${c.id} history ${opts.dash} ${plainTitle(c)}`, ""];
  head.push(opts.anchors ? `All identities, records and communications are fictional. Total events: ${events.length}.` : "All identities, records and communications are fictional.", "");
  return head.join("\n") + "\n" + events.map((e) => eventBlock(e, opts)).join("\n");
}

function plainThread(events) {
  const date = (ts) => new Date(ts).toUTCString().replace("GMT", "+0000");
  return events.map((e) => [
    `From: ${e.from}`, `To: ${e.to}`, `Date: ${date(e.timestamp)}`, `Via: ${e.channel}`, "", e.body, "", "-----", "",
  ].join("\n")).join("\n");
}

function indexMd(c, { dash, historyFile, overview }) {
  const escalation = c.events.at(-1);
  const shipment = JSON.stringify(c.events).match(/\bDL-\d{3,5}\b/)?.[0];
  const lines = [
    `# Case ${c.id}: ${plainTitle(c)}`, "",
    "## Case details", "",
    `- **Source role:** ${escalation.from}`,
    `- **Status:** Escalated ${dash} awaiting the desk's decision`,
    `- **Created:** ${when(c.events[0].timestamp)}`,
    `- **Escalated:** ${when(escalation.timestamp)}`,
  ];
  if (shipment) lines.push(`- **Primary shipment:** ${shipment}`);
  lines.push(`- **Coordinator:** ${DESK}`, "- **Data:** Entirely synthetic; fictional geography; all times UTC", "");
  lines.push("## Context", "", c.context, "", "## Initial request", "", c.initial_request, "");
  if (overview) lines.push("## Overview", "", overview, "");
  if (historyFile) lines.push("## History", "", `[Read the complete dated history](${historyFile}).`, "");
  if (c.attachments?.length) {
    lines.push("## Attachments", "");
    for (const a of c.attachments) lines.push(`- [${a.name}](attachments/${a.name})`);
    lines.push("");
  }
  return lines.join("\n");
}

// Text to a real PDF or PNG, so the loader takes the same path as the Reality Test's binary attachments.
async function writeAttachment(dir, a, tmp) {
  const out = path.join(dir, a.name);
  if (a.missing) return;
  const ext = path.extname(a.name).toLowerCase();
  if (a.corrupt) {
    const head = ext === ".png" ? Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) : Buffer.from("%PDF-1.7\n");
    const junk = Buffer.from(Array.from({ length: 2048 }, (_, i) => (i * 37 + 11) % 256));
    await writeFile(out, Buffer.concat([head, junk]));
    return;
  }
  if (ext !== ".pdf" && ext !== ".png") {
    await writeFile(out, a.text);
    return;
  }
  const src = path.join(tmp, `${a.name}.txt`);
  const pdf = path.join(tmp, `${a.name}.pdf`);
  await writeFile(src, a.text);
  await writeFile(pdf, execFileSync("cupsfilter", ["-m", "application/pdf", src], { stdio: ["ignore", "pipe", "ignore"], maxBuffer: 50e6 }));
  if (ext === ".pdf") {
    await writeFile(out, await readFile(pdf));
    return;
  }
  execFileSync("qlmanage", ["-t", "-s", "1400", "-o", tmp, pdf], { stdio: "ignore" });
  const lines = a.text.split("\n").length;
  const height = String(Math.min(1400, 90 + lines * 26));
  // sips reads an offset of 0 0 as "centre the crop", so 1 1 keeps the top of the page.
  execFileSync("sips", ["-c", height, "1081", "--cropOffset", "1", "1", `${pdf}.png`, "--out", out], { stdio: "ignore" });
}

async function render(c, tmp) {
  const dir = path.join(RAW_DIR, c.id);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const format = c.format ?? "standard";
  const opts = {
    dash: format === "alt_dash" ? "-" : "—",
    stage: format !== "no_stage",
    anchors: format !== "no_anchors",
  };
  let events = c.events;
  let overview = null;
  if (format === "decision_point_mid") {
    events = [...c.events, ...c.post_decision_events];
    overview = `The escalation snapshot comprises history events 001${opts.dash === "-" ? "-" : "–"}${pad(c.events.length)}. Later events record what happened afterwards and must not be used as if already known at escalation.`;
  }
  if (format === "newest_first") events = [...events].reverse();

  if (format === "single_file") {
    const body = indexMd(c, { ...opts, historyFile: null, overview }) + "\n## History\n\n" + events.map((e) => eventBlock(e, opts)).join("\n");
    await writeFile(path.join(dir, "case.md"), body);
  } else if (format === "plain_thread") {
    await writeFile(path.join(dir, "index.md"), indexMd(c, { ...opts, historyFile: "thread.txt", overview }));
    await writeFile(path.join(dir, "thread.txt"), plainThread(events));
  } else {
    await writeFile(path.join(dir, "index.md"), indexMd(c, { ...opts, historyFile: "history.md", overview }));
    await writeFile(path.join(dir, "history.md"), historyMd(c, events, opts));
  }

  if (c.attachments?.length) {
    await mkdir(path.join(dir, "attachments"), { recursive: true });
    for (const a of c.attachments) await writeAttachment(path.join(dir, "attachments"), a, tmp);
  }
  return format;
}

async function main() {
  const names = (await readdir(ADVERSARIAL_DIR)).filter((n) => n.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const tmp = await mkdtemp(path.join(os.tmpdir(), "render-raw-"));
  const index = [];
  try {
    for (const name of names) {
      const c = JSON.parse(await readFile(path.join(ADVERSARIAL_DIR, name), "utf8"));
      const format = await render(c, tmp);
      index.push({
        id: c.id,
        mutation: c.mutation,
        title: c.title,
        events: c.events.length,
        dispositions: c.expected.acceptable_dispositions,
        format,
        attachments: (c.attachments ?? []).map((a) => a.name + (a.missing ? " (missing)" : a.corrupt ? " (corrupt)" : "")),
        file: `adversarial/delivery/${name}`,
        raw: `adversarial/raw/${c.id}`,
      });
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
  await writeFile(path.join(DATA, "adversarial", "index.json"), JSON.stringify(index, null, 2) + "\n");
  const count = (key) => index.reduce((acc, c) => {
    for (const v of [c[key]].flat()) acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`${index.length} cases rendered to ${path.relative(process.cwd(), RAW_DIR)}`);
  console.table(count("mutation"));
  console.table(count("format"));
}

await main();
