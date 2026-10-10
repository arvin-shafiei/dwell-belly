"use client";
// Overlay module: WorkflowHud. "Rivet Ops — live" control-room HUD over the city canvas.
// The root is pointer-events-none so the canvas stays draggable; only panels take the mouse.
import { memo, useState } from "react";
import { useWorld } from "../store";
import { MiniFlow } from "./WorkflowHud/MiniFlow";
import { CaseFeed, DecisionToast, Deliveries, GLASS, HotkeysFooter, IncidentList, AgentToggle, TopBar, useThrottledWorkflow } from "./WorkflowHud/parts";
import { ScenarioButton, ScenarioPanel, TourBadge, useScenarioCoverage } from "./WorkflowHud/scenarios";

// The Minimap sits at bottom-4 left-4 (240px); bottom overlays start right of it.
const MINIMAP_CLEAR = 268;

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
      Staged scenarios go to the real agent (apps/api) and its trace is replayed here. Other cases still use the mock and are tagged Simulated.
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
    <aside className={`${GLASS} hud-panel flex max-h-full w-[380px] flex-col overflow-hidden`}>
      <header className="flex items-center justify-between border-b border-white/[0.07] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-[3px] rounded-full bg-[#ff6a1a]" />
          <h2 className="text-[12px] font-semibold tracking-tight text-white">Incident workflow</h2>
          <span className="font-mono text-[10px] text-white/40">default-incident</span>
          <AgentToggle />
        </div>
        <button
          type="button"
          onClick={onCollapse}
          title="Collapse panel"
          className="grid h-6 w-6 place-items-center rounded-md text-white/60 transition hover:bg-white/10 hover:text-white"
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

export default function WorkflowHud() {
  const [open, setOpen] = useState(true);
  const [scenOpen, setScenOpen] = useState(false);
  const cov = useScenarioCoverage();
  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none font-sans text-white antialiased">
      <style>{STYLES}</style>

      <div className="absolute left-3 right-3 top-3">
        <TopBar
          badge={
            <>
              <AgentToggle />
              <TourBadge />
            </>
          }
          extra={<ScenarioButton open={scenOpen} onToggle={() => setScenOpen((o) => !o)} cov={cov} />}
        />
      </div>

      <div className="absolute bottom-14 right-3 top-[72px] flex flex-col items-end">
        {open ? <OpsPanel onCollapse={() => setOpen(false)} /> : <CollapsedTab onOpen={() => setOpen(true)} />}
      </div>

      {scenOpen && (
        <div className="absolute left-3 top-[72px] flex flex-col" style={{ bottom: MINIMAP_CLEAR }}>
          <ScenarioPanel onClose={() => setScenOpen(false)} />
        </div>
      )}

      <div
        className="absolute bottom-16 flex justify-center"
        style={{ left: MINIMAP_CLEAR, right: open ? 404 : 12 }}
      >
        <DecisionToast />
      </div>

      <div className="absolute bottom-3 flex justify-center" style={{ left: MINIMAP_CLEAR, right: open ? 404 : 12 }}>
        <HotkeysFooter />
      </div>
    </div>
  );
}
