"use client";
// Scenario launcher: the 50 public cases, Reality Test modifier chips, Run.
import { useMemo, useState } from "react";
import type { CityCommand } from "../../world/controlChannel";
import { MODIFIERS, SCENARIOS, type Modifier } from "../../world/scenarios";
import { filterScenarios } from "./logic";
import { Section } from "./ui";

const MOD_IDS = Object.keys(MODIFIERS) as Modifier[];

export function ScenarioLauncher({ send }: { send: (c: CityCommand) => void }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string>(SCENARIOS[0]?.id ?? "");
  const [mods, setMods] = useState<Modifier[]>([]);
  const [ran, setRan] = useState<string | null>(null);
  const list = useMemo(() => filterScenarios(SCENARIOS, q), [q]);
  const current = SCENARIOS.find((s) => s.id === picked);

  const run = () => {
    if (!picked) return;
    send({ type: "scenario", scenarioId: picked, modifiers: mods });
    setRan(picked);
    window.setTimeout(() => setRan((r) => (r === picked ? null : r)), 1200);
  };

  return (
    <Section title="Scenarios" right={<span className="text-[11px] tabular-nums text-white/40">{SCENARIOS.length} cases</span>}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search cases, scenes, places…"
        aria-label="Search scenarios"
        className="mb-2 w-full rounded-md border border-white/[0.08] bg-[#18181c] px-2.5 py-1.5 text-[12px] text-white placeholder:text-white/30 focus:border-[#ff6a1a]/60 focus:outline-none"
      />
      <ul role="listbox" aria-label="Scenarios" className="h-[180px] overflow-y-auto rounded-md border border-white/[0.06] bg-[#18181c]">
        {list.map((s) => (
          <li key={s.id}>
            <button
              role="option"
              aria-selected={s.id === picked}
              onClick={() => setPicked(s.id)}
              onDoubleClick={() => {
                setPicked(s.id);
                send({ type: "scenario", scenarioId: s.id, modifiers: mods });
              }}
              className={`flex w-full items-baseline gap-2 border-l-2 px-2.5 py-1.5 text-left ${
                s.id === picked ? "border-[#ff6a1a] bg-[#ff6a1a]/10" : "border-transparent hover:bg-white/[0.04]"
              }`}
            >
              <span className="w-[30px] shrink-0 font-mono text-[10.5px] tabular-nums text-white/35">{s.id.replace(/^\D+-?/, "")}</span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-white/85">{s.title}</span>
              <span className="shrink-0 text-[10px] text-white/30">{s.where}</span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="px-2.5 py-3 text-[12px] text-white/40">No match.</li>}
      </ul>
      <div className="mt-2.5 flex flex-wrap gap-1">
        {MOD_IDS.map((m) => {
          const on = mods.includes(m);
          return (
            <button
              key={m}
              aria-pressed={on}
              title={MODIFIERS[m].expect}
              onClick={() => setMods((cur) => (on ? cur.filter((x) => x !== m) : [...cur, m]))}
              className={`rounded-full border px-2 py-0.5 text-[10.5px] transition-colors ${
                on ? "border-[#ff6a1a] bg-[#ff6a1a]/20 text-white" : "border-white/[0.1] text-white/55 hover:border-white/25 hover:text-white"
              }`}
            >
              {MODIFIERS[m].label}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="min-w-0 flex-1 truncate text-[11px] text-white/45" title={current?.title}>
          {current ? <><span className="text-white/70">{current.id}</span> · {current.scene.replace(/_/g, " ")}</> : "Pick a case"}
        </div>
        <button
          onClick={run}
          disabled={!picked}
          className="shrink-0 rounded-md bg-[#ff6a1a] px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-[0_0_0_1px_rgba(255,106,26,0.4)] hover:bg-[#ff7d38] disabled:opacity-40"
        >
          {ran === picked ? "Sent ✓" : `▶ Run${mods.length ? ` +${mods.length}` : ""}`}
        </button>
      </div>
    </Section>
  );
}
