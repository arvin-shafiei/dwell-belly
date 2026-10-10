// Airport fire service: two crash tenders and an ambulance. Airside they cross the grass; to a crash off the
// airfield they drive the public road graph (left-hand lanes) and finish off-road next to the wreck.
import { edgeKey, findPath, getNode, lanePosition } from "../../roads";
import {
  CREW_EAST_X,
  CREW_HOMES,
  CREW_NORTH_Z,
  CREW_WEST_X,
  SERVICE_ROAD_Z,
  type CrashSite,
} from "./layout";
import { Path, roundCorners, v3, type V3 } from "./path";

export type CrewKind = "fire" | "ambulance";
export type CrewState = "home" | "out" | "onscene" | "returning";

export interface RoadSeg {
  d0: number;
  d1: number;
  from: string;
  to: string;
}

export interface CrewUnit {
  id: string;
  kind: CrewKind;
  index: number;
  home: { x: number; z: number; yaw: number };
  state: CrewState;
  path: Path | null;
  segs: RoadSeg[];
  d: number;
  speed: number;
  vmax: number;
  delay: number;
  x: number;
  z: number;
  yaw: number;
  /** Point the unit faces / sprays at once on scene. */
  target: V3 | null;
  spraying: boolean;
  /** live road position for the registry */
  from: string | null;
  to: string | null;
  t: number;
}

const ROAD_NODE = "airport_terminal";
const tmp = v3(0, 0, 0);

export function makeCrew(): CrewUnit[] {
  return CREW_HOMES.map((h, i) => ({
    id: i < 2 ? `ARFF-${i + 1}` : "AMB-AP",
    kind: i < 2 ? "fire" : "ambulance",
    index: i,
    home: { ...h },
    state: "home",
    path: null,
    segs: [],
    d: 0,
    speed: 0,
    vmax: 14,
    delay: 0,
    x: h.x,
    z: h.z,
    yaw: h.yaw,
    target: null,
    spraying: false,
    from: null,
    to: null,
    t: 0,
  }));
}

const flat = (x: number, z: number) => v3(x, 0, z);

/** Airside: west around the station, north past the runway threshold, east along the north strip. */
export function airsideOut(u: CrewUnit, dest: { x: number; z: number }): V3[] {
  return [
    flat(u.x, u.z),
    flat(u.x, u.z - 6),
    flat(CREW_WEST_X, u.z - 10),
    flat(CREW_WEST_X, CREW_NORTH_Z + u.index * 1.5),
    flat(dest.x - 12, CREW_NORTH_Z + u.index * 1.5),
    flat(dest.x, dest.z),
  ];
}

export function airsideBack(u: CrewUnit): V3[] {
  const h = u.home;
  return [
    flat(u.x, u.z),
    flat(u.x - 10, CREW_NORTH_Z + u.index * 1.5),
    flat(CREW_WEST_X, CREW_NORTH_Z + u.index * 1.5),
    flat(CREW_WEST_X, h.z - 10),
    flat(h.x, h.z - 8),
    flat(h.x, h.z),
  ];
}

/** Lane points along a node path, with the distance ranges of each road edge (measured on the raw polyline). */
function lanePoints(nodes: string[], pts: V3[], segs: RoadSeg[]) {
  let d = polyLen(pts);
  for (let i = 0; i + 1 < nodes.length; i++) {
    const [ax, az] = lanePosition(nodes[i], nodes[i + 1], 0);
    const [bx, bz] = lanePosition(nodes[i], nodes[i + 1], 1);
    const last = pts[pts.length - 1];
    d += Math.hypot(ax - last.x, az - last.z);
    pts.push(flat(ax, az));
    const len = Math.hypot(bx - ax, bz - az);
    segs.push({ d0: d, d1: d + len, from: nodes[i], to: nodes[i + 1] });
    d += len;
    pts.push(flat(bx, bz));
  }
}

function polyLen(pts: V3[]) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return l;
}

/** The end of the closed edge the crews come in from, and how far along it they can drive. */
export function approachNode(site: CrashSite, blocked: ReadonlySet<string>) {
  const key = edgeKey(site.a, site.b);
  const open = new Set(blocked);
  open.delete(key);
  let best: { node: string; other: string; nodes: string[] } | null = null;
  let bestLen = Infinity;
  for (const [n, o] of [
    [site.a, site.b],
    [site.b, site.a],
  ]) {
    const nodes = findPath(ROAD_NODE, n, open);
    if (!nodes || nodes.includes(o)) continue;
    let len = 0;
    for (let i = 1; i < nodes.length; i++) {
      const p = getNode(nodes[i - 1]);
      const q = getNode(nodes[i]);
      len += Math.hypot(p.x - q.x, p.z - q.z);
    }
    if (len < bestLen) {
      bestLen = len;
      best = { node: n, other: o, nodes };
    }
  }
  return best;
}

/** Projection of the site onto edge node->other, as t in 0..1. */
function siteT(node: string, other: string, site: CrashSite) {
  const a = getNode(node);
  const b = getNode(other);
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz || 1;
  return Math.min(1, Math.max(0, ((site.x - a.x) * dx + (site.z - a.z) * dz) / l2));
}

/** Where each unit parks around the wreck: short of it on the approach side, fanned out. */
export function standoff(site: CrashSite, node: string, index: number): { x: number; z: number } {
  const n = getNode(node);
  const dx = n.x - site.x;
  const dz = n.z - site.z;
  const l = Math.hypot(dx, dz) || 1;
  const ux = dx / l;
  const uz = dz / l;
  const side = (index - 1) * 10;
  const back = index === 2 ? 30 : 17;
  return { x: site.x + ux * back - uz * side, z: site.z + uz * back + ux * side };
}

export interface RoadRoute {
  pts: V3[];
  segs: RoadSeg[];
}

/** Station -> service road -> road graph -> along the closed edge -> off-road standoff. */
export function roadOut(u: CrewUnit, site: CrashSite, blocked: ReadonlySet<string>): RoadRoute | null {
  const ap = approachNode(site, blocked);
  if (!ap) return null;
  const pts: V3[] = [
    flat(u.x, u.z),
    flat(CREW_EAST_X, u.z),
    flat(CREW_EAST_X, SERVICE_ROAD_Z - 1.5),
    flat(getNode(ROAD_NODE).x - 6, SERVICE_ROAD_Z - 1.5),
  ];
  const segs: RoadSeg[] = [];
  lanePoints(ap.nodes, pts, segs);
  const t = Math.max(0, siteT(ap.node, ap.other, site) - 26 / Math.max(1, edgeLen(ap.node, ap.other)));
  const [ex, ez] = lanePosition(ap.node, ap.other, t);
  const d0 = polyLen(pts);
  pts.push(flat(ex, ez));
  segs.push({ d0, d1: polyLen(pts), from: ap.node, to: ap.other });
  const so = standoff(site, ap.node, u.index);
  pts.push(flat(so.x, so.z));
  return { pts, segs };
}

function edgeLen(a: string, b: string) {
  const p = getNode(a);
  const q = getNode(b);
  return Math.hypot(p.x - q.x, p.z - q.z);
}

/** Back from the wreck to the station by road. */
export function roadBack(u: CrewUnit, site: CrashSite, blocked: ReadonlySet<string>): RoadRoute | null {
  const ap = approachNode(site, blocked);
  if (!ap) return null;
  const pts: V3[] = [flat(u.x, u.z)];
  const t = Math.max(0, siteT(ap.node, ap.other, site) - 26 / Math.max(1, edgeLen(ap.node, ap.other)));
  const [ex, ez] = lanePosition(ap.other, ap.node, 1 - t);
  pts.push(flat(ex, ez));
  const segs: RoadSeg[] = [{ d0: polyLen(pts), d1: 0, from: ap.other, to: ap.node }];
  const [nx, nz] = lanePosition(ap.other, ap.node, 1);
  pts.push(flat(nx, nz));
  segs[0].d1 = polyLen(pts);
  const back = [...ap.nodes].reverse();
  lanePoints(back, pts, segs);
  pts.push(flat(getNode(ROAD_NODE).x - 6, SERVICE_ROAD_Z + 1.5));
  pts.push(flat(CREW_EAST_X + 3, SERVICE_ROAD_Z + 1.5));
  pts.push(flat(CREW_EAST_X + 3, u.home.z));
  pts.push(flat(u.home.x, u.home.z));
  return { pts, segs };
}

export function dispatch(u: CrewUnit, pts: V3[], segs: RoadSeg[], delay: number, vmax: number, state: CrewState) {
  u.path = new Path(roundCorners(pts, 7, 6));
  u.segs = segs;
  u.d = 0;
  u.speed = 0;
  u.delay = delay;
  u.vmax = vmax;
  u.state = state;
  u.spraying = false;
}

/** Advance one unit; returns true on the frame it arrives. */
export function stepCrew(u: CrewUnit, dt: number): boolean {
  if (!u.path || (u.state !== "out" && u.state !== "returning")) {
    u.from = u.to = null;
    const aim = u.state === "onscene" && u.target ? Math.atan2(u.target.x - u.x, u.target.z - u.z) : u.state === "home" ? u.home.yaw : null;
    if (aim !== null) {
      // tenders swing round to aim the monitor; back at the station they square up to their bay
      const want = aim;
      let dy = want - u.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      u.yaw += dy * Math.min(1, dt * 1.5);
    }
    return false;
  }
  if (u.delay > 0) {
    u.delay -= dt;
    return false;
  }
  const remaining = u.path.length - u.d;
  const want = Math.min(u.vmax, 2 + remaining * 0.7);
  u.speed += Math.max(-8 * dt, Math.min(4 * dt, want - u.speed));
  u.d = Math.min(u.path.length, u.d + u.speed * dt);
  u.path.sample(u.d, tmp);
  u.x = tmp.x;
  u.z = tmp.z;
  u.path.tangent(u.d, tmp);
  u.yaw = Math.atan2(tmp.x, tmp.z);
  u.from = u.to = null;
  for (const s of u.segs)
    if (u.d >= s.d0 && u.d <= s.d1) {
      u.from = s.from;
      u.to = s.to;
      u.t = s.d1 > s.d0 ? (u.d - s.d0) / (s.d1 - s.d0) : 0;
      break;
    }
  if (u.d >= u.path.length - 0.05) {
    u.path = null;
    u.speed = 0;
    if (u.state === "returning") {
      u.state = "home";
      u.target = null;
    } else u.state = "onscene";
    return true;
  }
  return false;
}
