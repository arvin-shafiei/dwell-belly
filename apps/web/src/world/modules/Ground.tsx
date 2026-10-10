"use client";
// Module: Ground. The terrain base: meadow, zone surfaces, beach and rocks, the quay, and the animated sea.
// Heights: meadow y = 0, kerb bands 0.005, zone patches 0.008, quay markings 0.011-0.012, sea WATER_Y (-0.25).
// Surfaces also use a positive polygonOffset (meadow most, patches least) so roads at y >= 0.02 always win the depth test.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { WATER_X } from "../config";
import { useWorld } from "../store";
import {
  beachGeometry,
  bordersGeometry,
  buildRocks,
  gridGeometry,
  landRects,
  meadowColor,
  patchColor,
  PATCHES,
  quayLinesGeometry,
} from "./Ground/geometry";
import { QUAY_HALF, WATER_Y } from "./Ground/noise";
import {
  countryTexture,
  depotTexture,
  docksTexture,
  lawnTexture,
  meadowTexture,
  pavingTexture,
  TILE,
} from "./Ground/textures";
import { createWaterMaterial, tickWater } from "./Ground/water";

const PATCH_Y = 0.008;
const SEA_EXTENT = 3600;

function surface(map: THREE.Texture | null, offset: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({
    map,
    vertexColors: true,
    roughness: 0.9,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: offset,
    polygonOffsetUnits: offset * 2,
    ...extra,
  });
}

function buildGround() {
  const tex = {
    meadow: meadowTexture(),
    country: countryTexture(),
    lawn: lawnTexture(),
    paving: pavingTexture(),
    depot: depotTexture(),
    docks: docksTexture(),
  };

  const meshes: { geo: THREE.BufferGeometry; mat: THREE.Material; name: string }[] = [
    { name: "meadow", geo: gridGeometry(landRects(), 0, TILE.meadow, meadowColor), mat: surface(tex.meadow, 4) },
    { name: "kerbs", geo: bordersGeometry(), mat: surface(null, 3, { roughness: 0.95 }) },
    { name: "downtown", geo: gridGeometry([PATCHES.downtown], PATCH_Y, TILE.paving, patchColor(0.12, 41)), mat: surface(tex.paving, 2, { roughness: 0.85 }) },
    { name: "countryside", geo: gridGeometry([PATCHES.countryside], PATCH_Y, TILE.country, patchColor(0.3, 42)), mat: surface(tex.country, 2) },
    { name: "depot", geo: gridGeometry([PATCHES.depot], PATCH_Y, TILE.depot, patchColor(0.1, 43)), mat: surface(tex.depot, 2, { roughness: 0.82 }) },
    { name: "suburbs", geo: gridGeometry([PATCHES.suburbs], PATCH_Y, TILE.lawn, patchColor(0.18, 44)), mat: surface(tex.lawn, 2) },
    { name: "docks", geo: gridGeometry([PATCHES.docks], PATCH_Y, TILE.docks, patchColor(0.16, 45)), mat: surface(tex.docks, 2, { roughness: 0.8 }) },
    { name: "quay-lines", geo: quayLinesGeometry(), mat: surface(null, 1, { roughness: 0.6 }) },
    { name: "beach", geo: beachGeometry(), mat: surface(null, 3, { flatShading: true, roughness: 0.95 }) },
  ];

  // Quay wall: a concrete block under the docks apron whose east and end faces drop into the sea.
  const quayGeo = new THREE.BoxGeometry(16, 3, QUAY_HALF * 2);
  quayGeo.translate(WATER_X - 8, -1.55, 0);
  const quayMat = new THREE.MeshStandardMaterial({ color: "#7c8085", roughness: 0.9, flatShading: true });
  meshes.push({ name: "quay-wall", geo: quayGeo, mat: quayMat });

  // The sea: from just under the beach far out past the horizon.
  const waterGeo = new THREE.PlaneGeometry(SEA_EXTENT + 40, SEA_EXTENT * 2, 1, 1);
  waterGeo.rotateX(-Math.PI / 2);
  waterGeo.translate(WATER_X - 40 + (SEA_EXTENT + 40) / 2, WATER_Y, 0);
  const waterMat = createWaterMaterial();

  const rocks = buildRocks();

  const dispose = () => {
    for (const t of Object.values(tex)) t.dispose();
    for (const m of meshes) {
      m.geo.dispose();
      m.mat.dispose();
    }
    waterGeo.dispose();
    waterMat.dispose();
    rocks.geometry.dispose();
    (rocks.material as THREE.Material).dispose();
    rocks.dispose();
  };

  return { meshes, waterGeo, waterMat, rocks, dispose };
}

export default function Ground() {
  const g = useMemo(() => buildGround(), []);
  useEffect(() => g.dispose, [g]);

  useFrame((state, delta) => {
    const world = useWorld.getState();
    tickWater(g.waterMat, world.paused ? 0 : Math.min(delta, 0.1), world.timeOfDay, state.scene.fog?.color ?? null);
  });

  return (
    <group name="ground">
      {g.meshes.map((m) => (
        <mesh key={m.name} name={`ground-${m.name}`} geometry={m.geo} material={m.mat} receiveShadow />
      ))}
      <mesh name="ground-sea" geometry={g.waterGeo} material={g.waterMat} />
      <primitive object={g.rocks} />
    </group>
  );
}
