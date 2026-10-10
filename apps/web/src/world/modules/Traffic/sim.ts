// Civilian traffic simulation + instanced rendering. Owns 76 vehicles, drives them with the
// pure logic in driving.ts, registers them in the shared registry, and writes instance matrices.
import {
  CircleGeometry,
  Color,
  DynamicDrawUsage,
  Euler,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
  type Material,
} from "three";
import { on } from "../../bus";
import { allVehicles, nextId, registerVehicle, type VehicleEntry, type VehicleKind } from "../../registry";
import { ROAD_EDGES, edgeKey, getEdge, type RoadEdge } from "../../roads";
import { hasSignal, signalFor } from "../../signals";
import { blockedSet, useWorld } from "../../store";
import {
  IDM,
  TURN_R,
  advance,
  blockageT,
  edgeLen,
  idmAccel,
  laneObstacle,
  needsReroute,
  pickDestination,
  poseAt,
  replanPath,
  signalDecision,
  smoothPose,
  turnSide,
  uturnPose,
  type Archetype,
  type LaneEntry,
  type Pose,
  type PoseOffset,
} from "./driving";
import { HALF_LENGTH, PALETTES, PARTS, buildArchetype, type Part } from "./models";

const FLEET: Record<Archetype, number> = { hatch: 22, saloon: 22, suv: 16, cab: 10, hgv: 6 };
const ARCHES = Object.keys(FLEET) as Archetype[];
const REG_KIND: Record<Archetype, VehicleKind> = { hatch: "car", saloon: "car", suv: "car", cab: "taxi", hgv: "truck" };
const KIND_HALF: Record<VehicleKind, number> = {
  car: 2.2, taxi: 2.25, bus: 5.3, van: 2.8, truck: 4.5, police: 2.4, ambulance: 3, fire: 4, roadworks: 3.5, tow: 3.5,
};
const SPEED_FACTOR: Record<Archetype, [number, number]> = {
  hatch: [0.85, 1.05], saloon: [0.88, 1.08], suv: [0.85, 1.02], cab: [0.98, 1.1], hgv: [0.78, 0.85],
};
const STOP_LINE = 5.2; // front bumper stops this far before the junction centre
const CLEAR_RADIUS = 25; // incident:cleared removes crashed cars within this distance
const WIDTH: Record<Archetype, number> = { hatch: 1.72, saloon: 1.8, suv: 1.95, cab: 1.85, hgv: 2.5 };

type Mode = "drive" | "uturn" | "crashed";

interface Driver {
  arche: Archetype;
  slot: number;
  half: number;
  entry: VehicleEntry;
  unregister: () => void;
  path: string[];
  idx: number;
  t: number;
  speed: number;
  accel: number;
  v0Factor: number;
  dest: string;
  mode: Mode;
  committed: boolean;
  stillFor: number; // stopped, not at a light
  blockedStill: number; // stopped behind a closure on our own edge
  patience: number;
  retryIn: number; // for path extension when no route was found
  checkIn: number; // periodic reroute check
  pose: Pose;
  target: Pose;
  off: PoseOffset;
  pitch: number;
  roll: number;
  braking: boolean;
  signal: -1 | 0 | 1 | 2; // indicator: 1 left, -1 right, 2 hazards
  uA: Pose;
  uB: Pose;
  uU: number;
  uDur: number;
  crashT: number;
  crashFrom: Pose;
  crashV: number;
  crashYaw: number;
  crashRoll: number;
  crashedAt: number;
}

const rand = Math.random;
const between = (a: number, b: number) => a + rand() * (b - a);

// Reusable scratch objects (no per-frame allocation)
const mat = new Matrix4();
const quat = new Quaternion();
const euler = new Euler(0, 0, 0, "YXZ");
const pos = new Vector3();
const scl = new Vector3(1, 1, 1);
const ZERO = new Matrix4().makeScale(0, 0, 0);
const laneHit: LaneEntry = { t: 0, speed: 0, half: 0 };

const C_TAIL_OFF = new Color(0.35, 0.03, 0.03);
const C_TAIL_RUN = new Color(0.9, 0.06, 0.05);
const C_TAIL_BRAKE = new Color(2.6, 0.18, 0.1);
const C_IND_OFF = new Color(0.45, 0.25, 0.05);
const C_IND_ON = new Color(2.4, 1.2, 0.1);
const C_HEAD_DAY = new Color(0.92, 0.92, 0.86);
const C_HEAD_NIGHT = new Color(2.6, 2.4, 1.8);

function poolEdges(arche: Archetype): { edges: RoadEdge[]; total: number } {
  const edges = [...ROAD_EDGES.values()].filter((e) => {
    if (arche === "hgv") return e.kind === "highway";
    return !e.a.startsWith("depot_") && !e.b.startsWith("depot_");
  });
  return { edges, total: edges.reduce((s, e) => s + e.length, 0) };
}

export class TrafficSim {
  readonly meshes: InstancedMesh[] = [];
  readonly paintMeshes = new Map<InstancedMesh, Archetype>();
  private parts = new Map<Archetype, Partial<Record<Part, InstancedMesh>>>();
  private shadow: InstancedMesh;
  private materials: Material[] = [];
  private headMat: MeshBasicMaterial;
  private drivers: Driver[] = [];
  private bySlot = new Map<Archetype, Driver[]>();
  private pools = new Map<Archetype, { edges: RoadEdge[]; total: number }>();
  private snap: VehicleEntry[] = [];
  private blocked: Set<string> = new Set();
  private blockedDirty = true;
  private selfId = "";
  private cleanup: (() => void)[] = [];
  private night = -1;
  private sweepIn = 2;

  constructor() {
    const paint = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.55, metalness: 0.15, flatShading: true });
    const fixed = new MeshStandardMaterial({ vertexColors: true, roughness: 0.75, flatShading: true });
    this.headMat = new MeshBasicMaterial({ color: C_HEAD_DAY, toneMapped: false });
    const lamp = new MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
    const shadowMat = new MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.28, depthWrite: false });
    this.materials.push(paint, fixed, this.headMat, lamp, shadowMat);
    const matFor: Record<Part, Material> = { paint, fixed, head: this.headMat, tail: lamp, indL: lamp, indR: lamp };

    for (const arche of ARCHES) {
      const n = FLEET[arche];
      const geos = buildArchetype(arche);
      const rec: Partial<Record<Part, InstancedMesh>> = {};
      for (const part of PARTS) {
        const g = geos[part];
        if (!g) continue;
        const m = new InstancedMesh(g, matFor[part], n);
        m.instanceMatrix.setUsage(DynamicDrawUsage);
        m.frustumCulled = false;
        m.name = `traffic-${arche}-${part}`;
        const big = arche === "hgv";
        m.castShadow = big && (part === "paint" || part === "fixed");
        m.receiveShadow = part === "paint" || part === "fixed";
        for (let i = 0; i < n; i++) m.setMatrixAt(i, ZERO);
        if (part === "paint" || part === "tail" || part === "indL" || part === "indR") {
          for (let i = 0; i < n; i++) m.setColorAt(i, part === "paint" ? new Color("#ffffff") : C_TAIL_OFF);
        }
        rec[part] = m;
        this.meshes.push(m);
        if (part === "paint") this.paintMeshes.set(m, arche);
      }
      this.parts.set(arche, rec);
      this.pools.set(arche, poolEdges(arche));
    }
    // soft blob shadow under every vehicle: one draw call
    const total = ARCHES.reduce((s, a) => s + FLEET[a], 0);
    const disc = new CircleGeometry(1, 12);
    disc.rotateX(-Math.PI / 2);
    this.shadow = new InstancedMesh(disc, shadowMat, total);
    this.shadow.frustumCulled = false;
    this.shadow.renderOrder = 1;
    for (let i = 0; i < total; i++) this.shadow.setMatrixAt(i, ZERO);
    this.meshes.push(this.shadow);
  }

  /** Vehicle id for a clicked instance (for camera follow). */
  idAt(mesh: InstancedMesh, instanceId: number): string | null {
    const arche = this.paintMeshes.get(mesh);
    if (!arche) return null;
    return this.bySlot.get(arche)?.[instanceId]?.entry.id ?? null;
  }

  start() {
    this.blocked = blockedSet();
    for (const arche of ARCHES) {
      const list: Driver[] = [];
      for (let slot = 0; slot < FLEET[arche]; slot++) {
        const d = this.makeDriver(arche, slot);
        this.spawn(d, null);
        list.push(d);
        this.drivers.push(d);
      }
      this.bySlot.set(arche, list);
    }
    this.cleanup.push(
      useWorld.subscribe((s, prev) => {
        if (s.blocked !== prev.blocked) this.blockedDirty = true;
      }),
      on((e) => {
        if (e.type === "incident:cleared") this.onCleared(e.incidentId);
        if (e.type === "road:blocked" || e.type === "road:reopened") this.blockedDirty = true;
      }),
    );
  }

  stop() {
    for (const c of this.cleanup) c();
    this.cleanup = [];
    for (const d of this.drivers) d.unregister();
    this.drivers = [];
    this.bySlot.clear();
  }

  dispose() {
    for (const m of this.meshes) m.geometry.dispose();
    for (const m of this.materials) m.dispose();
  }

  // --- lifecycle --------------------------------------------------------------------------

  private makeDriver(arche: Archetype, slot: number): Driver {
    const p = (): Pose => ({ x: 0, z: 0, h: 0 });
    const entry: VehicleEntry = {
      id: "", kind: REG_KIND[arche], object: new Object3D(), edgeKey: null, from: null, to: null, t: 0, speed: 0, stopped: false,
    };
    const d: Driver = {
      arche, slot, half: HALF_LENGTH[arche], entry, unregister: () => {},
      path: [], idx: 0, t: 0, speed: 0, accel: 0, v0Factor: 1, dest: "", mode: "drive", committed: false,
      stillFor: 0, blockedStill: 0, patience: 1, retryIn: 0, checkIn: 0,
      pose: p(), target: p(), off: { x: 0, z: 0, h: 0 }, pitch: 0, roll: 0, braking: false, signal: 0,
      uA: p(), uB: p(), uU: 0, uDur: 2.5, crashT: 0, crashFrom: p(), crashV: 0, crashYaw: 0, crashRoll: 0, crashedAt: 0,
    };
    entry.crash = () => this.crash(d);
    return d;
  }

  /** (Re)spawn a driver on a free random lane, optionally at least 80 m from `avoid`. */
  private spawn(d: Driver, avoid: { x: number; z: number } | null) {
    d.unregister();
    const pool = this.pools.get(d.arche)!;
    let a = "";
    let b = "";
    let t = 0.5;
    for (let attempt = 0; attempt < 40; attempt++) {
      let r = rand() * pool.total;
      let e = pool.edges[0];
      for (const cand of pool.edges) {
        r -= cand.length;
        if (r <= 0) {
          e = cand;
          break;
        }
      }
      if (this.blocked.has(e.key)) continue;
      [a, b] = rand() < 0.5 ? [e.a, e.b] : [e.b, e.a];
      t = between(0.15, 0.75);
      poseAt([a, b], 0, t, d.pose);
      if (avoid && Math.hypot(d.pose.x - avoid.x, d.pose.z - avoid.z) < 80) continue;
      if (this.isFree(d.pose.x, d.pose.z, 14)) break;
    }
    d.path = [a, b];
    d.idx = 0;
    d.t = t;
    d.mode = "drive";
    d.v0Factor = between(...SPEED_FACTOR[d.arche]);
    d.speed = getEdge(a, b)!.speedLimit * d.v0Factor * 0.7;
    d.accel = 0;
    d.committed = false;
    d.stillFor = d.blockedStill = 0;
    d.patience = between(0.6, 1.6);
    d.retryIn = 0;
    d.checkIn = between(0.5, 2);
    d.off.x = d.off.z = d.off.h = 0;
    d.pitch = d.roll = 0;
    d.dest = "";
    this.extend(d);
    poseAt(d.path, d.idx, d.t, d.pose);

    const palette = PALETTES[d.arche];
    this.parts.get(d.arche)!.paint!.setColorAt(d.slot, new Color(palette[Math.floor(rand() * palette.length)]));
    this.parts.get(d.arche)!.paint!.instanceColor!.needsUpdate = true;

    const prefix = d.arche === "cab" ? "taxi" : d.arche === "hgv" ? "hgv" : "car";
    d.entry.id = nextId(prefix);
    d.entry.stopped = false;
    this.syncEntry(d);
    d.unregister = registerVehicle(d.entry);
  }

  private isFree(x: number, z: number, r: number) {
    for (const v of allVehicles()) if (Math.hypot(v.object.position.x - x, v.object.position.z - z) < r) return false;
    return true;
  }

  /** Make sure the path continues past the current edge (pick a new destination when needed). */
  private extend(d: Driver) {
    if (d.idx + 2 < d.path.length) return true;
    const last = d.path[d.path.length - 1];
    for (let i = 0; i < 4; i++) {
      const dest = pickDestination(d.arche, last, rand);
      const r = replanPath(d.path, d.idx, dest, this.blocked);
      if (r) {
        d.path = r.path;
        d.idx = r.idx;
        d.dest = dest;
        return true;
      }
    }
    return false;
  }

  private reroute(d: Driver) {
    if (!needsReroute(d.path, d.idx, this.blocked)) return;
    const r = d.dest ? replanPath(d.path, d.idx, d.dest, this.blocked) : null;
    if (r) {
      d.path = r.path;
      d.idx = r.idx;
      return;
    }
    // destination cut off: cut the path to the current edge and pick a new one
    d.path = d.path.slice(Math.max(0, d.idx - 1), d.idx + 2);
    d.idx = Math.min(d.idx, 1);
    this.extend(d);
  }

  private crash(d: Driver): boolean {
    if (d.mode === "crashed") return false;
    d.mode = "crashed";
    d.crashFrom.x = d.pose.x;
    d.crashFrom.z = d.pose.z;
    d.crashFrom.h = d.pose.h;
    d.crashV = Math.max(d.speed, 5);
    const sign = rand() < 0.5 ? -1 : 1;
    const big = d.arche === "hgv";
    d.crashYaw = sign * between(40, big ? 60 : 120) * (Math.PI / 180);
    d.crashRoll = (rand() < 0.5 ? -1 : 1) * (big ? between(0.03, 0.06) : between(0.07, 0.15));
    d.crashT = 0;
    d.crashedAt = performance.now();
    d.speed = 0;
    d.accel = 0;
    d.entry.stopped = true;
    d.entry.speed = 0;
    return true;
  }

  private onCleared(incidentId: string) {
    const inc = useWorld.getState().incidents.find((i) => i.id === incidentId);
    if (!inc) return;
    for (const d of this.drivers)
      if (d.mode === "crashed" && Math.hypot(d.pose.x - inc.x, d.pose.z - inc.z) < CLEAR_RADIUS) this.spawn(d, inc);
  }

  /** Safety net: crashed cars nobody is handling disappear after a while. */
  private sweepCrashed(now: number) {
    const incidents = useWorld.getState().incidents;
    for (const d of this.drivers) {
      if (d.mode !== "crashed" || now - d.crashedAt < 150_000) continue;
      let handled = false;
      for (const i of incidents)
        if (i.status !== "cleared" && Math.hypot(d.pose.x - i.x, d.pose.z - i.z) < CLEAR_RADIUS) handled = true;
      if (!handled) this.spawn(d, d.pose);
    }
  }

  private startUturn(d: Driver) {
    const a = d.path[d.idx];
    const b = d.path[d.idx + 1];
    d.uA.x = d.pose.x;
    d.uA.z = d.pose.z;
    d.uA.h = d.pose.h;
    d.path = [b, a];
    d.idx = 0;
    d.t = 1 - d.t;
    if (d.dest) {
      const r = replanPath(d.path, 0, d.dest, this.blocked);
      if (r) d.path = r.path;
    }
    this.extend(d);
    poseAt(d.path, d.idx, d.t, d.uB);
    d.mode = "uturn";
    d.uU = 0;
    d.uDur = d.arche === "hgv" ? 4 : 2.6;
    d.speed = 0;
    d.committed = false;
    d.stillFor = d.blockedStill = 0;
  }

  // --- per frame --------------------------------------------------------------------------

  private lookup = (from: string, to: string, afterT: number): LaneEntry | null => {
    let best: VehicleEntry | null = null;
    for (const v of this.snap)
      if (v.id !== this.selfId && v.from === from && v.to === to && v.t > afterT && (!best || v.t < best.t)) best = v;
    if (!best) return null;
    laneHit.t = best.t;
    laneHit.speed = best.speed;
    laneHit.half = best.kind in KIND_HALF ? KIND_HALF[best.kind] : 2.5;
    return laneHit;
  };

  step(rawDt: number) {
    const dt = Math.min(rawDt, 0.1);
    const world = useWorld.getState();
    if (world.paused || dt <= 0) return;
    const now = performance.now();

    if (this.blockedDirty) {
      this.blocked = blockedSet();
      for (const d of this.drivers) if (d.mode === "drive") this.reroute(d);
      this.blockedDirty = false;
    }

    this.snap.length = 0;
    for (const v of allVehicles()) this.snap.push(v);

    for (const d of this.drivers) {
      if (d.mode === "drive") this.drive(d, dt, now, world.incidents);
      else if (d.mode === "uturn") this.uturn(d, dt);
      else this.crashed(d, dt);
    }

    this.sweepIn -= dt;
    if (this.sweepIn <= 0) {
      this.sweepIn = 2;
      this.sweepCrashed(now);
    }

    this.render(now, world.timeOfDay);
  }

  private drive(d: Driver, dt: number, now: number, incidents: ReturnType<typeof useWorld.getState>["incidents"]) {
    this.selfId = d.entry.id;
    if (d.idx + 2 >= d.path.length) {
      d.retryIn -= dt;
      if (d.retryIn <= 0) {
        d.retryIn = 1;
        this.extend(d);
      }
    }
    d.checkIn -= dt;
    if (d.checkIn <= 0) {
      d.checkIn = 1.5;
      this.reroute(d);
    }

    const a = d.path[d.idx];
    const b = d.path[d.idx + 1];
    const edge = getEdge(a, b)!;
    const len = edge.length;
    const distToNode = (1 - d.t) * len;
    const hasNext = d.idx + 2 < d.path.length;
    const c = hasNext ? d.path[d.idx + 2] : "";
    const v = d.speed;

    // desired speed, slowing for turns
    let v0 = edge.speedLimit * d.v0Factor;
    if (hasNext) {
      const side = turnSide(a, b, c);
      const uturnAtNode = c === a;
      if (side !== 0 || uturnAtNode) {
        const vTurn = uturnAtNode ? 3 : side === 1 ? 5.5 : 6.5;
        if (distToNode < 40) v0 = Math.min(v0, vTurn + Math.max(0, distToNode - TURN_R) * 0.4);
      }
    }

    // nearest obstacle
    const lead = laneObstacle(d.path, d.idx, d.t, d.half, this.lookup);
    let gap = lead.gap;
    let closing = v - lead.speed;
    let atSignal = false;
    const consider = (g: number) => {
      if (g < gap) {
        gap = g;
        closing = v;
      }
    };

    if (hasSignal(b)) {
      const distToLine = distToNode - STOP_LINE - d.half;
      const act = signalDecision(signalFor(b, a, now), distToLine, v, d.committed);
      if (act === "commit") d.committed = true;
      else if (act === "stop") {
        consider(distToLine + IDM.s0);
        atSignal = gap === distToLine + IDM.s0;
      }
    }
    if (!hasNext) consider(distToNode - d.half - 1 + IDM.s0); // nowhere to go: wait at the junction
    else if (this.blocked.has(edgeKey(b, c))) consider(distToNode - STOP_LINE - d.half + IDM.s0);

    // our own road closed ahead of us: queue behind the closure, then U-turn
    let closureAhead = false;
    if (this.blocked.has(edge.key)) {
      let bt = 0.5;
      for (const i of incidents)
        if (i.edgeKey === edge.key && i.status !== "cleared") {
          bt = blockageT(a, b, i.x, i.z);
          break;
        }
      bt = Math.min(0.95, Math.max(0.05, bt));
      if (bt > d.t) {
        closureAhead = true;
        consider((bt - d.t) * len - d.half - 5);
      }
    }

    const acc = idmAccel(v, v0, gap, closing);
    let nv = Math.max(0, v + acc * dt);
    let ds = nv * dt;
    if (Number.isFinite(gap)) {
      const room = Math.max(0, gap - 0.4);
      if (ds > room) {
        ds = room;
        nv = Math.min(nv, room / dt);
      }
    }
    d.accel = (nv - v) / dt;
    d.speed = nv;
    const entered = advance(d, ds);
    if (entered) {
      d.committed = false;
      if (needsReroute(d.path, d.idx, this.blocked)) this.reroute(d);
      if (d.idx > 4) {
        d.path.splice(0, d.idx - 1);
        d.idx = 1;
      }
      this.extend(d);
    }

    // stuck handling
    if (nv < 0.3) {
      if (closureAhead) {
        d.blockedStill += dt;
        if (d.blockedStill > d.patience) {
          this.startUturn(d);
          return this.uturn(d, 0);
        }
      } else if (!atSignal) {
        d.stillFor += dt;
        // deadlock breaker (e.g. queued behind a crash on an unblocked road, or a dead end)
        if (d.stillFor > (hasNext ? 18 : 3) + d.patience * 4) {
          this.startUturn(d);
          return this.uturn(d, 0);
        }
      }
    } else {
      d.stillFor = 0;
      d.blockedStill = 0;
    }

    d.braking = d.accel < -0.8 || nv < 0.4;
    // indicators: approaching a turn, or just after it
    d.signal = 0;
    if (d.idx + 2 < d.path.length && (1 - d.t) * edgeLen(d.path[d.idx], d.path[d.idx + 1]) < 30)
      d.signal = turnSide(d.path[d.idx], d.path[d.idx + 1], d.path[d.idx + 2]);
    else if (d.idx >= 1 && d.t * edgeLen(d.path[d.idx], d.path[d.idx + 1]) < TURN_R)
      d.signal = turnSide(d.path[d.idx - 1], d.path[d.idx], d.path[d.idx + 1]);

    const targetPitch = Math.max(-0.035, Math.min(0.04, -d.accel * 0.007));
    d.pitch += (targetPitch - d.pitch) * Math.min(1, dt * 5);
    d.roll *= 0.9;

    poseAt(d.path, d.idx, d.t, d.target);
    smoothPose(d.pose, d.target, d.off, dt, nv * dt * 1.6 + 0.12, d.pose);
    this.syncEntry(d);
  }

  private uturn(d: Driver, dt: number) {
    d.uU = Math.min(1, d.uU + dt / d.uDur);
    const u = d.uU * d.uU * (3 - 2 * d.uU); // ease in/out
    uturnPose(d.uA, d.uB, u, d.pose);
    d.speed = d.uU < 1 ? 3 : 2;
    d.braking = false;
    d.signal = -1; // UK: a U-turn goes across to the right
    d.pitch *= 0.9;
    if (d.uU >= 1) {
      d.mode = "drive";
      d.off.x = d.off.z = d.off.h = 0;
      d.pose.x = d.uB.x;
      d.pose.z = d.uB.z;
      d.pose.h = d.uB.h;
    }
    this.syncEntry(d);
  }

  private crashed(d: Driver, dt: number) {
    const DUR = 1.1;
    d.crashT += dt;
    const u = Math.min(1, d.crashT / DUR);
    const eased = 1 - (1 - u) * (1 - u);
    const dist = d.crashV * DUR * 0.5 * eased;
    const fx = Math.sin(d.crashFrom.h);
    const fz = Math.cos(d.crashFrom.h);
    const side = d.crashYaw > 0 ? -0.25 : 0.25;
    d.pose.x = d.crashFrom.x + fx * dist + fz * side * dist;
    d.pose.z = d.crashFrom.z + fz * dist - fx * side * dist;
    d.pose.h = d.crashFrom.h + d.crashYaw * eased;
    d.roll = d.crashRoll * eased;
    d.pitch = 0.03 * Math.sin(u * Math.PI);
    d.speed = 0;
    d.braking = false;
    d.signal = 2;
    d.entry.stopped = true;
    d.entry.speed = 0;
    d.entry.object.position.set(d.pose.x, 0, d.pose.z);
    d.entry.object.rotation.set(d.pitch, d.pose.h, d.roll, "YXZ");
  }

  private syncEntry(d: Driver) {
    const e = d.entry;
    const a = d.path[d.idx];
    const b = d.path[d.idx + 1];
    e.from = a;
    e.to = b;
    e.t = d.t;
    e.edgeKey = edgeKey(a, b);
    e.speed = d.speed;
    e.stopped = d.speed < 0.3 && d.mode !== "uturn";
    e.object.position.set(d.pose.x, 0, d.pose.z);
    e.object.rotation.set(d.pitch, d.pose.h, d.roll, "YXZ");
  }

  // --- rendering --------------------------------------------------------------------------

  private render(now: number, timeOfDay: number) {
    const night = timeOfDay < 7 || timeOfDay > 18.5 ? 1 : 0;
    if (night !== this.night) {
      this.night = night;
      this.headMat.color.copy(night ? C_HEAD_NIGHT : C_HEAD_DAY);
    }
    const blinkOn = Math.floor(now / 380) % 2 === 0;
    let shadowIdx = 0;
    for (const d of this.drivers) {
      const rec = this.parts.get(d.arche)!;
      const halfW = WIDTH[d.arche] / 2;
      pos.set(d.pose.x, Math.abs(Math.sin(d.roll)) * halfW, d.pose.z);
      euler.set(d.pitch, d.pose.h, d.roll, "YXZ");
      quat.setFromEuler(euler);
      mat.compose(pos, quat, scl);
      for (const part of PARTS) rec[part]?.setMatrixAt(d.slot, mat);

      rec.tail?.setColorAt(d.slot, d.braking ? C_TAIL_BRAKE : night ? C_TAIL_RUN : C_TAIL_OFF);
      const left = blinkOn && (d.signal === 1 || d.signal === 2);
      const right = blinkOn && (d.signal === -1 || d.signal === 2);
      rec.indL?.setColorAt(d.slot, left ? C_IND_ON : C_IND_OFF);
      rec.indR?.setColorAt(d.slot, right ? C_IND_ON : C_IND_OFF);

      // blob shadow, stretched to the vehicle footprint
      pos.y = 0.07;
      euler.set(0, d.pose.h, 0, "YXZ");
      quat.setFromEuler(euler);
      scl.set(halfW * 1.25, 1, d.half * 1.1);
      mat.compose(pos, quat, scl);
      this.shadow.setMatrixAt(shadowIdx++, mat);
      scl.set(1, 1, 1);
    }
    for (const m of this.meshes) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}

