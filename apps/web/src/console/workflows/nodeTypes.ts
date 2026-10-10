// Catalogue of every flow NodeType (apps/api/src/lib/flow.ts): label, palette group, colour, icon
// key, default runners, and named outputs. Descriptions mirror NODE_ROLES in apps/api/src/agent/architect.ts.
import type { NodeType, Runner } from "../types";

export type IconKey =
  | "router" | "box" | "scale" | "map" | "camera" | "heart"
  | "inbox" | "history" | "triage" | "users" | "clash" | "group" | "question"
  | "planner" | "shield" | "person" | "send" | "route" | "check"
  | "log" | "handshake" | "spark";

export type Group = "Watch" | "Understand" | "Judge" | "Plan" | "Control" | "Act" | "Record";

export interface NodeMeta {
  type: NodeType;
  label: string;
  description: string;
  group: Group;
  icon: IconKey;
  color: string; // accent for the icon tile and minimap
  runners: Runner[]; // default runners when dropped from the palette
  /** Named outputs. Absent = a single unnamed output. */
  outputs?: string[];
  defaultConfig?: Record<string, unknown>;
}

export const GATE_OUTPUTS = ["allow", "ask", "block"] as const;

const C = {
  watch: "#38bdf8",
  understand: "#60a5fa",
  judge: "#a78bfa",
  plan: "#ff6a1a",
  control: "#f43f5e",
  act: "#22c55e",
  record: "#94a3b8",
};

export const NODE_META: Record<NodeType, NodeMeta> = {
  event_router: { type: "event_router", label: "Event router", description: "Watch flow. Sends each order update to the right check.", group: "Watch", icon: "router", color: C.watch, runners: ["code"] },
  order_check: { type: "order_check", label: "Order check", description: "Watch flow. Is the order complete and realistic before it leaves.", group: "Watch", icon: "box", color: C.watch, runners: ["jev", "code"] },
  load_check: { type: "load_check", label: "Load check", description: "Watch flow. Is the load on the right vehicle with room for it.", group: "Watch", icon: "scale", color: C.watch, runners: ["code"] },
  on_route_check: { type: "on_route_check", label: "On-route check", description: "Watch flow. Is the delivery running late against its slot.", group: "Watch", icon: "map", color: C.watch, runners: ["code", "ortools"] },
  proof_check: { type: "proof_check", label: "Proof check", description: "Watch flow. Does the proof of delivery match the address.", group: "Watch", icon: "camera", color: C.watch, runners: ["jev", "claude"] },
  aftercare_check: { type: "aftercare_check", label: "Aftercare check", description: "Watch flow. Is a complaint, claim or promise still open.", group: "Watch", icon: "heart", color: C.watch, runners: ["jev"] },

  ingest: { type: "ingest", label: "Ingest", description: "Entry point of an incident. Reads the messages, tickets and files of one case.", group: "Understand", icon: "inbox", color: C.understand, runners: ["code", "claude"] },
  history_lookup: { type: "history_lookup", label: "History lookup", description: "Gathers the full story of the delivery and the people involved.", group: "Understand", icon: "history", color: C.understand, runners: ["code"] },
  triage: { type: "triage", label: "Triage", description: "Case type and urgency.", group: "Judge", icon: "triage", color: C.judge, runners: ["jev"] },
  perspectives: { type: "perspectives", label: "Perspectives", description: "Several reviewers ask narrow questions about the case at once; rules in config turn their answers into notes for the planner or force a human.", group: "Judge", icon: "users", color: C.judge, runners: ["jev", "code"], defaultConfig: { rules: {} } },
  clash_check: { type: "clash_check", label: "Clash check", description: "Finds who said what and whether the accounts conflict.", group: "Judge", icon: "clash", color: C.judge, runners: ["claude", "jev"] },
  group_check: { type: "group_check", label: "Group check", description: "Is this case linked to other open cases with one shared cause.", group: "Judge", icon: "group", color: C.judge, runners: ["jev", "code"] },
  missing_info: { type: "missing_info", label: "Missing info", description: "Is there enough to act, or must someone be asked first.", group: "Judge", icon: "question", color: C.judge, runners: ["jev", "claude"] },

  planner: { type: "planner", label: "Planner", description: "Proposes what to do and writes the messages.", group: "Plan", icon: "planner", color: C.plan, runners: ["claude"] },
  replan_route: { type: "replan_route", label: "Replan route", description: "Moves drops between vehicles. Changes the real world, so it counts as an action.", group: "Plan", icon: "route", color: C.plan, runners: ["ortools", "code"] },

  safety_gate: { type: "safety_gate", label: "Safety gate", description: "Scores the risk of each proposed step; thresholds in config decide allow, ask a human, or block.", group: "Control", icon: "shield", color: C.control, runners: ["jev", "code"], outputs: [...GATE_OUTPUTS], defaultConfig: { allow_below: 0.3, block_above: 0.8 } },
  human_decision: { type: "human_decision", label: "Human decision", description: "Writes the decision card for a person, with a deadline and a safe fallback.", group: "Control", icon: "person", color: C.control, runners: ["claude", "code"] },

  action: { type: "action", label: "Action", description: "Carries out an approved step.", group: "Act", icon: "send", color: C.act, runners: ["code"] },
  verify: { type: "verify", label: "Verify", description: "Checks whether the action worked.", group: "Act", icon: "check", color: C.act, runners: ["jev"] },

  case_log: { type: "case_log", label: "Case log", description: "End point. Records every step, cost and timing.", group: "Record", icon: "log", color: C.record, runners: ["code"] },
  promise_tracker: { type: "promise_tracker", label: "Promise tracker", description: "Logs promises made and chases them before they are late.", group: "Record", icon: "handshake", color: C.record, runners: ["code"] },
  learner: { type: "learner", label: "Learner", description: "Watches human decisions and suggests where the agent could be given more freedom.", group: "Record", icon: "spark", color: C.record, runners: ["claude", "code"] },
};

export const ALL_NODE_TYPES = Object.keys(NODE_META) as NodeType[];
export const GROUP_ORDER: Group[] = ["Watch", "Understand", "Judge", "Plan", "Control", "Act", "Record"];
export const ALL_RUNNERS: Runner[] = ["jev", "claude", "code", "ortools"];

export const RUNNER_STYLE: Record<Runner, { label: string; fg: string; bg: string }> = {
  jev: { label: "Jev", fg: "#c4b5fd", bg: "rgba(167,139,250,0.14)" },
  claude: { label: "Claude", fg: "#f0a27a", bg: "rgba(217,119,87,0.16)" },
  code: { label: "code", fg: "#cbd5e1", bg: "rgba(148,163,184,0.14)" },
  ortools: { label: "OR-Tools", fg: "#86efac", bg: "rgba(34,197,94,0.14)" },
};

export function metaFor(type: string): NodeMeta {
  return (NODE_META as Record<string, NodeMeta>)[type] ?? {
    type: type as NodeType, label: type, description: "Unknown node type", group: "Record",
    icon: "spark", color: C.record, runners: ["code"],
  };
}

/** Palette search: matches label, type, group or description, case-insensitive. */
export function searchNodeTypes(q: string): NodeMeta[] {
  const s = q.trim().toLowerCase();
  const all = ALL_NODE_TYPES.map((t) => NODE_META[t]);
  if (!s) return all;
  return all.filter((m) =>
    [m.label, m.type, m.group, m.description].some((f) => f.toLowerCase().includes(s)));
}
