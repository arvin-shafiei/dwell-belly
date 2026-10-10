"use client";
// Console tab: City. Live control panel for the 3D city (/city) over the "rivet-city" BroadcastChannel:
// controls on the left, an embedded live view in the centre, telemetry on the right.
import { useState } from "react";
import { useCityLink } from "../city/useCityLink";
import { AgentModeControl, ClockControl, Injectors, SpeedControl, WeatherControl } from "../city/Controls";
import { ScenarioLauncher } from "../city/ScenarioLauncher";
import { TelemetryPanel } from "../city/TelemetryPanel";
import { formatHour, type LinkState } from "../city/logic";

const LINK: Record<LinkState, { dot: string; label: string }> = {
  live: { dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]", label: "Live" },
  stale: { dot: "bg-amber-400", label: "No signal" },
  waiting: { dot: "bg-white/30 animate-pulse", label: "Connecting" },
};

export default function CityTab() {
  const { telemetry: t, state, send } = useCityLink();
  const [tour, setTour] = useState(false);
  const link = LINK[state];

  return (
    <div className="grid h-full min-h-[560px] grid-cols-[300px_minmax(0,1fr)_320px] bg-[#1f1f23] text-white 2xl:grid-cols-[340px_minmax(0,1fr)_360px]">
      {/* Controls */}
      <aside aria-label="City controls" className="min-h-0 overflow-y-auto border-r border-white/[0.06] bg-[#1b1b1f]">
        <WeatherControl send={send} telemetry={t} />
        <ClockControl send={send} telemetry={t} />
        <SpeedControl send={send} telemetry={t} />
        <Injectors send={send} />
        <ScenarioLauncher send={send} />
        <AgentModeControl send={send} telemetry={t} />
      </aside>

      {/* Live view */}
      <main className="flex min-h-0 min-w-0 flex-col">
        <div className="flex h-10 shrink-0 items-center gap-3 border-b border-white/[0.06] px-3 text-[12px]">
          <span className="flex items-center gap-1.5" role="status" aria-live="polite">
            <span className={`size-2 rounded-full ${link.dot}`} />
            <span className="font-medium text-white/80">{link.label}</span>
          </span>
          {t && (
            <span className="flex min-w-0 items-center gap-3 truncate text-white/50">
              <span className="font-mono tabular-nums text-white/80">{formatHour(t.timeOfDay)}</span>
              <span className="capitalize">{t.weather}</span>
              <span className="tabular-nums">{t.paused ? "Paused" : `${t.timeScale}×`}</span>
              <span className={t.agentMode === "real" ? "text-emerald-300" : "text-amber-300"}>
                {t.agentMode === "real" ? "Real agent" : "Mock agent"}
              </span>
            </span>
          )}
          <span className="ml-auto flex shrink-0 items-center gap-2">
            <button
              aria-pressed={tour}
              onClick={() => {
                send({ type: "tour", on: !tour });
                setTour(!tour);
              }}
              className={`rounded-md border px-2.5 py-1 text-[11.5px] font-medium ${
                tour ? "border-[#ff6a1a] bg-[#ff6a1a]/15 text-white" : "border-white/[0.1] text-white/65 hover:text-white"
              }`}
            >
              {tour ? "■ Stop tour" : "◎ Cinematic tour"}
            </button>
            <a
              href="/city"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-white/[0.1] px-2.5 py-1 text-[11.5px] font-medium text-white/80 hover:border-[#ff6a1a]/60 hover:text-white"
            >
              Open full screen ↗
            </a>
          </span>
        </div>
        <div className="relative min-h-0 flex-1 bg-black">
          <iframe src="/city?embed=1" title="Live city" className="absolute inset-0 size-full border-0" allow="fullscreen" />
          {state === "waiting" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit rounded-md bg-black/70 px-3 py-1.5 text-[11.5px] text-white/70">
              Loading the city…
            </div>
          )}
        </div>
      </main>

      {/* Telemetry */}
      <aside aria-label="City telemetry" className="min-h-0 overflow-y-auto border-l border-white/[0.06] bg-[#1b1b1f]">
        <TelemetryPanel t={t} send={send} />
      </aside>
    </div>
  );
}
