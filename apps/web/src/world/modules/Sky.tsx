"use client";
// Module: Sky. Owns time of day, the sky dome (gradient, sun, moon, stars), clouds, scene lighting, fog
// and post-processing (bloom + tone mapping + vignette) for the whole scene.
import { useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, type ComponentRef } from "react";
import {
  BackSide,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  Euler,
} from "three";
import { useWorld } from "../store";
import { advanceHour, createSkyState, sampleSky } from "./Sky/skyState";

const DOME_RADIUS = 1500;
const FOG_NEAR = 380;
const FOG_FAR = 900;
const STORE_PUSH_MS = 250; // setTimeOfDay at most 4x per second
const SHADOW_HALF = 220; // shadow camera covers downtown +-200 with a little margin
const LIGHT_DISTANCE = 500;
const TONE_MAPPING_ACES_FILMIC = 6; // postprocessing ToneMappingMode.ACES_FILMIC

const noRaycast = () => null;

// ---------- Sky dome shader ----------
const domeVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const domeFragment = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uSunColor;
uniform float uStars;
uniform float uTime;
varying vec3 vDir;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

void main() {
  vec3 d = normalize(vDir);
  float y = d.y;

  // Gradient: horizon -> zenith, slightly deeper colour just below the horizon (mostly hidden by fog/ground).
  vec3 col = mix(uHorizon, uZenith, pow(clamp(y, 0.0, 1.0), 0.45));
  col = mix(col, uHorizon * 0.82, clamp(-y * 3.0, 0.0, 1.0));

  // Sun glow and disc.
  float sunVis = smoothstep(-0.18, 0.04, uSunDir.y);
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(sd, 10.0) * 0.35 + pow(sd, 180.0) * 0.7) * sunVis;
  float disc = smoothstep(0.99935, 0.99965, sd) * smoothstep(-0.01, 0.01, y);
  col = mix(col, uSunColor * 5.0 + vec3(1.2), disc * sunVis);

  // Moon (with a faint halo) and stars at night.
  float night = uStars;
  float md = max(dot(d, uMoonDir), 0.0);
  float moonVis = night * smoothstep(-0.02, 0.08, uMoonDir.y) * smoothstep(-0.01, 0.01, y);
  col += vec3(0.55, 0.62, 0.9) * pow(md, 300.0) * 0.25 * moonVis;
  float mdisc = smoothstep(0.99955, 0.99975, md);
  // a little crater shading so the moon isn't a flat dot
  float crater = 0.85 + 0.15 * hash13(floor(d * 2600.0));
  col = mix(col, vec3(1.0, 0.97, 0.88) * 2.2 * crater, mdisc * moonVis);

  if (night > 0.001 && y > 0.0) {
    vec3 p = d * 170.0;
    vec3 cell = floor(p);
    float h = hash13(cell);
    if (h > 0.986) {
      vec3 off = vec3(hash13(cell + 7.1), hash13(cell + 3.7), hash13(cell + 1.3)) - 0.5;
      float dist = length(fract(p) - 0.5 - off * 0.5);
      float tw = 0.65 + 0.35 * sin(uTime * (1.5 + h * 3.0) + h * 91.0);
      float s = (1.0 - smoothstep(0.0, 0.14, dist)) * tw * smoothstep(0.0, 0.25, y);
      vec3 tint = mix(vec3(0.8, 0.85, 1.0), vec3(1.0, 0.9, 0.75), hash13(cell + 11.0));
      col += tint * s * night * (h > 0.997 ? 1.6 : 0.9);
    }
  }

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// ---------- Clouds ----------
interface CloudLayout {
  count: number;
  baseX: Float32Array; // per cloud
  baseZ: Float32Array;
  baseY: Float32Array;
  speed: Float32Array;
  puffCloud: Uint16Array; // per puff: owning cloud
  puffOffset: Float32Array; // per puff xyz
  puffScale: Float32Array; // per puff xyz
  puffQuat: Quaternion[];
}

const CLOUDS = 16;
const CLOUD_SPAN = 1300; // clouds wrap across x in [-650, 650]

function buildClouds(): CloudLayout {
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const baseX = new Float32Array(CLOUDS);
  const baseZ = new Float32Array(CLOUDS);
  const baseY = new Float32Array(CLOUDS);
  const speed = new Float32Array(CLOUDS);
  const puffCloud: number[] = [];
  const off: number[] = [];
  const scl: number[] = [];
  const quats: Quaternion[] = [];
  const e = new Euler();
  for (let c = 0; c < CLOUDS; c++) {
    baseX[c] = -CLOUD_SPAN / 2 + rnd() * CLOUD_SPAN;
    baseZ[c] = -520 + rnd() * 1040;
    baseY[c] = 125 + rnd() * 45;
    speed[c] = 2.5 + rnd() * 2.5;
    const puffs = 4 + Math.floor(rnd() * 4);
    const size = 9 + rnd() * 7;
    for (let p = 0; p < puffs; p++) {
      puffCloud.push(c);
      const along = (p / (puffs - 1) - 0.5) * size * 2.6;
      const r = size * (0.65 + rnd() * 0.5) * (1 - Math.abs(along) / (size * 3.2));
      off.push(along, (rnd() - 0.3) * size * 0.35, (rnd() - 0.5) * size * 0.9);
      scl.push(r * 1.25, r * 0.75, r);
      quats.push(new Quaternion().setFromEuler(e.set(rnd() * 0.4, rnd() * Math.PI * 2, rnd() * 0.4)));
    }
  }
  return {
    count: puffCloud.length,
    baseX,
    baseZ,
    baseY,
    speed,
    puffCloud: Uint16Array.from(puffCloud),
    puffOffset: Float32Array.from(off),
    puffScale: Float32Array.from(scl),
    puffQuat: quats,
  };
}

// Scratch objects for the frame loop (no per-frame allocation).
const _m = new Matrix4();
const _p = new Vector3();
const _s = new Vector3();
const _night = new Color();

export default function Sky() {
  const scene = useThree((s) => s.scene);
  const sky = useMemo(() => createSkyState(), []);
  const hourRef = useRef(useWorld.getState().timeOfDay);
  const lastPushed = useRef(useWorld.getState().timeOfDay);
  const lastPushT = useRef(0);

  const domeRef = useRef<Mesh>(null);
  const sunRef = useRef<DirectionalLight>(null);
  const hemiRef = useRef<HemisphereLight>(null);
  const cloudsRef = useRef<InstancedMesh>(null);
  const fogRef = useRef<Fog>(null);
  const cloudDrift = useRef(0); // seconds of (unpaused) cloud drift
  const bloomRef = useRef<ComponentRef<typeof Bloom>>(null);

  const domeGeo = useMemo(() => new SphereGeometry(DOME_RADIUS, 48, 24), []);
  const domeMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: domeVertex,
        fragmentShader: domeFragment,
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uZenith: { value: new Color() },
          uHorizon: { value: new Color() },
          uSunDir: { value: new Vector3(0, 1, 0) },
          uMoonDir: { value: new Vector3(0, -1, 0) },
          uSunColor: { value: new Color() },
          uStars: { value: 0 },
          uTime: { value: 0 },
        },
      }),
    [],
  );

  const clouds = useMemo(() => buildClouds(), []);
  const cloudGeo = useMemo(() => new IcosahedronGeometry(1, 1), []);
  const cloudMat = useMemo(
    () => new MeshStandardMaterial({ color: "#ffffff", roughness: 1, metalness: 0, flatShading: true }),
    [],
  );

  // World.tsx mounts a constant white fallback hemisphere light. Sky drives its own hemisphere light, so
  // mute the fallback while Sky is alive (otherwise night can never get moody) and restore it on unmount.
  useEffect(() => {
    const muted: { light: HemisphereLight; intensity: number }[] = [];
    scene.traverse((o) => {
      if ((o as HemisphereLight).isHemisphereLight && o !== hemiRef.current) {
        const l = o as HemisphereLight;
        muted.push({ light: l, intensity: l.intensity });
        l.intensity = 0;
      }
    });
    return () => muted.forEach((m) => (m.light.intensity = m.intensity));
  }, [scene]);

  // Make sure the shadow frustum props (set via pierced props) take effect.
  useEffect(() => {
    sunRef.current?.shadow.camera.updateProjectionMatrix();
  }, []);

  useEffect(
    () => () => {
      domeGeo.dispose();
      domeMat.dispose();
      cloudGeo.dispose();
      cloudMat.dispose();
    },
    [domeGeo, domeMat, cloudGeo, cloudMat],
  );

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    const world = useWorld.getState();
    const now = performance.now();

    // ---- time of day ----
    if (world.timeOfDay !== lastPushed.current) {
      // someone else (UI) changed the time: adopt it
      hourRef.current = world.timeOfDay;
      lastPushed.current = world.timeOfDay;
    }
    if (!world.paused) {
      hourRef.current = advanceHour(hourRef.current, dt);
      if (now - lastPushT.current >= STORE_PUSH_MS) {
        lastPushT.current = now;
        lastPushed.current = hourRef.current;
        world.setTimeOfDay(hourRef.current);
      }
    }

    sampleSky(hourRef.current, sky);

    // ---- dome ----
    const dome = domeRef.current;
    if (dome) {
      dome.position.copy(state.camera.position);
      const u = (dome.material as ShaderMaterial).uniforms;
      (u.uZenith.value as Color).copy(sky.zenith);
      (u.uHorizon.value as Color).copy(sky.horizon);
      (u.uSunDir.value as Vector3).copy(sky.sunDir);
      (u.uMoonDir.value as Vector3).copy(sky.moonDir);
      (u.uSunColor.value as Color).copy(sky.keyColor);
      u.uStars.value = sky.stars;
      u.uTime.value = now / 1000;
    }

    // ---- fog ----
    fogRef.current?.color.copy(sky.horizon);

    // ---- lights ----
    const sun = sunRef.current;
    if (sun) {
      sun.position.copy(sky.keyDir).multiplyScalar(LIGHT_DISTANCE);
      sun.color.copy(sky.keyColor);
      sun.intensity = sky.keyIntensity;
    }
    const hemi = hemiRef.current;
    if (hemi) {
      hemi.color.copy(sky.hemiSky);
      hemi.groundColor.copy(sky.hemiGround);
      hemi.intensity = sky.hemiIntensity;
    }

    // ---- bloom: stronger at night so windows, lamps and sirens pop ----
    const bloom = bloomRef.current;
    if (bloom) bloom.intensity = sky.bloom;

    // ---- clouds ----
    const inst = cloudsRef.current;
    if (inst) {
      const mat = inst.material as MeshStandardMaterial;
      mat.color.copy(sky.cloud);
      mat.emissive.copy(_night.copy(sky.cloud).multiplyScalar(0.35));
      if (!world.paused) cloudDrift.current += dt;
      const drift = cloudDrift.current;
      const c = clouds;
      const half = CLOUD_SPAN / 2;
      for (let i = 0; i < c.count; i++) {
        const ci = c.puffCloud[i];
        const x = ((((c.baseX[ci] + c.speed[ci] * drift + half) % CLOUD_SPAN) + CLOUD_SPAN) % CLOUD_SPAN) - half;
        _p.set(
          x + c.puffOffset[i * 3],
          c.baseY[ci] + c.puffOffset[i * 3 + 1],
          c.baseZ[ci] + c.puffOffset[i * 3 + 2],
        );
        _s.set(c.puffScale[i * 3], c.puffScale[i * 3 + 1], c.puffScale[i * 3 + 2]);
        _m.compose(_p, c.puffQuat[i], _s);
        inst.setMatrixAt(i, _m);
      }
      inst.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <mesh
        ref={domeRef}
        geometry={domeGeo}
        material={domeMat}
        renderOrder={-1000}
        frustumCulled={false}
        raycast={noRaycast}
      />
      <instancedMesh
        ref={cloudsRef}
        args={[cloudGeo, cloudMat, clouds.count]}
        frustumCulled={false}
        raycast={noRaycast}
      />

      <directionalLight
        ref={sunRef}
        castShadow
        position={[200, 300, 150]}
        intensity={2.5}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-SHADOW_HALF}
        shadow-camera-right={SHADOW_HALF}
        shadow-camera-top={SHADOW_HALF}
        shadow-camera-bottom={-SHADOW_HALF}
        shadow-camera-near={10}
        shadow-camera-far={LIGHT_DISTANCE * 2.2}
        shadow-bias={-0.0004}
        shadow-normalBias={0.4}
      />
      <fog ref={fogRef} attach="fog" args={["#a9c7e8", FOG_NEAR, FOG_FAR]} />
      <hemisphereLight ref={hemiRef} args={["#d6e8ff", "#606a55", 1]} />

      <EffectComposer multisampling={4}>
        <Bloom ref={bloomRef} mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.2} intensity={0.8} radius={0.7} />
        <ToneMapping mode={TONE_MAPPING_ACES_FILMIC} />
        <Vignette offset={0.3} darkness={0.45} />
      </EffectComposer>
    </>
  );
}
