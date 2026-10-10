// Colours and labels shared by the HUD parts.
import type { IncidentKind, IncidentStatus } from "../../store";
import type { CaseState, NodeStatus, Runner } from "./flow";

export const ORANGE = "#ff6a1a";

export const RUNNER_COLOR: Record<Runner, string> = { jev: "#2dd4bf", claude: "#d97757", code: "#9ca3af" };
export const RUNNER_LABEL: Record<Runner, string> = { jev: "Jev", claude: "Claude", code: "Code" };

export const STATUS_COLOR: Record<NodeStatus, string> = {
  start: ORANGE,
  ok: "#34d399",
  ask: "#fbbf24",
  block: "#f43f5e",
  error: "#ef4444",
};

export const STATE_STYLE: Record<CaseState, { label: string; chip: string; bar: string }> = {
  running: { label: "running", chip: "bg-[#ff6a1a]/15 text-[#ff8a4a]", bar: "bg-[#ff6a1a]" },
  awaiting: { label: "needs human", chip: "bg-amber-400/15 text-amber-300", bar: "bg-amber-400" },
  blocked: { label: "blocked", chip: "bg-rose-500/15 text-rose-300", bar: "bg-rose-500" },
  error: { label: "error", chip: "bg-red-500/15 text-red-300", bar: "bg-red-500" },
  closed: { label: "closed", chip: "bg-emerald-400/15 text-emerald-300", bar: "bg-emerald-400" },
};

export const INCIDENT_STATUS_STYLE: Record<Exclude<IncidentStatus, "cleared">, string> = {
  active: "bg-rose-500/15 text-rose-300",
  responding: "bg-sky-400/15 text-sky-300",
  clearing: "bg-amber-400/15 text-amber-300",
};

export const INCIDENT_LABEL: Record<IncidentKind, string> = {
  car_crash: "Car crash",
  truck_crash: "Truck crash",
  roadworks: "Roadworks",
  breakdown: "Breakdown",
};

export const INCIDENT_COLOR: Record<IncidentKind, string> = {
  car_crash: "#f43f5e",
  truck_crash: "#fb7185",
  roadworks: "#fbbf24",
  breakdown: ORANGE,
};
