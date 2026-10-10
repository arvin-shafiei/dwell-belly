"use client";
import dynamic from "next/dynamic";
import { useCallback, useState, useSyncExternalStore } from "react";
import CityReviewBridge from "../review/CityReviewBridge";
import ReviewDrawer from "../review/ReviewDrawer";
import { useWorld } from "./store";
import { ModuleBoundary } from "./ModuleBoundary";
import WorkflowHud from "./modules/WorkflowHud";
import { isEmbedSearch } from "./modules/WorkflowHud/layout";
import Minimap from "./modules/Minimap";

// three.js needs the browser, so the canvas is client-only.
const World = dynamic(() => import("./World"), { ssr: false, loading: () => <p className="p-4">Loading city…</p> });

const noSubscribe = () => () => {};
/** `?embed=1`: the desk console's iframe. Read on the client only (false during SSR/hydration). */
function useEmbed(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => isEmbedSearch(window.location.search),
    () => false,
  );
}

export default function CityPage() {
  const embed = useEmbed();
  const [reviewOpen, setReviewOpen] = useState(false);
  const closeReview = useCallback(() => setReviewOpen(false), []);
  const agentMode = useWorld((state) => state.agentMode);
  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white">
      {/* `isolate` gives the canvas its own stacking context, so drei <Html> labels (z-index up to 40
          via zIndexRange) stay inside this layer, below the HUD (z-10) and minimap (z-20). */}
      <div className="absolute inset-0 isolate z-0">
        <World />
      </div>
      <CityReviewBridge />
      <ModuleBoundary name="WorkflowHud">
        <WorkflowHud embed={embed} onReviewOpen={() => setReviewOpen(true)} />
      </ModuleBoundary>
      <ModuleBoundary name="Minimap">
        <Minimap embed={embed} />
      </ModuleBoundary>
      {reviewOpen && <ReviewDrawer onClose={closeReview} source={agentMode === "real" ? "agent" : "simulation"} />}
    </div>
  );
}
