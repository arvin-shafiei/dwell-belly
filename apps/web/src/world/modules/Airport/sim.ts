// The airport's brain: air traffic, the incident director, emergency/crash lifecycles and the fire crews.
// No three.js and no React: side effects on the shared store/bus go through SimEffects, so it is testable.
import type { WorldEvent } from "../../bus";
import type { Incident, IncidentStatus } from "../../store";
import {
  airsideBack,
  airsideOut,
  dispatch,
  makeCrew,
  roadBack,
  roadOut,
  stepCrew,
  type CrewUnit,
} from "./fireCrew";
import { Fleet, type FleetEvent, type Plane } from "./flight";
import { CrashTimeline, Director, EmergencyTimeline, type DirectorOpts, type PlaneIncident } from "./incidents";
import {
  CRASH_SITES,
  crashEdge,
  EMERGENCY_STOP_X,
  RUNWAY_ATTACK,
  RUNWAY_STANDBY,
  RWY,
  type CrashSite,
} from "./layout";
import { v3, type V3 } from "./path";

export interface SimEffects {
  addIncident(i: Incident): void;
  updateIncident(id: string, patch: Partial<Incident>): void;
  blockEdge(key: string, reason: string): void;
  unblockEdge(key: string): void;
  emit(e: WorldEvent): void;
  blocked(): ReadonlySet<string>;
  newId(): string;
  now(): number; // performance.now() ms
}

export interface EmergencyRun {
  incidentId: string;
  plane: Plane;
  tl: EmergencyTimeline;
  towPending: boolean;
  /** seconds since the plane stopped (-1 before) */
  sinceStop: number;
}

export interface CrashRun {
  incidentId: string | null; // set at impact
  plane: Plane;
  site: CrashSite;
  edge: string;
  tl: CrashTimeline | null;
}

/** Smoking engine (left, local +x) in plane-local coordinates. */
export const SICK_ENGINE: V3 = v3(5.2, 1.3, 2.4);

/** Plane-local point -> world, for a plane at pos with heading yaw (ignores pitch/roll; fine on the ground). */
export function planeLocalToWorld(p: Plane, l: V3, out: V3): V3 {
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  out.x = p.pos.x + c * l.x + s * l.z;
  out.y = p.pos.y + l.y;
  out.z = p.pos.z - s * l.x + c * l.z;
  return out;
}

export class AirportSim {
  readonly fleet: Fleet;
  readonly director: Director;
  readonly crew: CrewUnit[] = makeCrew();
  emergency: EmergencyRun | null = null;
  crash: CrashRun | null = null;
  /** Fleet events of the last step, for one-shot effects (tyre smoke, sparks, fireball). */
  fx: FleetEvent[] = [];
  /** Increments every step, so renderers consume `fx` exactly once. */
  stepId = 0;
  time = 0;

  constructor(
    private fxs: SimEffects,
    private rand: () => number = Math.random,
    opts: DirectorOpts = {},
  ) {
    this.fleet = new Fleet(rand);
    this.director = new Director(rand, opts);
  }

  get busy() {
    return !!this.emergency || !!this.crash || this.crew.some((u) => u.state !== "home");
  }

  request(kind: PlaneIncident) {
    this.director.request(kind);
  }

  step(dt: number) {
    this.time += dt;
    this.stepId++;
    this.fleet.step(dt);
    this.fx = this.fleet.events;

    const kind = this.director.step(dt, this.busy);
    if (kind && !(kind === "emergency_landing" ? this.startEmergency() : this.startCrash())) this.director.retry(kind);

    if (this.emergency) this.stepEmergency(dt, this.emergency);
    if (this.crash) this.stepCrash(dt, this.crash);
    for (const u of this.crew) stepCrew(u, dt);
  }

  // --- Emergency landing ----------------------------------------------------------

  private startEmergency(): boolean {
    const plane = this.fleet.declareEmergency();
    if (!plane) return false;
    const id = this.fxs.newId();
    this.fxs.addIncident({
      id,
      kind: "emergency_landing",
      edgeKey: "runway_09",
      x: EMERGENCY_STOP_X,
      z: RWY.z,
      status: "active",
      createdAt: this.fxs.now(),
      note: `Emergency landing: ${plane.callsign} engine fire, runway 09 closed`,
    });
    this.fxs.emit({ type: "incident:created", incidentId: id });
    this.emergency = { incidentId: id, plane, tl: new EmergencyTimeline(), towPending: false, sinceStop: -1 };
    this.crew.forEach((u, i) => {
      dispatch(u, airsideOut(u, RUNWAY_STANDBY[i]), [], i * 1.2, 16, "out");
      u.target = v3(RUNWAY_STANDBY[i].x + 10, 0, RWY.z);
    });
    return true;
  }

  private stepEmergency(dt: number, e: EmergencyRun) {
    const p = e.plane;
    const stopped = p.phase === "stopped" || p.phase === "towed" || p.phase === "parked";
    if (e.sinceStop >= 0) e.sinceStop += dt;
    const offRunway = p.phase === "parked" || (p.phase === "towed" && p.pos.z > RWY.z + RWY.halfW + 2);
    const a = e.tl.update(dt, { stopped, offRunway });
    if (a.status) this.setStatus(e.incidentId, a.status);
    if (a.status === "responding") {
      e.sinceStop = 0;
      // move in: tenders either side of the burning engine, ambulance by the evacuees
      const engine = planeLocalToWorld(p, SICK_ENGINE, v3(0, 0, 0));
      this.crew.forEach((u, i) => {
        const dest = RUNWAY_ATTACK[i];
        // the far tender swings out round the back so it doesn't drive through its colleague
        const pts = i === 1 ? [v3(u.x, 0, u.z), v3(u.x + 8, 0, -437), v3(dest.x - 8, 0, -437), v3(dest.x, 0, dest.z)] : [v3(u.x, 0, u.z), v3(dest.x, 0, dest.z)];
        dispatch(u, pts, [], i * 0.4, 9, "out");
        u.target = u.kind === "fire" ? engine : v3(p.pos.x, 0, p.pos.z - 14);
      });
    }
    if (a.startTow) e.towPending = true;
    if (e.towPending && this.fleet.startTow(p)) e.towPending = false;
    for (const u of this.crew) u.spraying = u.kind === "fire" && u.state === "onscene" && e.tl.stage === "evacuating";
    if (a.clear) {
      this.fxs.emit({ type: "incident:cleared", incidentId: e.incidentId });
      this.fleet.reopenRunway();
      for (const u of this.crew) {
        u.spraying = false;
        dispatch(u, airsideBack(u), [], u.index * 1.5, 14, "returning");
      }
      this.emergency = null;
    }
  }

  // --- Plane crash -----------------------------------------------------------------

  private startCrash(): boolean {
    const site = CRASH_SITES[Math.floor(this.rand() * CRASH_SITES.length)];
    const plane = this.fleet.declareCrash(site);
    if (!plane) return false;
    this.crash = { incidentId: null, plane, site, edge: crashEdge(site), tl: null };
    return true;
  }

  private stepCrash(dt: number, c: CrashRun) {
    if (!c.tl) {
      if (c.plane.phase !== "crashed") return;
      this.impact(c);
      return;
    }
    const onScene = this.crew.some((u) => u.kind === "fire" && u.state === "onscene");
    const a = c.tl.update(dt, onScene);
    if (a.status && c.incidentId) this.setStatus(c.incidentId, a.status);
    for (const u of this.crew) u.spraying = u.kind === "fire" && u.state === "onscene" && c.tl.foaming;
    if (a.clear && c.incidentId) {
      this.fxs.unblockEdge(c.edge);
      this.fxs.emit({ type: "incident:cleared", incidentId: c.incidentId });
      this.fxs.emit({ type: "road:reopened", edgeKey: c.edge });
      this.fleet.releaseCrashed(c.plane);
      const blocked = this.fxs.blocked();
      for (const u of this.crew) {
        u.spraying = false;
        const r = roadBack(u, c.site, blocked);
        if (r) dispatch(u, r.pts, r.segs, u.index * 1.5, 16, "returning");
        else dispatch(u, [v3(u.x, 0, u.z), v3(u.home.x, 0, u.home.z)], [], u.index * 1.5, 14, "returning");
      }
      this.crash = null;
    }
  }

  private impact(c: CrashRun) {
    const id = this.fxs.newId();
    c.incidentId = id;
    c.tl = new CrashTimeline();
    const what = c.plane.spec.cargo ? "Cargo jet" : "Jet";
    this.fxs.addIncident({
      id,
      kind: "plane_crash",
      edgeKey: c.edge,
      x: c.site.x,
      z: c.site.z,
      status: "active",
      createdAt: this.fxs.now(),
      note: `${what} ${c.plane.callsign} down ${c.site.where}, road closed`,
    });
    this.fxs.blockEdge(c.edge, "Plane crash");
    this.fxs.emit({ type: "incident:created", incidentId: id });
    this.fxs.emit({ type: "road:blocked", edgeKey: c.edge, reason: "Plane crash" });
    const blocked = this.fxs.blocked();
    for (const u of this.crew) {
      const r = roadOut(u, c.site, blocked);
      if (r) dispatch(u, r.pts, r.segs, u.index * 1.6, 17, "out");
      else dispatch(u, [v3(u.x, 0, u.z), v3(c.site.x + 20, 0, c.site.z + u.index * 8)], [], u.index * 1.6, 14, "out");
      u.target = v3(c.site.x, 0, c.site.z);
    }
  }

  private setStatus(id: string, status: IncidentStatus) {
    this.fxs.updateIncident(id, { status });
  }
}
