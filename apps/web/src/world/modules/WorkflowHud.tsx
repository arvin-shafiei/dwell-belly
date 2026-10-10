"use client";
// Overlay module: WorkflowHud. "Rivet Ops — live" control-room HUD over the city canvas.
// The root is pointer-events-none so the canvas stays draggable; only panels take the mouse.
// Placement comes from WorkflowHud/layout.ts (one source of truth, unit-tested for overlaps):
//   top bar (full width, may wrap; its height is measured) > ops panel (right) / scenario panel (left,
//   above the minimap) > bottom band (decision card + hotkeys, between minimap and ops panel).
// Z-order inside the HUD: bottom band 10 < panels 20 < top bar + its menus 30. CityPage keeps the
// 3D canvas (and drei <Html> labels) in an isolated layer below the HUD.
import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { useWorld } from "../store";
import { hudLayout, TOPBAR_FALLBACK_H, type Insets } from "./WorkflowHud/layout";
import { MiniFlow } from "./WorkflowHud/MiniFlow";
import { AgentToggle, CaseFeed, Deliveries, GLASS, HotkeysFooter, IncidentList, RealAgentTag, SimulatedTag, useThrottledWorkflow } from "./WorkflowHud/parts";
import { useReviewQueue } from "../../review/useReviewQueue";
import { RealDecisionToast } from "./WorkflowHud/decision";
import { ScenarioButton, ScenarioPanel, TourBadge, useScenarioCoverage } from "./WorkflowHud/scenarios";
import { Clock, TopBar } from "./WorkflowHud/topbar";

const px = (b: Insets): CSSProperties => ({ left: b.left, right: b.right, top: b.top, bottom: b.bottom });

const STYLES = `
@keyframes hud-toast-in { from { opacity: 0; transform: translateY(24px) scale(0.98); } to { opacity: 1; transform: none; } }
.hud-toast { animation: hud-toast-in 320ms cubic-bezier(0.2, 0.9, 0.25, 1.15) both; }
@keyframes hud-panel-in { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: none; } }
.hud-panel { animation: hud-panel-in 260ms ease-out both; }
.hud-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent; }
.hud-scroll::-webkit-scrollbar { width: 6px; }
.hud-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
`;

function AgentNote() {
  const real = useWorld((st) => st.agentMode === "real" && !!st.agentOnline);
  return real ? (
    <p className="border-b border-white/[0.07] bg-emerald-500/[0.07] px-4 py-1.5 text-[10px] leading-snug text-emerald-100/80">
      City incidents (as synthetic cases), staged scenarios and new console runs go to the real agent (apps/api) and their traces are replayed here, within the budget. Anything else uses the mock and is tagged Simulated.
    </p>
  ) : (
    <p className="border-b border-white/[0.07] bg-fuchsia-500/[0.07] px-4 py-1.5 text-[10px] leading-snug text-fuchsia-100/80">
      Cases below come from a mock agent that drives this visual demo. The real agent&apos;s decisions are in{" "}
      <span className="font-mono">ANSWERS/</span> and its traces.
    </p>
  );
}

const OpsPanel = memo(function OpsPanel({ onCollapse }: { onCollapse: () => void }) {
  const events = useThrottledWorkflow(250);
  return (
    <aside className={`${GLASS} hud-panel flex max-h-full w-full flex-col overflow-hidden`}>
      <header className="flex items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-[#ff6a1a]" />
          <h2 className="shrink-0 whitespace-nowrap text-[12px] font-semibold tracking-tight text-white">Incident workflow</h2>
          <span className="min-w-0 truncate font-mono text-[10px] text-white/40">default-incident</span>
          <AgentToggle short />
        </div>
        <button
          type="button"
          onClick={onCollapse}
          title="Collapse panel"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <path d="M3 1.5 L6.5 5 L3 8.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <AgentNote />
      <div className="hud-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 pt-3">
        <MiniFlow events={events} />
        <IncidentList />
        <CaseFeed events={events} />
        <Deliveries />
      </div>
    </aside>
  );
});

function CollapsedTab({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${GLASS} flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-white/85 transition hover:text-white`}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
        <path d="M6.5 1.5 L3 5 L6.5 8.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </svg>
      Ops panel
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff6a1a]" />
    </button>
  );
}

/** Embed mode (`?embed=1`, the desk console's iframe): only an honesty badge and the clock, in a corner. */
function EmbedBadge() {
  const real = useWorld((st) => st.agentMode === "real" && !!st.agentOnline);
  return (
    <div className="absolute left-2 top-2 flex items-center gap-2 rounded-lg border border-white/10 bg-[#0b0d12]/70 px-2 py-1 backdrop-blur-md">
      <span className="h-2 w-2 shrink-0 rounded-sm bg-[#ff6a1a]" />
      <Clock className="text-[11px]" />
      {real ? <RealAgentTag /> : <SimulatedTag />}
      <TourBadge />
    </div>
  );
}

/** Height of the top bar, kept in sync as it wraps (ResizeObserver; border-box). */
function useMeasuredHeight<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [h, setH] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setH(Math.ceil(el.getBoundingClientRect().height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, h] as const;
}

export default function WorkflowHud({ embed = false, onReviewOpen }: { embed?: boolean; onReviewOpen: () => void }) {
  const [open, setOpen] = useState(true);
  const [scenOpen, setScenOpen] = useState(false);
  const cov = useScenarioCoverage();
  const [barRef, barH] = useMeasuredHeight<HTMLDivElement>(TOPBAR_FALLBACK_H);
  const { tasks, loading } = useReviewQueue();
  const mode = useWorld((state) => state.agentMode);
  const reviewTasks = tasks.filter((task) => task.status === "pending" && (mode === "real" ? !task.simulated : task.simulated));

  if (embed) {
    return (
      <div className="pointer-events-none absolute inset-0 z-10 select-none font-sans text-white antialiased">
        <EmbedBadge />
        <button type="button" onClick={onReviewOpen} className="pointer-events-auto absolute right-2 top-2 rounded-lg border border-amber-400/30 bg-[#0b0d12]/80 px-3 py-2 text-[11px] text-amber-100">Human review{reviewTasks.length > 0 && <span className="ml-2 font-mono">{reviewTasks.length}</span>}</button>
      </div>
    );
  }

  const L = hudLayout({ topBarH: barH, opsOpen: open, minimap: true });
  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none font-sans text-white antialiased">
      <style>{STYLES}</style>

      {/* bottom band: decision card above the hotkeys, between the minimap and the ops panel */}
      <div className="absolute z-10 flex flex-col items-center justify-end gap-2" style={px(L.bottomBand)}>
        <RealDecisionToast tasks={tasks} loading={loading} onOpenQueue={onReviewOpen} />
        {reviewTasks.length > 0 && <button type="button" onClick={onReviewOpen} className={`${GLASS} flex max-w-sm items-center gap-3 border-amber-400/30 px-4 py-3 text-left text-xs transition hover:bg-[#15171d]/90`}>
          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-300" />
          <span><strong className="block font-medium text-amber-100">{reviewTasks.length} case{reviewTasks.length === 1 ? " needs" : "s need"} a person</strong><span className="mt-1 block text-[10px] text-white/55">Open the decision queue →</span></span>
        </button>}
        <HotkeysFooter />
      </div>

      <div className="absolute z-20 flex max-w-[calc(100%-24px)] flex-col items-end" style={{ ...px(L.ops), width: open ? L.ops.width : undefined }}>
        {open ? <OpsPanel onCollapse={() => setOpen(false)} /> : <CollapsedTab onOpen={() => setOpen(true)} />}
      </div>

      {scenOpen && (
        <div className="absolute z-20 flex max-w-[calc(100%-24px)] flex-col" style={{ ...px(L.scenario), width: L.scenario.width }}>
          <ScenarioPanel cov={cov} onClose={() => setScenOpen(false)} />
        </div>
      )}

      <div ref={barRef} className="absolute z-30" style={px(L.topBar)}>
        <TopBar
          scenarios={<div className="flex items-center gap-2">
            <button type="button" onClick={onReviewOpen} className="pointer-events-auto whitespace-nowrap rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] font-medium text-amber-100 transition hover:bg-amber-400/20 focus-visible:outline-2 focus-visible:outline-amber-300">Human review{reviewTasks.length > 0 && <span className="ml-2 font-mono">{reviewTasks.length}</span>}</button>
            <ScenarioButton open={scenOpen} onToggle={() => setScenOpen((o) => !o)} cov={cov} />
          </div>}
          badge={<TourBadge />}
        />
      </div>
    </div>
  );
}
