"use client";
// Console tab: Evidence grid (PRD J0): every tested case across every dataset. Grid lives in ../evidence/.
import { Suspense } from "react";
import EvidenceGrid from "../evidence/EvidenceGrid";

export default function EvidenceTab() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-white/50">Loading evidence…</div>}>
      <EvidenceGrid />
    </Suspense>
  );
}
