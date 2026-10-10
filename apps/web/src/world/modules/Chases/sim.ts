// Chases simulation: police pursuits (getaway, 2-3 police cars, helicopter), night street races and
// speed cameras. Imperative three.js objects built once and pooled; per-frame state lives here, the
// store is only touched when a chase ends in a crash (incident + closed road).
import * as THREE from "three";
import { emit, on } from "../../bus";
import { allVehicles, nextId, type VehicleEntry } from "../../registry";
import { PLACES, ROAD_NODES, edgeKey, findPath, getEdge, getNode, neighbours } from "../../roads";
import { signalFor } from "../../signals";
import { blockedSet, useWorld } from "../../store";
import { blockageT, poseAt, replanPath, type Pose } from "../Traffic/driving";
import {
  boxSlots,
  cameraSites,
  chooseTurn,
  escapeNode,
  isMotorwayEdge,
  isNight,
  newChase,
  nextChaseDelay,
  pursuitTarget,
  raceStrip,
  racerLaunch,
  rollEnding,
  speedingHit,
  stepChase,
  straightAhead,
  turnKind,
  type CameraSite,
  type ChaseAction,
  type ChaseState,
  type Slot,
} from "./logic";
import {
  buildCameras,
  buildFigure,
  buildGetaway,
  buildHeli,
  buildLamppost,
  buildPolice,
  buildRacer,
  buildSparks,
  disposeKit,
  type CarParts,
  type Figure,
  type HeliParts,
  type PoliceParts,
  type Sparks,
} from "./meshes";
import { KERB_LAT, Mover, OVERTAKE_LAT } from "./mover";

const rand = Math.random;
const between = (a: number, b: number) => a + rand() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (u: number) => {
  const c = clamp(u, 0, 1);
  return c * c * (3 - 2 * c);
};
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

const GETAWAY_FACTOR = 1.7;
const POLICE_FACTOR = 1.95;
const POLICE_GIVEUP_FACTOR = 1.45;
const HELI_Y = 46;
const FIRST_CHASE_S: [number, number] = [25, 40];
const RACE_EVERY_S: [number, number] = [40, 75];
const WRECK_SAFETY_S = 150;
const SITE_COOL_S = 1.1;

type PoliceMode = "idle" | "waiting" | "pursue" | "box" | "parked" | "leave";

interface Police {
  parts: PoliceParts;
  mv: Mover;
  role: number;
  mode: PoliceMode;
  spawnAt: number; // chase time to leave
  start: string;
  slot: Slot | null;
  boxFrom: Pose;
  boxU: number;
  boxDur: number;
  flash: number;
  checkIn: number;
}

interface Car {
  parts: CarParts;
  mv: Mover;
}

interface Racer extends Car {
  accel: number;
  top: number;
  manT: number;
  smokeT: number;
}

type RacePhase = "idle" | "staging" | "racing";

interface CamState {
  site: CameraSite;
  cool: number;
  lastId: string;
  flashT: number; // seconds since the flash started (Infinity = idle)
}

export class ChaseSim {
  readonly root = new THREE.Group();
  private police: Police[] = [];
  private getaways: Record<"saloon" | "van", Car>;
  private g: Car | null = null;
  private heli: HeliParts;
  private heliActive = false;
  private heliPos = new THREE.Vector3();
  private heliVel = new THREE.Vector3();
  private heliOrbit = 0;
  private heliLeaveT = 0;
  private officers: Figure[];
  private suspect: Figure;
  private lamppost: THREE.Group;
  private lampFall = -1; // seconds since knocked (-1 = standing/hidden)
  private racers: Racer[];
  private race: RacePhase = "idle";
  private raceSawRed = false;
  private raceWait = 0;
  private raceTimer = between(...RACE_EVERY_S);
  private raceEnd = 0; // path index where the strip ends
  private cams: CamState[];
  private camFlash: THREE.InstancedMesh;
  private sparks: Sparks;
  private lights: THREE.PointLight[] = [];
  private materials: THREE.Material[] = [];
  private geos: THREE.BufferGeometry[] = [];

  private chase: ChaseState | null = null;
  private chaseTimer = between(...FIRST_CHASE_S);
  private escapeDest: string | null = null;
  private escapeRouted = false;
  private gaveUpAt = 0;
  private manT = 0; // getaway manoeuvre timer
  private ramCool = 0;
  private prevH = 0;
  private spin = { from: { x: 0, z: 0, h: 0 }, to: { x: 0, z: 0, h: 0 }, yaw: 0, u: 0, dur: 1 };
  private arrestT = -1;
  private wreck: { incidentId: string; at: number; smokeT: number } | null = null;
  private suspectFrom = { x: 0, z: 0 };
  private officerFrom: [number, number][] = [
    [0, 0],
    [0, 0],
  ];

  private blocked = new Set<string>();
  private blockedDirty = true;
  private cleanup: (() => void)[] = [];
  private night = false;
  private sim = 0;
  private tmpV = new THREE.Vector3();
  private tmpU = new THREE.Vector3();
  private o = new THREE.Object3D();
  private up = new THREE.Vector3(0, 1, 0);

  constructor() {
    this.root.name = "chases";
    for (let i = 0; i < 3; i++) {
      const parts = buildPolice();
      this.root.add(parts.root);
      this.materials.push(...parts.own);
      this.police.push({
        parts, mv: new Mover(parts.root, "police", 2.2), role: i, mode: "idle", spawnAt: 0, start: "",
        slot: null, boxFrom: { x: 0, z: 0, h: 0 }, boxU: 0, boxDur: 2, flash: rand() * 10, checkIn: 0,
      });
    }
    const saloon = buildGetaway("saloon");
    const van = buildGetaway("van");
    this.getaways = { saloon: { parts: saloon, mv: new Mover(saloon.root, "car", 2.35) }, van: { parts: van, mv: new Mover(van.root, "car", 2.6) } };
    this.root.add(saloon.root, van.root);
    this.materials.push(...saloon.own, ...van.own);

    this.heli = buildHeli();
    this.root.add(this.heli.root, this.heli.cone, this.heli.spot);
    this.materials.push(...this.heli.own);
    this.geos.push(...this.heli.geos);

    this.officers = [buildFigure("officer"), buildFigure("officer")];
    this.suspect = buildFigure("suspect");
    for (const f of [...this.officers, this.suspect]) this.root.add(f.root);
    this.lamppost = buildLamppost();
    this.root.add(this.lamppost);

    const neon: [string, string][] = [
      ["#1d6bff", "#19e6ff"],
      ["#e8e8ea", "#ff2bd6"],
      ["#ffd21a", "#4dff6a"],
      ["#c8141c", "#9d4dff"],
    ];
    this.racers = [0, 1].map((i) => {
      const [paint, glow] = neon[(i * 2 + Math.floor(rand() * 2)) % neon.length];
      const parts = buildRacer(paint, glow);
      this.root.add(parts.root);
      this.materials.push(...parts.own);
      return { parts, mv: new Mover(parts.root, "car", 2.2), accel: 7, top: 32, manT: 0, smokeT: 0 };
    });

    const sites = cameraSites();
    this.cams = sites.map((site) => ({ site, cool: 0, lastId: "", flashT: Infinity }));
    const cams = buildCameras(sites);
    this.camFlash = cams.flash;
    this.materials.push(...cams.own);
    for (const m of cams.meshes) this.root.add(m);

    this.sparks = buildSparks();
    this.root.add(this.sparks.mesh);

    for (let i = 0; i < 2; i++) {
      const L = new THREE.PointLight("#3d6bff", 0, 26, 2);
      this.lights.push(L);
      this.root.add(L);
    }
  }

  start() {
    this.blocked = blockedSet();
    this.cleanup.push(
      useWorld.subscribe((s, p) => {
        if (s.blocked !== p.blocked) this.blockedDirty = true;
      }),
      on((e) => {
        if (e.type === "incident:cleared" && this.wreck?.incidentId === e.incidentId) this.removeWreck();
      }),
    );
  }

  stop() {
    for (const c of this.cleanup) c();
    this.cleanup = [];
    if (this.wreck) this.clearWreckIncident();
    for (const p of this.police) p.mv.despawn();
    for (const c of Object.values(this.getaways)) c.mv.despawn();
    for (const r of this.racers) r.mv.despawn();
  }

  dispose() {
    for (const m of this.materials) m.dispose();
    for (const g of this.geos) g.dispose();
    disposeKit();
  }

  /** Dev/demo hooks: start a chase / race now. */
  triggerChase() {
    if (!this.chase && !this.wreck) this.startChase();
  }
  triggerRace() {
    if (this.race === "idle") this.stageRace();
  }

  // --- per frame ----------------------------------------------------------------------------

  step(rawDt: number) {
    const dt = Math.min(rawDt, 0.1);
    const world = useWorld.getState();
    if (world.paused || dt <= 0) return;
    this.sim += dt;
    const now = performance.now();
    this.night = isNight(world.timeOfDay);
    if (this.blockedDirty) {
      this.blocked = blockedSet();
      this.blockedDirty = false;
    }

    if (!this.chase) {
      this.chaseTimer -= dt;
      if (this.chaseTimer <= 0 && !this.wreck) this.startChase();
    } else this.stepChase(dt);

    this.stepWreck(dt);
    this.stepRace(dt, now);
    this.stepCameras(dt);
    this.sparks.step(dt);
    this.renderPolice();
  }

  // --- chase lifecycle ------------------------------------------------------------------------

  private startChase() {
    const blocked = this.blocked;
    // start on a downtown street, away from the police station
    let path: string[] | null = null;
    for (let attempt = 0; attempt < 12 && !path; attempt++) {
      const i = Math.floor(between(-3, 4));
      const j = Math.floor(between(-3, 4));
      const a = `g_${i}_${j}`;
      if (!ROAD_NODES.has(a) || a === PLACES.policeStation) continue;
      const opts = neighbours(a).filter((n) => !blocked.has(edgeKey(a, n)));
      if (!opts.length) continue;
      const b = opts[Math.floor(rand() * opts.length)];
      poseAt([a, b], 0, 0.3, this.spin.from);
      if (!this.isFree(this.spin.from.x, this.spin.from.z, 9)) continue;
      path = [a, b];
    }
    if (!path) {
      this.chaseTimer = 5;
      return;
    }
    this.g = rand() < 0.25 ? this.getaways.van : this.getaways.saloon;
    const g = this.g;
    g.mv.spawn(path, 0, 0.3, 3, "getaway");
    this.extendGetaway();
    g.parts.hazard.color.set("#5a3300");
    g.parts.body.rotation.set(0, 0, 0);
    g.parts.body.position.set(0, 0, 0);
    this.prevH = g.mv.pose.h;
    const ending = rollEnding(rand());
    this.chase = newChase(ending, rand);
    this.escapeDest = ending === "escape" ? escapeNode(getNode(path[0]), rand) : null;
    this.escapeRouted = false;
    this.manT = 0;
    this.arrestT = -1;
    this.lampFall = -1;
    this.lamppost.visible = false;

    // police: one from the station, the rest are patrol cars from nearby streets
    const startNode = getNode(path[0]);
    const nearby = [...ROAD_NODES.values()]
      .filter((n) => n.id.startsWith("g_") && n.id !== PLACES.policeStation && n.id !== path![0] && n.id !== path![1])
      .filter((n) => {
        const d = Math.hypot(n.x - startNode.x, n.z - startNode.z);
        return d > 80 && d < 200;
      })
      .sort(() => rand() - 0.5);
    const count = rand() < 0.55 ? 3 : 2;
    const starts = [PLACES.policeStation, ...nearby.map((n) => n.id)];
    this.police.forEach((p, i) => {
      p.mode = i < count ? "waiting" : "idle";
      p.spawnAt = i === 0 ? 1.2 : 2.2 + i * 1.4;
      p.start = starts[i] ?? PLACES.policeStation;
      p.slot = null;
      p.role = i;
    });

    // helicopter scrambles from over the station
    const st = getNode(PLACES.policeStation);
    this.heliPos.set(st.x - 60, HELI_Y + 30, st.z + 40);
    this.heliVel.set(0, 0, 0);
    this.heliActive = true;
    this.heliLeaveT = 0;
    this.heli.root.visible = true;
  }

  private stepChase(dt: number) {
    const s = this.chase!;
    const g = this.g!;

    for (const p of this.police) if (p.mode === "waiting" && s.t >= p.spawnAt && s.phase === "fleeing") this.spawnPolice(p);

    // inputs for the state machine
    let gap = Infinity;
    let behind = false;
    const gh = g.mv.pose.h;
    const hx = Math.sin(gh);
    const hz = Math.cos(gh);
    for (const p of this.police) {
      if (!p.mv.active || p.mode !== "pursue") continue;
      const dx = g.mv.object.position.x - p.mv.object.position.x;
      const dz = g.mv.object.position.z - p.mv.object.position.z;
      const d = Math.hypot(dx, dz);
      if (d < gap) gap = d;
      // right behind: in the getaway's wake, pointing the same way
      const along = dx * hx + dz * hz;
      const side = Math.abs(dx * hz - dz * hx);
      const sameWay = Math.sin(p.mv.pose.h) * hx + Math.cos(p.mv.pose.h) * hz > 0.7;
      if (along > 0 && along < 14 && side < 3.5 && sameWay) behind = true;
    }
    const straight = g.mv.active && !g.mv.free && straightAhead(g.mv.path, g.mv.idx, g.mv.t) > 16;
    const onMotorway = g.mv.active && !g.mv.free && isMotorwayEdge(g.mv.from, g.mv.to);
    const allHome = this.police.every((p) => !p.mv.active) && !this.heliActive && (!g.mv.active || !!this.wreck);
    const act = stepChase(s, { gap, behind, straight, onMotorway, allHome }, dt);
    if (act) this.onAction(act);

    // vehicles
    if (g.mv.active) {
      const escaping = s.ending === "escape" && (s.phase === "escaped" || s.phase === "leaving");
      if (s.phase === "fleeing" || escaping) this.driveGetaway(dt);
      else if (s.phase === "leaving" && s.ending === "pit") this.driveHome(g.mv, dt, 1);
      else {
        if (s.phase === "pit" || s.phase === "crashed") this.spinGetaway(dt);
        g.mv.update(0);
      }
    }
    for (const p of this.police) {
      if (!p.mv.active) continue;
      if (p.mode === "pursue") this.drivePolice(p, dt);
      else if (p.mode === "box") this.boxPolice(p, dt);
      else if (p.mode === "leave") this.driveHome(p.mv, dt, 1.05);
      else p.mv.update(0);
    }
    if (this.arrestT >= 0) this.stepArrest(dt);
    if (this.lampFall >= 0) {
      this.lampFall += dt;
      this.lamppost.rotation.x = 1.42 * Math.min(1, (this.lampFall / 1.1) ** 2);
    }
    this.stepHeli(dt);

    if (s.phase === "done") this.endChase();
  }

  private onAction(act: ChaseAction) {
    const g = this.g!;
    switch (act) {
      case "spin":
        this.startSpin();
        return;
      case "crash":
        this.startCrash();
        return;
      case "give_up":
        for (const p of this.police) if (p.mv.active) this.sendHome(p);
        this.gaveUpAt = this.chase!.t;
        this.heliLeaveT = 0.01;
        return;
      case "start_arrest":
        this.startArrest();
        return;
      case "release":
        this.arrestT = -1;
        for (const f of [...this.officers, this.suspect]) f.root.visible = false;
        for (const p of this.police) if (p.mv.active && p.mode !== "leave") this.sendHome(p);
        if (this.chase!.ending === "pit" && g.mv.active) this.rejoinHome(g.mv);
        this.heliLeaveT = 0.01;
        return;
      case "finish":
        return;
    }
  }

  private endChase() {
    for (const p of this.police) {
      p.mv.despawn();
      p.mode = "idle";
    }
    if (this.g && !this.wreck) this.g.mv.despawn();
    this.heliActive = false;
    this.heli.root.visible = false;
    this.heli.cone.visible = false;
    this.heli.spot.visible = false;
    for (const f of [...this.officers, this.suspect]) f.root.visible = false;
    this.chase = null;
    this.chaseTimer = nextChaseDelay(rand);
  }

  // --- getaway ----------------------------------------------------------------------------

  private extendGetaway() {
    const mv = this.g!.mv;
    while (mv.idx + 3 >= mv.path.length) {
      const last = mv.path[mv.path.length - 1];
      const prev = mv.path[mv.path.length - 2];
      const next = chooseTurn(prev, last, this.blocked, rand);
      if (!next) return;
      mv.path.push(next);
    }
  }

  private routeEscape() {
    const mv = this.g!.mv;
    if (!this.escapeDest) return;
    const r = replanPath(mv.path, mv.idx, this.escapeDest, this.blocked);
    if (r) {
      mv.path = r.path;
      mv.idx = r.idx;
      this.escapeRouted = true;
    }
  }

  private driveGetaway(dt: number) {
    const s = this.chase!;
    const mv = this.g!.mv;
    // escape: head for the motorway once the chase has run a while; afterwards keep going along it
    if (s.ending === "escape" && !this.escapeRouted && s.t > s.minFleeS * 0.5) this.routeEscape();
    if (s.phase === "leaving" && s.t - this.gaveUpAt > 30) {
      mv.despawn(); // gone: lost on the motorway
      return;
    }
    if (this.escapeRouted && mv.idx + 2 >= mv.path.length) {
      this.escapeDest = escapeNode(getNode(mv.to), rand);
      this.routeEscape();
    }
    if (!this.escapeRouted) this.extendGetaway();
    if (mv.idx + 1 >= mv.path.length) return;

    const fleeing = s.phase === "fleeing";
    const limit = mv.limit;
    let v0 = limit * (fleeing ? GETAWAY_FACTOR : 1.35);
    v0 = Math.min(v0, this.turnCap(mv, 9));

    // weaving through traffic
    const lead = mv.lead();
    if (mv.latTarget === 0) {
      if (lead.gap < 26 && lead.speed < mv.speed - 1.5) {
        const kind = getEdge(mv.from, mv.to)?.kind;
        if (straightAhead(mv.path, mv.idx, mv.t) > 32 && !mv.oncoming(60)) {
          mv.latTarget = OVERTAKE_LAT;
          this.manT = 0;
        } else if (kind === "street" || kind === "country") {
          mv.latTarget = KERB_LAT;
          this.manT = 0;
        } else if (lead.gap < 1.2) this.ram(lead.v, lead.speed);
        else v0 = Math.min(v0, lead.speed + Math.max(0, lead.gap - 1) * 1.5);
      }
    } else {
      this.manT += dt;
      const nearJunction = mv.remaining < 10 && mv.idx + 2 < mv.path.length && turnKind(mv.from, mv.to, mv.path[mv.idx + 2]) !== 0;
      if ((this.manT > 1.2 && this.laneClear(mv, 9)) || nearJunction) mv.latTarget = 0;
      if (mv.latTarget === KERB_LAT || mv.lat < -1) v0 = Math.min(v0, 13);
    }
    // kerb: bounce and lean
    const onKerb = mv.lat < -1.4;
    mv.lift += ((onKerb ? 0.16 + Math.abs(Math.sin(this.sim * 23)) * 0.05 : 0) - mv.lift) * Math.min(1, dt * 12);
    this.accelerate(mv, v0, dt, 7, 12);
    const entered = mv.move(mv.speed * dt);
    if (entered && !this.escapeRouted) this.extendGetaway();

    // body roll from turning
    const dh = wrap(mv.pose.h - this.prevH);
    this.prevH = mv.pose.h;
    const rollTarget = clamp((-dh / Math.max(dt, 1e-3)) * 0.05, -0.12, 0.12) + (onKerb ? 0.05 : 0);
    mv.roll += (rollTarget - mv.roll) * Math.min(1, dt * 6);
    mv.update(dt);
  }

  private turnCap(mv: Mover, vTurn: number) {
    if (mv.idx + 2 >= mv.path.length) return Math.max(3, mv.remaining * 0.8);
    const tk = turnKind(mv.from, mv.to, mv.path[mv.idx + 2]);
    if (tk === 0) return Infinity;
    const vt = tk === 2 ? 4 : vTurn;
    return vt + Math.max(0, mv.remaining - 6) * 0.55;
  }

  private accelerate(mv: Mover, v0: number, dt: number, up: number, down: number) {
    mv.speed = Math.max(0, mv.speed + clamp(v0 - mv.speed, -down * dt, up * dt));
  }

  /** No vehicle on our own lane within `m` metres of us (so we can pull back in). */
  private laneClear(mv: Mover, m: number) {
    const len = mv.edgeLen;
    const mine = mv.t * len;
    for (const v of allVehicles()) {
      if (v.id === mv.entry.id || v.from !== mv.from || v.to !== mv.to) continue;
      if (Math.abs(v.t * len - mine) < m) return false;
    }
    return true;
  }

  /** The getaway rams a slower car: sparks, a jolt, and it loses speed. */
  private ram(v: VehicleEntry | null, leadSpeed: number) {
    const mv = this.g!.mv;
    mv.speed = Math.min(mv.speed, leadSpeed + 1.5);
    if (this.ramCool > this.sim) return;
    this.ramCool = this.sim + 1.2;
    mv.yaw = (rand() < 0.5 ? -1 : 1) * 0.12;
    const fx = Math.sin(mv.pose.h);
    const fz = Math.cos(mv.pose.h);
    const x = mv.pose.x + fx * 2.4;
    const z = mv.pose.z + fz * 2.4;
    this.burst(x, 0.6, z, 14, 0);
    // a tiny shove (owners re-place their objects each frame, so this is a one-frame jolt at most)
    if (v) {
      v.object.position.x += fx * 0.25;
      v.object.position.z += fz * 0.25;
    }
  }

  private burst(x: number, y: number, z: number, sparks: number, puffs: number) {
    for (let i = 0; i < sparks; i++) {
      const a = rand() * Math.PI * 2;
      const sp = between(3, 9);
      this.sparks.emit(x, y, z, Math.cos(a) * sp, between(2, 7), Math.sin(a) * sp, between(0.3, 0.7), between(0.07, 0.12), 1, between(0.6, 0.9), 0.3);
    }
    for (let i = 0; i < puffs; i++) {
      const a = rand() * Math.PI * 2;
      this.sparks.emit(x, 0.6, z, Math.cos(a) * 1.5, between(0.6, 1.5), Math.sin(a) * 1.5, between(1.6, 2.6), between(0.5, 0.9), 0.4, 0.4, 0.42);
    }
  }

  // --- endings ----------------------------------------------------------------------------

  /** Bake the lane offset into the pose and switch to scripted motion. */
  private freeze(mv: Mover) {
    const h = mv.pose.h;
    mv.pose.x -= Math.cos(h) * mv.lat;
    mv.pose.z += Math.sin(h) * mv.lat;
    mv.lat = mv.latTarget = mv.latVel = 0;
    mv.lift = 0;
    mv.free = true;
  }

  private startSpin() {
    const mv = this.g!.mv;
    this.freeze(mv);
    const dir = rand() < 0.5 ? -1 : 1;
    const slide = Math.min(16, mv.speed * 0.9 + 4);
    const fx = Math.sin(mv.pose.h);
    const fz = Math.cos(mv.pose.h);
    this.spin.from = { x: mv.pose.x, z: mv.pose.z, h: mv.pose.h };
    this.spin.to = { x: mv.pose.x + fx * slide - fz * dir * 1.2, z: mv.pose.z + fz * slide + fx * dir * 1.2, h: mv.pose.h };
    this.spin.yaw = dir * between(2.3, 3.0);
    this.spin.u = 0;
    this.spin.dur = 1.6;
    this.burst(mv.pose.x - fx * 2.2, 0.5, mv.pose.z - fz * 2.2, 18, 6);
    const final = this.spin.to;
    const slots = boxSlots(final.x, final.z, final.h + this.spin.yaw, 3);
    let k = 0;
    for (const p of this.police) if (p.mv.active) this.startBox(p, slots[k++]);
  }

  private spinGetaway(dt: number) {
    const mv = this.g!.mv;
    const sp = this.spin;
    if (sp.u >= 1) return;
    sp.u = Math.min(1, sp.u + dt / sp.dur);
    const e = 1 - (1 - sp.u) ** 2;
    mv.pose.x = sp.from.x + (sp.to.x - sp.from.x) * e;
    mv.pose.z = sp.from.z + (sp.to.z - sp.from.z) * e;
    mv.pose.h = sp.from.h;
    mv.yaw = sp.yaw * e;
    mv.roll = 0.08 * Math.sin(sp.u * Math.PI) * Math.sign(sp.yaw);
    mv.speed = (1 - sp.u) * 8;
    if (rand() < 0.5) {
      const h = mv.pose.h + mv.yaw;
      this.sparks.emit(mv.pose.x - Math.sin(h) * 2, 0.3, mv.pose.z - Math.cos(h) * 2, 0, 0.8, 0, 1.4, 0.45, 0.75, 0.75, 0.78);
    }
    if (sp.u >= 1) {
      mv.speed = 0;
      mv.roll = 0;
    }
  }

  private startCrash() {
    const g = this.g!;
    const mv = g.mv;
    this.freeze(mv);
    const h = mv.pose.h;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    // a registry car just ahead of us that can be crashed, else a lamppost on the kerb
    let victim: VehicleEntry | null = null;
    let best = 26;
    for (const v of allVehicles()) {
      if (v.id === mv.entry.id || !v.crash || (v.kind !== "car" && v.kind !== "taxi" && v.kind !== "van")) continue;
      if (this.isOurs(v.id)) continue;
      const dx = v.object.position.x - mv.pose.x;
      const dz = v.object.position.z - mv.pose.z;
      const d = Math.hypot(dx, dz);
      if (d < 4 || d > best || (dx * fx + dz * fz) / d < 0.55) continue;
      best = d;
      victim = v;
    }
    let note: string;
    let tx: number;
    let tz: number;
    const ids = [mv.entry.id];
    if (victim && victim.crash!()) {
      const vx = victim.object.position.x;
      const vz = victim.object.position.z;
      const d = Math.hypot(vx - mv.pose.x, vz - mv.pose.z) || 1;
      tx = vx - ((vx - mv.pose.x) / d) * 4.3;
      tz = vz - ((vz - mv.pose.z) / d) * 4.3;
      ids.push(victim.id);
      note = "Police chase ends in a crash: getaway car smashed into traffic";
    } else {
      const lx = Math.cos(h); // left of travel
      const lz = -Math.sin(h);
      const ahead = clamp(mv.speed * 0.8, 8, 14);
      const px = mv.pose.x + fx * ahead + lx * 2.6;
      const pz = mv.pose.z + fz * ahead + lz * 2.6;
      this.lamppost.position.set(px, 0, pz);
      this.lamppost.rotation.set(0, h, 0, "YXZ");
      this.lamppost.visible = true;
      this.lampFall = -1;
      tx = px - fx * 2.6 - lx * 0.6;
      tz = pz - fz * 2.6 - lz * 0.6;
      note = "Police chase ends in a crash: getaway car hit a lamppost";
    }
    this.spin.from = { x: mv.pose.x, z: mv.pose.z, h };
    this.spin.to = { x: tx, z: tz, h };
    this.spin.yaw = (victim ? (rand() < 0.5 ? -1 : 1) * between(0.5, 0.9) : 0.45);
    this.spin.u = 0;
    this.spin.dur = 0.9;
    // impact a moment later (when the slide ends): schedule via wreck state
    const key = mv.entry.edgeKey ?? edgeKey(mv.from, mv.to);
    const incidentId = nextId("INC");
    this.wreck = { incidentId, at: this.sim, smokeT: 0 };
    const w = useWorld.getState();
    try {
      w.addIncident({ id: incidentId, kind: "car_crash", edgeKey: key, x: tx, z: tz, status: "active", createdAt: performance.now(), note });
      w.blockEdge(key, note);
      emit({ type: "incident:created", incidentId });
      emit({ type: "road:blocked", edgeKey: key, reason: note });
      for (const vehicleId of ids) emit({ type: "vehicle:crashed", vehicleId, incidentId });
    } catch (err) {
      console.warn("[Chases] incident failed", err);
    }
    const slots = boxSlots(tx, tz, h + this.spin.yaw, 3);
    let k = 0;
    for (const p of this.police) if (p.mv.active) this.startBox(p, slots[k++]);
  }

  private stepWreck(dt: number) {
    const w = this.wreck;
    if (!w || !this.g) return;
    const mv = this.g.mv;
    const age = this.sim - w.at;
    // impact when the slide finishes
    if (age >= 0.9 && age - dt < 0.9) {
      const h = mv.pose.h + mv.yaw;
      this.burst(mv.pose.x + Math.sin(h) * 2.3, 0.7, mv.pose.z + Math.cos(h) * 2.3, 30, 8);
      if (this.lamppost.visible) this.lampFall = 0;
      mv.roll = 0.06;
    }
    if (age > 0.9) {
      this.g.parts.hazard.color.set(Math.floor(this.sim * 2.6) % 2 ? "#ffb020" : "#5a3300");
      w.smokeT -= dt;
      if (w.smokeT <= 0) {
        w.smokeT = 0.35;
        const h = mv.pose.h + mv.yaw;
        this.sparks.emit(mv.pose.x + Math.sin(h) * 1.6, 1.0, mv.pose.z + Math.cos(h) * 1.6, between(-0.3, 0.3), 1.2, between(-0.3, 0.3), 2.4, 0.5, 0.33, 0.33, 0.35);
      }
    }
    if (this.lampFall >= 0 && !this.chase) {
      this.lampFall += dt;
      this.lamppost.rotation.x = 1.42 * Math.min(1, (this.lampFall / 1.1) ** 2);
    }
    if (!this.chase) mv.update(0);
    // safety net: nobody cleared it
    if (age > WRECK_SAFETY_S) this.clearWreckIncident();
  }

  private clearWreckIncident() {
    const w = this.wreck;
    if (!w) return;
    const st = useWorld.getState();
    const inc = st.incidents.find((i) => i.id === w.incidentId);
    if (inc && inc.status !== "cleared") {
      st.updateIncident(inc.id, { status: "cleared" });
      st.unblockEdge(inc.edgeKey);
      emit({ type: "incident:cleared", incidentId: inc.id });
      emit({ type: "road:reopened", edgeKey: inc.edgeKey });
    }
    this.removeWreck();
  }

  private removeWreck() {
    if (!this.wreck) return;
    this.wreck = null;
    this.lamppost.visible = false;
    this.lampFall = -1;
    if (this.g && (!this.chase || this.chase.phase === "leaving" || this.chase.phase === "done")) this.g.mv.despawn();
  }

  // --- police -----------------------------------------------------------------------------

  private spawnPolice(p: Police) {
    const g = this.g!.mv;
    const tgt = pursuitTarget(p.role, { from: g.from, to: g.to, path: g.path, idx: g.idx }, "");
    let path = findPath(p.start, tgt, this.blocked);
    if (!path || path.length < 2) {
      const nb = neighbours(p.start).find((n) => !this.blocked.has(edgeKey(p.start, n)));
      if (!nb) return;
      path = [p.start, nb];
    }
    p.mv.spawn(path, 0, 0.05, 6, "police");
    p.mode = "pursue";
    p.checkIn = 0.5;
  }

  private drivePolice(p: Police, dt: number) {
    const mv = p.mv;
    const g = this.g!.mv;
    const s = this.chase!;
    // right behind the getaway on its lane: share its route exactly
    if (mv.from === g.from && mv.to === g.to && !g.free) {
      if (mv.path[mv.idx + 2] !== g.path[g.idx + 2] || mv.path.length - mv.idx !== g.path.length - g.idx) {
        const prev = mv.idx > 0 ? mv.path[mv.idx - 1] : null;
        mv.path = prev ? [prev, ...g.path.slice(g.idx)] : g.path.slice(g.idx);
        mv.idx = prev ? 1 : 0;
      }
    } else {
      p.checkIn -= dt;
      if (p.checkIn <= 0 || mv.idx + 2 >= mv.path.length) {
        p.checkIn = 2;
        this.repath(p);
      }
    }
    if (mv.idx + 1 >= mv.path.length) return;

    const factor = s.ending === "escape" && s.t > s.minFleeS * 0.5 ? POLICE_GIVEUP_FACTOR : POLICE_FACTOR;
    let v0 = Math.min(mv.limit * factor, this.turnCap(mv, 8.5));
    // relative to the getaway: once close, every unit tails; a unit that ended up in front eases off so the
    // getaway blasts past it and it can drop in behind (a PIT needs a car right behind)
    const dx = g.object.position.x - mv.object.position.x;
    const dz = g.object.position.z - mv.object.position.z;
    const d = Math.hypot(dx, dz);
    const gh = g.pose.h;
    const sameWay = Math.sin(mv.pose.h) * Math.sin(gh) + Math.cos(mv.pose.h) * Math.cos(gh) > 0.5;
    if (d < 25) p.role = 0;
    if (sameWay && d < 40 && dx * Math.sin(gh) + dz * Math.cos(gh) < -2) v0 = Math.min(v0, g.speed * 0.7);
    const lead = mv.lead();
    if (mv.latTarget === 0) {
      if (lead.v && lead.v.id === g.entry.id) {
        const want = s.ending === "pit" ? 3 : 8;
        v0 = Math.min(v0, lead.speed + (lead.gap - want) * 0.9);
      } else if (lead.v && this.isOurs(lead.v.id)) {
        v0 = Math.min(v0, lead.speed + Math.max(0, lead.gap - 4) * 0.8);
      } else if (lead.gap < 24 && lead.speed < mv.speed - 1) {
        if (straightAhead(mv.path, mv.idx, mv.t) > 28 && !mv.oncoming(50)) {
          mv.latTarget = OVERTAKE_LAT;
          p.boxU = 0; // reuse as manoeuvre timer
        } else v0 = Math.min(v0, lead.speed + Math.max(0, lead.gap - 3) * 0.8); // obey
      }
    } else {
      p.boxU += dt;
      const nearJunction = mv.remaining < 10 && mv.idx + 2 < mv.path.length && turnKind(mv.from, mv.to, mv.path[mv.idx + 2]) !== 0;
      if ((p.boxU > 1.2 && this.laneClear(mv, 9)) || nearJunction) mv.latTarget = 0;
    }
    this.accelerate(mv, Math.max(0, v0), dt, 7.5, 12);
    const entered = mv.move(mv.speed * dt);
    if (entered) this.repath(p);
    mv.update(dt);
  }

  /** Re-path to the pursuit target (each junction, and every couple of seconds). */
  private repath(p: Police) {
    const mv = p.mv;
    const g = this.g!.mv;
    const tgt = pursuitTarget(p.role, { from: g.from, to: g.to, path: g.path, idx: g.idx }, mv.to);
    const r = replanPath(mv.path, mv.idx, tgt, this.blocked);
    if (r) {
      mv.path = r.path;
      mv.idx = r.idx;
    } else if (mv.idx + 2 >= mv.path.length) {
      const next = chooseTurn(mv.from, mv.to, this.blocked, rand);
      if (next) mv.path.push(next);
    }
  }

  private startBox(p: Police, slot: Slot | undefined) {
    if (!slot) return;
    p.slot = slot;
    p.mode = "box";
    p.boxU = 0;
    p.boxDur = 0;
  }

  /** Drive towards the scene, then glide into the box-in slot and stop. */
  private boxPolice(p: Police, dt: number) {
    const mv = p.mv;
    const slot = p.slot!;
    const d = Math.hypot(slot.x - mv.pose.x, slot.z - mv.pose.z);
    if (p.boxDur === 0) {
      const stuck = mv.idx + 2 >= mv.path.length && mv.t >= 0.99;
      if (d > 45 && !mv.free && !stuck) {
        // still far: keep driving towards the getaway's node, then box
        const g = this.g!.mv;
        if (mv.idx + 2 >= mv.path.length) {
          const r = replanPath(mv.path, mv.idx, g.to !== mv.to ? g.to : g.from, new Set());
          if (r) {
            mv.path = r.path;
            mv.idx = r.idx;
          }
        }
        this.accelerate(mv, Math.min(mv.limit * 1.6, this.turnCap(mv, 8)), dt, 7, 12);
        mv.move(mv.speed * dt);
        mv.update(dt);
        return;
      }
      this.freeze(mv);
      p.boxFrom = { x: mv.pose.x, z: mv.pose.z, h: mv.pose.h + mv.yaw };
      mv.yaw = 0;
      p.boxDur = clamp(d / 9, 1.2, 3);
    }
    p.boxU = Math.min(1, p.boxU + dt / p.boxDur);
    const e = smooth(p.boxU);
    mv.pose.x = p.boxFrom.x + (slot.x - p.boxFrom.x) * e;
    mv.pose.z = p.boxFrom.z + (slot.z - p.boxFrom.z) * e;
    mv.pose.h = p.boxFrom.h + wrap(slot.h - p.boxFrom.h) * e;
    mv.speed = p.boxU < 1 ? d / Math.max(0.3, p.boxDur * (1 - p.boxU)) : 0;
    mv.pitch = p.boxU > 0.85 && p.boxU < 1 ? 0.04 : 0;
    if (p.boxU >= 1) {
      mv.speed = 0;
      mv.pitch = 0;
      p.mode = "parked";
    }
    mv.update(0);
  }

  private sendHome(p: Police) {
    p.mode = "leave";
    this.rejoinHome(p.mv);
  }

  /** From wherever the vehicle is (maybe off-lane after a box-in), rejoin the road and head to the station. */
  private rejoinHome(mv: Mover) {
    const ref = this.g?.mv ?? mv;
    let a = ref.path[ref.idx] ?? mv.from;
    let b = ref.path[ref.idx + 1] ?? mv.to;
    if (mv.free) {
      // drive off in whichever direction the car is pointing
      const na = getNode(a);
      const nb = getNode(b);
      const h = mv.pose.h + mv.yaw;
      if (Math.sin(h) * (nb.x - na.x) + Math.cos(h) * (nb.z - na.z) < 0) [a, b] = [b, a];
    } else {
      a = mv.from;
      b = mv.to;
    }
    const t = mv.free ? clamp(blockageT(a, b, mv.pose.x, mv.pose.z), 0.02, 0.95) : mv.t;
    const others = new Set(this.blocked);
    others.delete(edgeKey(a, b));
    const tail = findPath(b, PLACES.policeStation, others) ?? [b];
    mv.speed = Math.min(mv.speed, 4);
    mv.rejoin(a, b, t, tail);
  }

  private driveHome(mv: Mover, dt: number, factor: number) {
    if (mv.idx + 1 >= mv.path.length || (mv.idx + 2 >= mv.path.length && mv.t > 0.85)) {
      mv.despawn();
      return;
    }
    let v0 = Math.min(mv.limit * factor, this.turnCap(mv, 7));
    const lead = mv.lead();
    if (mv.latTarget === 0) {
      if (lead.gap < 14 && lead.speed < 0.5 && !mv.oncoming(35)) mv.latTarget = OVERTAKE_LAT; // round a wreck or a queue
      else if (Number.isFinite(lead.gap)) v0 = Math.min(v0, lead.speed + Math.max(0, lead.gap - 3) * 0.8);
    } else if (this.laneClear(mv, 9) || mv.remaining < 8) mv.latTarget = 0;
    // safety net: still stuck after a while, just pull away out of shot
    mv.stuck = mv.speed < 0.3 ? mv.stuck + dt : 0;
    if (mv.stuck > 8) {
      mv.despawn();
      return;
    }
    this.accelerate(mv, Math.max(0, v0), dt, 3.5, 9);
    mv.move(mv.speed * dt);
    mv.update(dt);
  }

  private isOurs(id: string) {
    if (this.g?.mv.entry.id === id) return true;
    for (const p of this.police) if (p.mv.entry.id === id) return true;
    for (const r of this.racers) if (r.mv.entry.id === id) return true;
    return false;
  }

  private isFree(x: number, z: number, r: number) {
    for (const v of allVehicles()) if (Math.hypot(v.object.position.x - x, v.object.position.z - z) < r) return false;
    return true;
  }

  // --- arrest -----------------------------------------------------------------------------

  private startArrest() {
    const g = this.g!.mv;
    const h = g.pose.h + g.yaw;
    // UK cars: the driver gets out on the right
    this.suspectFrom = { x: g.pose.x - Math.cos(h) * 1.5, z: g.pose.z + Math.sin(h) * 1.5 };
    const cops = this.police.filter((p) => p.mv.active).slice(0, 2);
    cops.forEach((p, i) => {
      const ph = p.mv.pose.h;
      this.officerFrom[i] = [p.mv.pose.x - Math.cos(ph) * 1.4, p.mv.pose.z + Math.sin(ph) * 1.4];
    });
    this.officers.forEach((f, i) => {
      f.root.visible = i < cops.length;
      f.root.position.set(this.officerFrom[i][0], 0, this.officerFrom[i][1]);
    });
    this.arrestT = 0;
  }

  private walk(f: Figure, ax: number, az: number, bx: number, bz: number, u: number) {
    const e = smooth(u);
    f.root.position.set(ax + (bx - ax) * e, u > 0 && u < 1 ? Math.abs(Math.sin(this.sim * 9)) * 0.07 : 0, az + (bz - az) * e);
    if (Math.hypot(bx - ax, bz - az) > 0.3 && u < 1) f.root.rotation.y = Math.atan2(bx - ax, bz - az);
  }

  private stepArrest(dt: number) {
    this.arrestT += dt;
    const T = this.arrestT;
    const g = this.g!.mv;
    const h = g.pose.h + g.yaw;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const door = this.suspectFrom;
    const cops = this.police.filter((p) => p.mv.active).slice(0, 2);
    const car0 = cops[0]?.mv;
    // the suspect is put in the back of the first police car, on its left
    const cellX = car0 ? car0.pose.x + Math.cos(car0.pose.h) * 1.5 - Math.sin(car0.pose.h) * 0.6 : door.x;
    const cellZ = car0 ? car0.pose.z - Math.sin(car0.pose.h) * 1.5 - Math.cos(car0.pose.h) * 0.6 : door.z;
    const posts: [number, number][] = [
      [door.x + fx * 1.1, door.z + fz * 1.1],
      [door.x - fx * 1.1 - Math.cos(h) * 0.6, door.z - fz * 1.1 + Math.sin(h) * 0.6],
    ];
    this.officers.forEach((f, i) => {
      if (i >= cops.length) return;
      const [ox, oz] = this.officerFrom[i];
      const [px, pz] = posts[i];
      if (T < 2.5) this.walk(f, ox, oz, px, pz, T / 2.5);
      else if (T < 3.6) f.root.rotation.y = Math.atan2(door.x - f.root.position.x, door.z - f.root.position.z);
      else if (T < 8.6) {
        // escort: officer 0 walks beside the suspect, officer 1 follows
        const u = (T - 3.6) / 5;
        const sx = cellX + (i === 0 ? fz * 0.7 : -fx * 1.4);
        const sz = cellZ + (i === 0 ? -fx * 0.7 : -fz * 1.4);
        this.walk(f, px, pz, sx, sz, u);
      } else if (T < 11.6) {
        const sx = cellX + (i === 0 ? fz * 0.7 : -fx * 1.4);
        const sz = cellZ + (i === 0 ? -fx * 0.7 : -fz * 1.4);
        this.walk(f, sx, sz, ox, oz, (T - 8.6) / 3);
      } else f.root.visible = false;
    });
    const sus = this.suspect.root;
    if (T < 2.6) sus.visible = false;
    else if (T < 3.6) {
      sus.visible = true;
      sus.position.set(door.x, 0, door.z);
      sus.rotation.y = h - Math.PI / 2;
    } else if (T < 8.6) this.walk(this.suspect, door.x, door.z, cellX, cellZ, (T - 3.6) / 5);
    else sus.visible = false;
  }

  // --- helicopter -------------------------------------------------------------------------

  private stepHeli(dt: number) {
    if (!this.heliActive) return;
    const heli = this.heli;
    const g = this.g?.mv;
    let tx: number;
    let tz: number;
    let ty = HELI_Y;
    if (this.heliLeaveT > 0) {
      this.heliLeaveT += dt;
      const st = getNode(PLACES.policeStation);
      tx = st.x - 500;
      tz = st.z - 700;
      ty = HELI_Y + 50;
      if (this.heliLeaveT > 22) {
        this.heliActive = false;
        heli.root.visible = heli.cone.visible = heli.spot.visible = false;
        return;
      }
    } else if (g && (g.active || this.wreck)) {
      this.heliOrbit += dt * 0.3;
      const lead = g.free ? 0 : Math.min(18, g.speed * 0.8);
      tx = g.pose.x + Math.sin(g.pose.h) * lead + Math.cos(this.heliOrbit) * 22;
      tz = g.pose.z + Math.cos(g.pose.h) * lead + Math.sin(this.heliOrbit) * 22;
    } else {
      tx = this.heliPos.x;
      tz = this.heliPos.z;
    }
    // critically-damped-ish follow with a speed cap
    const ax = (tx - this.heliPos.x) * 1.1 - this.heliVel.x * 1.6;
    const ay = (ty - this.heliPos.y) * 1.1 - this.heliVel.y * 1.6;
    const az = (tz - this.heliPos.z) * 1.1 - this.heliVel.z * 1.6;
    this.heliVel.x += ax * dt;
    this.heliVel.y += ay * dt;
    this.heliVel.z += az * dt;
    const sp = Math.hypot(this.heliVel.x, this.heliVel.z);
    if (sp > 34) {
      this.heliVel.x *= 34 / sp;
      this.heliVel.z *= 34 / sp;
    }
    this.heliPos.addScaledVector(this.heliVel, dt);
    const r = heli.root;
    r.position.copy(this.heliPos);
    const wantH = sp > 2 ? Math.atan2(this.heliVel.x, this.heliVel.z) : r.rotation.y;
    r.rotation.order = "YXZ";
    r.rotation.y += wrap(wantH - r.rotation.y) * Math.min(1, dt * 1.5);
    r.rotation.x = clamp(sp * 0.008, 0, 0.22);
    heli.rotor.rotation.y += dt * 30;
    heli.tailRotor.rotation.x += dt * 40;
    heli.beacon.visible = Math.floor(this.sim * 1.6) % 2 === 0;

    // searchlight at night: cone from the pod down to the getaway
    const showBeam = this.night && this.heliLeaveT === 0 && !!g && (g.active || !!this.wreck);
    heli.cone.visible = heli.spot.visible = showBeam;
    if (showBeam && g) {
      const gx = g.pose.x + Math.sin(this.sim * 0.9) * 1.5;
      const gz = g.pose.z + Math.cos(this.sim * 0.7) * 1.5;
      const top = this.tmpV.set(this.heliPos.x, this.heliPos.y - 1.3, this.heliPos.z);
      const dir = this.tmpU.set(top.x - gx, top.y, top.z - gz);
      const len = dir.length();
      dir.divideScalar(len || 1);
      heli.cone.position.set((top.x + gx) / 2, top.y / 2, (top.z + gz) / 2);
      heli.cone.quaternion.setFromUnitVectors(this.up, dir);
      heli.cone.scale.set(5.5, len, 5.5);
      heli.coneMat.uniforms.uOpacity.value = 0.55;
      heli.spot.position.set(gx, 0.12, gz);
      heli.spotMat.opacity = 0.9;
    }
  }

  // --- police visuals ---------------------------------------------------------------------

  private renderPolice() {
    let light = 0;
    const t = this.sim;
    for (const p of this.police) {
      const blues = p.mv.active && p.mode !== "leave";
      const { lightL, lightR, ring, ringMat } = p.parts;
      if (!p.mv.active) continue;
      const f = t * 4.5 + p.flash;
      const sideL = Math.sin(f * Math.PI) > 0;
      const strobe = Math.sin(f * Math.PI * 6) > -0.2 ? 1 : 0.35;
      lightL.emissiveIntensity = blues ? (sideL ? 5 * strobe : 0.25) : 0.15;
      lightR.emissiveIntensity = blues ? (sideL ? 0.25 : 5 * strobe) : 0.15;
      if (blues) {
        const ph = (t * 1.2 + p.flash) % 1;
        ring.visible = true;
        ring.scale.setScalar(1.6 * (1 + ph * 2.6));
        ringMat.opacity = (1 - ph) * 0.55;
        if (light < this.lights.length) {
          const L = this.lights[light++];
          L.position.set(p.mv.pose.x, 3, p.mv.pose.z);
          L.intensity = 40 + 40 * Math.max(0, Math.sin(f * Math.PI * 2));
        }
      } else ring.visible = false;
    }
    for (let i = light; i < this.lights.length; i++) this.lights[i].intensity = 0;
  }

  // --- street racers ----------------------------------------------------------------------

  private stageRace() {
    const row = [-3, 0, 3][Math.floor(rand() * 3)];
    const east = rand() < 0.5;
    const strip = raceStrip(row, east);
    if (strip.length < 4) return;
    for (let i = 0; i + 1 < strip.length; i++) if (this.blocked.has(edgeKey(strip[i], strip[i + 1]))) return;
    const len = getEdge(strip[0], strip[1])!.length;
    const t = clamp(1 - (5.2 + 2.2 + 0.6) / len, 0.2, 0.9);
    const p: Pose = { x: 0, z: 0, h: 0 };
    poseAt(strip, 0, t, p);
    if (!this.isFree(p.x, p.z, 9)) return;
    // a ring tail so they blast off up the ramp and away
    const ringEnd = strip[strip.length - 1];
    const tail = ringEnd.startsWith("h_") ? this.ringTail(ringEnd, strip[strip.length - 2]) : [];
    const path = [...strip, ...tail];
    this.raceEnd = strip.length - 2;
    this.racers.forEach((r, i) => {
      r.mv.spawn(path.slice(), 0, t, 0, "racer");
      r.mv.lat = r.mv.latTarget = i === 1 ? OVERTAKE_LAT : 0;
      r.accel = between(6.2, 7.8);
      r.top = between(30, 35);
      r.manT = 0;
      r.smokeT = 0;
      r.mv.update(0);
    });
    this.race = "staging";
    this.raceSawRed = false;
    this.raceWait = 0;
  }

  private ringTail(ringNode: string, from: string): string[] {
    // continue a few nodes around the ring, away from where we came from
    const out: string[] = [];
    let prev = from;
    let cur = ringNode;
    for (let k = 0; k < 3; k++) {
      const next = neighbours(cur).find((n) => n.startsWith("h_") && n !== prev);
      if (!next) break;
      out.push(next);
      prev = cur;
      cur = next;
    }
    return out;
  }

  private stepRace(dt: number, now: number) {
    if (this.race === "idle") {
      if (!this.night) return;
      this.raceTimer -= dt;
      if (this.raceTimer <= 0) {
        this.raceTimer = between(...RACE_EVERY_S);
        this.stageRace();
      }
      return;
    }
    const glowOn = this.night;
    for (const r of this.racers) {
      if (!r.mv.active) continue;
      r.parts.glow!.visible = glowOn;
      r.parts.glowMat!.opacity = 0.75 + 0.25 * Math.sin(this.sim * 7 + r.accel);
    }

    if (this.race === "staging") {
      this.raceWait += dt;
      const a = this.racers[0].mv;
      const st = racerLaunch(this.raceSawRed, signalFor(a.path[1], a.path[0], now));
      this.raceSawRed = st.sawRed;
      for (const r of this.racers) {
        // revving: the body shakes
        r.parts.body.rotation.x = Math.sin(this.sim * 40 + r.accel) * 0.012;
        r.mv.update(0);
      }
      if (st.go || this.raceWait > 22) {
        this.race = "racing";
        for (const r of this.racers) r.smokeT = 1.1;
      }
      return;
    }

    // racing
    let anyActive = false;
    for (const [i, r] of this.racers.entries()) {
      const mv = r.mv;
      if (!mv.active) continue;
      anyActive = true;
      r.parts.body.rotation.x = 0;
      if (mv.idx + 2 >= mv.path.length && mv.t > 0.8) {
        mv.despawn();
        continue;
      }
      const finished = mv.idx >= this.raceEnd;
      let v0 = finished ? mv.limit * 1.15 : r.top;
      if (mv.idx + 2 < mv.path.length && turnKind(mv.from, mv.to, mv.path[mv.idx + 2]) !== 0) v0 = Math.min(v0, 8 + Math.max(0, mv.remaining - 6) * 0.6);
      // the one in the oncoming lane tucks in when something comes the other way, then goes again
      if (i === 1) {
        if (mv.latTarget !== 0 && (mv.oncoming(70) || finished)) {
          mv.latTarget = 0;
          r.manT = 0;
        } else if (mv.latTarget === 0 && !finished) {
          r.manT += dt;
          if (r.manT > 1.5 && !mv.oncoming(110) && straightAhead(mv.path, mv.idx, mv.t) > 60) mv.latTarget = OVERTAKE_LAT;
        }
      }
      if (Math.abs(mv.lat) < 1.5) {
        const lead = mv.lead();
        if (Number.isFinite(lead.gap)) v0 = Math.min(v0, lead.speed + Math.max(0, lead.gap - 4) * 1.0); // obey traffic ahead
      }
      this.accelerate(mv, Math.max(0, v0), dt, r.accel, 10);
      mv.pitch = mv.speed < r.top * 0.6 && !finished ? -0.035 : 0; // nose up on launch
      mv.move(mv.speed * dt);
      mv.update(dt);
      if (r.smokeT > 0) {
        r.smokeT -= dt;
        const h = mv.pose.h;
        if (rand() < 0.6)
          this.sparks.emit(mv.object.position.x - Math.sin(h) * 2.3, 0.3, mv.object.position.z - Math.cos(h) * 2.3, between(-0.5, 0.5), 0.6, between(-0.5, 0.5), 1.6, 0.5, 0.8, 0.8, 0.82);
      }
    }
    if (!anyActive) this.race = "idle";
  }

  // --- speed cameras ----------------------------------------------------------------------

  private stepCameras(dt: number) {
    let dirty = false;
    for (const c of this.cams) {
      c.cool -= dt;
      if (c.flashT !== Infinity) c.flashT += dt;
    }
    for (const v of allVehicles()) {
      if (!v.edgeKey) continue;
      for (const c of this.cams) {
        if (v.edgeKey !== c.site.key) continue;
        if (c.cool > 0 && c.lastId === v.id) continue;
        if (c.cool > 0.6) continue;
        if (!speedingHit(c.site, v)) continue;
        c.cool = SITE_COOL_S;
        c.lastId = v.id;
        c.flashT = 0;
      }
    }
    const o = this.o;
    this.cams.forEach((c, i) => {
      // double flash: two quick pops
      const f = c.flashT;
      let k = 0;
      if (f < 0.09) k = 1 - f / 0.09;
      else if (f > 0.2 && f < 0.29) k = 1 - (f - 0.2) / 0.09;
      if (f > 0.3 && f !== Infinity) c.flashT = Infinity;
      if (k > 0 || f === 0) dirty = true;
      o.position.set(c.site.x, 3.9, c.site.z);
      o.rotation.set(0, 0, 0);
      o.scale.setScalar(k > 0 ? (this.night ? 3.6 : 2.4) * k : 0);
      o.updateMatrix();
      this.camFlash.setMatrixAt(i, o.matrix);
    });
    if (dirty || this.camsWereLit) this.camFlash.instanceMatrix.needsUpdate = true;
    this.camsWereLit = dirty;
  }
  private camsWereLit = false;
}
