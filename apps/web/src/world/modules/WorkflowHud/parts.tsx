"use client";
// HUD building blocks: top bar, case feed, incidents, deliveries, decision toast, hotkeys footer.
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { emit, type WorldEvent } from "../../bus";
import { useWorld, type Delivery, type Incident, type IncidentKind, type WorkflowEvent } from "../../store";
import { getScenario } from "../../scenarios";
import { formatAge, formatClock, formatCost, newAsks, RUNNER_OF, summariseCases } from "./flow";
import { chosenAction, formatExpected, matchExpected, scenarioIdOf } from "./scenarioMatch";
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

// ---------------------------------------------------------------- top bar

const DEMO: { label: string; event: WorldEvent; kind: IncidentKind }[] = [
  { label: "Car crash", event: { type: "request:crash", kind: "car_crash" }, kind: "car_crash" },
  { label: "Truck crash", event: { type: "request:crash", kind: "truck_crash" }, kind: "truck_crash" },
  { label: "Pileup", event: { type: "request:crash", kind: "pileup" }, kind: "pileup" },
  { label: "Emergency landing", event: { type: "request:plane", kind: "emergency_landing" }, kind: "emergency_landing" },
  { label: "Plane crash", event: { type: "request:plane", kind: "plane_crash" }, kind: "plane_crash" },
  { label: "Roadworks", event: { type: "request:roadworks" }, kind: "roadworks" },
  { label: "Van breakdown", event: { type: "request:breakdown" }, kind: "breakdown" },
];

function Clock() {
  const hhmm = useWorld((s) => formatClock(s.timeOfDay));
  return <span className="font-mono text-[15px] font-medium tabular-nums tracking-tight text-white">{hhmm}</span>;
}

function PauseButton() {
  const paused = useWorld((s) => s.paused);
  const setPaused = useWorld((s) => s.setPaused);
  return (
    <button
      type="button"
      onClick={() => setPaused(!paused)}
      title={paused ? "Resume simulation" : "Pause simulation"}
      className={`grid h-7 w-7 place-items-center rounded-md border transition ${
        paused ? "border-[#ff6a1a]/60 bg-[#ff6a1a]/20 text-[#ff8a4a]" : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
      }`}
    >
      {paused ? (
        <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden>
          <path d="M1 1 L9 6 L1 11 Z" fill="currentColor" />
        </svg>
      ) : (
        <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden>
          <rect x="1" y="1" width="3" height="10" rx="0.6" fill="currentColor" />
          <rect x="6" y="1" width="3" height="10" rx="0.6" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex flex-col items-end leading-none">
      <span className={`font-mono text-[17px] font-semibold tabular-nums ${value > 0 ? tone : "text-white/40"}`}>{value}</span>
      <span className="mt-1 text-[9px] uppercase tracking-[0.14em] text-white/45">{label}</span>
    </div>
  );
}

function Counters() {
  const active = useWorld((s) => s.incidents.reduce((n, i) => n + (i.status !== "cleared" ? 1 : 0), 0));
  const closed = useWorld((s) => Object.keys(s.blocked).length);
  const cases = useWorld((s) => {
    const open = new Set<string>();
    for (const e of s.workflow) {
      if (e.nodeId === "log" && e.status === "ok") open.delete(e.caseId);
      else open.add(e.caseId);
    }
    return open.size;
  });
  return (
    <div className="flex items-center gap-5">
      <Counter label="Incidents" value={active} tone="text-rose-400" />
      <Counter label="Roads closed" value={closed} tone="text-amber-300" />
      <Counter label="Open cases" value={cases} tone="text-[#ff8a4a]" />
    </div>
  );
}

const SPEEDS = [1, 3, 10, 30];
const PRESETS: { label: string; hour: number }[] = [
  { label: "Dawn", hour: 6 },
  { label: "Noon", hour: 12 },
  { label: "Golden", hour: 18.5 },
  { label: "Night", hour: 22.5 },
];

/** Fast-forward the clock and jump to a time of day (the Sky module adopts external time changes). */
function TimeControls() {
  const scale = useWorld((s) => s.timeScale);
  const setScale = useWorld((s) => s.setTimeScale);
  const setTime = useWorld((s) => s.setTimeOfDay);
  const btn = "rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums transition";
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center rounded-md border border-white/10 bg-white/5 p-0.5" title="Clock speed">
        {SPEEDS.map((x) => (
          <button
            key={x}
            type="button"
            onClick={() => setScale(x)}
            className={`${btn} ${scale === x ? "bg-[#ff6a1a]/25 text-[#ff8a4a]" : "text-white/60 hover:text-white"}`}
          >
            {x}×
          </button>
        ))}
      </div>
      <div className="flex items-center rounded-md border border-white/10 bg-white/5 p-0.5" title="Jump to time">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" onClick={() => setTime(p.hour)} className={`${btn} text-white/60 hover:text-white`}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Honesty label (rules: no fabricated results). Everything the HUD shows about cases comes from the
 * mock engine in modules/WorkflowDriver, not the real agent in apps/api. Keep this visible in every
 * video take until the HUD replays real traces.
 */
export function SimulatedTag({ long = false }: { long?: boolean }) {
  return (
    <span
      title="Mock agent for the visual demo. Real decisions come from the agent runtime in apps/api (ANSWERS/<n>/trace.json)."
      className="inline-flex items-center gap-1 rounded border border-fuchsia-400/50 bg-fuchsia-500/15 px-1.5 py-[1px] font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-fuchsia-200"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-300" />
      {long ? "Simulated · mock agent" : "Simulated"}
    </span>
  );
}

export const TopBar = memo(function TopBar({ badge, extra }: { badge?: ReactNode; extra?: ReactNode }) {
  const paused = useWorld((s) => s.paused);
  return (
    <div className={`${GLASS} flex items-center gap-4 px-3 py-2`}>
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#ff6a1a] shadow-[0_0_18px_rgba(255,106,26,0.45)]">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M3 3 H10 A3 3 0 0 1 10 9 H6 L11 13" stroke="#0b0d12" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 3 V13" stroke="#0b0d12" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold tracking-tight text-white">Rivet Ops</div>
          <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em]">
            <span className="relative flex h-1.5 w-1.5">
              {!paused && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff6a1a] opacity-75" />}
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${paused ? "bg-white/40" : "bg-[#ff6a1a]"}`} />
            </span>
            <span className={paused ? "text-white/40" : "text-[#ff8a4a]"}>{paused ? "paused" : "live"}</span>
            {badge}
          </div>
        </div>
      </div>

      <div className="h-8 w-px bg-white/10" />

      <div className="flex items-center gap-2">
        <Clock />
        <PauseButton />
        <TimeControls />
      </div>

      <div className="h-8 w-px bg-white/10" />

      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="mr-1 hidden text-[9px] uppercase tracking-[0.16em] text-white/40 xl:inline">Inject</span>
        {DEMO.map((d) => (
          <button
            key={d.label}
            type="button"
            onClick={() => emit(d.event)}
            className="group flex items-center gap-1.5 whitespace-nowrap rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-white/85 transition hover:border-[#ff6a1a]/60 hover:bg-[#ff6a1a]/15 hover:text-white active:scale-[0.97]"
          >
            <IncidentIcon kind={d.kind} size={12} />
            {d.label}
          </button>
        ))}
      </div>

      {extra}

      <Counters />
    </div>
  );
});

// ---------------------------------------------------------------- icons

export function IncidentIcon({ kind, size = 16 }: { kind: IncidentKind; size?: number }) {
  const c = INCIDENT_COLOR[kind];
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className="shrink-0">
      {kind === "car_crash" && (
        <path d="M8 1 L9.6 5.2 L14 4.4 L11 8 L14.4 11.4 L9.8 11 L8 15 L6.2 11 L1.6 11.4 L5 8 L2 4.4 L6.4 5.2 Z" fill={c} />
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

/** For scenario cases: the case's expected next action and whether the mock agent's choice matches it. */
function ExpectedLine({ caseId, events }: { caseId: string; events: readonly WorkflowEvent[] }) {
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
      className={`${GLASS} hud-toast w-[min(440px,calc(100vw-32px))] overflow-hidden border-amber-300/30`}
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
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">Decision needed</span>
          <SimulatedTag />
          <span className="font-mono text-[11px] text-white/80">{cur.e.caseId}</span>
          {queue.length > 1 && <span className="ml-auto font-mono text-[10px] text-white/45">+{queue.length - 1} queued</span>}
        </div>
        <p className="mt-1.5 text-[13px] leading-snug text-white">{cur.e.summary}</p>
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
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-white/10 bg-[#0b0d12]/55 px-3.5 py-1.5 text-[10.5px] text-white/55 backdrop-blur-md">
      {KEYS.map(([k, v], i) => (
        <span key={k} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-white/20">·</span>}
          <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 py-px font-mono text-[10px] text-white/85">{k}</kbd>
          {v}
        </span>
      ))}
    </div>
  );
}
