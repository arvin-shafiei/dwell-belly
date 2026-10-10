// Collision engine: each frame, find overlapping vehicle pairs (physics.overlapping) and decide what
// they are. Fast overlaps are real crashes: both owners' crash() hooks run with an impulse hint in
// object.userData.impulse, an incident is filed, the road closes and events go out. Slow overlaps
// (a queue bunching up, a responder parking in a wreck) only get a separation hint for the owner.
// No React or three.js rendering here: the component calls step() and draws debris via onImpact.
import { emit } from "../../bus";
import { nextId, type VehicleEntry } from "../../registry";
import { addSeparation, beginSeparation, overlapping, pairMtv, physicsStats, rebuildSpatialIndex } from "../../physics";
import { useWorld } from "../../store";
import { CrashGate, closingSpeed, crashNote, impulse, isCrash, mass, pairKey, type Body } from "./rules";

export interface CollisionStats {
  overlaps: number; // overlapping pairs this frame (at least one moving)
  slowOverlaps: number; // of which slow (separation hints only)
  crashes: number; // crashes created since start
  suppressed: number; // fast overlaps that the rate limit / active cap turned away (frames)
  refused: number; // fast overlaps where neither vehicle accepted crash()
  queriesPerFrame: number; // obstacleAhead calls last frame
  vehicles: number;
  buildMs: number; // spatial index rebuild
  stepMs: number; // rebuild + overlap pass + crash handling
  lastCrash: string;
}

export type ImpactFx = (x: number, z: number, nx: number, nz: number, strength: number, truck: boolean) => void;

const SEP_RATE = 0.5; // fraction of the penetration to resolve per frame

export class CollisionEngine {
  readonly stats: CollisionStats = {
    overlaps: 0, slowOverlaps: 0, crashes: 0, suppressed: 0, refused: 0, queriesPerFrame: 0, vehicles: 0, buildMs: 0, stepMs: 0, lastCrash: "",
  };
  readonly gate = new CrashGate();
  private mine = new Set<string>(); // incident ids we created and that aren't cleared yet
  private done = new Set<string>(); // vehicles crashed this frame
  private A: Body = { x: 0, z: 0, h: 0, speed: 0, stopped: false };
  private B: Body = { x: 0, z: 0, h: 0, speed: 0, stopped: false };

  constructor(private onImpact?: ImpactFx) {}

  /** Rebuild the spatial index (always) and resolve overlaps (unless paused). */
  step(now: number, paused: boolean) {
    const t0 = performance.now();
    rebuildSpatialIndex();
    const s = this.stats;
    s.queriesPerFrame = physicsStats.queriesPerFrame;
    s.vehicles = physicsStats.vehicles;
    s.buildMs = physicsStats.buildMs;
    if (!paused) this.resolve(now);
    s.suppressed = this.gate.suppressed;
    s.stepMs = performance.now() - t0;
  }

  private resolve(now: number) {
    beginSeparation();
    this.done.clear();
    const pairs = overlapping();
    const s = this.stats;
    s.overlaps = pairs.length;
    s.slowOverlaps = 0;
    for (let i = 0; i < pairs.length; i++) {
      const a = pairs[i][0];
      const b = pairs[i][1];
      if (this.done.has(a.id) || this.done.has(b.id)) continue;
      const m = pairMtv(i);
      const nx = m.nx;
      const nz = m.nz;
      const depth = m.depth;
      const A = body(a, this.A);
      const B = body(b, this.B);
      if (isCrash(A, B)) {
        const key = pairKey(a.id, b.id);
        if (!this.gate.isDuplicate(key, now) && this.gate.allows(key, now, this.activeCount())) {
          if (this.crash(a, b, A, B, nx, nz, now)) {
            this.gate.commit(key, now);
            continue;
          }
          s.refused++;
        }
      }
      // slow (or not allowed to crash): push apart, lighter / moving one gives way
      s.slowOverlaps++;
      const k = depth * SEP_RATE;
      if (A.stopped) addSeparation(b.id, nx * k, nz * k);
      else if (B.stopped) addSeparation(a.id, -nx * k, -nz * k);
      else {
        const ma = mass(a.kind);
        const mb = mass(b.kind);
        const fa = mb / (ma + mb);
        addSeparation(a.id, -nx * k * fa, -nz * k * fa);
        addSeparation(b.id, nx * k * (1 - fa), nz * k * (1 - fa));
      }
    }
  }

  /** Crashes we created that are still on the map. */
  activeCount(): number {
    if (!this.mine.size) return 0;
    const incidents = useWorld.getState().incidents;
    for (const id of this.mine) {
      const inc = incidents.find((x) => x.id === id);
      if (!inc || inc.status === "cleared") this.mine.delete(id);
    }
    return this.mine.size;
  }

  private crash(a: VehicleEntry, b: VehicleEntry, A: Body, B: Body, nx: number, nz: number, now: number): boolean {
    const closing = Math.max(closingSpeed(A, B), A.stopped ? 0 : A.speed, B.stopped ? 0 : B.speed);
    const imp = impulse(A, mass(a.kind), B, mass(b.kind), nx, nz);
    // owners read this in crash(): velocity change in m/s, world x/z
    a.object.userData.impulse = { x: imp.ax, z: imp.az };
    b.object.userData.impulse = { x: imp.bx, z: imp.bz };
    const okA = a.crash ? a.crash() : false;
    const okB = b.crash ? b.crash() : false;
    delete a.object.userData.impulse;
    delete b.object.userData.impulse;
    if (!okA && !okB) return false;
    this.done.add(a.id).add(b.id);

    // the faster one did the hitting
    const [hitter, victim, victimStopped] = (A.stopped ? 0 : A.speed) >= (B.stopped ? 0 : B.speed) ? [a, b, B.stopped] : [b, a, A.stopped];
    const truck = a.kind === "truck" || b.kind === "truck";
    const kind = truck ? "truck_crash" : "car_crash";
    const note = crashNote(hitter.kind, hitter.id, victim.kind, victim.id, closing, victimStopped);
    const x = (A.x + B.x) / 2;
    const z = (A.z + B.z) / 2;
    const edge = (okA ? a.edgeKey : b.edgeKey) ?? a.edgeKey ?? b.edgeKey ?? "";
    const incidentId = nextId("INC");
    const w = useWorld.getState();
    w.addIncident({ id: incidentId, kind, edgeKey: edge, x, z, status: "active", createdAt: now, note });
    if (edge && !w.blocked[edge]) {
      w.blockEdge(edge, note);
      emit({ type: "road:blocked", edgeKey: edge, reason: note });
    }
    emit({ type: "incident:created", incidentId });
    if (okA) emit({ type: "vehicle:crashed", vehicleId: a.id, incidentId });
    if (okB) emit({ type: "vehicle:crashed", vehicleId: b.id, incidentId });
    this.mine.add(incidentId);
    this.stats.crashes++;
    this.stats.lastCrash = note;
    this.onImpact?.(x, z, nx, nz, Math.min(1, closing / 20), truck);
    return true;
  }
}

function body(v: VehicleEntry, out: Body): Body {
  out.x = v.object.position.x;
  out.z = v.object.position.z;
  out.h = v.object.rotation.y;
  out.speed = v.speed;
  out.stopped = v.stopped;
  return out;
}
