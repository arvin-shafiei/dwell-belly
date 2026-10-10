"use client";
// Module: WorkflowDriver. Turns city events into workflow cases and pushes their node-by-node progress
// into useWorld.workflow for the HUD. Renders nothing.
// Real first: when the agent API is up (agentMode "real") and the budget guard allows, incidents and staged
// scenarios go to apps/api and their traces are replayed (backendLink.ts). New console runs are polled and
// replayed too. Everything else runs on the mock engine and is tagged SIMULATED.
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { emit, on } from "../bus";
import { useWorld } from "../store";
import { WorkflowEngine } from "./WorkflowDriver/engine";
import { setWorkflowEngine } from "./WorkflowDriver/handle";
import { checkAgent, outcomeOf, runAgentFull, toCaseView, traceCost, traceToTimedEvents, type AgentRunResult, type ReplayMeta } from "../agentBridge";
import {
  browserFetchJson, buildIncidentCase, ExecutionPoller, loadSharedBudget, originOf, POLL_MS, rememberReplay, saveSharedBudget,
} from "../backendLink";
import { allVehicles } from "../registry";
import { getScenario, type Modifier } from "../scenarios";
import type { Trace } from "../../../../api/src/lib/trace";

const MAX_AGENT_RUNS = 2; // concurrent real-agent cases; extra ones fall back to the mock
let agentRuns = 0;
let agentCaseNo = 0;
/** runIds already replayed (city runs and console runs), so nothing is shown twice. */
const replayedRuns = new Set<string>();
/** Console replays waiting for the Scenarios module to stage their scene: scenarioId -> replay state. */
const consoleScenes = new Map<string, { outcome: ReturnType<typeof outcomeOf>; doneAt: number }>();

function push(e: Omit<import("../store").WorkflowEvent, "id" | "t">) {
  useWorld.getState().pushWorkflow({ ...e, id: `agt-${Math.random().toString(36).slice(2, 10)}`, t: performance.now() });
}

/** Claim one real-agent slot from the budget shared by every open city tab. False = use the mock. */
function claimBudget(): boolean {
  const st = useWorld.getState();
  const shared = loadSharedBudget();
  if (shared) st.syncAgentBudget(shared.starts, shared.spentUsd);
  if (!useWorld.getState().claimAgentRun(Date.now())) return false;
  const b = useWorld.getState().agentBudget;
  saveSharedBudget(b.starts, b.spentUsd);
  return true;
}

function recordSpend(trace: Trace) {
  const usd = traceCost(trace);
  if (usd === null) return;
  const st = useWorld.getState();
  const shared = loadSharedBudget();
  const total = Math.max(shared?.spentUsd ?? 0, st.agentBudget.spentUsd) + usd;
  st.syncAgentBudget(shared?.starts ?? [], total);
  saveSharedBudget(useWorld.getState().agentBudget.starts, total);
}

/** Can a real case start now? (mode, health, concurrency; the budget is claimed separately.) */
function realAvailable(): boolean {
  const s = useWorld.getState();
  return s.agentMode === "real" && !!s.agentOnline && agentRuns < MAX_AGENT_RUNS;
}

/** Replay a real trace into the HUD; returns when (ms from now) the last event shows. */
function replay(result: Pick<AgentRunResult, "trace" | "card" | "outbox">, caseLabel: string, meta: ReplayMeta, executionId?: string): number {
  replayedRuns.add(result.trace.runId);
  rememberReplay({ caseLabel, trace: result.trace, card: result.card, outbox: result.outbox, origin: meta.origin, executionId });
  const timed = traceToTimedEvents(result.trace, caseLabel, meta);
  for (const t of timed) setTimeout(() => push(t.event), t.atMs);
  return timed.length ? timed[timed.length - 1].atMs : 0;
}

/** Send a staged scenario to the real agent and replay its trace into the HUD. Returns false if it can't run. */
function tryRealAgent(ev: { runId: string; scenarioId: string; modifiers: Modifier[] }): boolean {
  const scenario = getScenario(ev.scenarioId);
  if (!scenario || !realAvailable() || !claimBudget()) return false;
  agentRuns++;
  agentCaseNo++;
  const caseId = `AGT-${String(agentCaseNo).padStart(3, "0")} · ${ev.scenarioId}`;
  const tag = { source: "agent" as const, origin: "city_scenario" as const };
  push({ caseId, nodeId: "ingest", status: "start", summary: "Sent to the real agent (apps/api), waiting for its trace…", ...tag });
  runAgentFull(toCaseView(scenario, ev.modifiers))
    .then((result) => {
      recordSpend(result.trace);
      const last = replay(result, caseId, { origin: "city_scenario" });
      setTimeout(() => emit({ type: "scenario:resolved", runId: ev.runId, scenarioId: ev.scenarioId, outcome: outcomeOf(result.trace) }), last + 200);
    })
    .catch((err: unknown) => {
      push({ caseId, nodeId: "log", status: "error", summary: `Real agent failed: ${String(err).slice(0, 80)}`, ...tag });
      emit({ type: "scenario:resolved", runId: ev.runId, scenarioId: ev.scenarioId, outcome: "escalated" });
    })
    .finally(() => {
      agentRuns--;
    });
  return true;
}

let incidentCaseNo = 0;

/** Turn a city incident into a synthetic case for the real agent. Returns false if it can't run (mock covers it). */
function tryRealIncident(incidentId: string): boolean {
  const s = useWorld.getState();
  const inc = s.incidents.find((i) => i.id === incidentId);
  if (!inc || !realAvailable() || !claimBudget()) return false;
  agentRuns++;
  incidentCaseNo++;
  const positions: Record<string, { x: number; z: number }> = {};
  for (const v of allVehicles()) positions[v.id] = { x: v.object.position.x, z: v.object.position.z };
  const { view, affected } = buildIncidentCase(inc, s.deliveries, { now: new Date(), seq: incidentCaseNo, positions });
  const caseId = `INC-${String(incidentCaseNo).padStart(3, "0")} · ${inc.kind.replace("_", " ")}`;
  const tag = { source: "agent" as const, origin: "city_incident" as const, synthetic: true };
  const dls = affected.map((d) => d.id).join(", ");
  push({ caseId, nodeId: "ingest", status: "start", summary: `Synthetic case from the city (simulated driver + customer${dls ? `, ${dls}` : ""}) sent to the real agent…`, ...tag });
  runAgentFull(view)
    .then((result) => {
      recordSpend(result.trace);
      replay(result, caseId, { origin: "city_incident", synthetic: true });
    })
    .catch((err: unknown) => {
      push({ caseId, nodeId: "log", status: "error", summary: `Real agent failed: ${String(err).slice(0, 80)}`, ...tag });
    })
    .finally(() => {
      agentRuns--;
    });
  return true;
}

let consoleCaseNo = 0;

/** Poll the console's executions and replay each new finished run (and act its scene out when it has one). */
function startConsolePolling(): () => void {
  const poller = new ExecutionPoller(browserFetchJson, replayedRuns);
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      for (const ex of await poller.poll()) {
        if (!ex.trace) continue;
        consoleCaseNo++;
        const caseId = `RUN-${String(consoleCaseNo).padStart(3, "0")} · ${ex.caseId}`;
        const meta: ReplayMeta = { origin: originOf(ex), synthetic: ex.simulated || ex.trace.synthetic === true };
        const last = replay({ trace: ex.trace, card: ex.card ?? null, outbox: ex.outbox ?? null }, caseId, meta, ex.id);
        if (getScenario(ex.caseId)) {
          consoleScenes.set(ex.caseId, { outcome: outcomeOf(ex.trace), doneAt: performance.now() + last });
          emit({ type: "request:scenario", scenarioId: ex.caseId, modifiers: [] });
        }
      }
    } catch {
      /* console API down or not mounted: try again next tick */
    } finally {
      busy = false;
    }
  };
  void tick();
  const timer = setInterval(tick, POLL_MS);
  return () => clearInterval(timer);
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
      // Every mock event is tagged, so no feed item is ever unlabelled (PRD J0).
      emit: (e) => useWorld.getState().pushWorkflow({ ...e, source: e.source ?? "mock" }),
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
          // Real agent first (synthetic case, within budget); the mock covers the rest.
          if (tryRealIncident(ev.incidentId)) return;
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
        case "scenario:staged": {
          // A console run being acted out: its real trace is already in the feed; just resolve the scene.
          const scene = consoleScenes.get(ev.scenarioId);
          if (scene) {
            consoleScenes.delete(ev.scenarioId);
            const wait = Math.max(1500, scene.doneAt - performance.now());
            setTimeout(() => emit({ type: "scenario:resolved", runId: ev.runId, scenarioId: ev.scenarioId, outcome: scene.outcome }), wait);
            return;
          }
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
      }
    });

    // Is the agent API up? Re-checked every 30 s so the HUD toggle knows whether "real" is available.
    // The first time it answers, the city defaults to the real agent (unless `?agent=mock`); the toggle
    // and the console's remote can still switch it.
    const param = new URLSearchParams(window.location.search).get("agent");
    let defaulted = false;
    const ping = () =>
      checkAgent().then((ok) => {
        useWorld.getState().setAgentOnline(ok);
        if (ok && !defaulted) {
          defaulted = true;
          if (param !== "mock") useWorld.getState().setAgentMode("real");
        }
      });
    ping();
    const pingTimer = setInterval(ping, 30_000);
    if (param === "real") useWorld.getState().setAgentMode("real");
    const stopPolling = startConsolePolling();

    return () => {
      clearInterval(pingTimer);
      stopPolling();
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
