// Catalogue of every flow NodeType (apps/api/src/lib/flow.ts): label, palette group, colour,
// icon key, default runners, and the named outputs a node exposes on the canvas.
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
  event_router: { type: "event_router", label: "Event router", description: "Routes an incoming delivery event to the right check.", group: "Watch", icon: "router", color: C.watch, runners: ["code"] },
  order_check: { type: "order_check", label: "Order check", description: "Checks the order details are complete and consistent.", group: "Watch", icon: "box", color: C.watch, runners: ["jev", "code"] },
  load_check: { type: "load_check", label: "Load check", description: "Checks the vehicle load against the manifest.", group: "Watch", icon: "scale", color: C.watch, runners: ["code"] },
  on_route_check: { type: "on_route_check", label: "On-route check", description: "Watches progress against the planned route.", group: "Watch", icon: "map", color: C.watch, runners: ["code", "ortools"] },
  proof_check: { type: "proof_check", label: "Proof check", description: "Checks proof of delivery (photo, signature).", group: "Watch", icon: "camera", color: C.watch, runners: ["jev", "claude"] },
  aftercare_check: { type: "aftercare_check", label: "Aftercare check", description: "Follows up after delivery for complaints or damage.", group: "Watch", icon: "heart", color: C.watch, runners: ["jev"] },

  ingest: { type: "ingest", label: "Ingest", description: "Reads every file and attachment in the case.", group: "Understand", icon: "inbox", color: C.understand, runners: ["code", "claude"] },
  history_lookup: { type: "history_lookup", label: "History lookup", description: "Finds open commitments, deadlines and earlier attempts.", group: "Understand", icon: "history", color: C.understand, runners: ["code"] },
  triage: { type: "triage", label: "Triage", description: "Case type and urgency, with a probability.", group: "Judge", icon: "triage", color: C.judge, runners: ["jev"] },
  perspectives: { type: "perspectives", label: "Perspectives", description: "Panel of seats (advocate, rule keeper, safety, sceptic, ops) raising flags.", group: "Judge", icon: "users", color: C.judge, runners: ["jev", "code"], defaultConfig: { rules: {} } },
  clash_check: { type: "clash_check", label: "Clash check", description: "Do the sources contradict each other?", group: "Judge", icon: "clash", color: C.judge, runners: ["claude", "jev"] },
  group_check: { type: "group_check", label: "Group check", description: "Is this case part of a wider incident?", group: "Judge", icon: "group", color: C.judge, runners: ["jev", "code"] },
  missing_info: { type: "missing_info", label: "Missing info", description: "Is anything missing that blocks a decision? Drafts the ask.", group: "Judge", icon: "question", color: C.judge, runners: ["jev", "claude"] },

  planner: { type: "planner", label: "Planner", description: "Writes the next action and what it won't do.", group: "Plan", icon: "planner", color: C.plan, runners: ["claude"] },
  replan_route: { type: "replan_route", label: "Replan route", description: "Re-optimises the route around blocked roads.", group: "Plan", icon: "route", color: C.plan, runners: ["ortools", "code"] },

  safety_gate: { type: "safety_gate", label: "Safety gate", description: "Scores risk; allow, ask a human, or block.", group: "Control", icon: "shield", color: C.control, runners: ["jev", "code"], outputs: [...GATE_OUTPUTS], defaultConfig: { allow_below: 0.3, block_above: 0.8 } },
  human_decision: { type: "human_decision", label: "Human decision", description: "Puts a decision card in front of a person at the desk.", group: "Control", icon: "person", color: C.control, runners: ["claude", "code"] },

  action: { type: "action", label: "Action", description: "Sends the cleared, undoable message.", group: "Act", icon: "send", color: C.act, runners: ["code"] },
  verify: { type: "verify", label: "Verify", description: "Checks the action landed as intended.", group: "Act", icon: "check", color: C.act, runners: ["jev"] },

  case_log: { type: "case_log", label: "Case log", description: "Writes the case record and reasoning.", group: "Record", icon: "log", color: C.record, runners: ["code"] },
  promise_tracker: { type: "promise_tracker", label: "Promise tracker", description: "Tracks promises made to customers and their deadlines.", group: "Record", icon: "handshake", color: C.record, runners: ["code"] },
  learner: { type: "learner", label: "Learner", description: "Learns from outcomes to tune future runs.", group: "Record", icon: "spark", color: C.record, runners: ["claude", "code"] },
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
