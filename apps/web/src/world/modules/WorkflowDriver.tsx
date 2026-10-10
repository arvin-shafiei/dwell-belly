"use client";
// Module: WorkflowDriver. Mock Delivery Ops agent: turns city events into workflow cases and pushes
// their node-by-node progress into useWorld.workflow for the HUD. Renders nothing.
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { emit, on } from "../bus";
import { useWorld } from "../store";
import { WorkflowEngine } from "./WorkflowDriver/engine";
import { setWorkflowEngine } from "./WorkflowDriver/handle";
import { checkAgent, outcomeOf, runAgent, toCaseView, traceToTimedEvents } from "../agentBridge";
import { getScenario, type Modifier } from "../scenarios";

const MAX_AGENT_RUNS = 2; // concurrent real-agent cases; extra scenarios fall back to the mock
let agentRuns = 0;
let agentCaseNo = 0;

function push(e: Omit<import("../store").WorkflowEvent, "id" | "t">) {
  useWorld.getState().pushWorkflow({ ...e, id: `agt-${Math.random().toString(36).slice(2, 10)}`, t: performance.now() });
}

/** Send a staged scenario to the real agent and replay its trace into the HUD. Returns false if it can't run. */
function tryRealAgent(ev: { runId: string; scenarioId: string; modifiers: Modifier[] }): boolean {
  const s = useWorld.getState();
  const scenario = getScenario(ev.scenarioId);
  if (s.agentMode !== "real" || !s.agentOnline || !scenario || agentRuns >= MAX_AGENT_RUNS) return false;
  agentRuns++;
  agentCaseNo++;
  const caseId = `AGT-${String(agentCaseNo).padStart(3, "0")} · ${ev.scenarioId}`;
  push({ caseId, nodeId: "ingest", status: "start", summary: "Sent to the real agent (apps/api), waiting for its trace…", source: "agent" });
  runAgent(toCaseView(scenario, ev.modifiers))
    .then((trace) => {
      const timed = traceToTimedEvents(trace, caseId);
      for (const t of timed) setTimeout(() => push(t.event), t.atMs);
      const last = timed.length ? timed[timed.length - 1].atMs : 0;
      setTimeout(() => emit({ type: "scenario:resolved", runId: ev.runId, scenarioId: ev.scenarioId, outcome: outcomeOf(trace) }), last + 200);
    })
    .catch((err: unknown) => {
      push({ caseId, nodeId: "log", status: "error", summary: `Real agent failed: ${String(err).slice(0, 80)}`, source: "agent" });
      emit({ type: "scenario:resolved", runId: ev.runId, scenarioId: ev.scenarioId, outcome: "escalated" });
    })
    .finally(() => {
      agentRuns--;
    });
  return true;
}

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
      // The human desk needs an operational deadline, not a six-second demo timer.
      humanTimeoutMs: 15 * 60_000,
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
          if (tryRealAgent(ev)) return;
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

    // Is the agent API up? Re-checked every 30 s so the HUD toggle knows whether "real" is available.
    const ping = () => checkAgent().then((ok) => useWorld.getState().setAgentOnline(ok));
    ping();
    const pingTimer = setInterval(ping, 30_000);
    if (new URLSearchParams(window.location.search).get("agent") === "real") useWorld.getState().setAgentMode("real");

    return () => {
      clearInterval(pingTimer);
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
