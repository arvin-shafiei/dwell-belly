"use client";
import dynamic from "next/dynamic";
import { ModuleBoundary } from "./ModuleBoundary";
import WorkflowHud from "./modules/WorkflowHud";
import Minimap from "./modules/Minimap";

// three.js needs the browser, so the canvas is client-only.
const World = dynamic(() => import("./World"), { ssr: false, loading: () => <p className="p-4">Loading city…</p> });

export default function CityPage() {
  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white">
      <World />
      <ModuleBoundary name="WorkflowHud">
        <WorkflowHud />
      </ModuleBoundary>
      <ModuleBoundary name="Minimap">
        <Minimap />
      </ModuleBoundary>
    </div>
  );
}
