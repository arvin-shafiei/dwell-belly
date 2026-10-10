// Flow = a graph of node types from SPEC.md §5. Stored as JSON, run by the runtime, rendered by the web UI.

export type Runner = "code" | "jev" | "claude" | "ortools";

export type NodeType =
  // Watch flow
  | "event_router" | "order_check" | "load_check" | "on_route_check" | "proof_check" | "aftercare_check"
  // Incident flow
  | "ingest" | "history_lookup" | "triage" | "clash_check" | "group_check" | "missing_info"
  | "planner" | "safety_gate" | "human_decision" | "action" | "replan_route" | "verify"
  | "case_log" | "promise_tracker" | "learner";

export interface FlowNode {
  id: string;
  type: NodeType;
  runs_on: Runner[];
  config?: Record<string, unknown>;
}

export interface FlowEdge {
  from: string;
  to: string;
  when?: string;
}

export interface Flow {
  id: string;
  name: string;
  business: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}
