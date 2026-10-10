// Shared world state (low-frequency things only). Per-frame positions live in registry.ts, not here.
import { create } from "zustand";

export type IncidentKind =
  | "car_crash" | "truck_crash" | "pileup" | "roadworks" | "breakdown" | "plane_crash" | "emergency_landing";
export type IncidentStatus = "active" | "responding" | "clearing" | "cleared";

export interface Incident {
  id: string;
  kind: IncidentKind;
  edgeKey: string; // the road it blocks
  x: number;
  z: number;
  status: IncidentStatus;
  createdAt: number; // performance.now() ms
  note: string; // one line for the HUD, e.g. "Van V-12 crashed into a car on King St"
}

export interface WorkflowEvent {
  id: string;
  t: number; // performance.now() ms
  caseId: string; // e.g. "CASE-0042"
  nodeId: string; // flow node id from apps/api/flows/default-incident.json, e.g. "triage"
  status: "start" | "ok" | "ask" | "block" | "error";
  summary: string;
}

export interface Delivery {
  id: string; // "DL-1042"
  truckId: string;
  stop: string; // road node id
  status: "loading" | "en_route" | "delayed" | "delivered" | "failed";
  etaS: number; // seconds of sim time remaining (rough)
}

interface WorldState {
  /** Roads closed right now: edgeKey -> reason. Read with blockedSet(). */
  blocked: Record<string, string>;
  incidents: Incident[];
  deliveries: Record<string, Delivery>;
  workflow: WorkflowEvent[]; // newest last, capped at 200
  selectedVehicle: string | null; // camera follows this vehicle id
  focus: { x: number; z: number } | null; // camera flies here (e.g. an incident)
  timeOfDay: number; // 0..24 hours
  paused: boolean;

  blockEdge: (key: string, reason: string) => void;
  unblockEdge: (key: string) => void;
  addIncident: (i: Incident) => void;
  updateIncident: (id: string, patch: Partial<Incident>) => void;
  upsertDelivery: (d: Delivery) => void;
  pushWorkflow: (e: WorkflowEvent) => void;
  select: (vehicleId: string | null) => void;
  setFocus: (f: { x: number; z: number } | null) => void;
  setTimeOfDay: (h: number) => void;
  setPaused: (p: boolean) => void;
}

export const useWorld = create<WorldState>((set) => ({
  blocked: {},
  incidents: [],
  deliveries: {},
  workflow: [],
  selectedVehicle: null,
  focus: null,
  timeOfDay: 17.5,
  paused: false,

  blockEdge: (key, reason) => set((s) => ({ blocked: { ...s.blocked, [key]: reason } })),
  unblockEdge: (key) =>
    set((s) => {
      const next = { ...s.blocked };
      delete next[key];
      return { blocked: next };
    }),
  addIncident: (i) => set((s) => ({ incidents: [...s.incidents.slice(-49), i] })),
  updateIncident: (id, patch) =>
    set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
  upsertDelivery: (d) => set((s) => ({ deliveries: { ...s.deliveries, [d.id]: d } })),
  pushWorkflow: (e) => set((s) => ({ workflow: [...s.workflow.slice(-199), e] })),
  select: (selectedVehicle) => set({ selectedVehicle }),
  setFocus: (focus) => set({ focus }),
  setTimeOfDay: (timeOfDay) => set({ timeOfDay }),
  setPaused: (paused) => set({ paused }),
}));

/** Current blocked edges as a Set, for findPath(). Call inside useFrame via useWorld.getState(). */
export function blockedSet(): Set<string> {
  return new Set(Object.keys(useWorld.getState().blocked));
}
