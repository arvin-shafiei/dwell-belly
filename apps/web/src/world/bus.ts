// Tiny event bus for one-off happenings. State lives in store.ts; this is for "something just happened".
export type WorldEvent =
  | { type: "incident:created"; incidentId: string }
  | { type: "incident:cleared"; incidentId: string }
  | { type: "road:blocked"; edgeKey: string; reason: string }
  | { type: "road:reopened"; edgeKey: string }
  | { type: "delivery:delayed"; deliveryId: string; reason: string }
  | { type: "delivery:completed"; deliveryId: string }
  | { type: "vehicle:crashed"; vehicleId: string; incidentId: string }
  // Requests from the UI (demo buttons). The owning module listens and acts.
  | { type: "request:crash"; kind: "car_crash" | "truck_crash" }
  | { type: "request:roadworks" }
  | { type: "request:breakdown" }
  // Scenarios (see scenarios.ts): the HUD fires one; the Scenarios module acts it out in the city and
  // emits scenario:staged with where it happened; the WorkflowDriver turns it into a workflow case.
  | { type: "request:scenario"; scenarioId: string; modifiers: import("./scenarios").Modifier[] }
  | { type: "scenario:staged"; runId: string; scenarioId: string; modifiers: import("./scenarios").Modifier[]; x: number; z: number; vehicleId?: string }
  | { type: "scenario:resolved"; runId: string; scenarioId: string; outcome: "acted" | "asked_for_info" | "escalated" | "blocked" | "no_action" };

type Handler = (e: WorldEvent) => void;
const handlers = new Set<Handler>();

export function emit(e: WorldEvent) {
  for (const h of handlers) h(e);
}

/** Subscribe; returns unsubscribe. Use inside useEffect. */
export function on(h: Handler) {
  handlers.add(h);
  return () => {
    handlers.delete(h);
  };
}
