// Pure helpers for the Ground module: seeded RNG, value noise, and the coastline shape.
// The water shader (water.ts) mirrors shoreX() in GLSL, so keep the two in sync.
import { WATER_X, ZONES } from "../../config";

/** Small fast seeded RNG returning [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed + 1, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** 2D value noise in [0, 1). */
export function valueNoise(x: number, y: number, seed = 0): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** Fractal value noise normalised to [0, 1). */
export function fbm(x: number, y: number, octaves = 4, seed = 0): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * f, y * f, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

/** Half-length (z) of the straight docks quay wall. */
export const QUAY_HALF = ZONES.docks.maxZ; // 80
/** How far inland of WATER_X the beach waterline sits (outside the quay). */
export const SHORE_INSET = 6;
/** Sea level. Slightly below the ground so the land reads as sitting above the water. */
export const WATER_Y = -0.25;

/** The waterline x for a given z: a straight quay wall at the docks, a wobbly beach elsewhere. */
export function shoreX(z: number): number {
  const az = Math.abs(z);
  if (az <= QUAY_HALF) return WATER_X;
  const m = smoothstep(QUAY_HALF, QUAY_HALF + 60, az);
  return WATER_X - SHORE_INSET + m * (2.6 * Math.sin(z * 0.031) + 1.2 * Math.sin(z * 0.097 + 1.3));
}
