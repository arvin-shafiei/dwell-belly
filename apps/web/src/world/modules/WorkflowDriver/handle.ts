// The live engine instance, for overlays (the HUD) that want richer case data or to answer a decision card:
//   getWorkflowEngine()?.cases()  /  getWorkflowEngine()?.decide(caseId, option)
import type { WorkflowEngine } from "./engine";

let current: WorkflowEngine | null = null;

export function setWorkflowEngine(e: WorkflowEngine | null) {
  current = e;
}

export function getWorkflowEngine(): WorkflowEngine | null {
  return current;
}
