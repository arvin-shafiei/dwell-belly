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
  | { type: "request:breakdown" };

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
