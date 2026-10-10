// Turns a case into a CaseBundle. Accepts any folder: it never requires a particular file name or
// heading, because the Reality Test format is not known in advance. Text is read as text, PDFs and
// images are passed to the model as they are, and anything unreadable is listed, not dropped silently.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { CaseBundle } from "./types.ts";

const TEXT = new Set([".md", ".txt", ".csv", ".json", ".eml", ".html", ".log", ".yaml", ".yml", ".tsv", ""]);
const MEDIA: Record<string, string> = {
  ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp",
};
const MAX_TEXT_CHARS = 400_000;
const MAX_CASE_CHARS = 600_000;
const MAX_PDF_BYTES = 8_000_000;
// Base64 adds a third; this keeps one image under the API's 5 MB limit and a request under 32 MB.
const MAX_IMAGE_BYTES = 3_700_000;
const MAX_MEDIA_TOTAL_BYTES = 20_000_000;

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out.sort();
}

export async function loadFolder(dir: string): Promise<CaseBundle> {
  const bundle: CaseBundle = { id: path.basename(dir), title: path.basename(dir), documents: [], media: [], unreadable: [] };
  const files = await walk(dir);
  let textBudget = MAX_CASE_CHARS;
  let mediaBytes = 0;
  for (const file of files) {
    const name = path.relative(dir, file);
    const ext = path.extname(file).toLowerCase();
    try {
      if (MEDIA[ext]) {
        const size = (await stat(file)).size;
        if (size === 0) bundle.unreadable.push(`${name} (empty file)`);
        else if (size > (ext === ".pdf" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES)) bundle.unreadable.push(`${name} (too large: ${size} bytes)`);
        else if (mediaBytes + size > MAX_MEDIA_TOTAL_BYTES) bundle.unreadable.push(`${name} (left out: attachments exceed the size the model accepts in one request)`);
        else {
          mediaBytes += size;
          bundle.media.push({ name, mediaType: MEDIA[ext], base64: (await readFile(file)).toString("base64") });
        }
      } else if (TEXT.has(ext)) {
        // A text sidecar next to a PDF or image repeats what the model reads from the original,
        // so it is skipped, but only when the original was actually taken (files arrive sorted).
        const original = name.replace(/\.(txt|ocr\.txt|desc\.md)$/i, "");
        if (original !== name && bundle.media.some((m) => m.name === original)) continue;
        const text = await readFile(file, "utf8");
        if (text.includes("\u0000")) { bundle.unreadable.push(`${name} (binary file)`); continue; }
        const take = Math.min(text.length, MAX_TEXT_CHARS, textBudget);
        textBudget -= take;
        if (take > 0) bundle.documents.push({ name, text: text.slice(0, take) });
        if (take < text.length) bundle.unreadable.push(`${name} (read the first ${take} of ${text.length} characters)`);
      } else {
        bundle.unreadable.push(`${name} (unsupported file type)`);
      }
    } catch (err) {
      bundle.unreadable.push(`${name} (${err instanceof Error ? err.message : String(err)})`);
    }
  }
  // Only the case label is taken from the files; the rest of a heading is case content and stays out of our titles.
  const heading = bundle.documents.map((d) => d.text.match(/^#\s+(Case\s+[\w-]+)\b/m)?.[1]).find(Boolean);
  if (heading) bundle.title = heading.trim();
  return bundle;
}

export type EventSource = "live_human" | "simulated_persona" | "audio_attachment";
interface ViewEvent {
  n: number; timestamp: string; stage: string | null; channel: string | null; from: string | null; to: string | null; body: string;
  /** Set on events that came in by voice. Absent means an ordinary written message. */
  source?: EventSource;
}
export interface CaseView {
  id: string;
  title?: string | null;
  context?: string | null;
  initial_request?: string | null;
  events: ViewEvent[];
  attachments?: { name: string; text: string | null }[];
}

/**
 * A parsed case view (the eval's cut of a practice or generated case) as a bundle.
 * Events voiced by a simulated persona are left out unless the caller asks for them: they are
 * for demos, and must never be treated as evidence in a scored run.
 */
export function fromView(view: CaseView, options: { allowSimulated?: boolean } = {}): CaseBundle {
  const events = options.allowSimulated ? view.events : view.events.filter((e) => e.source !== "simulated_persona");
  const dropped = view.events.length - events.length;
  const history = events.map((e) =>
    `Event ${e.n} | ${e.timestamp} | ${e.stage ?? ""} | ${e.channel ?? ""}${e.source ? ` | voice: ${e.source.replace("_", " ")}` : ""}\nFrom: ${e.from ?? ""}\nTo: ${e.to ?? ""}\n${e.body}`).join("\n\n");
  const documents = [{ name: "history", text: history }];
  if (view.context) documents.unshift({ name: "context", text: view.context });
  for (const a of view.attachments ?? []) if (a.text) documents.push({ name: `attachment ${a.name}`, text: a.text });
  const unreadable = dropped ? [`${dropped} event(s) voiced by a simulated persona (excluded from the evidence)`] : [];
  return { id: view.id, title: view.title ?? view.id, documents, media: [], unreadable };
}

export function bundleText(bundle: CaseBundle): string {
  return bundle.documents.map((d) => `<file name="${d.name}">\n${d.text}\n</file>`).join("\n\n");
}
