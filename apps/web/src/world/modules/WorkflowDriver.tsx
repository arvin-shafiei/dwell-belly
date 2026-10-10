"use client";
// Module: WorkflowDriver. Mock Delivery Ops agent: turns city events into workflow cases and pushes
// their node-by-node progress into useWorld.workflow for the HUD. Renders nothing.
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { emit, on } from "../bus";
import { useWorld } from "../store";
import { WorkflowEngine } from "./WorkflowDriver/engine";
import { setWorkflowEngine } from "./WorkflowDriver/handle";

/** Continue case numbering after a remount (HMR) so ids don't collide in the store. */
function nextCaseNo() {
  let max = 0;
  for (const e of useWorld.getState().workflow) {
    const m = /^CASE-(\d+)/.exec(e.caseId);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

export default function WorkflowDriver() {
  const engineRef = useRef<WorkflowEngine | null>(null);

  useEffect(() => {
    const engine = new WorkflowEngine({
      seed: 2026,
      clock: () => performance.now(),
      emit: (e) => useWorld.getState().pushWorkflow(e),
      // Real scenarios come from the Scenarios module's autoplay; random messages are just filler.
      backgroundMinMs: 45_000,
      backgroundMaxMs: 75_000,
      firstCaseNo: nextCaseNo(),
      idPrefix: `wf${Date.now().toString(36)}`,
      onCaseDone: (c) => {
        if (c.scenarioId && c.runId && c.outcome) {
          emit({ type: "scenario:resolved", runId: c.runId, scenarioId: c.scenarioId, outcome: c.outcome });
        }
      },
    });
    engineRef.current = engine;
    setWorkflowEngine(engine);

    const off = on((ev) => {
      switch (ev.type) {
        case "incident:created": {
          const s = useWorld.getState();
          const inc = s.incidents.find((i) => i.id === ev.incidentId);
          if (!inc) return;
          let live = 0;
          for (const d of Object.values(s.deliveries)) if (d.status === "en_route" || d.status === "delayed") live++;
          engine.incident({
            id: inc.id,
            kind: inc.kind,
            edgeKey: inc.edgeKey,
            note: inc.note,
            affected: live >= 2 ? Math.min(live, 12) : undefined,
          });
          return;
        }
        case "delivery:delayed":
          engine.delayed(ev.deliveryId, ev.reason);
          return;
        case "scenario:staged":
          engine.scenario({
            runId: ev.runId,
            scenarioId: ev.scenarioId,
            modifiers: ev.modifiers,
            x: ev.x,
            z: ev.z,
            vehicleId: ev.vehicleId,
          });
          return;
      }
    });

    return () => {
      off();
      setWorkflowEngine(null);
      engineRef.current = null;
    };
  }, []);

  useFrame((_, delta) => {
    const engine = engineRef.current;
    if (!engine || useWorld.getState().paused) return;
    engine.advance(Math.min(delta, 0.1) * 1000);
  });

  return null;
}
