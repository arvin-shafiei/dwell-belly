"use client";
// Small shared building blocks for the City tab.
import type { ReactNode } from "react";

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-white/[0.06] px-4 py-3.5 last:border-b-0">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/45">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md border border-white/[0.08] bg-[#18181c] p-0.5">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={String(o.id)}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={`min-w-0 flex-1 truncate rounded-[5px] px-1.5 py-1 text-[11.5px] font-medium transition-colors ${
              on ? "bg-[#ff6a1a] text-white shadow-sm" : "text-white/60 hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Tag({ kind }: { kind: "REAL" | "SIMULATED" }) {
  return kind === "REAL" ? (
    <span className="rounded-sm bg-emerald-500/15 px-1 py-px text-[9px] font-bold tracking-wider text-emerald-300">REAL</span>
  ) : (
    <span className="rounded-sm bg-amber-400/15 px-1 py-px text-[9px] font-bold tracking-wider text-amber-300">SIMULATED</span>
  );
}
