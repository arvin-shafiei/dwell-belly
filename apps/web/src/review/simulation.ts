import type { WorkflowEngine } from "../world/modules/WorkflowDriver/engine";
import type { ReviewTask } from "./types";

/** This adapter is explicitly simulated; it never writes to the real runner's files. */
export function simulationTasks(engine: WorkflowEngine, sessionId: string, now: number): ReviewTask[] {
  return engine.cases().flatMap((c) => {
    const card = c.decision;
    if (!card || (c.state !== "awaiting_human" && !card.chosen)) return [];
    const step = (node: string) => c.steps.find((s) => s.nodeId === node)?.summary ?? "";
    const priority = step("triage");
    const urgency = priority.includes("high") ? "high" : priority.includes("low") ? "low" : "medium";
    const deadlineAt = new Date(now + Math.max(0, (card.deadlineAt ?? engine.now) - engine.now)).toISOString();
    const options = card.options.map((label, i) => ({ id: `option-${i + 1}`, label, undoable: label === card.safe }));
    const chosen = options.find((o) => o.label === card.chosen);
    const routeTo = /hazard|medical|injur|plane|cold|temperature/i.test(`${c.title} ${priority}`) ? "On-call lead"
      : /damag|refund|claim|replacement/i.test(`${c.title} ${priority}`) ? "Claims team" : "Depot manager";
    return [{
      id: `simulation:${sessionId}:${c.id}`, caseId: c.id, runId: sessionId, cardId: `simulation:${sessionId}:${c.id}`,
      title: c.title, summary: step("planner") || c.title, mustDecide: "The simulated agent paused at its safety gate. Choose what it should do next.", evidence: [],
      routeTo, clash: c.clash ? step("clash") : null,
      tried: [step("history"), step("group"), step("missing_info")].filter(Boolean),
      wouldChangeMyMind: step("missing_info") || "Confirmation from the owning delivery team.",
      options, fallback: card.safe,
      receivedAt: new Date(now - (engine.now - c.createdAt)).toISOString(), deadlineAt,
      urgency, risk: c.risk, status: chosen ? "resolved" : "pending",
      decision: chosen ? { optionId: chosen.id, optionLabel: chosen.label, who: card.auto ? "Simulation fallback" : "Simulation reviewer", note: "", at: new Date(now).toISOString(), execution: "simulation" } : null,
      simulated: true, mode: "demo", origin: "city", messages: [],
      timeline: c.steps.map((s) => ({ node: s.nodeId, summary: s.summary, status: s.status })), costUsd: c.costUsd, durationMs: null,
    } satisfies ReviewTask];
  });
}
