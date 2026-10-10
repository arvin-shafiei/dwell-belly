// Procedural, seamlessly tiling CanvasTextures for the ground surfaces. Built once on mount.
// Every texture is sampled with world-space UVs (uv = xz / tileMetres), so tiles line up across meshes.
import * as THREE from "three";
import { mulberry32 } from "./noise";

type Ctx = CanvasRenderingContext2D;
type Rng = () => number;

function makeCanvas(size: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return [c, ctx];
}

function finish(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** Run draw(ox, oy) at every wrapped offset so shapes crossing an edge reappear on the opposite side. */
function wrapped(size: number, x: number, y: number, r: number, draw: (x: number, y: number) => void) {
  for (const dx of [-size, 0, size]) {
    if (x + dx + r < 0 || x + dx - r > size) continue;
    for (const dy of [-size, 0, size]) {
      if (y + dy + r < 0 || y + dy - r > size) continue;
      draw(x + dx, y + dy);
    }
  }
}

/** Soft radial blotches (mottling, stains, clumps). */
function blotches(ctx: Ctx, size: number, rng: Rng, n: number, colors: string[], rMin: number, rMax: number, alpha: number) {
  for (let i = 0; i < n; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = rMin + rng() * (rMax - rMin);
    const col = colors[Math.floor(rng() * colors.length)];
    wrapped(size, x, y, r, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, col);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
  ctx.globalAlpha = 1;
}

/** Short slanted strokes, read as grass blades from close up and as fine texture from afar. */
function blades(ctx: Ctx, size: number, rng: Rng, n: number, colors: string[], len: number, width: number) {
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const l = len * (0.5 + rng());
    const a = -Math.PI / 2 + (rng() - 0.5) * 1.1;
    const ex = Math.cos(a) * l;
    const ey = Math.sin(a) * l;
    ctx.strokeStyle = colors[Math.floor(rng() * colors.length)];
    ctx.lineWidth = width * (0.6 + rng() * 0.8);
    ctx.globalAlpha = 0.55 + rng() * 0.45;
    wrapped(size, x, y, l + 2, (px, py) => {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + ex, py + ey);
      ctx.stroke();
    });
  }
  ctx.globalAlpha = 1;
}

function dots(ctx: Ctx, size: number, rng: Rng, n: number, colors: string[], rMin: number, rMax: number) {
  for (let i = 0; i < n; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = rMin + rng() * (rMax - rMin);
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
    wrapped(size, x, y, r, (px, py) => {
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

/** Per-pixel brightness grain. Independent per pixel, so it tiles trivially. */
function grain(ctx: Ctx, size: number, rng: Rng, amount: number) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = (rng() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + v));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + v));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + v));
  }
  ctx.putImageData(img, 0, 0);
}

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
}

/** Hairline cracks: thin random-walk polylines. */
function cracks(ctx: Ctx, size: number, rng: Rng, n: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < n; i++) {
    let x = size * 0.1 + rng() * size * 0.8;
    let y = size * 0.1 + rng() * size * 0.8;
    let a = rng() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const steps = 4 + Math.floor(rng() * 6);
    for (let s = 0; s < steps; s++) {
      a += (rng() - 0.5) * 1.2;
      x += Math.cos(a) * 6;
      y += Math.sin(a) * 6;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------------------------

/** Open meadow outside the zones. Tile: 16 m. */
export function meadowTexture(): THREE.CanvasTexture {
  const S = 512;
  const [c, ctx] = makeCanvas(S);
  const rng = mulberry32(11);
  ctx.fillStyle = "#79ad4c";
  ctx.fillRect(0, 0, S, S);
  blotches(ctx, S, rng, 40, ["#5f9a3c", "#8dbd58", "#9cc062", "#6aa443"], 30, 90, 0.35);
  blades(ctx, S, rng, 5200, ["#5c9438", "#6fa646", "#8fc25a", "#a3cc6a", "#4f8a33"], 7, 2);
  dots(ctx, S, rng, 70, ["#f6f2d8", "#f3d653", "#c9a6e8", "#ffffff"], 1, 1.8);
  grain(ctx, S, rng, 14);
  return finish(c);
}

/** Countryside: lusher, deeper green with clover clumps. Tile: 16 m. */
export function countryTexture(): THREE.CanvasTexture {
  const S = 512;
  const [c, ctx] = makeCanvas(S);
  const rng = mulberry32(23);
  ctx.fillStyle = "#679f3d";
  ctx.fillRect(0, 0, S, S);
  blotches(ctx, S, rng, 55, ["#4e8a2e", "#7cb24b", "#8fb84e", "#5a9636"], 20, 70, 0.45);
  blades(ctx, S, rng, 6500, ["#4a852c", "#5f9938", "#7db349", "#93c05a", "#3f7a27"], 8, 2.2);
  dots(ctx, S, rng, 120, ["#fff6c8", "#f2d14a", "#ffffff", "#e9a1c4"], 1, 2);
  grain(ctx, S, rng, 16);
  return finish(c);
}

/** Suburb lawns: bright green with mown stripes. Tile: 8 m (two 4 m stripes). */
export function lawnTexture(): THREE.CanvasTexture {
  const S = 512;
  const [c, ctx] = makeCanvas(S);
  const rng = mulberry32(37);
  ctx.fillStyle = "#86c45a";
  ctx.fillRect(0, 0, S / 2, S);
  ctx.fillStyle = "#74b34b";
  ctx.fillRect(S / 2, 0, S / 2, S);
  blotches(ctx, S, rng, 25, ["#6aa842", "#95cf68"], 30, 80, 0.25);
  blades(ctx, S, rng, 4200, ["#6aa842", "#7dbb52", "#96cf69", "#5f9d3b"], 5, 1.8);
  dots(ctx, S, rng, 25, ["#ffffff", "#f6e46a"], 1, 1.6);
  grain(ctx, S, rng, 10);
  return finish(c);
}

/** Downtown paving: running-bond slabs with joints and a faint bevel. Tile: 8 m, slabs 2 m x 1 m. */
export function pavingTexture(): THREE.CanvasTexture {
  const S = 512;
  const [c, ctx] = makeCanvas(S);
  const rng = mulberry32(51);
  const base = new THREE.Color("#a5a49f");
  const sw = 128; // 2 m
  const sh = 64; // 1 m
  for (let row = 0; row < S / sh; row++) {
    const off = row % 2 ? sw / 2 : 0;
    for (let col = -1; col < S / sw + 1; col++) {
      const x = col * sw + off;
      const y = row * sh;
      const k = 0.93 + rng() * 0.12;
      const tint = base.clone().multiplyScalar(k);
      tint.b *= 0.98 + rng() * 0.04;
      ctx.fillStyle = `#${tint.getHexString()}`;
      ctx.fillRect(x, y, sw, sh);
    }
  }
  blotches(ctx, S, rng, 30, ["#8d8c88", "#b8b7b1"], 20, 70, 0.18);
  grain(ctx, S, rng, 12);
  // Bevel highlights then joints.
  for (let row = 0; row < S / sh; row++) {
    const off = row % 2 ? sw / 2 : 0;
    const y = row * sh;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(0, y + 2, S, 1);
    for (let col = -1; col < S / sw + 1; col++) ctx.fillRect(col * sw + off + 2, y, 1, sh);
    ctx.fillStyle = "#7b7a75";
    ctx.fillRect(0, y, S, 2);
    for (let col = -1; col < S / sw + 1; col++) ctx.fillRect(col * sw + off - 1, y, 2, sh);
  }
  dots(ctx, S, rng, 40, ["rgba(70,70,70,0.25)", "rgba(240,240,235,0.3)"], 1, 2.5); // gum, specks
  return finish(c);
}

/** Generic poured concrete with expansion joints, mottling, stains. */
function concrete(opts: {
  seed: number;
  base: string;
  slab: number; // px per slab (S must be divisible)
  joint: string;
  stains: number;
  rust: number;
  cracks: number;
}): THREE.CanvasTexture {
  const S = 512;
  const [c, ctx] = makeCanvas(S);
  const rng = mulberry32(opts.seed);
  const base = new THREE.Color(opts.base);
  for (let y = 0; y < S; y += opts.slab) {
    for (let x = 0; x < S; x += opts.slab) {
      ctx.fillStyle = `#${base.clone().multiplyScalar(0.95 + rng() * 0.09).getHexString()}`;
      ctx.fillRect(x, y, opts.slab, opts.slab);
    }
  }
  blotches(ctx, S, rng, 60, [shade(opts.base, 0.85), shade(opts.base, 1.12)], 15, 60, 0.2);
  blotches(ctx, S, rng, opts.stains, ["#3a3836", "#4a4440"], 8, 34, 0.28);
  if (opts.rust) blotches(ctx, S, rng, opts.rust, ["#8a5a32", "#a0683a"], 3, 12, 0.35);
  grain(ctx, S, rng, 18);
  cracks(ctx, S, rng, opts.cracks, shade(opts.base, 0.6));
  // Joints, half on each edge so the tile is seamless.
  ctx.fillStyle = opts.joint;
  for (let p = 0; p <= S; p += opts.slab) {
    ctx.fillRect(p - 1.5, 0, 3, S);
    ctx.fillRect(0, p - 1.5, S, 3);
  }
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  for (let p = 0; p < S; p += opts.slab) {
    ctx.fillRect(p + 2, 0, 1, S);
    ctx.fillRect(0, p + 2, S, 1);
  }
  return finish(c);
}

/** Depot apron: clean, light concrete, 4 m slabs. Tile: 16 m. */
export function depotTexture(): THREE.CanvasTexture {
  return concrete({ seed: 61, base: "#bdb9ae", slab: 128, joint: "#8c887f", stains: 14, rust: 0, cracks: 4 });
}

/** Docks: darker, cooler, weathered harbour concrete with oil and rust. Tile: 16 m, 4 m slabs. */
export function docksTexture(): THREE.CanvasTexture {
  return concrete({ seed: 73, base: "#8f959a", slab: 128, joint: "#5f6468", stains: 34, rust: 18, cracks: 12 });
}

export const TILE = {
  meadow: 16,
  country: 16,
  lawn: 8,
  paving: 8,
  depot: 16,
  docks: 16,
} as const;
