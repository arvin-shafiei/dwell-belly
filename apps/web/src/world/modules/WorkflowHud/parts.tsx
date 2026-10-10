"use client";
// HUD building blocks: agent labels, case feed, incidents, deliveries, decision toast, hotkeys footer.
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { useWorld, type Delivery, type Incident, type IncidentKind, type WorkflowEvent } from "../../store";
import { getScenario } from "../../scenarios";
import { formatAge, formatCost, newAsks, RUNNER_OF, summariseCases } from "./flow";
import { chosenAction, formatExpected, hasRealTrace, matchExpected, scenarioIdOf } from "./scenarioMatch";
import {
  INCIDENT_COLOR,
  INCIDENT_LABEL,
  INCIDENT_STATUS_STYLE,
  ORANGE,
  RUNNER_COLOR,
  RUNNER_LABEL,
  STATE_STYLE,
  STATUS_COLOR,
} from "./theme";

export const GLASS =
  "pointer-events-auto rounded-xl border border-white/10 bg-[#0b0d12]/70 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl";

/** Ticking clock in ms (performance.now), for ages and countdowns. */
export function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Workflow events, re-rendered at most every `ms` to avoid storms when the driver is busy. */
export function useThrottledWorkflow(ms: number) {
  const [events, setEvents] = useState(() => useWorld.getState().workflow);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending = false;
    const flush = () => {
      timer = null;
      if (!pending) return;
      pending = false;
      setEvents(useWorld.getState().workflow);
      timer = setTimeout(flush, ms);
    };
    const unsub = useWorld.subscribe((s, prev) => {
      if (s.workflow === prev.workflow) return;
      pending = true;
      if (!timer) flush();
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [ms]);
  return events;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">{children}</h3>
      {right}
    </div>
  );
}

// ---------------------------------------------------------------- agent labels

/**
 * Honesty label (rules: no fabricated results). Everything the HUD shows about cases comes from the
 * mock engine in modules/WorkflowDriver, not the real agent in apps/api. Keep this visible in every
 * video take until the HUD replays real traces.
 */
export function SimulatedTag({ long = false }: { long?: boolean }) {
  return (
    <span
      title="Mock agent for the visual demo. Real decisions come from the agent runtime in apps/api (ANSWERS/<n>/trace.json)."
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded border border-fuchsia-400/50 bg-fuchsia-500/15 px-1.5 py-[1px] font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-fuchsia-200"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-300" />
      Simulated
      {long && <span className="hidden whitespace-nowrap 2xl:inline"> · mock agent</span>}
    </span>
  );
}

export function RealAgentTag() {
  return (
    <span
      title="Decided by the real agent in apps/api; this is a replay of its trace."
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded border border-emerald-400/50 bg-emerald-500/15 px-1.5 py-[1px] font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-200"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
      Real agent
    </span>
  );
}

/**
 * Mock vs real agent. "Real" sends each staged scenario to POST /api/cases (costs model calls), so
 * it's opt-in, and only available when the agent API answers its health check.
 */
export function AgentToggle({ short = false }: { short?: boolean }) {
  const mode = useWorld((s) => s.agentMode);
  const online = useWorld((s) => s.agentOnline);
  const setMode = useWorld((s) => s.setAgentMode);
  const real = mode === "real" && online;
  return (
    <button
      type="button"
      disabled={!online && mode === "mock"}
      onClick={() => setMode(mode === "real" ? "mock" : "real")}
      title={
        online
          ? real
            ? "Scenarios go to the real agent (apps/api). Click to switch back to the mock."
            : "Click to send scenarios to the real agent (apps/api). Uses model calls."
          : "Agent API not reachable at NEXT_PUBLIC_API_URL, so the mock agent runs."
      }
      className="shrink-0 disabled:cursor-not-allowed"
    >
      {real ? <RealAgentTag /> : <SimulatedTag long={!short} />}
    </button>
  );
}

// ---------------------------------------------------------------- icons

export function IncidentIcon({ kind, size = 16 }: { kind: IncidentKind; size?: number }) {
  const c = INCIDENT_COLOR[kind];
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className="shrink-0">
      {(kind === "car_crash" || kind === "pileup") && (
        <path d="M8 1 L9.6 5.2 L14 4.4 L11 8 L14.4 11.4 L9.8 11 L8 15 L6.2 11 L1.6 11.4 L5 8 L2 4.4 L6.4 5.2 Z" fill={c} />
      )}
      {kind === "pileup" && <circle cx="12.6" cy="3.4" r="2.2" fill={c} stroke="#0b0d12" strokeWidth="0.8" />}
      {(kind === "emergency_landing" || kind === "plane_crash") && (
        <path
          d="M8 1 C8.8 1 9 2 9 3 V6.2 L15 9.6 V11 L9 9 V12.4 L10.8 13.8 V15 L8 14.2 L5.2 15 V13.8 L7 12.4 V9 L1 11 V9.6 L7 6.2 V3 C7 2 7.2 1 8 1 Z"
          fill={c}
          transform={kind === "plane_crash" ? "rotate(35 8 8)" : undefined}
        />
      )}
      {kind === "truck_crash" && (
        <g fill={c}>
          <rect x="1" y="4" width="9" height="7" rx="1" />
          <path d="M10.5 6 H13 L15 8.5 V11 H10.5 Z" />
          <circle cx="4" cy="12.5" r="1.6" />
          <circle cx="12" cy="12.5" r="1.6" />
        </g>
      )}
      {kind === "roadworks" && (
        <g>
          <path d="M8 1.5 L13 14 H3 Z" fill={c} />
          <rect x="4.6" y="9" width="6.8" height="1.6" fill="#0b0d12" />
          <rect x="6" y="5.4" width="4" height="1.4" fill="#0b0d12" />
        </g>
      )}
      {kind === "breakdown" && (
        <path
          d="M10.8 1.6 A3.6 3.6 0 0 0 7.2 6.4 L1.8 11.8 A1.4 1.4 0 0 0 4.2 14.2 L9.6 8.8 A3.6 3.6 0 0 0 14.4 5.2 L12.2 7.4 L10 6 L8.6 3.8 Z"
          fill={c}
        />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------- case feed

export const CaseFeed = memo(function CaseFeed({ events }: { events: readonly WorkflowEvent[] }) {
  const cases = useMemo(() => summariseCases(events, 8), [events]);
  const now = useNow(1000);
  const total = useMemo(() => summariseCases(events, 1000).reduce((s, c) => s + c.cost, 0), [events]);
  return (
    <section>
      <SectionTitle right={<span className="font-mono text-[10px] tabular-nums text-white/45">spend {formatCost(total)}</span>}>
        Case feed
      </SectionTitle>
      {cases.length === 0 ? (
        <Empty>Waiting for the first incident.</Empty>
      ) : (
        <ul className="space-y-1.5">
          {cases.map((c) => {
            const style = STATE_STYLE[c.state];
            const runner = RUNNER_OF[c.last.nodeId] ?? "code";
            return (
              <li
                key={c.caseId}
                className="relative overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.03] py-1.5 pl-3 pr-2"
              >
                <span className={`absolute inset-y-0 left-0 w-[3px] ${style.bar}`} />
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-medium text-white">{c.caseId}</span>
                  {c.caseId.startsWith("AGT-") || hasRealTrace(events, c.caseId) ? <RealAgentTag /> : <SimulatedTag />}
                  <span className={`rounded px-1.5 py-px font-mono text-[9px] uppercase tracking-wider ${style.chip}`}>{style.label}</span>
                  <span className="ml-auto font-mono text-[10px] tabular-nums text-white/55">{formatCost(c.cost)}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/70">{c.last.summary}</p>
                <ExpectedLine caseId={c.caseId} events={events} />
                <div className="mt-1 flex items-center gap-1.5 font-mono text-[9px] text-white/40">
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: RUNNER_COLOR[runner] }} />
                  <span style={{ color: STATUS_COLOR[c.last.status] }}>{c.last.nodeId}</span>
                  <span>·</span>
                  <span>{RUNNER_LABEL[runner]}</span>
                  <span>·</span>
                  <span>{c.steps} steps</span>
                  <span className="ml-auto tabular-nums">{formatAge(now - c.last.t)} ago</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
});

/**
 * For scenario cases replayed from a REAL agent trace: the expected next action and whether the agent's
 * choice matches it. PRD J4: never shown for mock cases, whose planner copies the answer key and would
 * always "match" (that would read as a fabricated eval).
 */
function ExpectedLine({ caseId, events }: { caseId: string; events: readonly WorkflowEvent[] }) {
  if (!hasRealTrace(events, caseId)) return null;
  const sid = scenarioIdOf(caseId);
  const expected = sid ? getScenario(sid)?.expected : null;
  if (!expected) return null;
  const chosen = chosenAction(events, caseId);
  const ok = chosen ? matchExpected(chosen.summary, expected) : null;
  return (
    <div className="mt-1 flex items-center gap-1.5 rounded-md bg-black/25 px-1.5 py-1 text-[10px] leading-tight">
      <span className="shrink-0 font-semibold uppercase tracking-wider text-white/40">Expected</span>
      <span className="min-w-0 flex-1 truncate text-white/75" title={expected.summary}>
        {formatExpected(expected)}
      </span>
      {ok === null ? (
        <span className="shrink-0 rounded px-1 font-mono text-[9px] text-white/35">…</span>
      ) : (
        <span
          title={chosen?.summary}
          className={`shrink-0 rounded px-1 font-mono text-[9px] font-semibold ${ok ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}
        >
          {ok ? "✓ match" : "✗ differs"}
        </span>
      )}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-center text-[11px] text-white/40">{children}</div>;
}

// ---------------------------------------------------------------- incidents

export const IncidentList = memo(function IncidentList() {
  const incidents = useWorld((s) => s.incidents);
  const setFocus = useWorld((s) => s.setFocus);
  const now = useNow(1000);
  const live = useMemo(
    () => incidents.filter((i): i is Incident & { status: Exclude<Incident["status"], "cleared"> } => i.status !== "cleared").reverse(),
    [incidents],
  );
  return (
    <section>
      <SectionTitle right={<span className="font-mono text-[10px] text-white/45">{live.length} live</span>}>Incidents</SectionTitle>
      {live.length === 0 ? (
        <Empty>All clear. Roads are open.</Empty>
      ) : (
        <ul className="space-y-1">
          {live.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => setFocus({ x: i.x, z: i.z })}
                title="Fly camera here"
                className="flex w-full items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-left transition hover:border-[#ff6a1a]/50 hover:bg-[#ff6a1a]/10"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-black/40">
                  <IncidentIcon kind={i.kind} size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-white">{INCIDENT_LABEL[i.kind]}</span>
                    <span className={`rounded px-1.5 py-px font-mono text-[9px] uppercase tracking-wider ${INCIDENT_STATUS_STYLE[i.status]}`}>
                      {i.status}
                    </span>
                    <span className="ml-auto font-mono text-[10px] tabular-nums text-white/45">{formatAge(now - i.createdAt)}</span>
                  </span>
                  <span className="block truncate text-[10.5px] text-white/55">{i.note}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
});

// ---------------------------------------------------------------- deliveries

function countDeliveries(ds: Record<string, Delivery>) {
  let enRoute = 0;
  let delayed = 0;
  let delivered = 0;
  let other = 0;
  for (const k in ds) {
    const st = ds[k].status;
    if (st === "en_route") enRoute++;
    else if (st === "delayed") delayed++;
    else if (st === "delivered") delivered++;
    else other++;
  }
  return { enRoute, delayed, delivered, other };
}

export const Deliveries = memo(function Deliveries() {
  const c = useWorld(useShallow((s) => countDeliveries(s.deliveries)));
  const total = c.enRoute + c.delayed + c.delivered + c.other;
  const rows = [
    { label: "En route", n: c.enRoute, color: ORANGE },
    { label: "Delayed", n: c.delayed, color: "#fbbf24" },
    { label: "Delivered", n: c.delivered, color: "#34d399" },
  ];
  return (
    <section>
      <SectionTitle right={<span className="font-mono text-[10px] tabular-nums text-white/45">{total} total</span>}>Deliveries</SectionTitle>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        {total > 0 &&
          rows.map((r) => (
            <div key={r.label} className="h-full transition-[width] duration-500" style={{ width: `${(r.n / total) * 100}%`, background: r.color }} />
          ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {rows.map((r) => (
          <div key={r.label} className="rounded-md bg-white/[0.03] px-2 py-1.5">
            <div className="font-mono text-[15px] font-semibold tabular-nums leading-none" style={{ color: r.n ? r.color : "rgba(255,255,255,0.35)" }}>
              {r.n}
            </div>
            <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-white/45">{r.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
});

// ---------------------------------------------------------------- decision toast

const AUTO_MS = 12_000;

interface Pending {
  e: WorkflowEvent;
  deadline: number;
}

function optionsFor(e: WorkflowEvent): { label: string; safe?: boolean }[] {
  const s = e.summary.toLowerCase();
  if (s.includes("refund") || s.includes("compens") || s.includes("replace"))
    return [{ label: "Ask merchant to decide", safe: true }, { label: "Offer replacement" }, { label: "Issue refund" }];
  if (s.includes("reroute") || s.includes("road") || s.includes("closed") || s.includes("detour"))
    return [{ label: "Hold & ask carrier", safe: true }, { label: "Approve reroute" }, { label: "Notify customer of delay" }];
  return [{ label: "Hold & escalate to desk", safe: true }, { label: "Approve plan" }, { label: "Notify customer" }];
}

export function DecisionToast() {
  const [queue, setQueue] = useState<Pending[]>([]);
  const [choice, setChoice] = useState<string | null>(null);
  const lastId = useRef<string | null>(null);
  const now = useNow(200);

  // Watch the store for new "ask" events (no React re-render on every workflow push).
  useEffect(() => {
    const wf = useWorld.getState().workflow;
    lastId.current = wf.length ? wf[wf.length - 1].id : null;
    return useWorld.subscribe((s, prev) => {
      if (s.workflow === prev.workflow || s.workflow.length === 0) return;
      const fresh = newAsks(s.workflow, lastId.current);
      lastId.current = s.workflow[s.workflow.length - 1].id;
      if (!fresh.length) return;
      const t = performance.now();
      setQueue((q) => [...q, ...fresh.map((e) => ({ e, deadline: t + AUTO_MS }))].slice(-4));
    });
  }, []);

  const cur = queue[0] ?? null;
  const opts = useMemo(() => (cur ? optionsFor(cur.e) : []), [cur]);
  const remaining = cur ? Math.max(0, cur.deadline - now) : 0;
  const expired = !!cur && remaining <= 0;

  // Dismiss after a choice (or the auto-resolve) has been shown briefly.
  useEffect(() => {
    if (!cur || (!choice && !expired)) return;
    const id = setTimeout(() => {
      setChoice(null);
      setQueue((q) => {
        const [, ...rest] = q;
        const t = performance.now();
        // The next card gets a fresh countdown from when it becomes visible.
        return rest.map((p, i) => (i === 0 ? { ...p, deadline: Math.max(p.deadline, t + AUTO_MS) } : p));
      });
    }, 900);
    return () => clearTimeout(id);
  }, [cur, choice, expired]);

  if (!cur) return null;
  const picked = choice ?? (expired ? opts.find((o) => o.safe)?.label ?? null : null);
  const secs = Math.ceil(remaining / 1000);

  return (
    <div
      key={cur.e.id}
      className={`${GLASS} hud-toast w-full max-w-[440px] overflow-hidden border-amber-300/30`}
      role="alertdialog"
      aria-label="Decision needed"
    >
      <div className="h-[3px] bg-white/[0.06]">
        <div className="h-full bg-amber-400 transition-[width] duration-200 ease-linear" style={{ width: `${(remaining / AUTO_MS) * 100}%` }} />
      </div>
      <div className="px-4 pb-3.5 pt-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
          </span>
          <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">Decision needed</span>
          {cur.e.source === "agent" ? <RealAgentTag /> : <SimulatedTag />}
          <span className="min-w-0 truncate font-mono text-[11px] text-white/80">{cur.e.caseId}</span>
          {queue.length > 1 && <span className="ml-auto shrink-0 font-mono text-[10px] text-white/45">+{queue.length - 1} queued</span>}
        </div>
        <p className="mt-1.5 line-clamp-3 text-[13px] leading-snug text-white">{cur.e.summary}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {opts.map((o) => {
            const on = picked === o.label;
            return (
              <button
                key={o.label}
                type="button"
                disabled={!!picked}
                onClick={() => setChoice(o.label)}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11.5px] font-medium transition ${
                  on
                    ? "border-[#ff6a1a] bg-[#ff6a1a] text-black shadow-[0_0_16px_rgba(255,106,26,0.5)]"
                    : picked
                      ? "border-white/5 bg-white/[0.02] text-white/30"
                      : "border-white/12 bg-white/[0.05] text-white/90 hover:border-[#ff6a1a]/60 hover:bg-[#ff6a1a]/15"
                }`}
              >
                {o.label}
                {o.safe && (
                  <span className={`rounded px-1 font-mono text-[8.5px] uppercase tracking-wider ${on ? "bg-black/20" : "bg-emerald-400/15 text-emerald-300"}`}>
                    safe
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-2.5 font-mono text-[10px] tabular-nums text-white/45">
          {picked ? (
            <span className="text-[#ff8a4a]">{choice ? "Decision sent" : "Auto-resolved"}: {picked}</span>
          ) : (
            <>auto-resolving with safe option in {secs}s</>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- footer

const KEYS: [string, string][] = [
  ["WASD", "pan"],
  ["Q/E", "rotate"],
  ["R/F", "zoom"],
  ["1–5", "zones"],
  ["V", "follow van"],
  ["C", "cinematic tour"],
  ["Esc", "release"],
];

export function HotkeysFooter() {
  return (
    <div className="flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl border border-white/10 bg-[#0b0d12]/55 px-3.5 py-1.5 text-[10.5px] text-white/55 backdrop-blur-md">
      {KEYS.map(([k, v], i) => (
        <span key={k} className="flex items-center gap-1.5 whitespace-nowrap">
          {i > 0 && <span className="text-white/20">·</span>}
          <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 py-px font-mono text-[10px] text-white/85">{k}</kbd>
          {v}
        </span>
      ))}
    </div>
  );
}
