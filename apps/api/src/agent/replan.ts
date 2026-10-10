// Route replanning for when a van drops out. This is a greedy heuristic, not an optimiser: it takes
// the stranded drops most urgent first and gives each to the nearest van that can still take it. It
// does not reorder a van's existing route, does not swap drops between healthy vans, and can leave a
// drop unassigned that a real solver would place. It proposes moves; it does not carry them out.
//
// The practice data has no order stream and no fleet data, so the drops and vans are whatever the
// caller supplies (the demo uses a small made-up fleet). Distances are straight-line, travel time is
// distance over an assumed speed, and a moved drop is appended after the receiving van's current work.
// The same input always gives the same output: every ordering has an id tie-break.

const EARTH_RADIUS_KM = 6371;
const MINUTE_MS = 60_000;

export interface Drop {
  id: string;
  /** The van currently carrying this drop. */
  vanId: string;
  lat: number;
  lng: number;
  slotStart: string;
  slotEnd: string;
  weightKg: number;
  chilled?: boolean;
}

export interface Van {
  id: string;
  available: boolean;
  chilled: boolean;
  capacityKg: number;
  loadKg: number;
  /** Where the van will be when it can take extra work. */
  lat: number;
  lng: number;
  /** Driver minutes left beyond the van's current route. */
  driverMinutesLeft: number;
  /** ISO time the van can start extra work. Defaults to now. */
  freeAt?: string;
}

export interface ReplanOptions {
  /** ISO time. Required, so the result never depends on the wall clock. */
  now: string;
  speedKph?: number;
  serviceMinutes?: number;
}

export interface ReplanResult {
  ok: boolean;
  error?: string;
  moves: { dropId: string; from: string; to: string }[];
  unassigned: { dropId: string; reason: string }[];
}

interface VanState {
  van: Van;
  lat: number;
  lng: number;
  freeAt: number;
  loadKg: number;
  minutesLeft: number;
}

function time(iso: unknown): number | null {
  // Date.parse alone reads "run 5" as a date.
  if (typeof iso !== "string" || !/^\s*\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const numbers = (...values: unknown[]) => values.every((v) => typeof v === "number" && Number.isFinite(v));
const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function usableVan(v: Van): boolean {
  return !!v && typeof v.id === "string" && numbers(v.lat, v.lng, v.capacityKg, v.loadKg, v.driverMinutesLeft);
}

/** Why this van cannot take the drop, or the cost of taking it. */
function fit(
  drop: Drop, state: VanState, slotStart: number, slotEnd: number, speedKph: number, serviceMinutes: number,
): { reject: string } | { km: number; done: number; minutes: number } {
  if (drop.chilled && !state.van.chilled) return { reject: "not chilled" };
  if (state.loadKg + drop.weightKg > state.van.capacityKg) return { reject: "over capacity" };
  const km = kmBetween(state, drop);
  const arrival = state.freeAt + (km / speedKph) * 60 * MINUTE_MS;
  if (arrival > slotEnd) return { reject: "would miss the slot" };
  // Arriving early means waiting for the slot to open, and that wait is driver time too.
  const done = Math.max(arrival, slotStart) + serviceMinutes * MINUTE_MS;
  const minutes = (done - state.freeAt) / MINUTE_MS;
  if (minutes > state.minutesLeft) return { reject: "not enough driver hours" };
  return { km, done, minutes };
}

/**
 * Moves drops off unavailable (or unlisted) vans. Never throws: bad options come back as ok=false,
 * and a drop with unusable data is listed as unassigned with the reason.
 */
export function replan(drops: Drop[], vans: Van[], options: ReplanOptions): ReplanResult {
  const result: ReplanResult = { ok: true, moves: [], unassigned: [] };
  try {
    const now = time(options?.now);
    const speedKph = options?.speedKph ?? 30;
    const serviceMinutes = options?.serviceMinutes ?? 5;
    if (now === null) return { ...result, ok: false, error: "options.now is not a readable time" };
    if (!numbers(speedKph, serviceMinutes) || speedKph <= 0 || serviceMinutes < 0) {
      return { ...result, ok: false, error: "speedKph must be above zero and serviceMinutes must not be negative" };
    }
    if (!Array.isArray(drops) || !Array.isArray(vans)) return { ...result, ok: false, error: "drops and vans must be lists" };

    const listed = vans.filter(usableVan);
    const working = new Set(listed.filter((v) => v.available).map((v) => v.id));
    const states: VanState[] = listed
      .filter((v) => v.available)
      .sort((a, b) => byId(a.id, b.id))
      .map((van) => ({ van, lat: van.lat, lng: van.lng, freeAt: Math.max(now, time(van.freeAt) ?? now), loadKg: van.loadKg, minutesLeft: van.driverMinutesLeft }));

    for (const d of drops) {
      if (d && typeof d.id !== "string" && !working.has(d.vanId)) result.unassigned.push({ dropId: String(d.id ?? "unknown"), reason: "drop has no usable id" });
    }
    const stranded = drops
      .filter((d) => d && typeof d.id === "string" && !working.has(d.vanId))
      .map((drop) => ({ drop, slotStart: time(drop.slotStart), slotEnd: time(drop.slotEnd) }))
      .sort((a, b) => (a.slotEnd ?? Infinity) - (b.slotEnd ?? Infinity) || byId(a.drop.id, b.drop.id));

    for (const { drop, slotStart, slotEnd } of stranded) {
      if (slotStart === null || slotEnd === null || slotEnd < slotStart || !numbers(drop.lat, drop.lng, drop.weightKg) || drop.weightKg < 0) {
        result.unassigned.push({ dropId: drop.id, reason: "drop has no usable position, weight or slot" });
        continue;
      }
      if (!states.length) {
        result.unassigned.push({ dropId: drop.id, reason: "no van is available" });
        continue;
      }
      let best: { state: VanState; km: number; done: number; minutes: number } | null = null;
      const rejects: Record<string, number> = {};
      for (const state of states) {
        const f = fit(drop, state, slotStart, slotEnd, speedKph, serviceMinutes);
        if ("reject" in f) rejects[f.reject] = (rejects[f.reject] ?? 0) + 1;
        // Strictly nearer wins, so on a tie the lower van id (earlier in the list) keeps the drop.
        else if (!best || f.km < best.km) best = { state, km: f.km, done: f.done, minutes: f.minutes };
      }
      if (!best) {
        const why = Object.keys(rejects).sort().map((r) => `${r} (${rejects[r]})`).join(", ");
        result.unassigned.push({ dropId: drop.id, reason: `no van can take it: ${why}` });
        continue;
      }
      const s = best.state;
      s.lat = drop.lat;
      s.lng = drop.lng;
      s.freeAt = best.done;
      s.loadKg += drop.weightKg;
      s.minutesLeft -= best.minutes;
      result.moves.push({ dropId: drop.id, from: String(drop.vanId), to: s.van.id });
    }
    return result;
  } catch (err) {
    return { ok: false, error: `replan failed: ${err instanceof Error ? err.message : String(err)}`, moves: [], unassigned: [] };
  }
}
