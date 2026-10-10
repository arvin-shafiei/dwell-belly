// Pure helpers for the console City tab: control catalogues, connection state, formatting, filters.
import type { CityCommand, CityTelemetry } from "../../world/controlChannel";

export type WeatherChoice = Extract<CityCommand, { type: "weather" }>["weather"];
export type InjectEvent = Extract<CityCommand, { type: "inject" }>["event"];

export const WEATHERS: { id: WeatherChoice; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "clear", label: "Clear" },
  { id: "overcast", label: "Overcast" },
  { id: "drizzle", label: "Drizzle" },
  { id: "rain", label: "Rain" },
  { id: "storm", label: "Storm" },
];

export const TIME_PRESETS: { label: string; hour: number }[] = [
  { label: "Dawn", hour: 6 },
  { label: "Noon", hour: 12 },
  { label: "Golden", hour: 18.5 },
  { label: "Night", hour: 22.5 },
];

export const SPEEDS = [1, 3, 10, 30] as const;

export const INJECTORS: { event: InjectEvent; label: string; hint: string; tone: "red" | "amber" | "blue" }[] = [
  { event: "car_crash", label: "Car crash", hint: "Two cars, one lane blocked", tone: "red" },
  { event: "truck_crash", label: "Truck crash", hint: "Rivet truck, road closed", tone: "red" },
  { event: "pileup", label: "Pileup", hint: "Multi-vehicle, major closure", tone: "red" },
  { event: "roadworks", label: "Roadworks", hint: "Crew closes a road", tone: "amber" },
  { event: "breakdown", label: "Van breakdown", hint: "Delivery van stalls", tone: "amber" },
  { event: "emergency_landing", label: "Emergency landing", hint: "Airport, responders roll", tone: "amber" },
  { event: "plane_crash", label: "Plane crash", hint: "Cargo jet down in town", tone: "red" },
  { event: "chase", label: "Police chase", hint: "Pursuit through downtown", tone: "blue" },
];

/** Telemetry counts as live if a snapshot arrived within this window (city posts every 1 s). */
export const STALE_MS = 3000;

export type LinkState = "waiting" | "live" | "stale";

export function linkState(last: CityTelemetry | null, now: number): LinkState {
  if (!last) return "waiting";
  return now - last.at <= STALE_MS ? "live" : "stale";
}

/** 17.5 -> "17:30". */
export function formatHour(h: number): string {
  const wrapped = ((h % 24) + 24) % 24;
  let hh = Math.floor(wrapped);
  let mm = Math.round((wrapped - hh) * 60);
  if (mm === 60) {
    mm = 0;
    hh = (hh + 1) % 24;
  }
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * REAL: the real agent's trace, a live human, a real audio attachment or a case file.
 * SIMULATED: the mock engine (no source / "mock") and simulated personas.
 */
const REAL_SOURCES = new Set(["agent", "live_human", "audio_attachment", "case_file"]);
export function sourceTag(source: string | undefined): "REAL" | "SIMULATED" {
  return source && REAL_SOURCES.has(source) ? "REAL" : "SIMULATED";
}

/** Case-insensitive match on id, title, scene and where. Empty query returns everything. */
export function filterScenarios<T extends { id: string; title: string; scene: string; where: string }>(list: readonly T[], q: string): T[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [...list];
  return list.filter((s) => `${s.id} ${s.title} ${s.scene} ${s.where}`.toLowerCase().includes(needle));
}

/** Delivery bars: each status with its share of the total (0..1). */
export function deliveryBars(d: CityTelemetry["deliveries"]) {
  const order: (keyof CityTelemetry["deliveries"])[] = ["en_route", "loading", "delayed", "delivered", "failed"];
  const total = order.reduce((n, k) => n + d[k], 0);
  return order.map((k) => ({ key: k, count: d[k], share: total ? d[k] / total : 0 }));
}

/** Vehicle kinds sorted by count, largest first. */
export function vehicleRows(v: Record<string, number>) {
  return Object.entries(v).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function isTelemetry(m: unknown): m is CityTelemetry {
  return !!m && typeof m === "object" && (m as { type?: unknown }).type === "telemetry" && typeof (m as { at?: unknown }).at === "number";
}
