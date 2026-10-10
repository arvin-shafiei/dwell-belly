// Pure dispatch planning for emergency responders: who goes, from where, and the route to the scene.
import type { IncidentKind } from "../../store";
import { PLACES, ROAD_EDGES, findPath, getEdge, getNode } from "../../roads";

export type UnitRole = "police" | "ambulance" | "fire" | "tow";
export type Side = "a" | "b"; // which end of the incident edge a unit drives in from

/** A route through road nodes; the unit stops at `stopT` on the final leg nodes[n-2] -> nodes[n-1]. */
export interface Route {
  nodes: string[];
  stopT: number;
}

export interface Approach {
  route: Route;
  side: Side;
  cost: number; // seconds at the speed limit, for comparing options
}

export interface IncidentLike {
  edgeKey: string;
  x: number;
  z: number;
}

export const BASE: Record<UnitRole, string> = {
  police: PLACES.policeStation,
  ambulance: PLACES.hospital,
  fire: PLACES.hospital,
  tow: PLACES.maintenanceYard,
};

/** How far (metres) behind the wreck each unit parks. */
export const GAP_M: Record<UnitRole, number> = { tow: 5.5, police: 10, ambulance: 17, fire: 25 };

/** Seconds after the call before each unit leaves base (so units from one base don't overlap). */
export const LEAVE_DELAY_S: Record<UnitRole, number> = { police: 0, ambulance: 0.4, fire: 2.2, tow: 2.5 };

const HANDLED: ReadonlySet<IncidentKind> = new Set<IncidentKind>(["car_crash", "truck_crash", "breakdown"]);

export function shouldHandle(kind: IncidentKind) {
  return HANDLED.has(kind);
}

export function planDispatch(kind: IncidentKind): UnitRole[] {
  if (!shouldHandle(kind)) return [];
  const roles: UnitRole[] = ["police"];
  if (kind === "car_crash" || kind === "truck_crash") roles.push("ambulance");
  if (kind === "truck_crash") roles.push("fire");
  roles.push("tow");
  return roles;
}

/** Where the incident sits along its edge, as t on e.a -> e.b, kept away from the junctions. */
export function incidentT(edgeKey: string, x: number, z: number) {
  const e = ROAD_EDGES.get(edgeKey);
  if (!e) return 0.5;
  const a = getNode(e.a);
  const b = getNode(e.b);
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz || 1;
  const t = ((x - a.x) * dx + (z - a.z) * dz) / l2;
  return Math.min(0.85, Math.max(0.15, t));
}

function pathTime(path: string[]) {
  let s = 0;
  for (let i = 1; i < path.length; i++) {
    const e = getEdge(path[i - 1], path[i]);
    if (e) s += e.length / e.speedLimit;
  }
  return s;
}

/**
 * Route from `from` to just behind the incident. The incident's own edge is allowed only as the
 * final leg: the approach path to an endpoint treats it as blocked, so a unit never drives through
 * the wreck to reach the other end. Returns null when neither end is reachable.
 */
export function planApproach(
  from: string,
  inc: IncidentLike,
  role: UnitRole,
  blocked: ReadonlySet<string>,
  avoidSide?: Side,
): Approach | null {
  const e = ROAD_EDGES.get(inc.edgeKey);
  if (!e || !ROAD_EDGES.size) return null;
  const avoid = new Set(blocked);
  avoid.add(e.key);
  const tW = incidentT(e.key, inc.x, inc.z);
  const options: Approach[] = [];
  for (const side of ["a", "b"] as const) {
    const end = side === "a" ? e.a : e.b;
    const other = side === "a" ? e.b : e.a;
    let path: string[] | null = null;
    try {
      path = findPath(from, end, avoid);
    } catch {
      path = null;
    }
    if (!path) continue;
    const wreckT = side === "a" ? tW : 1 - tW;
    const stopT = Math.max(0.04, wreckT - GAP_M[role] / e.length);
    options.push({
      route: { nodes: [...path, other], stopT },
      side,
      cost: pathTime(path) + (e.length * stopT) / e.speedLimit,
    });
  }
  if (!options.length) return null;
  options.sort((p, q) => p.cost - q.cost);
  if (avoidSide) {
    const alt = options.find((o) => o.side !== avoidSide);
    if (alt) return alt;
  }
  return options[0];
}

/** Route home: finish the current leg from -> to, then the shortest path to base. */
export function planReturn(from: string, to: string, base: string, blocked: ReadonlySet<string>): Route | null {
  let path: string[] | null = null;
  try {
    path = findPath(to, base, blocked);
  } catch {
    path = null;
  }
  if (!path) return null;
  return { nodes: [from, ...path], stopT: 1 };
}
