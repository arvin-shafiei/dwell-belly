"use client";
// Scripted wreck meshes (T-boned cars, jackknifed HGV) and the per-crash site markers
// (pulsing ring, oil slick, warning triangle, floating status badge).
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { registerVehicle } from "../../registry";
import type { IncidentStatus } from "../../store";
import { labelTexture, triangleGeometry } from "./vfx";

// --- Shared geometry and materials (created once, lazily) --------------------

let shared: ReturnType<typeof makeShared> | null = null;
function makeShared() {
  const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, ...extra });
  return {
    carBody: new THREE.BoxGeometry(1.9, 0.7, 4.2),
    carCabin: new THREE.BoxGeometry(1.62, 0.6, 2.1),
    carRoof: new THREE.BoxGeometry(1.72, 0.1, 2.0),
    bonnet: new THREE.BoxGeometry(1.8, 0.07, 1.3),
    wheel: new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10).rotateZ(Math.PI / 2),
    bigWheel: new THREE.CylinderGeometry(0.55, 0.55, 0.4, 10).rotateZ(Math.PI / 2),
    hazard: new THREE.BoxGeometry(0.28, 0.16, 0.08),
    cab: new THREE.BoxGeometry(2.5, 2.4, 2.4),
    windscreen: new THREE.BoxGeometry(2.3, 1.0, 0.1),
    trailer: new THREE.BoxGeometry(2.6, 3.0, 9.5),
    stripe: new THREE.BoxGeometry(2.64, 0.55, 9.3),
    ring: new THREE.RingGeometry(3.4, 4.2, 40).rotateX(-Math.PI / 2),
    slick: new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2),
    triOuter: triangleGeometry(1.5),
    triInner: triangleGeometry(0.85),
    triLeg: new THREE.BoxGeometry(0.06, 0.5, 0.06),
    glass: std("#24364a", { roughness: 0.25, metalness: 0.4 }),
    tyre: std("#1b1b1f"),
    hazardMat: new THREE.MeshStandardMaterial({ color: "#ff9d1a", emissive: "#ff8a00", emissiveIntensity: 2 }),
    cabMat: std("#ff6a1a"),
    white: std("#f4f2ee"),
    charred: std("#2a2522"),
    ringMat: new THREE.MeshBasicMaterial({ color: "#ff2a2a", transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }),
    slickMat: new THREE.MeshStandardMaterial({
      color: "#0d0d10",
      roughness: 0.15,
      metalness: 0.6,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
    triRed: new THREE.MeshStandardMaterial({ color: "#e3141b", emissive: "#a00000", emissiveIntensity: 0.6, side: THREE.DoubleSide }),
    triWhite: new THREE.MeshStandardMaterial({ color: "#ffffff", side: THREE.DoubleSide }),
    paint: new Map<string, THREE.MeshStandardMaterial>(),
  };
}
export function getShared() {
  if (!shared) shared = makeShared();
  return shared;
}
function paint(color: string) {
  const s = getShared();
  let m = s.paint.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15, flatShading: true });
    s.paint.set(color, m);
  }
  return m;
}

export const CAR_COLORS = ["#d7263d", "#1b98e0", "#f4d35e", "#3bb273", "#7b2cbf", "#f4f2ee", "#222831", "#ff8c42"];

// --- Layouts in the crash frame: +z is the direction of travel, +x is the travelling (left) lane ---

/** T-bone: car A in its lane, car B nose-first into A's offside. */
export const TBONE = {
  a: { x: 2.1, z: 0, yaw: 0.14, roll: 0.1 },
  b: { x: -0.7, z: 0.5, yaw: Math.PI / 2 - 0.28, roll: -0.04 },
  impact: { x: 1.1, z: 0.3 },
  smoke: { x: 0.2, z: 0.4 },
};

const TR_YAW = 0.95;
const TR = { x: -1.2, z: 0 };
const TR_F = { x: Math.sin(TR_YAW), z: Math.cos(TR_YAW) };
const CAB_YAW = TR_YAW - 1.45;
const CAB_F = { x: Math.sin(CAB_YAW), z: Math.cos(CAB_YAW) };
const HINGE = { x: TR.x + TR_F.x * 3.75, z: TR.z + TR_F.z * 3.75 };
/** Jackknifed HGV: trailer slewed across both lanes, cab folded back against it. */
export const JACKKNIFE = {
  trailer: { x: TR.x, z: TR.z, yaw: TR_YAW, roll: 0.16 },
  cab: { x: HINGE.x + CAB_F.x * 2.2, z: HINGE.z + CAB_F.z * 2.2, yaw: CAB_YAW, roll: -0.08 },
  rear: { x: TR.x - TR_F.x * 4.75, z: TR.z - TR_F.z * 4.75 },
  rearDir: { x: -TR_F.x, z: -TR_F.z },
};

// --- Wreck vehicles ---------------------------------------------------------

function Car({ color, crumpled, groupRef }: { color: string; crumpled: boolean; groupRef: React.Ref<THREE.Group> }) {
  const s = getShared();
  const body = paint(color);
  return (
    <group ref={groupRef}>
      <mesh geometry={s.carBody} material={body} position={[0, 0.6, 0]} scale={[1, 1, crumpled ? 0.86 : 1]} castShadow />
      <mesh geometry={s.carCabin} material={s.glass} position={[0, 1.25, -0.25]} rotation={[0, 0, crumpled ? 0.06 : 0]} />
      <mesh geometry={s.carRoof} material={body} position={[0, 1.58, -0.25]} rotation={[0.05, 0, crumpled ? 0.08 : 0]} />
      {crumpled && <mesh geometry={s.bonnet} material={body} position={[0, 1.08, 1.25]} rotation={[-0.55, 0.12, 0.1]} />}
      {[
        [0.95, 1.3],
        [-0.95, 1.3],
        [0.95, -1.3],
        [-0.95, -1.3],
      ].map(([x, z], i) => (
        <mesh key={i} geometry={s.wheel} material={s.tyre} position={[x, 0.38, z]} rotation={[0, crumpled && i < 2 ? 0.5 : 0, 0]} />
      ))}
      <mesh geometry={s.hazard} material={s.hazardMat} position={[0.7, 0.75, -2.12]} />
      <mesh geometry={s.hazard} material={s.hazardMat} position={[-0.7, 0.75, -2.12]} />
      <mesh geometry={s.hazard} material={s.hazardMat} position={[0.7, 0.75, 1.9]} />
      <mesh geometry={s.hazard} material={s.hazardMat} position={[-0.7, 0.75, 1.9]} />
    </group>
  );
}

function useRegisterWreck(ref: React.RefObject<THREE.Object3D | null>, id: string, kind: "car" | "truck", edgeKey: string, from: string, to: string) {
  useEffect(() => {
    const src = ref.current;
    if (!src) return;
    // The wreck mesh is nested in the crash group, so hand the registry a detached proxy that holds
    // world position and heading (registry readers expect object.position / rotation.y in world space).
    src.updateWorldMatrix(true, false);
    const proxy = new THREE.Object3D();
    src.matrixWorld.decompose(proxy.position, proxy.quaternion, proxy.scale);
    proxy.rotation.setFromQuaternion(proxy.quaternion, "YXZ");
    const off = registerVehicle({ id, kind, object: proxy, edgeKey, from, to, t: 0.5, speed: 0, stopped: true, crash: () => false });
    return () => {
      off();
    };
  }, [ref, id, kind, edgeKey, from, to]);
}

export interface WreckProps {
  ids: string[];
  colors: [string, string];
  edgeKey: string;
  from: string;
  to: string;
}

export function TBoneWreck({ ids, colors, edgeKey, from, to }: WreckProps) {
  const a = useRef<THREE.Group>(null);
  const b = useRef<THREE.Group>(null);
  useRegisterWreck(a, ids[0], "car", edgeKey, from, to);
  useRegisterWreck(b, ids[1], "car", edgeKey, from, to);
  return (
    <>
      <group position={[TBONE.a.x, 0, TBONE.a.z]} rotation={[0, TBONE.a.yaw, TBONE.a.roll]}>
        <Car color={colors[0]} crumpled={false} groupRef={a} />
      </group>
      <group position={[TBONE.b.x, 0, TBONE.b.z]} rotation={[0, TBONE.b.yaw, TBONE.b.roll]}>
        <Car color={colors[1]} crumpled groupRef={b} />
      </group>
    </>
  );
}

export function JackknifeWreck({ ids, edgeKey, from, to, burnt }: WreckProps & { burnt: boolean }) {
  const s = getShared();
  const truck = useRef<THREE.Group>(null);
  useRegisterWreck(truck, ids[0], "truck", edgeKey, from, to);
  const t = JACKKNIFE.trailer;
  const c = JACKKNIFE.cab;
  return (
    <group ref={truck}>
      <group position={[t.x, 0, t.z]} rotation={[0, t.yaw, t.roll]}>
        <mesh geometry={s.trailer} material={s.white} position={[0, 2.6, 0]} castShadow />
        <mesh geometry={s.stripe} material={s.cabMat} position={[0, 2.0, 0]} />
        {[-3.6, -2.4].map((z) =>
          [1.1, -1.1].map((x) => <mesh key={`${x}${z}`} geometry={s.bigWheel} material={s.tyre} position={[x, 0.55, z]} />),
        )}
        <mesh geometry={s.hazard} material={s.hazardMat} position={[1.1, 1.3, -4.78]} />
        <mesh geometry={s.hazard} material={s.hazardMat} position={[-1.1, 1.3, -4.78]} />
      </group>
      <group position={[c.x, 0, c.z]} rotation={[0, c.yaw, c.roll]}>
        <mesh geometry={s.cab} material={burnt ? s.charred : s.cabMat} position={[0, 1.75, 0]} castShadow />
        <mesh geometry={s.windscreen} material={s.glass} position={[0, 2.3, 1.22]} rotation={[0.15, 0, 0.1]} />
        {[0.8, -0.8].map((z) =>
          [1.15, -1.15].map((x) => <mesh key={`${x}${z}`} geometry={s.bigWheel} material={s.tyre} position={[x, 0.55, z]} />),
        )}
        <mesh geometry={s.hazard} material={s.hazardMat} position={[1.0, 1.0, 1.22]} />
        <mesh geometry={s.hazard} material={s.hazardMat} position={[-1.0, 1.0, 1.22]} />
      </group>
    </group>
  );
}

// --- Site markers -----------------------------------------------------------

const STATUS_TEXT: Record<IncidentStatus, [string, string]> = {
  active: ["Road closed · no units yet", "#e0262b"],
  responding: ["Units on scene", "#ef7d00"],
  clearing: ["Clearing wreckage", "#2f6fd6"],
  cleared: ["Road reopened", "#2a9d55"],
};

export function SiteMarker({
  title,
  status,
  slick,
  tri,
  phase,
}: {
  title: string;
  status: IncidentStatus;
  slick: number; // oil slick radius
  tri: [number, number]; // warning triangle position in the crash frame (faces upstream, -z)
  phase: number; // animation offset so sites don't pulse in sync
}) {
  const s = getShared();
  const ring = useRef<THREE.Mesh>(null);
  const label = useRef<THREE.Sprite>(null);
  const [text, color] = STATUS_TEXT[status];
  const map = useMemo(() => labelTexture(title, text, color), [title, text, color]);
  useFrame(() => {
    const t = performance.now() / 1000 + phase;
    if (ring.current) {
      const k = (t * 0.9) % 1;
      ring.current.scale.setScalar(0.7 + k * 1.6);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - k);
    }
    if (label.current) label.current.position.y = 12 + Math.sin(t * 2) * 0.35;
  });
  // ring material per site so opacities differ
  const ringMat = useMemo(() => s.ringMat.clone(), [s]);
  useEffect(() => () => ringMat.dispose(), [ringMat]);
  useEffect(() => {
    ringMat.color.set(status === "active" ? "#ff2a2a" : status === "responding" ? "#ff9a1a" : "#3a8bff");
  }, [ringMat, status]);
  return (
    <>
      <mesh ref={ring} geometry={s.ring} material={ringMat} position={[0, 0.09, 0]} renderOrder={5} />
      <mesh geometry={s.slick} material={s.slickMat} position={[0.4, 0.075, -0.3]} scale={[slick, 1, slick * 0.75]} />
      <group position={[tri[0], 0, tri[1]]}>
        <group rotation={[0, Math.PI, 0]} scale={1.6}>
          <mesh geometry={s.triLeg} material={s.tyre} position={[-0.3, 0.25, -0.15]} rotation={[0.5, 0, 0]} />
          <mesh geometry={s.triLeg} material={s.tyre} position={[0.3, 0.25, -0.15]} rotation={[0.5, 0, 0]} />
          <group position={[0, 0.2, 0]} rotation={[-0.25, 0, 0]}>
            <mesh geometry={s.triOuter} material={s.triRed} />
            <mesh geometry={s.triInner} material={s.triWhite} position={[0, 0.2, 0.01]} />
          </group>
        </group>
      </group>
      <sprite ref={label} position={[0, 12, 0]} scale={[13, 4.06, 1]} renderOrder={20}>
        <spriteMaterial map={map} depthTest={false} depthWrite={false} transparent toneMapped={false} />
      </sprite>
    </>
  );
}
