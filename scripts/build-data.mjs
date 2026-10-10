// Parses data/raw (DwellyOrg/HackatonPublicCases) into machine-readable JSON.
// Output: data/cases/<track>/<NNN>.json and data/index.json. No dependencies.
// Attachment text comes from sidecars next to each file (see data/README.md).
import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "data");
const RAW = path.join(ROOT, "raw");
const OUT = path.join(ROOT, "cases");

const TRACKS = {
  "Banking & Financial Services": "banking",
  "Delivery & Logistics": "delivery",
  "Insurance Claims Processing": "insurance",
  "Property Management": "property",
};

const exists = (p) => stat(p).then(() => true, () => false);
const readIf = async (p) => ((await exists(p)) ? (await readFile(p, "utf8")).trim() : null);

// "## Heading\n body" -> { heading: body }
function sections(md) {
  const out = {};
  const parts = md.split(/^## /m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    out[part.slice(0, nl).trim()] = part.slice(nl + 1).trim();
  }
  return out;
}

// "- **Key:** value" lines -> { key: value }
function bulletFields(text) {
  const out = {};
  for (const m of text.matchAll(/^- \*\*([^*]+?):\*\*\s*(.*)$/gm)) {
    out[m[1].trim().toLowerCase().replace(/\s+/g, "_")] = m[2].trim();
  }
  return out;
}

function parseIndex(md) {
  const title = md.match(/^# (.*)$/m)?.[1].trim() ?? "";
  const s = sections(md);
  const snap = s.Overview?.match(/snapshot comprises history events (\d+)\s*[–-]\s*(\d+)/);
  const nextAction = s["Next action at escalation"];
  const recordedEvent = nextAction?.match(/history\.md#event-(\d+)/)?.[1];
  return {
    title,
    details: bulletFields(s["Case details"] ?? ""),
    context: s.Context ?? null,
    initial_request: s["Initial request"] ?? null,
    overview: s.Overview ?? null,
    escalation_snapshot: snap ? { first_event: +snap[1], last_event: +snap[2] } : null,
    next_action: nextAction
      ? {
          summary: nextAction.split(/\n\s*\n/)[0].trim(),
          ...bulletFields(nextAction),
          recorded_event: recordedEvent ? +recordedEvent : null,
        }
      : null,
    outcome: s.Outcome ?? null,
    boundaries: s["Boundaries and remaining work"] ?? null,
  };
}

function parseHistory(md) {
  const events = [];
  const blocks = md.split(/^<a id="event-\d+"><\/a>\s*$/m).slice(1);
  for (const block of blocks) {
    const head = block.match(/^## (.+?) — event (\d+)\s*$/m);
    if (!head) continue;
    const afterHead = block.slice(block.indexOf(head[0]) + head[0].length);
    const fieldLines = afterHead.match(/^(\s*- \*\*[^\n]+\n)+/)?.[0] ?? "";
    const fields = bulletFields(fieldLines);
    events.push({
      n: +head[2],
      timestamp: head[1].replace(" UTC", "Z").replace(" ", "T"),
      stage: fields.stage ?? null,
      channel: fields.channel ?? null,
      from: fields.from ?? null,
      to: fields.to ?? null,
      body: afterHead.slice(fieldLines.length).trim(),
    });
  }
  return events;
}

async function attachments(caseDir) {
  const dir = path.join(caseDir, "attachments");
  if (!(await exists(dir))) return [];
  const isSidecar = (f) => /\.(pdf\.txt|png\.ocr\.txt|png\.desc\.md)$/.test(f);
  const files = (await readdir(dir)).filter((f) => !isSidecar(f));
  const out = [];
  for (const f of files.sort()) {
    const p = path.join(dir, f);
    const ext = path.extname(f).slice(1).toLowerCase();
    let text = null;
    let text_source = null;
    if (ext === "csv" || ext === "txt") {
      text = await readIf(p);
      text_source = "original";
    } else if (ext === "pdf") {
      text = await readIf(`${p}.txt`);
      text_source = "pdftotext";
    } else if (ext === "png") {
      const ocr = await readIf(`${p}.ocr.txt`);
      const desc = await readIf(`${p}.desc.md`);
      text = [desc, ocr && `OCR text:\n${ocr}`].filter(Boolean).join("\n\n");
      text_source = desc ? "description+ocr" : "ocr";
    }
    out.push({ name: f, type: ext, path: path.relative(ROOT, p), text, text_source });
  }
  return out;
}

const index = [];
for (const [trackName, track] of Object.entries(TRACKS)) {
  const trackDir = path.join(RAW, trackName);
  await mkdir(path.join(OUT, track), { recursive: true });
  for (const num of (await readdir(trackDir)).filter((d) => /^\d+$/.test(d)).sort()) {
    const caseDir = path.join(trackDir, num);
    const idx = parseIndex(await readFile(path.join(caseDir, "index.md"), "utf8"));
    const events = parseHistory(await readFile(path.join(caseDir, "history.md"), "utf8"));
    const atts = await attachments(caseDir);
    const id = `${track}-${num}`;
    const record = { id, track, track_name: trackName, number: num, ...idx, events, attachments: atts };
    await writeFile(path.join(OUT, track, `${num}.json`), JSON.stringify(record, null, 2) + "\n");
    index.push({
      id,
      track,
      number: num,
      title: idx.title,
      status: idx.details.status ?? null,
      events: events.length,
      attachments: atts.map((a) => a.name),
      escalation_snapshot: idx.escalation_snapshot,
      file: `cases/${track}/${num}.json`,
    });
  }
}
await writeFile(path.join(ROOT, "index.json"), JSON.stringify(index, null, 2) + "\n");
console.log(`wrote ${index.length} cases`);
