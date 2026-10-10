"use client";
// Right column of the City tab: "What's happening" in plain sentences, and the cases with their status.
import type { CityCommand, CityTelemetry } from "../../world/controlChannel";
import { caseRows, incidentSentence, type CaseRow } from "./logic";
import { Section } from "./ui";

const DOT: Record<string, string> = { active: "bg-red-500", responding: "bg-amber-400", clearing: "bg-sky-400" };
const TONE: Record<CaseRow["tone"], string> = {
  working: "text-white/60",
  done: "text-emerald-300",
  person: "text-amber-300",
  stopped: "text-red-300",
};

export function Happening({ t, send }: { t: CityTelemetry | null; send: (c: CityCommand) => void }) {
  if (!t) return <p className="px-5 py-6 text-[13px] text-white/45">Waiting for the city…</p>;
  const cases = caseRows(t.workflow);
  const d = t.deliveries;
  return (
    <>
      <div className="grid grid-cols-3 gap-2 px-5 pt-5">
        {[
          [d.en_route + d.loading, "On the way"],
          [d.delayed, "Late"],
          [d.delivered, "Delivered"],
        ].map(([n, label]) => (
          <div key={label} className="rounded-lg bg-white/[0.03] px-3 py-2.5">
            <div className="text-[22px] font-semibold tabular-nums leading-none text-white">{n}</div>
            <div className="mt-1 text-[12px] text-white/50">{label}</div>
          </div>
        ))}
      </div>

      <Section title="What's happening">
        {t.incidents.length === 0 ? (
          <p className="text-[14px] text-white/45">All quiet.</p>
        ) : (
          <ul className="space-y-1">
            {t.incidents.slice(-6).reverse().map((i) => (
              <li key={i.id}>
                <button
                  onClick={() => send({ type: "focus", x: i.x, z: i.z })}
                  title="Show me"
                  className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left text-[14px] leading-snug text-white/85 hover:bg-white/[0.05]"
                >
                  <span className={`mt-[7px] size-2 shrink-0 rounded-full ${DOT[i.status] ?? "bg-white/40"}`} />
                  {incidentSentence(i)}
                </button>
              </li>
            ))}
          </ul>
        )}
        {t.closedRoads > 0 && (
          <p className="mt-2 px-2 text-[12px] text-white/45">
            {t.closedRoads} {t.closedRoads === 1 ? "road" : "roads"} closed
          </p>
        )}
      </Section>

      <Section title="Cases">
        {cases.length === 0 ? (
          <p className="text-[14px] text-white/45">No cases yet.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {cases.map((c) => (
              <li key={c.caseId} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[14px] ${TONE[c.tone]}`}>{c.status}</span>
                  <span className="text-[11px] text-white/35">{c.title}</span>
                </span>
                <span className={`shrink-0 text-[11px] font-medium ${c.live ? "text-emerald-300" : "text-white/40"}`}>
                  {c.live ? "Live" : "Practice"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
