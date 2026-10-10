"use client";
// Left column of the City tab: weather, clock, speed, incident injectors, agent mode.
import { useState } from "react";
import type { CityCommand, CityTelemetry } from "../../world/controlChannel";
import { INJECTORS, SPEEDS, TIME_PRESETS, WEATHERS, formatHour, type InjectEvent, type WeatherChoice } from "./logic";
import { Section, Segmented } from "./ui";

type Send = (c: CityCommand) => void;

const TONE: Record<"red" | "amber" | "blue", string> = {
  red: "before:bg-red-500",
  amber: "before:bg-amber-400",
  blue: "before:bg-sky-400",
};

export function WeatherControl({ send, telemetry }: { send: Send; telemetry: CityTelemetry | null }) {
  const [choice, setChoice] = useState<WeatherChoice>("auto");
  return (
    <Section
      title="Weather"
      right={telemetry && <span className="text-[11px] capitalize text-white/45">now: {telemetry.weather}</span>}
    >
      <div className="grid grid-cols-3 gap-1">
        {WEATHERS.map((w) => (
          <button
            key={w.id}
            aria-pressed={choice === w.id}
            onClick={() => {
              setChoice(w.id);
              send({ type: "weather", weather: w.id });
            }}
            className={`rounded-md border px-2 py-1.5 text-[12px] font-medium transition-colors ${
              choice === w.id
                ? "border-[#ff6a1a] bg-[#ff6a1a]/15 text-white"
                : "border-white/[0.08] bg-[#18181c] text-white/60 hover:border-white/20 hover:text-white"
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>
    </Section>
  );
}

export function ClockControl({ send, telemetry }: { send: Send; telemetry: CityTelemetry | null }) {
  const [drag, setDrag] = useState<number | null>(null);
  const hour = drag ?? telemetry?.timeOfDay ?? 17.5;
  const set = (h: number) => send({ type: "time", hour: h });
  return (
    <Section title="Time of day" right={<span className="font-mono text-[13px] tabular-nums text-white">{formatHour(hour)}</span>}>
      <input
        type="range"
        min={0}
        max={23.98}
        step={0.05}
        value={hour}
        aria-label="Time of day"
        onChange={(e) => {
          const h = Number(e.target.value);
          setDrag(h);
          set(h);
        }}
        onPointerUp={() => setDrag(null)}
        onKeyUp={() => setDrag(null)}
        onBlur={() => setDrag(null)}
        className="w-full accent-[#ff6a1a]"
      />
      <div className="mt-2 grid grid-cols-4 gap-1">
        {TIME_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => set(p.hour)}
            className="rounded-md border border-white/[0.08] bg-[#18181c] py-1 text-[11.5px] text-white/65 hover:border-white/20 hover:text-white"
          >
            {p.label}
          </button>
        ))}
      </div>
    </Section>
  );
}

export function SpeedControl({ send, telemetry }: { send: Send; telemetry: CityTelemetry | null }) {
  const paused = telemetry?.paused ?? false;
  return (
    <Section title="Simulation speed">
      <div className="flex gap-1.5">
        <div className="min-w-0 flex-1">
          <Segmented
            label="Speed"
            options={SPEEDS.map((s) => ({ id: s, label: `${s}×` }))}
            value={telemetry ? (telemetry.timeScale as (typeof SPEEDS)[number]) : null}
            onChange={(s) => send({ type: "timeScale", scale: s })}
          />
        </div>
        <button
          onClick={() => send({ type: "pause", paused: !paused })}
          aria-pressed={paused}
          className={`w-[76px] shrink-0 rounded-md border px-2 text-[11.5px] font-semibold ${
            paused ? "border-[#ff6a1a] bg-[#ff6a1a] text-white" : "border-white/[0.08] bg-[#18181c] text-white/70 hover:text-white"
          }`}
        >
          {paused ? "▶ Resume" : "❚❚ Pause"}
        </button>
      </div>
    </Section>
  );
}

export function Injectors({ send }: { send: Send }) {
  const [flash, setFlash] = useState<InjectEvent | null>(null);
  return (
    <Section title="Inject incident">
      <div className="grid grid-cols-2 gap-1.5">
        {INJECTORS.map((i) => (
          <button
            key={i.event}
            onClick={() => {
              send({ type: "inject", event: i.event });
              setFlash(i.event);
              window.setTimeout(() => setFlash((f) => (f === i.event ? null : f)), 700);
            }}
            title={i.hint}
            className={`relative overflow-hidden rounded-lg border px-3 py-2.5 text-left transition-colors before:absolute before:inset-y-0 before:left-0 before:w-[3px] ${TONE[i.tone]} ${
              flash === i.event
                ? "border-[#ff6a1a] bg-[#ff6a1a]/20"
                : "border-white/[0.08] bg-[#2a2a30] hover:border-white/20 hover:bg-[#313138]"
            }`}
          >
            <div className="text-[12.5px] font-semibold leading-tight text-white">{i.label}</div>
            <div className="mt-0.5 truncate text-[10.5px] text-white/45">{i.hint}</div>
          </button>
        ))}
      </div>
    </Section>
  );
}

export function AgentModeControl({ send, telemetry }: { send: Send; telemetry: CityTelemetry | null }) {
  return (
    <Section title="Agent">
      <Segmented
        label="Agent mode"
        options={[
          { id: "mock", label: "Mock (simulated)" },
          { id: "real", label: "Real agent" },
        ]}
        value={telemetry?.agentMode ?? null}
        onChange={(m) => send({ type: "agentMode", mode: m })}
      />
      <p className="mt-2 text-[11px] leading-snug text-white/40">
        Real sends staged scenarios to the agent API and replays its trace. Mock events are tagged SIMULATED.
      </p>
    </Section>
  );
}
