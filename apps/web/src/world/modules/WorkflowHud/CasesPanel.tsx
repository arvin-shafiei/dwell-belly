"use client";
// The city's side panel: one "Cases" list (every incident and the case it became, newest first) and,
// under it, the selected case's run drawn on the playbook with an n8n-style events timeline.
// Click a case -> the camera flies to its incident and the playbook shows its run. Click a step ->
// its lines expand. Merge/dedupe and selection rules live in casesModel.ts (unit-tested).
import { memo, useEffect, useMemo, useState } from "react";
import { useWorld, type WorkflowEvent } from "../../store";
import { loadCityState, type CityRun } from "../../cityState";
import { traceToTimedEvents } from "../../agentBridge";
import { getExecution } from "../../../console/workflows/api";
import { scrubLeaks } from "../../../ui/plain";
import { on } from "../../bus";
import { caseEvents, caseForIncident, CASE_STATE_WORD, mergeCases, resolveSelection, type CaseItem, type CaseState } from "./casesModel";
import { nodeStatuses, stepName, type NodeStatus } from "./flow";
import { FlowPicture } from "./MiniFlow";
import { IncidentIcon, useThrottledWorkflow } from "./parts";
import { STATUS_COLOR } from "./theme";

const STATE_TONE: Record<CaseState, string> = {
  waiting: "bg-white/10 text-white/70",
  working: "bg-[#ff6a1a]/15 text-[#ffb08a]",
  sent: "bg-emerald-400/15 text-emerald-200",
  person: "bg-amber-400/15 text-amber-200",
  stopped: "bg-rose-500/15 text-rose-200",
};

/** Feed label -> incident id, remembered from the agent queue (an incident leaves the queue once it starts). */
const LABEL_INCIDENT: Record<string, string> = {};
function rememberLabels(queue: readonly { label: string; incidentId?: string }[]) {
  for (const q of queue) if (q.incidentId) LABEL_INCIDENT[q.label] = q.incidentId;
}

/** Recent city runs from SQLite, refreshed every 10 s. */
function useCityRuns(): CityRun[] {
  const [runs, setRuns] = useState<CityRun[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => void loadCityState().then((r) => alive && r && Array.isArray(r.runs) && setRuns(r.runs));
    load();
    const id = setInterval(load, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return runs;
}

/** performance.now() and Date.now() read together, ticking (read after mount, never during render). */
function useClocks(ms: number) {
  const [c, setC] = useState({ perf: 0, epoch: 0 });
  useEffect(() => {
    const tick = () => setC({ perf: performance.now(), epoch: Date.now() });
    tick();
    const id = setInterval(tick, ms);
    return () => clearInterval(id);
  }, [ms]);
  return c;
}

function age(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h` : `${Math.round(h / 24)}d`;
}

function LateIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 16 16" aria-hidden className="shrink-0">
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="#fbbf24" strokeWidth="1.6" />
      <path d="M8 4.5 V8 L10.4 9.6" stroke="#fbbf24" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export const CasesPanel = memo(function CasesPanel({ onDecide }: { onDecide: () => void }) {
  const workflow = useThrottledWorkflow(300);
  const incidents = useWorld((s) => s.incidents);
  const queue = useWorld((s) => s.agentQueue);
  const setFocus = useWorld((s) => s.setFocus);
  const runs = useCityRuns();
  const clocks = useClocks(2000);
  const [sel, setSel] = useState<{ key: string; incidentId: string | null } | null>(null);

  useEffect(() => {
    rememberLabels(useWorld.getState().agentQueue);
    return useWorld.subscribe((s, p) => {
      if (s.agentQueue !== p.agentQueue) rememberLabels(s.agentQueue);
    });
  }, []);

  const items = useMemo(
    () => (clocks.epoch ? mergeCases({ incidents, workflow, runs, queue, labelIncident: LABEL_INCIDENT, perfNow: clocks.perf, epochNow: clocks.epoch }) : []),
    [incidents, workflow, runs, queue, clocks],
  );
  const selected = resolveSelection(items, sel);

  const pick = (it: CaseItem) => {
    setSel({ key: it.key, incidentId: it.incidentId });
    if (it.pos) setFocus(it.pos);
  };

  // An incident clicked in the city (or on the minimap) selects its case.
  useEffect(
    () =>
      on((e) => {
        if (e.type !== "ui:selectIncident") return;
        const it = caseForIncident(items, e.incidentId);
        if (it) setSel({ key: it.key, incidentId: it.incidentId });
      }),
    [items],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="hud-scroll max-h-[42%] shrink-0 space-y-1 overflow-y-auto px-3 py-2" aria-label="Cases">
        {items.length === 0 && <li className="px-1 py-3 text-center text-[11px] text-white/40">Nothing yet. Roads are open.</li>}
        {items.map((it) => {
          const active = selected?.key === it.key;
          return (
            <li key={it.key}>
              <button
                type="button"
                onClick={() => pick(it)}
                aria-pressed={active}
                className={`flex w-full items-center gap-2.5 rounded-lg border px-2 py-1.5 text-left transition ${active ? "border-white/40 bg-white/[0.08]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]"}`}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-black/40">
                  {it.kind ? <IncidentIcon kind={it.kind} size={15} /> : <LateIcon />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="min-w-0 truncate text-[12px] font-medium text-white">{it.title}</span>
                    <span className="ml-auto shrink-0 text-[10px] tabular-nums text-white/40">{age(clocks.epoch - it.at)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-medium ${STATE_TONE[it.state]}`}>{CASE_STATE_WORD[it.state]}</span>
                    {it.note && <span className="min-w-0 truncate text-[10.5px] text-white/50">{it.note}</span>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="hud-scroll min-h-0 flex-1 overflow-y-auto border-t border-white/[0.07] px-3 pb-3 pt-2.5">
        {selected ? (
          <RunView key={selected.key} item={selected} workflow={workflow} onDecide={onDecide} />
        ) : (
          <p className="py-6 text-center text-[11px] text-white/40">Pick a case to see its run on the playbook.</p>
        )}
      </div>
    </div>
  );
});

interface Row { atMs: number; nodeId: string; status: NodeStatus; summary: string }

/** The run's lines: the HUD feed when it has them, else the saved trace from SQLite. */
function useRunRows(item: CaseItem, workflow: readonly WorkflowEvent[]): { rows: Row[]; loading: boolean } {
  const feed = useMemo(() => caseEvents(workflow, item), [workflow, item]);
  const [fetched, setFetched] = useState<Row[] | null>(null);
  const needFetch = feed.length === 0 && !!item.executionId;
  useEffect(() => {
    if (!needFetch || !item.executionId) return;
    let alive = true;
    void getExecution(item.executionId).then((r) => {
      if (!alive) return;
      const trace = r.ok ? r.data.execution.trace : null;
      setFetched(trace ? traceToTimedEvents(trace, item.label ?? item.title).map((t) => ({ atMs: t.atMs, nodeId: t.event.nodeId, status: t.event.status, summary: t.event.summary })) : []);
    });
    return () => {
      alive = false;
    };
  }, [needFetch, item.executionId, item.label, item.title]);
  if (feed.length) {
    const t0 = feed[0].t;
    return { rows: feed.map((e) => ({ atMs: e.t - t0, nodeId: e.nodeId, status: e.status, summary: e.summary })), loading: false };
  }
  return { rows: fetched ?? [], loading: needFetch && fetched === null };
}

function RunView({ item, workflow, onDecide }: { item: CaseItem; workflow: readonly WorkflowEvent[]; onDecide: () => void }) {
  const { rows, loading } = useRunRows(item, workflow);
  const [step, setStep] = useState<string | null>(null);
  const st = useMemo(() => nodeStatuses(rows.map((r, i) => ({ id: String(i), t: r.atMs, caseId: "x", nodeId: r.nodeId, status: r.status, summary: r.summary })), "x"), [rows]);
  const shown = step ? rows.filter((r) => r.nodeId === step || (step === "block" && r.nodeId === "gate" && r.status === "block")) : rows;

  return (
    <section>
      <div className="mb-1.5 flex items-center gap-2">
        <h3 className="min-w-0 truncate text-[12px] font-semibold text-white">{item.title}</h3>
        <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-medium ${STATE_TONE[item.state]}`}>{CASE_STATE_WORD[item.state]}</span>
      </div>
      <FlowPicture st={st} picked={step} onPick={(id) => setStep((s) => (s === id ? null : id))} />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {item.state === "person" && (
          <button type="button" onClick={onDecide} className="rounded-md bg-amber-400/90 px-2.5 py-1 text-[11px] font-semibold text-black transition hover:bg-amber-300">
            Decide
          </button>
        )}
        {item.executionId && (
          <a href={`/?tab=workflows&run=${encodeURIComponent(item.executionId)}`} className="rounded-md border border-white/15 px-2.5 py-1 text-[11px] text-white/85 transition hover:bg-white/10">
            Open in Playbooks
          </a>
        )}
      </div>
      <div className="mb-1 mt-3 flex items-center justify-between text-[10px] uppercase tracking-wide text-white/40">
        <span>{step ? stepName(step) : "Events"}</span>
        {step && (
          <button type="button" onClick={() => setStep(null)} className="normal-case tracking-normal text-white/55 hover:text-white">
            Show all
          </button>
        )}
      </div>
      {loading ? (
        <p className="text-[11px] text-white/40">Loading the run…</p>
      ) : shown.length === 0 ? (
        <p className="text-[11px] text-white/40">{step ? "This case didn't reach this step." : item.state === "waiting" ? "Waiting for its turn." : "No steps recorded."}</p>
      ) : (
        <ol className="space-y-px">
          {shown.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => setStep((s) => (s === r.nodeId ? null : r.nodeId))}
                className="grid w-full grid-cols-[36px_10px_1fr] items-start gap-1.5 rounded px-1 py-1 text-left hover:bg-white/[0.04]"
              >
                <span className="pt-px text-right font-mono text-[10px] tabular-nums text-white/35">+{(r.atMs / 1000).toFixed(1)}s</span>
                <span className="mt-[5px] h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[r.status] }} />
                <span className="min-w-0">
                  <span className="block text-[10.5px] text-white/45">{stepName(r.nodeId)}</span>
                  <span className="block text-[11px] leading-snug text-white/85">{scrubLeaks(r.summary) || "…"}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
