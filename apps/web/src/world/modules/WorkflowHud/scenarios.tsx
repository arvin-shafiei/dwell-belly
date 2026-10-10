"use client";
// HUD scenario launcher: coverage meter, searchable case list grouped by `where`, modifier chips, Run.
// Also the cinematic-tour badge (reads CameraRig's cameraRigStatus).
import { memo, useEffect, useMemo, useState } from "react";
import { emit, on } from "../../bus";
import { MODIFIERS, SCENARIOS, type Modifier, type Where } from "../../scenarios";
import { cameraRigStatus } from "../CameraRig/director";
import { filterScenarios, groupScenarios } from "./scenarioMatch";
import { GLASS } from "./parts";

const MOD_KEYS = Object.keys(MODIFIERS) as Modifier[];
const WHERE_LABEL: Record<Where, string> = {
  suburbs: "Suburbs",
  downtown: "Downtown",
  depot: "Depot",
  docks: "Docks",
  road: "On the road",
  office: "Back office",
};

export interface Coverage {
  cases: number;
  mods: number;
}

/** Tally of distinct scenarios and modifiers staged so far (from scenario:staged events). */
export function useScenarioCoverage(): Coverage {
  const [cov, setCov] = useState(() => ({ cases: new Set<string>(), mods: new Set<Modifier>() }));
  useEffect(
    () =>
      on((e) => {
        if (e.type !== "scenario:staged") return;
        setCov((c) => {
          const fresh = !c.cases.has(e.scenarioId) || e.modifiers.some((m) => !c.mods.has(m));
          if (!fresh) return c;
          return { cases: new Set(c.cases).add(e.scenarioId), mods: new Set([...c.mods, ...e.modifiers]) };
        });
      }),
    [],
  );
  return { cases: cov.cases.size, mods: cov.mods.size };
}

function Meter({ n, total, color }: { n: number; total: number; color: string }) {
  return (
    <span className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-white/10">
      <span className="block h-full transition-[width] duration-500" style={{ width: `${(n / total) * 100}%`, background: color }} />
    </span>
  );
}

export function ScenarioButton({ open, onToggle, cov }: { open: boolean; onToggle: () => void; cov: Coverage }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      title={`Pick a practice case to run. ${cov.cases} of ${SCENARIOS.length} played.`}
      className={`flex h-7 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border px-2 text-[11px] font-medium transition ${
        open
          ? "border-[#ff6a1a]/70 bg-[#ff6a1a]/15 text-white"
          : "border-white/10 bg-white/[0.04] text-white/85 hover:border-[#ff6a1a]/60 hover:bg-[#ff6a1a]/10 hover:text-white"
      }`}
    >
      Practice cases
      <span className="rounded bg-black/30 px-1 text-[10px] tabular-nums text-white/60">
        {cov.cases}/{SCENARIOS.length}
      </span>
    </button>
  );
}

/** Coverage strip in the scenario panel ("cases played", PRD J4: not "covered", which reads like an eval). */
function CoverageStrip({ cov }: { cov: Coverage }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-white/[0.07] px-3 py-1.5 text-[10px] tabular-nums text-white/55">
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <Meter n={cov.cases} total={SCENARIOS.length} color="#ff6a1a" />
        {cov.cases} of {SCENARIOS.length} played
      </span>
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <Meter n={cov.mods} total={MOD_KEYS.length} color="#2dd4bf" />
        {cov.mods} of {MOD_KEYS.length} twists tried
      </span>
    </div>
  );
}

export const ScenarioPanel = memo(function ScenarioPanel({ onClose, cov }: { onClose: () => void; cov: Coverage }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [mods, setMods] = useState<Modifier[]>([]);
  const groups = useMemo(() => groupScenarios(filterScenarios(SCENARIOS, q)), [q]);
  const toggle = (m: Modifier) => setMods((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  const run = () => {
    if (!picked) return;
    emit({ type: "request:scenario", scenarioId: picked, modifiers: mods });
  };

  return (
    <aside className={`${GLASS} hud-panel flex max-h-full w-full flex-col overflow-hidden`}>
      <header className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2">
        <h2 className="shrink-0 text-[13px] font-semibold text-white">Practice cases</h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className="ml-auto w-[150px] min-w-0 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-white placeholder:text-white/35 focus:border-[#ff6a1a]/60 focus:outline-none"
        />
        <button
          type="button"
          onClick={onClose}
          title="Close"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
      </header>
      <CoverageStrip cov={cov} />

      <div className="hud-scroll min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {groups.length === 0 && <div className="px-2 py-3 text-center text-[11px] text-white/40">No case matches “{q}”.</div>}
        {groups.map(([where, list]) => (
          <div key={where} className="mb-2">
            <div className="px-1.5 pb-1 text-[10px] font-semibold text-white/45">
              {WHERE_LABEL[where]} <span className="text-white/25">{list.length}</span>
            </div>
            <ul>
              {list.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setPicked(s.id)}
                    onDoubleClick={() => emit({ type: "request:scenario", scenarioId: s.id, modifiers: mods })}
                    className={`flex w-full items-baseline gap-2 rounded-md px-1.5 py-1 text-left transition ${
                      picked === s.id ? "bg-[#ff6a1a]/20 text-white" : "text-white/75 hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="shrink-0 text-[10px] text-white/35">{s.id.replace("delivery-", "#")}</span>
                    <span className="truncate text-[11px]">{s.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <footer className="border-t border-white/[0.07] px-3 py-2">
        <div className="mb-2 flex flex-wrap gap-1">
          {MOD_KEYS.map((m) => {
            const onIt = mods.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggle(m)}
                title={MODIFIERS[m].label}
                className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                  onIt ? "border-teal-300/70 bg-teal-400/20 text-teal-100" : "border-white/10 bg-white/[0.03] text-white/60 hover:text-white"
                }`}
              >
                {MODIFIERS[m].label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={!picked}
          onClick={run}
          className="flex w-full items-center justify-center gap-2 truncate rounded-lg bg-[#ff6a1a] px-3 py-2 text-[13px] font-semibold text-black transition hover:bg-[#ff7d38] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
        >
          {picked ? `Run this case${mods.length ? ` with ${mods.length} twist${mods.length > 1 ? "s" : ""}` : ""}` : "Pick a case"}
        </button>
      </footer>
    </aside>
  );
});

/** Small pill shown while CameraRig's cinematic tour is on (polls the plain status object). */
export function TourBadge() {
  const [tour, setTour] = useState(cameraRigStatus.tour);
  useEffect(() => {
    const id = setInterval(() => setTour(cameraRigStatus.tour), 300);
    return () => clearInterval(id);
  }, []);
  if (!tour) return null;
  return (
    <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-sky-300/40 bg-sky-400/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-sky-200">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-300" />
      Tour
    </span>
  );
}
