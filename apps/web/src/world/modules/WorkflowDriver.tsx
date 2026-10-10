"use client";
// Module: WorkflowDriver. Links the city to the REAL agent API; renders nothing. There is no mock agent:
// incidents, grouped delivery delays and staged scenarios go to apps/api POST /api/cases through
// WorkflowDriver/link.ts (FIFO queue, 2 at a time, within the budget guard), and new console runs are
// polled and replayed. While the agent API is offline, cases wait in the queue and nothing is invented.
import { useEffect } from "react";
import { emit, on } from "../bus";
import { useWorld } from "../store";
import { checkAgent, runAgentFull, traceCost } from "../agentBridge";
import { browserFetchJson, ExecutionPoller, loadSharedBudget, POLL_MS, saveSharedBudget } from "../backendLink";
import { allVehicles } from "../registry";
import { budgetLeft } from "./WorkflowDriver/budget";
import { CityAgentLink } from "./WorkflowDriver/link";
import type { Trace } from "../../../../api/src/lib/trace";

function push(e: Omit<import("../store").WorkflowEvent, "id" | "t">) {
  useWorld.getState().pushWorkflow({ ...e, id: `agt-${Math.random().toString(36).slice(2, 10)}`, t: performance.now() });
}

/** Claim one slot from the budget shared by every open city tab. False = over budget (the case waits). */
function claimBudget(): boolean {
  const st = useWorld.getState();
  const shared = loadSharedBudget();
  if (shared) st.syncAgentBudget(shared.starts, shared.spentUsd);
  if (budgetLeft(useWorld.getState().agentBudget, Date.now()) <= 0) return false;
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

function createCityLink(): CityAgentLink {
  return new CityAgentLink({
    runAgent: runAgentFull,
    push,
    emit,
    schedule: (fn, ms) => void setTimeout(fn, ms),
    online: () => useWorld.getState().agentOnline === true,
    claim: claimBudget,
    onSpend: recordSpend,
    onQueue: (queue, running) => useWorld.getState().setAgentQueue(queue, running),
    incident: (id) => useWorld.getState().incidents.find((i) => i.id === id),
    deliveries: () => useWorld.getState().deliveries,
    positions: () => {
      const p: Record<string, { x: number; z: number }> = {};
      for (const v of allVehicles()) p[v.id] = { x: v.object.position.x, z: v.object.position.z };
      return p;
    },
    now: () => Date.now(),
    clock: () => performance.now(),
  });
}

export default function WorkflowDriver() {
  useEffect(() => {
    const link = createCityLink();

    const off = on((ev) => {
      switch (ev.type) {
        case "incident:created":
          link.incident(ev.incidentId);
          return;
        case "delivery:delayed":
          link.delayed(ev.deliveryId, ev.reason);
          return;
        case "scenario:staged":
          link.staged(ev);
          return;
      }
    });

    // Delay groups close after 20 s; the queue also re-pumps as the budget window rolls.
    const tick = setInterval(() => {
      link.flushDelays();
      link.pump();
    }, 2000);

    // Agent API health: every 10 s while offline (cases paused), every 30 s once online.
    let pingTimer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;
    const ping = async () => {
      const ok = await checkAgent();
      if (!alive) return;
      useWorld.getState().setAgentOnline(ok);
      if (ok) link.pump();
      pingTimer = setTimeout(ping, ok ? 30_000 : 10_000);
    };
    void ping();

    // New console runs (Execute, test runs) are replayed as they finish.
    const poller = new ExecutionPoller(browserFetchJson, link.replayedRuns);
    let busy = false;
    const poll = async () => {
      if (busy) return;
      busy = true;
      try {
        for (const ex of await poller.poll()) link.consoleExecution(ex);
      } catch {
        /* console API down: try again next tick */
      } finally {
        busy = false;
      }
    };
    void poll();
    const pollTimer = setInterval(poll, POLL_MS);

    return () => {
      alive = false;
      if (pingTimer) clearTimeout(pingTimer);
      clearInterval(tick);
      clearInterval(pollTimer);
      off();
    };
  }, []);

  return null;
}
