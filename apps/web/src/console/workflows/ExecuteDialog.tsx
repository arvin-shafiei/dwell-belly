"use client";
// "Execute workflow" dialog: pick a case (GET /api/console/cases) and run it.
import { useEffect, useState } from "react";
import { Icon } from "./icons";
import { listCases } from "./api";
import { Btn } from "./bits";
import { plainDataset } from "../../ui/plain";

type CaseRow = { id: string; dataset: string; title: string | null };

export function ExecuteDialog({ onRun, onClose }: { onRun: (c: CaseRow) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [cases, setCases] = useState<CaseRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<CaseRow | null>(null);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      listCases(q).then((r) => {
        if (!live) return;
        if (r.ok) { setCases(r.data?.cases ?? []); setError(null); }
        else { setCases([]); setError("Couldn't load the cases right now."); }
      });
    }, q ? 200 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onMouseDown={onClose}>
      <div
        role="dialog" aria-label="Run a case"
        className="flex max-h-[min(560px,90vh)] w-full max-w-[520px] flex-col rounded-xl border border-white/10 bg-[#222227] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className="text-[#ff6a1a]"><Icon name="play" size={16} /></span>
          <div className="flex-1 text-[15px] font-semibold text-white">Run a case</div>
          <button type="button" onClick={onClose} className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white"><Icon name="close" size={15} /></button>
        </div>
        <div className="px-4 pt-3">
          <label className="flex h-9 items-center gap-2 rounded-md border border-white/10 bg-black/25 px-2.5 text-white/50 focus-within:border-[#ff6a1a]/60">
            <Icon name="search" size={14} />
            <input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cases"
              className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-white/35"
            />
          </label>
        </div>
        <div className="min-h-[200px] flex-1 overflow-y-auto px-2 py-2">
          {cases === null && <div className="px-3 py-6 text-center text-[12px] text-white/40">Loading cases…</div>}
          {error && <div className="mx-2 rounded-md bg-[#ef4444]/10 px-3 py-2 text-[12px] text-[#f87171]">{error}</div>}
          {cases?.length === 0 && !error && <div className="px-3 py-6 text-center text-[12px] text-white/40">No cases match.</div>}
          {cases?.map((c) => {
            const on = picked?.id === c.id && picked.dataset === c.dataset;
            return (
              <button
                key={`${c.dataset}/${c.id}`} type="button" onClick={() => setPicked(c)} onDoubleClick={() => onRun(c)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left ${on ? "bg-[#ff6a1a]/15 ring-1 ring-[#ff6a1a]/50" : "hover:bg-white/[0.05]"}`}
              >
                <span className="min-w-0 flex-1 truncate text-[13px] text-white/85">{c.title ?? c.id}</span>
                <span className="shrink-0 text-[11px] text-white/30">{plainDataset(c.dataset)}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
          <span className="mr-auto text-[12px] text-white/40">Takes up to a minute.</span>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!picked} onClick={() => picked && onRun(picked)}>
            <Icon name="play" size={13} /> Run it
          </Btn>
        </div>
      </div>
    </div>
  );
}
