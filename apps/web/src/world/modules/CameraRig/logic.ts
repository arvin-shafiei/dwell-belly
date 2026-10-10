// Pure camera helpers for CameraRig (no three.js, testable).
import { ZONES, type ZoneName } from "../../config";
import type { IncidentKind, IncidentStatus } from "../../store";

/** Hotkeys for the HUD to list. */
export const HOTKEYS: readonly { keys: string; action: string }[] = [
  { keys: "WASD / Arrows", action: "Pan" },
  { keys: "Q / E", action: "Rotate" },
  { keys: "R / F", action: "Zoom in / out" },
  { keys: "1-5", action: "Downtown, Docks, Countryside, Depot, Suburbs" },
  { keys: "V", action: "Follow a random delivery van" },
  { keys: "C", action: "Toggle cinematic tour" },
  { keys: "Esc", action: "Release follow / stop tour" },
  { keys: "Click vehicle / ground", action: "Follow / release" },
];

export const ZONE_KEYS: readonly ZoneName[] = ["downtown", "docks", "countryside", "depot", "suburbs"];

export const MIN_DIST = 25;
export const MAX_DIST = 900;
export const MAX_POLAR = 1.35;

export function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function easeInOutCubic(t: number) {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Camera position looking at (tx,ty,tz) from `azimuth` (0 = +z side), `elevation` above the ground plane, at `distance`. */
export function framePosition(
  tx: number, ty: number, tz: number, azimuth: number, elevation: number, distance: number,
): [number, number, number] {
  const h = Math.cos(elevation) * distance;
  return [tx + Math.sin(azimuth) * h, ty + Math.sin(elevation) * distance, tz + Math.cos(azimuth) * h];
}

/** Centre and a pleasant viewing distance for a zone. */
export function zoneFrame(zone: ZoneName) {
  const b = ZONES[zone];
  const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
  return { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2, distance: clamp(span * 1.15, 120, 520) };
}

export interface TourIncident {
  id: string;
  kind: IncidentKind;
  x: number;
  z: number;
  status: IncidentStatus;
  createdAt: number;
}

export type TourShot =
  | { kind: "incident"; id: string; x: number; z: number }
  | { kind: "chase" }
  | { kind: "skyline" }
  | { kind: "docks" }
  | { kind: "roadworks" };

const SCENIC: readonly TourShot["kind"][] = ["chase", "skyline", "docks", "roadworks"];

/**
 * Next tour shot. Odd steps show an active incident (newest not yet shown, else newest);
 * everything else cycles the scenic shots.
 */
export function pickTourShot(step: number, incidents: readonly TourIncident[], shown: ReadonlySet<string>): TourShot {
  if (step % 2 === 1) {
    const active = incidents.filter((i) => i.status !== "cleared").sort((a, b) => b.createdAt - a.createdAt);
    const pick = active.find((i) => !shown.has(i.id)) ?? active[0];
    if (pick) return { kind: "incident", id: pick.id, x: pick.x, z: pick.z };
  }
  const k = SCENIC[Math.floor(step / (incidents.some((i) => i.status !== "cleared") ? 2 : 1)) % SCENIC.length];
  return { kind: k } as TourShot;
}
