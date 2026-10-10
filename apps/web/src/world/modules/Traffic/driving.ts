// Pure driving logic for civilian traffic: car-following (IDM), path following with smooth
// junction curves, signal decisions, rerouting. No three.js, no React: unit-tested.
import { ROAD_NODES, edgeKey, findPath, getEdge, getNode, lanePosition } from "../../roads";
import type { SignalColour } from "../../signals";

export interface Pose {
  x: number;
  z: number;
  h: number; // heading, rotation about y, 0 = facing +z
}

// --- Car following: Intelligent Driver Model -------------------------------------------------

export interface IdmParams {
  aMax: number; // comfortable acceleration m/s²
  bComf: number; // comfortable deceleration m/s²
  s0: number; // standstill gap m
  T: number; // time headway s
}

export const IDM: IdmParams = { aMax: 2.4, bComf: 3, s0: 2, T: 1.1 };
export const MAX_BRAKE = 9;

/**
 * Acceleration for speed `v` with desired speed `v0`, a bumper-to-bumper `gap` to the obstacle
 * ahead (Infinity when clear) closing at `closing` m/s (v - leaderSpeed).
 */
export function idmAccel(v: number, v0: number, gap: number, closing: number, p: IdmParams = IDM): number {
  const ratio = v / Math.max(v0, 0.1);
  // Above the limit (e.g. off the highway onto a street) slow down gently rather than slamming on.
  const free = Math.max(1 - ratio ** 4, -0.6);
  let a = p.aMax * free;
  if (Number.isFinite(gap)) {
    const sStar = p.s0 + Math.max(0, v * p.T + (v * closing) / (2 * Math.sqrt(p.aMax * p.bComf)));
    const g = Math.max(gap, 0.05);
    a -= p.aMax * (sStar / g) ** 2;
  }
  return Math.min(p.aMax, Math.max(-MAX_BRAKE, a));
}

// --- Path following ------------------------------------------------------------------------

export interface PathState {
  path: string[];
  idx: number; // current edge is path[idx] -> path[idx + 1]
  t: number; // 0..1 along it
}

export function edgeLen(a: string, b: string) {
  return getEdge(a, b)?.length ?? 1;
}

/** Move `ds` metres along the path. Returns how many new edges were entered. Stops at the path end. */
export function advance(s: PathState, ds: number): number {
  let entered = 0;
  while (ds > 0) {
    const len = edgeLen(s.path[s.idx], s.path[s.idx + 1]);
    const rem = (1 - s.t) * len;
    if (ds < rem) {
      s.t += ds / len;
      break;
    }
    if (s.idx + 2 >= s.path.length) {
      s.t = 1;
      break;
    }
    ds -= rem;
    s.idx += 1;
    s.t = 0;
    entered += 1;
  }
  return entered;
}

export const TURN_R = 6; // metres before/after a node over which the turn is blended

function cornerR(a: string, b: string, c: string) {
  return Math.min(TURN_R, edgeLen(a, b) * 0.35, edgeLen(b, c) * 0.35);
}

const tmpA: [number, number, number] = [0, 0, 0];
function lane(a: string, b: string, t: number, out: [number, number, number]) {
  const r = lanePosition(a, b, t);
  out[0] = r[0];
  out[1] = r[1];
  out[2] = r[2];
  return out;
}

/** Cubic Bézier through a junction a->b->c; u in 0..1 spans R metres before to R metres after b. */
function corner(a: string, b: string, c: string, u: number, out: Pose): Pose {
  const R = cornerR(a, b, c);
  const l1 = edgeLen(a, b);
  const l2 = edgeLen(b, c);
  const p0 = lane(a, b, 1 - R / l1, tmpA);
  const p0x = p0[0];
  const p0z = p0[1];
  const p3 = lane(b, c, R / l2, tmpA);
  const p3x = p3[0];
  const p3z = p3[1];
  const na = getNode(a);
  const nb = getNode(b);
  const nc = getNode(c);
  const d1x = (nb.x - na.x) / l1;
  const d1z = (nb.z - na.z) / l1;
  const d2x = (nc.x - nb.x) / l2;
  const d2z = (nc.z - nb.z) / l2;
  const dot = d1x * d2x + d1z * d2z;
  // Straight: 2/3 R keeps uniform speed; U-turn: a wider loop.
  const k = dot > 0.95 ? R / 1.5 : R * (0.55 + 0.45 * Math.max(0, -dot));
  bezier(p0x, p0z, p0x + d1x * k, p0z + d1z * k, p3x - d2x * k, p3z - d2z * k, p3x, p3z, u, out);
  return out;
}

function bezier(
  x0: number, z0: number, x1: number, z1: number, x2: number, z2: number, x3: number, z3: number,
  u: number, out: Pose,
) {
  const v = 1 - u;
  out.x = v * v * v * x0 + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x3;
  out.z = v * v * v * z0 + 3 * v * v * u * z1 + 3 * v * u * u * z2 + u * u * u * z3;
  const dx = 3 * v * v * (x1 - x0) + 6 * v * u * (x2 - x1) + 3 * u * u * (x3 - x2);
  const dz = 3 * v * v * (z1 - z0) + 6 * v * u * (z2 - z1) + 3 * u * u * (z3 - z2);
  if (dx * dx + dz * dz > 1e-9) out.h = Math.atan2(dx, dz);
  return out;
}

/** World pose for a vehicle at (path, idx, t), on the left lane, with curves through junctions. */
export function poseAt(path: readonly string[], idx: number, t: number, out: Pose): Pose {
  const a = path[idx];
  const b = path[idx + 1];
  const len = edgeLen(a, b);
  const s = t * len;
  if (idx + 2 < path.length) {
    const R = cornerR(a, b, path[idx + 2]);
    if (s > len - R) return corner(a, b, path[idx + 2], (s - (len - R)) / (2 * R), out);
  }
  if (idx >= 1) {
    const R = cornerR(path[idx - 1], a, b);
    if (s < R) return corner(path[idx - 1], a, b, 0.5 + s / (2 * R), out);
  }
  const p = lane(a, b, t, tmpA);
  out.x = p[0];
  out.z = p[1];
  out.h = p[2];
  return out;
}

/** +1 for a left turn at b, -1 for right, 0 for (roughly) straight or a U-turn. */
export function turnSide(a: string, b: string, c: string): -1 | 0 | 1 {
  const na = getNode(a);
  const nb = getNode(b);
  const nc = getNode(c);
  const l1 = Math.hypot(nb.x - na.x, nb.z - na.z) || 1;
  const l2 = Math.hypot(nc.x - nb.x, nc.z - nb.z) || 1;
  const d1x = (nb.x - na.x) / l1;
  const d1z = (nb.z - na.z) / l1;
  const d2x = (nc.x - nb.x) / l2;
  const d2z = (nc.z - nb.z) / l2;
  if (d1x * d2x + d1z * d2z < -0.9) return 0;
  // left of travel direction (dx, dz) is (dz, -dx)
  const side = d2x * d1z - d2z * d1x;
  return side > 0.35 ? 1 : side < -0.35 ? -1 : 0;
}

/** Cubic arc for a mid-road U-turn from pose a to pose b (b faces the other way). */
export function uturnPose(a: Pose, b: Pose, u: number, out: Pose): Pose {
  const fx = Math.sin(a.h);
  const fz = Math.cos(a.h);
  const gx = Math.sin(b.h);
  const gz = Math.cos(b.h);
  const k = 3.5;
  return bezier(a.x, a.z, a.x + fx * k, a.z + fz * k, b.x - gx * k, b.z - gz * k, b.x, b.z, u, out);
}

// --- Anti-teleport smoothing --------------------------------------------------------------

export interface PoseOffset {
  x: number;
  z: number;
  h: number;
}

function wrapAngle(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/**
 * Rendered pose = target + offset, where the offset absorbs any jump bigger than `maxStep`
 * (e.g. a replan changing the curve mid-junction) and decays over ~0.4 s.
 */
export function smoothPose(prev: Pose, target: Pose, off: PoseOffset, dt: number, maxStep: number, out: Pose): Pose {
  const decay = Math.exp(-dt * 6);
  off.x *= decay;
  off.z *= decay;
  off.h *= decay;
  let x = target.x + off.x;
  let z = target.z + off.z;
  const jump = Math.hypot(x - prev.x, z - prev.z);
  if (jump > maxStep) {
    // move at most maxStep towards the target this frame
    const k = maxStep / jump;
    x = prev.x + (x - prev.x) * k;
    z = prev.z + (z - prev.z) * k;
    off.x = x - target.x;
    off.z = z - target.z;
  }
  let h = target.h + off.h;
  const dh = wrapAngle(h - prev.h);
  const maxTurn = 4 * dt + 0.05;
  if (Math.abs(dh) > maxTurn) {
    h = prev.h + Math.sign(dh) * maxTurn;
    off.h = wrapAngle(h - target.h);
  }
  out.x = x;
  out.z = z;
  out.h = h;
  return out;
}

// --- Obstacles ----------------------------------------------------------------------------

export interface LaneEntry {
  t: number;
  speed: number;
  half: number; // half length of that vehicle
}

export type LaneLookup = (from: string, to: string, afterT: number) => LaneEntry | null;

/** Nearest vehicle ahead on our lane, looking up to `lookahead` metres along the path. */
export function laneObstacle(
  path: readonly string[], idx: number, t: number, selfHalf: number, lookup: LaneLookup, lookahead = 60,
): { gap: number; speed: number } {
  const a = path[idx];
  const b = path[idx + 1];
  const len = edgeLen(a, b);
  const lead = lookup(a, b, t);
  if (lead) return { gap: (lead.t - t) * len - selfHalf - lead.half, speed: lead.speed };
  let d = (1 - t) * len;
  for (let k = idx + 1; k + 1 < path.length && d < lookahead; k++) {
    const l = lookup(path[k], path[k + 1], -1);
    const lk = edgeLen(path[k], path[k + 1]);
    if (l) return { gap: d + l.t * lk - selfHalf - l.half, speed: l.speed };
    d += lk;
  }
  return { gap: Infinity, speed: 0 };
}

export type SignalAction = "go" | "stop" | "commit";

/** What to do about the light at the end of this edge. `distToLine` from our front bumper. */
export function signalDecision(colour: SignalColour, distToLine: number, v: number, committed: boolean): SignalAction {
  if (colour === "green" || committed || distToLine < -0.5) return "go";
  const comfy = (v * v) / (2 * IDM.bComf * 1.2);
  if (colour === "amber") return comfy <= distToLine ? "stop" : "commit";
  // red without having seen amber (e.g. just turned onto this edge): stop if physically possible
  return (v * v) / (2 * MAX_BRAKE) <= distToLine + 1 ? "stop" : "commit";
}

/** Where along the directed edge from->to a world point lies (0..1, unclamped). */
export function blockageT(from: string, to: string, x: number, z: number) {
  const a = getNode(from);
  const b = getNode(to);
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  return ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1);
}

// --- Routing ------------------------------------------------------------------------------

/** True when any edge after the current one is blocked. */
export function needsReroute(path: readonly string[], idx: number, blocked: ReadonlySet<string>): boolean {
  for (let k = idx + 1; k + 1 < path.length; k++) if (blocked.has(edgeKey(path[k], path[k + 1]))) return true;
  return false;
}

/**
 * New path to `dest` that keeps the edge we're on (we can't leave it mid-way) and the node
 * before it (for turn blending). Avoids an immediate U-turn at the next node when possible.
 */
export function replanPath(
  path: readonly string[], idx: number, dest: string, blocked: ReadonlySet<string>,
): { path: string[]; idx: number } | null {
  const from = path[idx];
  const to = path[idx + 1];
  const noBack = new Set(blocked);
  noBack.add(edgeKey(from, to));
  const tail = findPath(to, dest, noBack) ?? findPath(to, dest, blocked);
  if (!tail || tail.length < 2) return null;
  const keep = idx >= 1 ? path.slice(idx - 1, idx + 1) : path.slice(idx, idx + 1);
  return { path: [...keep, ...tail], idx: idx >= 1 ? 1 : 0 };
}

export type Archetype = "hatch" | "saloon" | "suv" | "cab" | "hgv";

const ALL_IDS = [...ROAD_NODES.keys()];
const DOWNTOWN = ALL_IDS.filter((id) => id.startsWith("g_"));
const RING = ALL_IDS.filter((id) => id.startsWith("h_"));
const CIVIL = ALL_IDS.filter((id) => !id.startsWith("depot_"));

/** A random destination suited to the vehicle type, never the current node. */
export function pickDestination(kind: Archetype, current: string, rand: () => number): string {
  const pick = (pool: string[]) => {
    for (let i = 0; i < 8; i++) {
      const id = pool[Math.floor(rand() * pool.length)];
      if (id !== current) return id;
    }
    return pool.find((id) => id !== current)!;
  };
  if (kind === "hgv") {
    // a few ring nodes ahead or behind, so lorries lap the ring rather than cutting through town
    const n = current.startsWith("h_") ? Number(current.slice(2)) : Math.floor(rand() * RING.length);
    const step = (2 + Math.floor(rand() * 4)) * (rand() < 0.5 ? 1 : -1);
    return `h_${(((n + step) % RING.length) + RING.length) % RING.length}`;
  }
  if (kind === "cab") return pick(rand() < 0.75 ? DOWNTOWN : CIVIL);
  return pick(rand() < 0.55 ? DOWNTOWN : CIVIL);
}
