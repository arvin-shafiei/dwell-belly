"use client";
// ~15 cyclists in the left gutter of downtown streets. Not in the vehicle registry (traffic ignores them).
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
} from "three";
import { useWorld } from "../../store";
import { merge, paint } from "./geo";
import { createCyclist, mulberry32, stepCyclist, type Cyclist } from "./sim";
import { isBlocked, isGreen } from "./signalsLocal";

const COUNT = 15;
const SCALE = 1.25;
const JERSEYS = ["#ffb703", "#e63946", "#3a86ff", "#2a9d8f", "#ff6a1a", "#8338ec", "#90be6d", "#ff006e"];

export default function Cyclists() {
  const bikeRef = useRef<InstancedMesh>(null);
  const riderRef = useRef<InstancedMesh>(null);
  const sim = useRef<{ bikes: Cyclist[]; rand: () => number } | null>(null);

  const { bikeGeo, riderGeo, bikeMat, riderMat } = useMemo(() => {
    const wheel = (z: number) => {
      const g = new TorusGeometry(0.33, 0.05, 5, 12);
      g.rotateY(Math.PI / 2);
      g.translate(0, 0.36, z);
      return paint(g, "#1b1b1b");
    };
    const frame = paint(new BoxGeometry(0.07, 0.07, 0.95), "#c0c4c8");
    frame.rotateX(-0.25);
    frame.translate(0, 0.6, 0);
    const seatPost = paint(new BoxGeometry(0.06, 0.4, 0.06), "#c0c4c8");
    seatPost.translate(0, 0.62, -0.2);
    const bars = paint(new BoxGeometry(0.5, 0.05, 0.05), "#333333");
    bars.translate(0, 0.98, 0.42);
    const bikeGeo = merge([wheel(0.52), wheel(-0.52), frame, seatPost, bars]);

    const torso = new CapsuleGeometry(0.2, 0.5, 3, 6);
    torso.rotateX(0.55); // lean forward to the bars
    torso.translate(0, 1.22, -0.05);
    const head = new SphereGeometry(0.18, 8, 6);
    head.translate(0, 1.66, 0.18);
    const legs = new CylinderGeometry(0.09, 0.07, 0.6, 5);
    legs.translate(0, 0.72, -0.05);
    // paint white so instance colour comes through; head/legs get a darker tone via vertex colour
    const riderGeo = merge([paint(torso, "#ffffff"), paint(head, "#2b2b2b"), paint(legs, "#3a3a3a")]);

    const bikeMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 });
    const riderMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true });
    return { bikeGeo, riderGeo, bikeMat, riderMat };
  }, []);

  useEffect(
    () => () => {
      bikeGeo.dispose();
      riderGeo.dispose();
      bikeMat.dispose();
      riderMat.dispose();
    },
    [bikeGeo, riderGeo, bikeMat, riderMat],
  );

  useLayoutEffect(() => {
    const rand = mulberry32(99);
    const bikes = Array.from({ length: COUNT }, () => createCyclist(rand));
    sim.current = { bikes, rand };
    const rider = riderRef.current!;
    const c = new Color();
    for (let i = 0; i < COUNT; i++) rider.setColorAt(i, c.set(JERSEYS[i % JERSEYS.length]));
    rider.instanceColor!.needsUpdate = true;
    write(bikes, bikeRef.current!, rider);
  }, []);

  useFrame((_, delta) => {
    const s = sim.current;
    if (!s || useWorld.getState().paused) return;
    const dt = Math.min(delta, 0.1);
    for (const b of s.bikes) stepCyclist(b, dt, s.rand, isGreen, isBlocked);
    write(s.bikes, bikeRef.current!, riderRef.current!);
  });

  return (
    <group>
      <instancedMesh ref={bikeRef} args={[bikeGeo, bikeMat, COUNT]} frustumCulled={false} />
      <instancedMesh ref={riderRef} args={[riderGeo, riderMat, COUNT]} frustumCulled={false} />
    </group>
  );
}

const dummy = new Object3D();
dummy.scale.setScalar(SCALE);
const shown = new Float32Array(COUNT); // smoothed heading per bike, so turns aren't instant

function write(bikes: Cyclist[], bike: InstancedMesh, rider: InstancedMesh) {
  for (let i = 0; i < bikes.length; i++) {
    const b = bikes[i];
    let d = b.heading - shown[i];
    d = Math.atan2(Math.sin(d), Math.cos(d));
    shown[i] += d * 0.25;
    dummy.position.set(b.x, 0, b.z);
    dummy.rotation.set(0, shown[i], b.speed > 0 ? Math.sin(b.phase) * 0.04 : 0.12);
    dummy.updateMatrix();
    bike.setMatrixAt(i, dummy.matrix);
    dummy.position.y = b.speed > 0 ? Math.abs(Math.sin(b.phase)) * 0.04 : 0;
    dummy.updateMatrix();
    rider.setMatrixAt(i, dummy.matrix);
  }
  bike.instanceMatrix.needsUpdate = true;
  rider.instanceMatrix.needsUpdate = true;
}
