"use client";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import CityReviewBridge from "../review/CityReviewBridge";
import ReviewDrawer from "../review/ReviewDrawer";
import { useWorld } from "./store";
import { ModuleBoundary } from "./ModuleBoundary";
import WorkflowHud from "./modules/WorkflowHud";
import Minimap from "./modules/Minimap";

// three.js needs the browser, so the canvas is client-only.
const World = dynamic(() => import("./World"), { ssr: false, loading: () => <p className="p-4">Loading city…</p> });

export default function CityPage() {
  const [reviewOpen, setReviewOpen] = useState(false);
  const closeReview = useCallback(() => setReviewOpen(false), []);
  const agentMode = useWorld((state) => state.agentMode);
  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white">
      <World />
      <CityReviewBridge />
      <ModuleBoundary name="WorkflowHud">
        <WorkflowHud onReviewOpen={() => setReviewOpen(true)} />
      </ModuleBoundary>
      <ModuleBoundary name="Minimap">
        <Minimap />
      </ModuleBoundary>
      {reviewOpen && <ReviewDrawer onClose={closeReview} source={agentMode === "real" ? "agent" : "simulation"} />}
    </div>
  );
}
