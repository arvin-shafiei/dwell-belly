// Every case the console can run or show, per dataset, read from the repo:
//   public    data/cases/delivery (via data/index.json)
//   generated data/generated/delivery without a grounding seed
//   grounded  data/generated/delivery with a grounding seed (data/scraped)
//   adversarial data/adversarial/delivery (Oriol's adversarial cases, PR #12)
//   city      data/city/delivery (hand-written city scenarios; no index.json, read from the folder)
//   fixtures  docs/stress-test/fixtures/NNN (index.md + history.md), id "fixture-NNN"
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fixtureAttachmentPaths, fixtureView, fixtureTitle, generatedView, publicView, type CaseView } from "./caseViews";
import { repoRoot } from "./db";

export interface CaseEntry {
  id: string;
  dataset: string;
  title: string | null;
}

interface Located extends CaseEntry {
  file: string; // absolute; for fixtures, the fixture folder
  mutation: string | null; // difficulty pattern (scripts/eval/mutations.mjs); null for public and fixtures
}

/** A case with its difficulty pattern, for scenario sets. */
export interface CaseWithMutation extends CaseEntry { mutation: string | null }

export const DATASETS = ["public", "generated", "grounded", "adversarial", "city", "fixtures"] as const;

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function scan(): Promise<Located[]> {
  const root = repoRoot();
  const data = path.join(root, "data");
  const out: Located[] = [];

  const index = (await readJson<{ id: string; track: string; title?: string; file: string }[]>(path.join(data, "index.json"))) ?? [];
  for (const c of index) {
    if (c.track === "delivery") out.push({ id: c.id, dataset: "public", title: c.title ?? null, file: path.join(data, c.file), mutation: null });
  }

  type Indexed = { id: string; title?: string; grounding?: string | null; mutation?: string; file: string };
  for (const set of ["generated", "adversarial", "city"] as const) {
    const dataset = (c: { grounding?: string | null }) => (set !== "generated" ? set : c.grounding ? "grounded" : "generated");
    const listed = (await readJson<Indexed[]>(path.join(data, set, "index.json"))) ?? [];
    const indexed = new Set(listed.map((c) => c.id));
    for (const c of listed) {
      out.push({ id: c.id, dataset: dataset(c), title: c.title ?? null, file: path.join(data, c.file), mutation: c.mutation ?? null });
    }
    // Files not yet in the index still count.
    const dir = path.join(data, set, "delivery");
    for (const name of (await readdir(dir).catch(() => [] as string[])).filter((n) => n.endsWith(".json")).sort()) {
      const id = name.replace(/\.json$/, "");
      if (indexed.has(id)) continue;
      const c = await readJson<Omit<Indexed, "file">>(path.join(dir, name));
      if (!c) continue;
      out.push({ id: c.id ?? id, dataset: dataset(c), title: c.title ?? null, file: path.join(dir, name), mutation: c.mutation ?? null });
    }
  }

  const fixDir = path.join(root, "docs", "stress-test", "fixtures");
  for (const name of (await readdir(fixDir).catch(() => [] as string[])).sort()) {
    const indexMd = await readFile(path.join(fixDir, name, "index.md"), "utf8").catch(() => null);
    if (indexMd === null) continue;
    out.push({ id: `fixture-${name}`, dataset: "fixtures", title: fixtureTitle(indexMd), file: path.join(fixDir, name), mutation: null });
  }
  return out;
}

const CACHE_MS = 15_000;
let cache: { at: number; cases: Promise<Located[]> } | null = null;

async function located(): Promise<Located[]> {
  if (!cache || Date.now() - cache.at > CACHE_MS) cache = { at: Date.now(), cases: scan() };
  return cache.cases;
}

export async function listCases(dataset?: string | null, q?: string | null): Promise<CaseEntry[]> {
  const needle = q?.trim().toLowerCase();
  return (await located())
    .filter((c) => !dataset || c.dataset === dataset)
    .filter((c) => !needle || c.id.toLowerCase().includes(needle) || (c.title ?? "").toLowerCase().includes(needle))
    .map(({ id, dataset: d, title }) => ({ id, dataset: d, title }));
}

/** Every case with its difficulty pattern. */
export async function listCasesWithMutation(): Promise<CaseWithMutation[]> {
  return (await located()).map(({ id, dataset, title, mutation }) => ({ id, dataset, title, mutation }));
}

export async function findCase(caseId: string, dataset?: string | null): Promise<CaseEntry | null> {
  const all = await located();
  const hit = all.find((c) => c.id === caseId && (!dataset || c.dataset === dataset));
  return hit ? { id: hit.id, dataset: hit.dataset, title: hit.title } : null;
}

/** The view the eval would send for this case. Null if the case is unknown. */
export async function buildView(caseId: string, dataset?: string | null): Promise<{ entry: CaseEntry; view: CaseView } | null> {
  const hit = (await located()).find((c) => c.id === caseId && (!dataset || c.dataset === dataset));
  if (!hit) return null;
  const entry = { id: hit.id, dataset: hit.dataset, title: hit.title };
  if (hit.dataset === "fixtures") {
    const [indexMd, historyMd] = await Promise.all([
      readFile(path.join(hit.file, "index.md"), "utf8"),
      readFile(path.join(hit.file, "history.md"), "utf8"),
    ]);
    const attachments = await Promise.all(fixtureAttachmentPaths(indexMd).map(async (rel) => ({
      name: path.basename(rel),
      text: await readFile(path.join(hit.file, rel), "utf8").catch(() => null),
    })));
    return { entry, view: fixtureView(hit.id, indexMd, historyMd, attachments) };
  }
  const raw = JSON.parse(await readFile(hit.file, "utf8"));
  return { entry, view: hit.dataset === "public" ? publicView(raw) : generatedView(raw) };
}
