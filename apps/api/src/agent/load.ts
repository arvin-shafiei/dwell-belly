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
const MAX_MEDIA_BYTES = 8_000_000;

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
  const names = new Set(files.map((f) => path.relative(dir, f)));
  for (const file of files) {
    const name = path.relative(dir, file);
    const ext = path.extname(file).toLowerCase();
    try {
      if (MEDIA[ext]) {
        const size = (await stat(file)).size;
        if (size > MAX_MEDIA_BYTES) bundle.unreadable.push(`${name} (too large: ${size} bytes)`);
        else bundle.media.push({ name, mediaType: MEDIA[ext], base64: (await readFile(file)).toString("base64") });
      } else if (TEXT.has(ext)) {
        // A text sidecar next to a PDF or image repeats what the model will read from the original.
        const original = name.replace(/\.(txt|ocr\.txt|desc\.md)$/i, "");
        if (original !== name && names.has(original) && MEDIA[path.extname(original).toLowerCase()]) continue;
        const text = await readFile(file, "utf8");
        bundle.documents.push({ name, text: text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text });
        if (text.length > MAX_TEXT_CHARS) bundle.unreadable.push(`${name} (read the first ${MAX_TEXT_CHARS} characters of ${text.length})`);
      } else {
        bundle.unreadable.push(`${name} (unsupported file type)`);
      }
    } catch (err) {
      bundle.unreadable.push(`${name} (${err instanceof Error ? err.message : String(err)})`);
    }
  }
  const heading = bundle.documents.map((d) => d.text.match(/^#\s+(.+)$/m)?.[1]).find(Boolean);
  if (heading) bundle.title = heading.trim();
  return bundle;
}

interface ViewEvent { n: number; timestamp: string; stage: string | null; channel: string | null; from: string | null; to: string | null; body: string }
export interface CaseView {
  id: string;
  title?: string | null;
  context?: string | null;
  initial_request?: string | null;
  events: ViewEvent[];
  attachments?: { name: string; text: string | null }[];
}

/** A parsed case view (the eval's cut of a practice or generated case) as a bundle. */
export function fromView(view: CaseView): CaseBundle {
  const history = view.events.map((e) =>
    `Event ${e.n} | ${e.timestamp} | ${e.stage ?? ""} | ${e.channel ?? ""}\nFrom: ${e.from ?? ""}\nTo: ${e.to ?? ""}\n${e.body}`).join("\n\n");
  const documents = [{ name: "history", text: history }];
  if (view.context) documents.unshift({ name: "context", text: view.context });
  for (const a of view.attachments ?? []) if (a.text) documents.push({ name: `attachment ${a.name}`, text: a.text });
  return { id: view.id, title: view.title ?? view.id, documents, media: [], unreadable: [] };
}

export function bundleText(bundle: CaseBundle): string {
  return bundle.documents.map((d) => `<file name="${d.name}">\n${d.text}\n</file>`).join("\n\n");
}
