"use client";
// Right column of the City tab: live incidents, roads, deliveries, vehicles and the workflow feed.
import type { CityCommand, CityTelemetry } from "../../world/controlChannel";
import { deliveryBars, sourceTag, vehicleRows } from "./logic";
import { Section, Tag } from "./ui";

const KIND_LABEL: Record<string, string> = {
  car_crash: "Car crash",
  truck_crash: "Truck crash",
  pileup: "Pileup",
  roadworks: "Roadworks",
  breakdown: "Breakdown",
  plane_crash: "Plane crash",
  emergency_landing: "Emergency landing",
};
const STATUS_DOT: Record<string, string> = {
  active: "bg-red-500",
  responding: "bg-amber-400",
  clearing: "bg-sky-400",
  cleared: "bg-emerald-400",
};
const BAR: Record<string, string> = {
  en_route: "bg-sky-400",
  loading: "bg-white/40",
  delayed: "bg-amber-400",
  delivered: "bg-emerald-400",
  failed: "bg-red-500",
};
const WF_STATUS: Record<string, string> = {
  start: "text-sky-300",
  ok: "text-emerald-300",
  ask: "text-amber-300",
  block: "text-red-300",
  error: "text-red-400",
};

export function TelemetryPanel({ t, send }: { t: CityTelemetry | null; send: (c: CityCommand) => void }) {
  if (!t) {
    return (
      <div className="px-4 py-6 text-[12px] leading-relaxed text-white/45">
        Waiting for the city. Telemetry appears here once the live view (or an open <span className="text-white/70">/city</span> tab) loads.
      </div>
    );
  }
  const bars = deliveryBars(t.deliveries);
  const feed = [...t.workflow].reverse();
  return (
    <>
      <Section title="Incidents" right={<span className="text-[11px] tabular-nums text-white/45">{t.incidents.length} open · {t.closedRoads} roads closed</span>}>
        {t.incidents.length === 0 ? (
          <p className="text-[12px] text-white/35">All clear.</p>
        ) : (
          <ul className="max-h-[168px] space-y-1 overflow-y-auto">
            {t.incidents.map((i) => (
              <li key={i.id}>
                <button
                  onClick={() => send({ type: "focus", x: i.x, z: i.z })}
                  title="Fly the camera here"
                  className="group flex w-full items-start gap-2 rounded-md border border-white/[0.06] bg-[#2a2a30] px-2.5 py-1.5 text-left hover:border-[#ff6a1a]/50"
                >
                  <span className={`mt-[5px] size-1.5 shrink-0 rounded-full ${STATUS_DOT[i.status] ?? "bg-white/40"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-[12px] font-semibold text-white">{KIND_LABEL[i.kind] ?? i.kind}</span>
                      <span className="text-[10px] uppercase tracking-wide text-white/40">{i.status}</span>
                    </span>
                    <span className="block truncate text-[11px] text-white/50">{i.note}</span>
                  </span>
                  <span className="self-center text-[11px] text-white/25 group-hover:text-[#ff6a1a]">⌖</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Deliveries">
        <div className="space-y-1.5">
          {bars.map((b) => (
            <div key={b.key} className="flex items-center gap-2 text-[11.5px]">
              <span className="w-[62px] shrink-0 capitalize text-white/55">{b.key.replace("_", " ")}</span>
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div className={`h-full rounded-full ${BAR[b.key]} transition-[width] duration-500`} style={{ width: `${b.share * 100}%` }} />
              </div>
              <span className="w-7 shrink-0 text-right tabular-nums text-white/80">{b.count}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Vehicles" right={<span className="text-[11px] tabular-nums text-white/45">{Object.values(t.vehicles).reduce((a, b) => a + b, 0)} live</span>}>
        <div className="grid grid-cols-3 gap-1">
          {vehicleRows(t.vehicles).map(([k, n]) => (
            <div key={k} className="rounded-md bg-[#2a2a30] px-2 py-1">
              <div className="text-[13px] font-semibold tabular-nums text-white">{n}</div>
              <div className="truncate text-[10px] capitalize text-white/45">{k}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Workflow feed" right={<span className="text-[11px] text-white/40">last {t.workflow.length}</span>}>
        {feed.length === 0 ? (
          <p className="text-[12px] text-white/35">No workflow events yet. Inject an incident or run a scenario.</p>
        ) : (
          <ul className="space-y-1">
            {feed.map((e, idx) => (
              <li key={`${e.caseId}-${e.nodeId}-${feed.length - idx}`} className="rounded-md border border-white/[0.05] bg-[#232328] px-2.5 py-1.5">
                <div className="flex items-center gap-1.5 text-[10.5px]">
                  <span className="font-mono text-white/60">{e.caseId}</span>
                  <span className="text-white/25">›</span>
                  <span className="font-medium text-white/80">{e.nodeId}</span>
                  <span className={`font-semibold uppercase ${WF_STATUS[e.status] ?? "text-white/50"}`}>{e.status}</span>
                  <span className="ml-auto"><Tag kind={sourceTag(e.source)} /></span>
                </div>
                <div className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-white/65">{e.summary}</div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
