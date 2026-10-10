"use client";
// Module: Crashes. Crash director + crash VFX.
// Every 35-60 s (and on bus request:crash) it wrecks real traffic (rear-end or solo via registry crash()),
// or stages a scripted wreck (T-boned cars / jackknifed burning HGV). It opens an incident, blocks the road,
// and plays impact flash, sparks, glass/cargo debris, a smoke column and (trucks) fire.
// Responders moves the incident on; when it is "cleared" everything here is removed.
// Safety net: an incident nobody responds to within 60 s is cleared here.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { emit, on } from "../bus";
import { allVehicles, nextId, type VehicleEntry } from "../registry";
import { edgeKey as makeEdgeKey, edgeMidpoint, getNode, ROAD_EDGES } from "../roads";
import { blockedSet, useWorld, type IncidentStatus } from "../store";
import { crashNote, findRearEnd, findSolo, pickScriptedEdge, type CrashKind, type Scenario } from "./Crashes/director";
import { DebrisPool, ParticlePool } from "./Crashes/particles";
import { makeParticleMesh, markParticlesDirty } from "./Crashes/vfx";
import { CAR_COLORS, getShared, JACKKNIFE, JackknifeWreck, SiteMarker, TBONE, TBoneWreck } from "./Crashes/wrecks";

const MAX_ACTIVE = 3;
const SAFETY_S = 60;
const LIGHTS = 2; // pre-mounted so adding a fire never forces a shader recompile
const WIND_X = 0.9;
const WIND_Z = 0.35;

interface Visual {
  slot: number;
  incidentId: string;
  kind: CrashKind;
  scenario: Scenario;
  x: number;
  z: number;
  heading: number; // crash frame: +z = direction of travel
  tri: [number, number]; // warning triangle in crash frame
  wreck: { ids: string[]; colors: [string, string]; edgeKey: string; from: string; to: string } | null;
  status: IncidentStatus;
}

interface Slot {
  active: boolean;
  incidentId: string;
  edgeKey: string;
  kind: CrashKind;
  status: IncidentStatus;
  age: number; // sim seconds since creation
  sx: number; // smoke source
  sy: number;
  sz: number;
  fx: number; // fire source
  fz: number;
  fire: boolean;
  smokeAcc: number;
  fireAcc: number;
  light: number; // index into lights, -1 none
  flash: number; // seconds of impact flash left
}

const newSlot = (): Slot => ({
  active: false,
  incidentId: "",
  edgeKey: "",
  kind: "car_crash",
  status: "active",
  age: 0,
  sx: 0,
  sy: 0,
  sz: 0,
  fx: 0,
  fz: 0,
  fire: false,
  smokeAcc: 0,
  fireAcc: 0,
  light: -1,
  flash: 0,
});

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const hexRGB = (hex: string, out: THREE.Color) => out.set(hex);

/** Crash frame (centre cx/cz, heading h) -> world. Writes into out. */
function toWorld(cx: number, cz: number, h: number, lx: number, lz: number, out: { x: number; z: number }) {
  const c = Math.cos(h);
  const s = Math.sin(h);
  out.x = cx + lx * c + lz * s;
  out.z = cz - lx * s + lz * c;
  return out;
}

const TITLES: Record<Scenario, string> = { rear_end: "CRASH", solo: "CRASH", tbone: "T-BONE CRASH", jackknife: "HGV FIRE" };

export default function Crashes() {
  const [visuals, setVisuals] = useState<Visual[]>([]);
  const slots = useRef<Slot[]>(Array.from({ length: MAX_ACTIVE }, newSlot));
  const queue = useRef<CrashKind[]>([]);
  const timer = useRef(rnd(35, 60));
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const lightOwner = useRef<number[]>(Array.from({ length: LIGHTS }, () => -1));

  // Pools and their meshes (one draw call each).
  const fx = useMemo(() => {
    const smoke = new ParticlePool(700);
    const glow = new ParticlePool(600);
    const glass = new DebrisPool(200, 0.3);
    const cargo = new DebrisPool(48, 0.5);
    const smokeMesh = makeParticleMesh(smoke, false);
    const glowMesh = makeParticleMesh(glow, true);
    const debrisMat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.25, flatShading: true });
    const glassMesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.5), debrisMat, glass.n);
    const cargoMat = new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true });
    const cargoMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cargoMat, cargo.n);
    for (const [m, p] of [
      [glassMesh, glass],
      [cargoMesh, cargo],
    ] as const) {
      m.instanceColor = new THREE.InstancedBufferAttribute(p.color, 3);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
    }
    cargoMesh.castShadow = true;
    const dummy = new THREE.Object3D();
    writeDebris(glass, glassMesh, dummy);
    writeDebris(cargo, cargoMesh, dummy);
    return { smoke, glow, glass, cargo, smokeMesh, glowMesh, glassMesh, cargoMesh };
  }, []);

  useEffect(
    () => () => {
      for (const m of [fx.smokeMesh, fx.glowMesh, fx.glassMesh, fx.cargoMesh]) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    },
    [fx],
  );

  // Scratch objects (no per-frame allocation).
  const scratch = useMemo(
    () => ({ dummy: new THREE.Object3D(), p: { x: 0, z: 0 }, q: { x: 0, z: 0 }, col: new THREE.Color(), debrisDirty: true }),
    [],
  );

  // UI requests.
  useEffect(
    () =>
      on((e) => {
        if (e.type === "request:crash" && queue.current.length < 3) queue.current.push(e.kind);
      }),
    [],
  );

  // Safety: if this module unmounts, reopen the roads it closed and clear its incidents.
  useEffect(() => {
    const s = slots.current;
    return () => {
      for (const sl of s) if (sl.active) finishIncident(sl);
    };
  }, []);

  // ---------------------------------------------------------------------------

  function impactBurst(slot: number, x: number, y: number, z: number, truck: boolean, paint: string[]) {
    const { glow, smoke, glass } = fx;
    // flash
    glow.emit(x, y + 0.8, z, 0, 0, 0, 0.35, 2, truck ? 24 : 15, 1, 1, 0.9, 0.6, 1, 0.6, 0.2, 0, 0, 0, slot);
    glow.emit(x, y + 0.6, z, 0, 0.5, 0, 0.7, 1, truck ? 14 : 9, 0.9, 1, 0.5, 0.12, 0.8, 0.15, 0.02, 0, 0, 0, slot);
    // sparks
    const sparks = truck ? 80 : 50;
    for (let i = 0; i < sparks; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rnd(5, 15);
      glow.emit(
        x, y + 0.5, z,
        Math.cos(a) * sp, rnd(2, 11), Math.sin(a) * sp,
        rnd(0.4, 1.1), rnd(0.35, 0.6), 0.08, 1,
        1, 0.92, 0.55, 1, 0.35, 0.05,
        20, 0.5, 0, slot,
      );
    }
    // dust puff ring
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const sp = rnd(3, 6.5);
      smoke.emit(
        x, 0.5, z,
        Math.cos(a) * sp, rnd(0.4, 1.4), Math.sin(a) * sp,
        rnd(1.3, 2.4), 1.4, rnd(4.5, 6.5), 0.6,
        0.58, 0.55, 0.5, 0.75, 0.73, 0.7,
        -0.3, 1.6, rnd(-0.5, 0.5), slot,
      );
    }
    // glass and plastic shards
    const n = truck ? 46 : 36;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rnd(2, 9);
      const pick = Math.random();
      let r = 0.78;
      let g = 0.93;
      let b = 1;
      if (pick > 0.55 && pick < 0.8) r = g = b = 0.12;
      else if (pick >= 0.8) {
        hexRGB(paint[i % paint.length], scratch.col);
        r = scratch.col.r;
        g = scratch.col.g;
        b = scratch.col.b;
      }
      glass.spawn({ x, y: y + 0.6, z, vx: Math.cos(a) * sp, vy: rnd(3, 9), vz: Math.sin(a) * sp, scale: rnd(0.25, 0.6), r, g, b, spin: 20, owner: slot });
    }
    scratch.debrisDirty = true;
  }

  function spillCargo(slot: number, rx: number, rz: number, dx: number, dz: number) {
    for (let i = 0; i < 16; i++) {
      const sp = rnd(2, 8);
      const side = rnd(-0.7, 0.7);
      const pick = Math.random();
      const [r, g, b] = pick < 0.55 ? [0.74, 0.55, 0.33] : pick < 0.85 ? [1, 0.42, 0.1] : [0.95, 0.94, 0.9];
      fx.cargo.spawn({
        x: rx + rnd(-0.8, 0.8),
        y: rnd(1.5, 3.2),
        z: rz + rnd(-0.8, 0.8),
        vx: (dx + side * dz) * sp,
        vy: rnd(2, 7),
        vz: (dz - side * dx) * sp,
        scale: rnd(0.7, 1.25),
        r,
        g,
        b,
        spin: 7,
        owner: slot,
      });
    }
    scratch.debrisDirty = true;
  }

  function claimLight(slot: number) {
    for (let i = 0; i < LIGHTS; i++)
      if (lightOwner.current[i] === -1) {
        lightOwner.current[i] = slot;
        return i;
      }
    return -1;
  }

  function releaseLight(sl: Slot) {
    if (sl.light >= 0) {
      lightOwner.current[sl.light] = -1;
      const L = lights.current[sl.light];
      if (L) L.intensity = 0;
    }
    sl.light = -1;
  }

  /** Clear everything this crash put in the world (VFX, wrecks, light). */
  function teardown(index: number) {
    const sl = slots.current[index];
    if (!sl.active) return;
    sl.active = false;
    releaseLight(sl);
    fx.smoke.killOwner(index, 1.2);
    fx.glow.killOwner(index, 0.25);
    fx.glass.killOwner(index);
    fx.cargo.killOwner(index);
    scratch.debrisDirty = true;
    const id = sl.incidentId;
    setVisuals((v) => v.filter((x) => x.incidentId !== id));
  }

  /** Our own clearing (safety net / unmount): mark cleared, reopen road, announce. */
  function finishIncident(sl: Slot) {
    const w = useWorld.getState();
    w.updateIncident(sl.incidentId, { status: "cleared" });
    if (w.blocked[sl.edgeKey] !== undefined) {
      w.unblockEdge(sl.edgeKey);
      emit({ type: "road:reopened", edgeKey: sl.edgeKey });
    }
    emit({ type: "incident:cleared", incidentId: sl.incidentId });
  }

  function createCrash(kind: CrashKind) {
    const index = slots.current.findIndex((s) => !s.active);
    if (index < 0) return;
    const blocked = blockedSet();
    for (const s of slots.current) if (s.active) blocked.add(s.edgeKey);

    // 1) a real collision between two moving vehicles
    let victims: VehicleEntry[] = [];
    let scenario: Scenario = "rear_end";
    const pair = findRearEnd(allVehicles(), { blocked, kind });
    if (pair) {
      for (const v of pair) if (v.crash?.()) victims.push(v);
      if (victims.length === 1) scenario = "solo";
    }
    // 2) a single moving vehicle
    if (!victims.length) {
      scenario = "solo";
      const tried = new Set<string>();
      for (let attempt = 0; attempt < 4 && !victims.length; attempt++) {
        const pool = [...allVehicles()].filter((v) => !tried.has(v.id));
        const v = findSolo(pool, { blocked, kind });
        if (!v) break;
        tried.add(v.id);
        if (v.crash?.()) victims = [v];
      }
    }

    const sl = slots.current[index];
    const paint = [CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)], CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]];
    let x: number;
    let z: number;
    let heading: number;
    let from: string;
    let to: string;
    let edge: string;
    let tri: [number, number];
    let wreck: Visual["wreck"] = null;
    let vehicleIds: string[];
    let aKind = victims[0]?.kind ?? (kind === "truck_crash" ? "truck" : "car");
    let bKind = victims[1]?.kind ?? "car";

    if (victims.length) {
      const lead = victims[0];
      from = lead.from!;
      to = lead.to!;
      edge = lead.edgeKey ?? makeEdgeKey(from, to);
      const na = getNode(from);
      const nb = getNode(to);
      heading = Math.atan2(nb.x - na.x, nb.z - na.z);
      x = 0;
      z = 0;
      for (const v of victims) {
        x += v.object.position.x;
        z += v.object.position.z;
      }
      x /= victims.length;
      z /= victims.length;
      // warning triangle 12 m upstream of the rear-most victim, in its lane
      tri = [0.6, -12 - (victims.length > 1 ? 4 : 2)];
      vehicleIds = victims.map((v) => v.id);
      const truck = victims.find((v) => v.kind === "truck");
      kind = truck ? "truck_crash" : kind;
      const firePos = truck ? truck.object.position : null;
      sl.fx = firePos ? firePos.x : x;
      sl.fz = firePos ? firePos.z : z;
      sl.sx = x;
      sl.sz = z;
      // impact point: between the cars, or the nose of a solo crash
      const p = toWorld(x, z, heading, 0, victims.length > 1 ? 0 : 2, scratch.p);
      impactBurst(index, p.x, 0.4, p.z, kind === "truck_crash", paint);
      if (kind === "truck_crash") {
        toWorld(sl.fx, sl.fz, heading, 0, -5, scratch.q);
        spillCargo(index, scratch.q.x, scratch.q.z, -Math.sin(heading), -Math.cos(heading));
      }
    } else {
      // 3) scripted wreck on a downtown street or the ring road
      const key = pickScriptedEdge(Math.random, blocked, new Set());
      if (!key) return;
      const e = ROAD_EDGES.get(key)!;
      [from, to] = Math.random() < 0.5 ? [e.a, e.b] : [e.b, e.a];
      edge = key;
      const na = getNode(from);
      const nb = getNode(to);
      heading = Math.atan2(nb.x - na.x, nb.z - na.z);
      [x, z] = edgeMidpoint(key);
      x += rnd(-0.5, 0.5);
      z += rnd(-0.5, 0.5);
      tri = [2.8, -15];
      const truck = kind === "truck_crash";
      scenario = truck ? "jackknife" : "tbone";
      vehicleIds = truck ? [nextId("WRECK")] : [nextId("WRECK"), nextId("WRECK")];
      wreck = { ids: vehicleIds, colors: [paint[0], paint[1]], edgeKey: edge, from, to };
      aKind = truck ? "truck" : "car";
      bKind = "car";
      if (truck) {
        const cab = toWorld(x, z, heading, JACKKNIFE.cab.x, JACKKNIFE.cab.z, scratch.p);
        sl.fx = cab.x;
        sl.fz = cab.z;
        sl.sx = cab.x;
        sl.sz = cab.z;
        impactBurst(index, cab.x, 0.6, cab.z, true, ["#ff6a1a", "#f4f2ee"]);
        const rear = toWorld(x, z, heading, JACKKNIFE.rear.x, JACKKNIFE.rear.z, scratch.q);
        const c = Math.cos(heading);
        const s = Math.sin(heading);
        const dl = JACKKNIFE.rearDir;
        spillCargo(index, rear.x, rear.z, dl.x * c + dl.z * s, -dl.x * s + dl.z * c);
      } else {
        const imp = toWorld(x, z, heading, TBONE.impact.x, TBONE.impact.z, scratch.p);
        impactBurst(index, imp.x, 0.5, imp.z, false, paint);
        const sm = toWorld(x, z, heading, TBONE.smoke.x, TBONE.smoke.z, scratch.q);
        sl.sx = sm.x;
        sl.sz = sm.z;
        sl.fx = sm.x;
        sl.fz = sm.z;
      }
    }

    const incidentId = nextId("INC");
    const note = crashNote(kind, scenario, from, to, Math.random, aKind, bKind);
    Object.assign(sl, {
      active: true,
      incidentId,
      edgeKey: edge,
      kind,
      status: "active" as IncidentStatus,
      age: 0,
      sy: kind === "truck_crash" ? 2.6 : 1.2,
      fire: kind === "truck_crash",
      smokeAcc: 0,
      fireAcc: 0,
      flash: 0.45,
      light: claimLight(index),
    });
    const L = sl.light >= 0 ? lights.current[sl.light] : null;
    if (L) L.position.set(sl.fx, 2.4, sl.fz);

    const w = useWorld.getState();
    w.addIncident({ id: incidentId, kind, edgeKey: edge, x, z, status: "active", createdAt: performance.now(), note });
    w.blockEdge(edge, note);
    emit({ type: "incident:created", incidentId });
    emit({ type: "road:blocked", edgeKey: edge, reason: note });
    for (const vehicleId of vehicleIds) emit({ type: "vehicle:crashed", vehicleId, incidentId });

    const visual: Visual = { slot: index, incidentId, kind, scenario, x, z, heading, tri, wreck, status: "active" };
    setVisuals((v) => [...v, visual]);
  }

  // ---------------------------------------------------------------------------

  useFrame((_, rawDt) => {
    const w = useWorld.getState();
    const t = performance.now() / 1000;
    // hazard lights blink even while paused (cheap, looks alive)
    getShared().hazardMat.emissiveIntensity = Math.floor(t * 2.6) % 2 ? 3 : 0.1;
    if (w.paused) return;
    const dt = Math.min(rawDt, 0.1);

    // Director
    timer.current -= dt;
    if (timer.current <= 0) {
      timer.current = rnd(35, 60);
      queue.current.push(Math.random() < 0.38 ? "truck_crash" : "car_crash");
    }
    while (queue.current.length) {
      const k = queue.current.shift()!;
      if (slots.current.some((s) => !s.active)) createCrash(k);
    }

    // Lifecycle
    const incidents = w.incidents;
    for (let i = 0; i < MAX_ACTIVE; i++) {
      const sl = slots.current[i];
      if (!sl.active) continue;
      sl.age += dt;
      let status: IncidentStatus = "cleared";
      for (let j = incidents.length - 1; j >= 0; j--)
        if (incidents[j].id === sl.incidentId) {
          status = incidents[j].status;
          break;
        }
      if (status === "active" && sl.age > SAFETY_S) {
        finishIncident(sl);
        status = "cleared";
      }
      if (status !== sl.status) {
        sl.status = status;
        if (status === "cleared") {
          teardown(i);
          continue;
        }
        if (status === "clearing") {
          sl.fire = false; // fire brigade has it out: steam and the odd wisp
          releaseLight(sl);
        }
        const id = sl.incidentId;
        setVisuals((v) => v.map((x) => (x.incidentId === id ? { ...x, status } : x)));
      }

      // Emitters
      const truck = sl.kind === "truck_crash";
      const clearing = sl.status === "clearing";
      const smokeRate = clearing ? 5 : truck ? 17 : 10;
      sl.smokeAcc += smokeRate * dt;
      while (sl.smokeAcc >= 1) {
        sl.smokeAcc -= 1;
        const sx = (sl.fire ? sl.fx : sl.sx) + rnd(-0.7, 0.7);
        const sz = (sl.fire ? sl.fz : sl.sz) + rnd(-0.7, 0.7);
        if (clearing)
          fx.smoke.emit(sx, 1, sz, WIND_X * 0.6, rnd(1.5, 2.5), WIND_Z * 0.6, rnd(2.5, 3.5), 0.8, rnd(3.5, 5), 0.45,
            0.86, 0.87, 0.9, 0.95, 0.95, 0.97, -0.3, 0.3, rnd(-0.4, 0.4), i);
        else if (truck)
          fx.smoke.emit(sx, sl.sy, sz, WIND_X + rnd(-0.3, 0.3), rnd(2.4, 3.6), WIND_Z + rnd(-0.3, 0.3), rnd(6, 8.5), rnd(1.6, 2.4), rnd(9, 13), 0.9,
            0.07, 0.065, 0.065, 0.34, 0.33, 0.32, -0.35, 0.22, rnd(-0.35, 0.35), i);
        else
          fx.smoke.emit(sx, sl.sy, sz, WIND_X + rnd(-0.3, 0.3), rnd(2, 3.2), WIND_Z + rnd(-0.3, 0.3), rnd(4.5, 6.5), rnd(1, 1.5), rnd(5, 7.5), 0.8,
            0.17, 0.16, 0.16, 0.5, 0.49, 0.48, -0.3, 0.25, rnd(-0.35, 0.35), i);
      }
      if (sl.fire) {
        sl.fireAcc += 48 * dt;
        while (sl.fireAcc >= 1) {
          sl.fireAcc -= 1;
          fx.glow.emit(sl.fx + rnd(-1.3, 1.3), rnd(0.8, 2.2), sl.fz + rnd(-1.3, 1.3), WIND_X * 0.4, rnd(2.5, 4.5), WIND_Z * 0.4,
            rnd(0.45, 0.9), rnd(1.8, 2.8), 0.3, 0.95, 1, 0.78, 0.28, 0.9, 0.16, 0.03, -1, 0.5, rnd(-1, 1), i);
          if (Math.random() < 0.12)
            fx.glow.emit(sl.fx + rnd(-1, 1), rnd(2, 3), sl.fz + rnd(-1, 1), WIND_X + rnd(-1, 1), rnd(4, 7), WIND_Z + rnd(-1, 1),
              rnd(1.2, 2.2), 0.22, 0.08, 1, 1, 0.75, 0.3, 1, 0.3, 0.05, -0.4, 0.2, 0, i);
        }
      }

      // Light: impact flash, then flickering fire
      if (sl.flash > 0) sl.flash -= dt;
      if (sl.light >= 0) {
        const L = lights.current[sl.light];
        const flash = sl.flash > 0 ? (sl.flash / 0.45) * 900 : 0;
        const flicker = sl.fire ? 170 * (0.72 + 0.18 * Math.sin(t * 23 + i) + 0.1 * Math.sin(t * 61 + i * 3)) : 0;
        if (L) L.intensity = flash + flicker;
        if (!sl.fire && sl.flash <= 0) releaseLight(sl);
      }
    }

    // Simulate pools and push to GPU
    fx.smoke.update(dt);
    fx.glow.update(dt);
    markParticlesDirty(fx.smokeMesh);
    markParticlesDirty(fx.glowMesh);
    const movedGlass = fx.glass.update(dt);
    const movedCargo = fx.cargo.update(dt);
    if (movedGlass || movedCargo || scratch.debrisDirty) {
      writeDebris(fx.glass, fx.glassMesh, scratch.dummy);
      writeDebris(fx.cargo, fx.cargoMesh, scratch.dummy);
      scratch.debrisDirty = false;
    }
  });

  return (
    <group name="crashes">
      <primitive object={fx.glassMesh} />
      <primitive object={fx.cargoMesh} />
      <primitive object={fx.smokeMesh} />
      <primitive object={fx.glowMesh} />
      {Array.from({ length: LIGHTS }, (_, i) => (
        <pointLight
          key={i}
          ref={(l) => {
            lights.current[i] = l;
          }}
          color="#ff7a1f"
          intensity={0}
          distance={45}
          decay={1.6}
        />
      ))}
      {visuals.map((v) => (
        <group key={v.incidentId} position={[v.x, 0, v.z]} rotation={[0, v.heading, 0]}>
          <SiteMarker title={TITLES[v.scenario]} status={v.status} slick={v.kind === "truck_crash" ? 4.5 : 2.6} tri={v.tri} phase={v.slot * 2.1} />
          {v.wreck && v.scenario === "tbone" && <TBoneWreck {...v.wreck} />}
          {v.wreck && v.scenario === "jackknife" && <JackknifeWreck {...v.wreck} burnt={v.status !== "active"} />}
        </group>
      ))}
    </group>
  );
}

function writeDebris(pool: DebrisPool, mesh: THREE.InstancedMesh, dummy: THREE.Object3D) {
  for (let i = 0; i < pool.n; i++) {
    const i3 = i * 3;
    dummy.position.set(pool.pos[i3], pool.pos[i3 + 1], pool.pos[i3 + 2]);
    dummy.rotation.set(pool.rot[i3], pool.rot[i3 + 1], pool.rot[i3 + 2]);
    const s = pool.state[i] === 0 ? 0 : pool.scale[i];
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}
