// One merged list for the city side panel: every incident and the case it became, newest first.
// Sources: store incidents, the HUD feed (store workflow), the agent queue, and the city runs saved in
// SQLite (GET /api/console/city/state `runs`). Deduped by incident id <-> case (view id
// `city-inc-<seq>-<incidentId>`, or the queue's label -> incidentId) and by execution id. Pure.
import type { Incident, IncidentKind, QueuedCase, WorkflowEvent } from "../../store";
import type { CityRun } from "../../cityState";
import { caseTitle } from "./flow";
import { INCIDENT_LABEL } from "./theme";

export type CaseState = "waiting" | "working" | "sent" | "person" | "stopped";

export const CASE_STATE_WORD: Record<CaseState, string> = {
  waiting: "Waiting",
  working: "Working",
  sent: "Sent",
  person: "Needs a person",
  stopped: "Stopped",
};

export interface CaseItem {
  key: string;
  title: string;
  /** Second line: the incident note, or empty. */
  note: string;
  kind: IncidentKind | null;
  state: CaseState;
  /** Wall clock (ms epoch) when it started, for ordering. */
  at: number;
  incidentId: string | null;
  executionId: string | null;
  runId: string | null;
  /** The feed's caseId ("INC-003 · car crash"), when the case has HUD lines. */
  label: string | null;
  /** Where the incident is, when it's still in the city. */
  pos: { x: number; z: number } | null;
}

export interface MergeInput {
  incidents: readonly Incident[];
  workflow: readonly WorkflowEvent[];
  runs: readonly CityRun[];
  queue: readonly QueuedCase[];
  /** Feed label -> incident id, remembered from the agent queue. */
  labelIncident: Readonly<Record<string, string>>;
  /** performance.now() and Date.now() taken together, to turn feed/incident times into wall clock. */
  perfNow: number;
  epochNow: number;
}

/** `city-inc-4-inc-abc` -> `inc-abc`. */
export function incidentIdFromCaseId(caseId: string | null | undefined): string | null {
  const m = /^city-inc-\d+-(.+)$/.exec(caseId ?? "");
  return m ? m[1] : null;
}

/** "INC-003 · car crash" -> "car_crash" when that's an incident kind. */
export function kindFromLabel(label: string | null | undefined): IncidentKind | null {
  const rest = (label ?? "").split(" · ")[1];
  if (!rest) return null;
  const k = rest.trim().replace(/\s+/g, "_");
  return k in INCIDENT_LABEL ? (k as IncidentKind) : null;
}

/** Where a case is, from its HUD lines in order. */
export function stateFromEvents(events: readonly Pick<WorkflowEvent, "nodeId" | "status" | "summary">[]): CaseState {
  const last = events[events.length - 1];
  if (!last) return "waiting";
  if (last.status === "ask") return "person";
  if (last.status === "error" || last.status === "block") return "stopped";
  if (last.nodeId === "log") return events.some((e) => e.status === "block") ? "stopped" : "sent";
  if (last.status === "start" && /^waiting/i.test(last.summary)) return "waiting";
  return "working";
}

function stateFromRun(r: CityRun): CaseState {
  if (r.status === "running") return "working";
  if (r.status === "error") return "stopped";
  if (r.card) return "person";
  return "sent";
}

interface Group { label: string; events: WorkflowEvent[]; executionId: string | null; runId: string | null }

function groupFeed(workflow: readonly WorkflowEvent[]): Map<string, Group> {
  const groups = new Map<string, Group>();
  for (const e of workflow) {
    let g = groups.get(e.caseId);
    if (!g) groups.set(e.caseId, (g = { label: e.caseId, events: [], executionId: null, runId: null }));
    g.events.push(e);
    if (e.executionId) g.executionId = e.executionId;
    if (e.runId) g.runId = e.runId;
  }
  return groups;
}

/** Merge incidents, HUD cases and saved city runs into one list, newest first. */
export function mergeCases(input: MergeInput): CaseItem[] {
  const { incidents, workflow, runs, queue, labelIncident, perfNow, epochNow } = input;
  const toEpoch = (t: number) => epochNow - (perfNow - t);
  const labels: Record<string, string> = { ...labelIncident };
  for (const q of queue) if (q.incidentId) labels[q.label] = q.incidentId;

  const items: CaseItem[] = [];
  const byExec = new Map<string, CaseItem>();
  const byRun = new Map<string, CaseItem>();
  const byIncident = new Map<string, CaseItem>();
  const index = (it: CaseItem) => {
    if (it.executionId) byExec.set(it.executionId, it);
    if (it.runId) byRun.set(it.runId, it);
    if (it.incidentId && !byIncident.has(it.incidentId)) byIncident.set(it.incidentId, it);
  };

  // 1. HUD cases (they carry the freshest status).
  for (const g of groupFeed(workflow).values()) {
    const kind = kindFromLabel(g.label);
    const it: CaseItem = {
      key: g.executionId ? `ex:${g.executionId}` : `case:${g.label}`,
      title: caseTitle(g.label),
      note: "",
      kind,
      state: stateFromEvents(g.events),
      at: toEpoch(g.events[0].t),
      incidentId: labels[g.label] ?? null,
      executionId: g.executionId,
      runId: g.runId,
      label: g.label,
      pos: null,
    };
    items.push(it);
    index(it);
  }

  // 2. Saved runs: link to a HUD case (execution, run, or label) or add as their own row.
  for (const r of runs) {
    const incId = incidentIdFromCaseId(r.caseId);
    let it = byExec.get(r.id) ?? (r.runId ? byRun.get(r.runId) : undefined);
    if (!it && r.title) it = items.find((x) => x.label === r.title && !x.executionId);
    if (it) {
      it.executionId ??= r.id;
      it.runId ??= r.runId;
      it.incidentId ??= incId;
      if (it.key.startsWith("case:")) it.key = `ex:${r.id}`;
      const started = Date.parse(r.startedAt);
      if (Number.isFinite(started)) it.at = Math.min(it.at, started);
      index(it);
      continue;
    }
    const title = r.title ?? r.caseId;
    const started = Date.parse(r.startedAt);
    const added: CaseItem = {
      key: `ex:${r.id}`,
      title: caseTitle(title),
      note: "",
      kind: kindFromLabel(title),
      state: stateFromRun(r),
      at: Number.isFinite(started) ? started : 0,
      incidentId: incId,
      executionId: r.id,
      runId: r.runId,
      label: null,
      pos: null,
    };
    items.push(added);
    index(added);
  }

  // 3. Incidents: fill in their case, or stand alone while they wait for one.
  for (const inc of incidents) {
    const it = byIncident.get(inc.id);
    if (it) {
      it.kind = inc.kind;
      it.title = INCIDENT_LABEL[inc.kind];
      it.note = inc.note;
      if (inc.status !== "cleared") it.pos = { x: inc.x, z: inc.z };
      it.at = Math.min(it.at, toEpoch(inc.createdAt));
      continue;
    }
    if (inc.status === "cleared") continue;
    const added: CaseItem = {
      key: `inc:${inc.id}`,
      title: INCIDENT_LABEL[inc.kind],
      note: inc.note,
      kind: inc.kind,
      state: "waiting",
      at: toEpoch(inc.createdAt),
      incidentId: inc.id,
      executionId: null,
      runId: null,
      label: null,
      pos: { x: inc.x, z: inc.z },
    };
    items.push(added);
    byIncident.set(inc.id, added);
  }

  // Dedupe by key (two feed labels can share an execution after a refresh), newest first.
  const seen = new Set<string>();
  return items
    .sort((a, b) => b.at - a.at)
    .filter((it) => (seen.has(it.key) ? false : (seen.add(it.key), true)));
}

/** The row for an incident clicked in the city. */
export function caseForIncident(items: readonly CaseItem[], incidentId: string): CaseItem | null {
  return items.find((it) => it.incidentId === incidentId) ?? null;
}

/** Keep the selection on the same case when keys change (a waiting incident gets its execution). */
export function resolveSelection(items: readonly CaseItem[], selected: { key: string; incidentId: string | null } | null): CaseItem | null {
  if (!selected) return null;
  return items.find((it) => it.key === selected.key) ?? (selected.incidentId ? caseForIncident(items, selected.incidentId) : null);
}

/** HUD lines for one case, in order. */
export function caseEvents(workflow: readonly WorkflowEvent[], item: CaseItem | null): WorkflowEvent[] {
  if (!item?.label) return [];
  return workflow.filter((e) => e.caseId === item.label);
}
