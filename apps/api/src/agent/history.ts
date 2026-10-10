// Case history: what lets one case see the others. One JSON line per run in a file, so parallel
// workers can append without a lock and a crash loses at most its own line. Grouping, the promise
// list and the learner are all code over that file: no model calls here. Nothing in this module
// throws; a disk problem comes back as ok=false and the flow carries on without history.
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Outcome } from "../lib/trace.ts";
import type { RunResult } from "./run.ts";
import type { Decision, PlannedAction, Understanding } from "./types.ts";

// Next.js bundles route handlers without import.meta.dirname, so fall back to the module URL.
const HERE = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_STORE_FILE = path.resolve(HERE, "..", "..", "..", "..", ".case-history", "runs.jsonl");

export interface Store { file: string }

export function historyStore(file: string = DEFAULT_STORE_FILE): Store {
  return { file };
}

export interface HistoryRecord {
  caseId: string;
  /** ISO time the run was recorded. */
  at: string;
  outcome: Outcome;
  caseType: string;
  urgency: Understanding["urgency"] | "";
  references: string[];
  parties: { name: string; role: Understanding["parties"][number]["role"] }[];
  decisionOwner: string;
  commitments: Understanding["commitments"];
  /** Only messages the run recorded in the outbox. Held and blocked ones never went anywhere, so they are not history. */
  messages: Pick<PlannedAction, "recipient" | "channel" | "kind" | "purpose">[];
  waitingFor: Decision["waiting_for"];
}

export type RecordResult = { ok: true; record: HistoryRecord } | { ok: false; error: string };
export type ReadResult = { ok: true; records: HistoryRecord[]; skipped: number } | { ok: false; records: []; skipped: 0; error: string };

const REFERENCE = /\b[A-Z]{2,5}-\d+\b/g;
const message = (err: unknown) => (err instanceof Error ? err.message : String(err));
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Shipment, order and case references in a text (DL-024, INV-953), in order of first appearance. */
export function references(text: string): string[] {
  return [...new Set(text.match(REFERENCE) ?? [])];
}

function toRecord(result: RunResult, now: Date): HistoryRecord {
  const u = result.understanding;
  const caseText = [result.bundle.title, ...result.bundle.documents.map((d) => d.text)].join("\n");
  return {
    caseId: result.bundle.id,
    at: now.toISOString(),
    outcome: result.outcome,
    caseType: u?.case_type ?? "",
    urgency: u?.urgency ?? "",
    references: references(caseText),
    parties: (u?.parties ?? []).map((p) => ({ name: p.name, role: p.role })),
    decisionOwner: u?.decision_owner ?? "",
    commitments: u?.commitments ?? [],
    messages: result.outbox.filter((o) => o.status === "recorded")
      .map(({ action: a }) => ({ recipient: a.recipient, channel: a.channel, kind: a.kind, purpose: a.purpose })),
    waitingFor: result.decision?.waiting_for ?? [],
  };
}

export async function record(store: Store, result: RunResult, now: Date): Promise<RecordResult> {
  try {
    const entry = toRecord(result, now);
    await mkdir(path.dirname(store.file), { recursive: true });
    await appendFile(store.file, `${JSON.stringify(entry)}\n`);
    return { ok: true, record: entry };
  } catch (err) {
    return { ok: false, error: `could not write case history to ${store.file}: ${message(err)}` };
  }
}

const allOf = (list: unknown, keys: string[]) => Array.isArray(list) && list.every((item: unknown) =>
  typeof item === "object" && item !== null && keys.every((k) => typeof (item as Record<string, unknown>)[k] === "string"));

// The readers dereference what is inside these lists, so a line with the wrong shapes there is as damaged as a torn one.
function isRecord(v: unknown): v is HistoryRecord {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.caseId === "string" && typeof r.at === "string" && typeof r.outcome === "string"
    && typeof r.caseType === "string" && typeof r.decisionOwner === "string"
    && Array.isArray(r.references) && r.references.every((ref) => typeof ref === "string")
    && allOf(r.parties, ["name", "role"]) && allOf(r.commitments, ["what", "owed_by", "status", "due"])
    && allOf(r.waitingFor, ["what", "from", "by"]) && Array.isArray(r.messages);
}

/** Every stored run, oldest first. A store that does not exist yet is an empty history, not an error. */
export async function readRuns(store: Store): Promise<ReadResult> {
  let raw: string;
  try {
    raw = await readFile(store.file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return { ok: true, records: [], skipped: 0 };
    return { ok: false, records: [], skipped: 0, error: `could not read case history from ${store.file}: ${message(err)}` };
  }
  const records: HistoryRecord[] = [];
  let skipped = 0;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    // A torn or hand-damaged line costs that one run, never the whole history.
    try {
      const parsed: unknown = JSON.parse(line);
      if (isRecord(parsed)) records.push(parsed); else skipped++;
    } catch {
      skipped++;
    }
  }
  return { ok: true, records, skipped };
}

/** One record per case, the newest run of each, newest first. A re-run replaces the earlier run rather than counting twice. */
function latestPerCase(records: HistoryRecord[], exceptCaseId?: string): HistoryRecord[] {
  const latest = new Map<string, HistoryRecord>();
  for (const r of records) {
    if (r.caseId === exceptCaseId) continue;
    const seen = latest.get(r.caseId);
    if (!seen || r.at >= seen.at) latest.set(r.caseId, r);
  }
  return [...latest.values()].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export interface LookupQuery {
  references: string[];
  parties: { name: string; role: string }[];
  /** The case doing the looking, so its own earlier runs are not returned as history. */
  caseId?: string;
}

export interface LookupResult {
  ok: boolean;
  error?: string;
  /** Other cases that mention one of the references, newest first. */
  byReference: HistoryRecord[];
  /** Other cases with the same customer party that are not already in byReference, newest first. */
  byCustomer: HistoryRecord[];
}

export async function lookup(store: Store, query: LookupQuery): Promise<LookupResult> {
  const read = await readRuns(store);
  if (!read.ok) return { ok: false, error: read.error, byReference: [], byCustomer: [] };
  const refs = new Set(query.references);
  const customers = new Set(query.parties.filter((p) => p.role === "customer").map((p) => norm(p.name)));
  const byReference: HistoryRecord[] = [];
  const byCustomer: HistoryRecord[] = [];
  for (const r of latestPerCase(read.records, query.caseId)) {
    if (r.references.some((ref) => refs.has(ref))) byReference.push(r);
    else if (r.parties.some((p) => p.role === "customer" && customers.has(norm(p.name)))) byCustomer.push(r);
  }
  return { ok: true, byReference, byCustomer };
}

export interface GroupOptions { windowMinutes?: number; minSize?: number }

export interface Group {
  groupId: string;
  /** This case first, then the others newest first. */
  memberCaseIds: string[];
  reason: string;
  size: number;
}

const slug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * The "40 complaints, one broken van" check. Two plain rules, and the larger group wins:
 * open cases with the same decision owner and case type recorded inside the window, or open cases
 * that mention the same reference. Open means the latest run did not end in no_action. Returns null
 * when no group reaches minSize or the store cannot be read; it is a hint for the planner, not proof.
 */
export async function groupCandidates(
  store: Store,
  result: RunResult,
  now: Date,
  { windowMinutes = 180, minSize = 3 }: GroupOptions = {},
): Promise<Group | null> {
  const read = await readRuns(store);
  if (!read.ok) return null;
  let self: HistoryRecord;
  try {
    self = toRecord(result, now);
  } catch {
    return null;
  }
  const open = latestPerCase(read.records, self.caseId).filter((r) => r.outcome !== "no_action");
  const group = (key: string, members: HistoryRecord[], reason: (size: number) => string): Group => {
    const size = members.length + 1;
    return { groupId: key, memberCaseIds: [self.caseId, ...members.map((m) => m.caseId)], reason: reason(size), size };
  };

  const candidates: Group[] = [];
  for (const ref of self.references) {
    const sharing = open.filter((r) => r.references.includes(ref));
    candidates.push(group(`ref-${ref}`, sharing, (size) => `${size} open cases mention reference ${ref}`));
  }
  if (self.decisionOwner && self.caseType) {
    const windowMs = windowMinutes * 60_000;
    const alike = open.filter((r) => norm(r.decisionOwner) === norm(self.decisionOwner) && norm(r.caseType) === norm(self.caseType)
      && Math.abs(now.getTime() - Date.parse(r.at)) <= windowMs);
    candidates.push(group(`owner-${slug(self.decisionOwner)}-type-${slug(self.caseType)}`, alike,
      (size) => `${size} open cases of type "${self.caseType}" with the same decision owner (${self.decisionOwner}) in the last ${windowMinutes} minutes`));
  }
  // Reference groups are listed first, so on a tie the more specific link is the one reported.
  const best = candidates.reduce<Group | null>((a, g) => (!a || g.size > a.size ? g : a), null);
  return best && best.size >= minSize ? best : null;
}

/** Minutes until a stated due time, negative when past, null when the text carries no usable time. */
export type MinutesLeft = (due: string, now: Date) => number | null;

export interface OpenPromise {
  caseId: string;
  kind: "commitment" | "waiting_for";
  what: string;
  /** Who owes it (commitment) or who the desk is waiting on (waiting_for). */
  who: string;
  due: string;
  minutesLeft: number | null;
}

export interface OpenPromises {
  ok: boolean;
  error?: string;
  overdue: OpenPromise[];
  dueSoon: OpenPromise[];
  later: OpenPromise[];
  /** No due time could be read. Listed so they are not silently dropped. */
  undated: OpenPromise[];
}

export async function openPromises(
  store: Store,
  now: Date,
  minutesLeft: MinutesLeft,
  { dueSoonMinutes = 60 }: { dueSoonMinutes?: number } = {},
): Promise<OpenPromises> {
  const out: OpenPromises = { ok: true, overdue: [], dueSoon: [], later: [], undated: [] };
  const read = await readRuns(store);
  if (!read.ok) return { ...out, ok: false, error: read.error };

  const left = (due: string) => {
    try {
      const m = minutesLeft(due, now);
      return typeof m === "number" && Number.isFinite(m) ? m : null;
    } catch {
      return null;
    }
  };
  const place = (p: Omit<OpenPromise, "minutesLeft">) => {
    const m = left(p.due);
    const item = { ...p, minutesLeft: m };
    if (m === null) out.undated.push(item);
    else if (m < 0) out.overdue.push(item);
    else if (m <= dueSoonMinutes) out.dueSoon.push(item);
    else out.later.push(item);
  };
  // A re-run that failed carries no analysis; it must not erase what the last completed run found owed.
  const completed = latestPerCase(read.records.filter((r) => r.outcome !== "error"));
  const failedOnly = latestPerCase(read.records).filter((r) => !completed.some((c) => c.caseId === r.caseId));
  for (const r of [...completed, ...failedOnly]) {
    for (const c of r.commitments) {
      // A commitment that was refused or withdrawn is no longer owed by anyone.
      if (c.status === "requested" || c.status === "confirmed") place({ caseId: r.caseId, kind: "commitment", what: c.what, who: c.owed_by, due: c.due });
    }
    for (const w of r.waitingFor) place({ caseId: r.caseId, kind: "waiting_for", what: w.what, who: w.from, due: w.by });
  }
  const soonest = (a: OpenPromise, b: OpenPromise) => (a.minutesLeft ?? 0) - (b.minutesLeft ?? 0);
  out.overdue.sort(soonest);
  out.dueSoon.sort(soonest);
  out.later.sort(soonest);
  return out;
}

export interface HumanDecision {
  caseType: string;
  /** The gate risk shown on the card. */
  risk: number;
  option: "approve" | "reject" | "edit";
}

export interface LearnerConfig {
  /** The gate's current allow threshold. */
  allowBelow?: number;
  /** How far above the threshold a card's risk may sit and still count as evidence. */
  bandWidth?: number;
  minApprovals?: number;
  lastCards?: number;
  /** The learner never suggests an allow threshold above this. */
  ceiling?: number;
}

export interface Suggestion {
  caseType: string;
  currentAllowBelow: number;
  suggestedAllowBelow: number;
  evidence: { cards: number; approved: number; edited: number; riskFrom: number; riskTo: number; summary: string };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Reads the log of human choices (oldest first) and suggests widening the allow threshold for a
 * case type people keep approving just above it. It only returns suggestions: applying one is a
 * person's edit to the flow config. An edit counts as neither approval nor rejection.
 */
export function learner(decisions: HumanDecision[], config: LearnerConfig = {}): Suggestion[] {
  const { allowBelow = 0.3, bandWidth = 0.1, minApprovals = 5, lastCards = 6, ceiling = 0.5 } = config;
  const top = Math.min(ceiling, round2(allowBelow + bandWidth));
  if (!(top > allowBelow) || lastCards < 1) return [];

  const byType = new Map<string, HumanDecision[]>();
  for (const d of decisions) {
    if (!Number.isFinite(d.risk) || d.risk < allowBelow || d.risk >= top) continue;
    const key = norm(d.caseType);
    byType.set(key, [...(byType.get(key) ?? []), d]);
  }
  const suggestions: Suggestion[] = [];
  for (const cards of byType.values()) {
    const recent = cards.slice(-lastCards);
    const approved = recent.filter((d) => d.option === "approve").length;
    const edited = recent.filter((d) => d.option === "edit").length;
    if (approved < minApprovals || recent.some((d) => d.option === "reject")) continue;
    const caseType = recent[recent.length - 1].caseType;
    suggestions.push({
      caseType,
      currentAllowBelow: allowBelow,
      suggestedAllowBelow: top,
      evidence: {
        cards: recent.length, approved, edited, riskFrom: allowBelow, riskTo: top,
        summary: `People approved ${approved} of the last ${recent.length} "${caseType}" cards with risk from ${allowBelow} up to ${top}; none were rejected.`,
      },
    });
  }
  return suggestions;
}
