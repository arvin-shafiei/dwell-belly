import { readFile } from "node:fs/promises";
import path from "node:path";

// Parsed synthetic cases, built by `npm run data` from data/raw. See data/README.md.
const DATA_DIR = path.join(process.cwd(), "..", "..", "data");

export type Track = "banking" | "delivery" | "insurance" | "property";

export interface CaseEvent {
  n: number;
  timestamp: string;
  stage: string | null;
  channel: string | null;
  from: string | null;
  to: string | null;
  body: string;
}

export interface CaseAttachment {
  name: string;
  type: string;
  path: string;
  text: string | null;
  text_source: string | null;
}

export interface SyntheticCase {
  id: string;
  track: Track;
  track_name: string;
  number: string;
  title: string;
  details: Record<string, string>;
  context: string | null;
  initial_request: string | null;
  overview: string | null;
  escalation_snapshot: { first_event: number; last_event: number } | null;
  next_action: ({ summary: string; recorded_event: number | null } & Record<string, unknown>) | null;
  outcome: string | null;
  boundaries: string | null;
  events: CaseEvent[];
  attachments: CaseAttachment[];
}

export interface CaseIndexEntry {
  id: string;
  track: Track;
  number: string;
  title: string;
  status: string | null;
  events: number;
  attachments: string[];
  escalation_snapshot: SyntheticCase["escalation_snapshot"];
  file: string;
}

export async function listCases(track?: string): Promise<CaseIndexEntry[]> {
  const all: CaseIndexEntry[] = JSON.parse(await readFile(path.join(DATA_DIR, "index.json"), "utf8"));
  return track ? all.filter((c) => c.track === track) : all;
}

export async function getCase(id: string): Promise<SyntheticCase | null> {
  const m = id.match(/^(banking|delivery|insurance|property)-(\d{3})$/);
  if (!m) return null;
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, "cases", m[1], `${m[2]}.json`), "utf8"));
  } catch {
    return null;
  }
}

// The case as it looked at escalation: later events, next action and outcome hidden.
export function escalationView(c: SyntheticCase) {
  const last = c.escalation_snapshot?.last_event;
  return {
    id: c.id,
    track: c.track,
    title: c.title,
    context: c.context,
    initial_request: c.initial_request,
    events: last ? c.events.filter((e) => e.n <= last) : c.events,
    attachments: c.attachments,
  };
}
