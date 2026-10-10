// Pure layout for the Countryside module: fields, hedgerows, walls, farm props, hills, pastures,
// and the tree scatter across all open land. Seeded, so the city looks the same every load.
import { HIGHWAY_RING, WATER_X, ZONES, inBox, type Box } from "../../config";
import { ROAD_EDGES, ROAD_NODES } from "../../roads";

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Seg = [ax: number, az: number, bx: number, bz: number];

export function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t - px;
  const qz = az + dz * t - pz;
  return Math.sqrt(qx * qx + qz * qz);
}

/** Every road edge as a centre-line segment, computed once. */
export const ROAD_SEGS: Seg[] = [...ROAD_EDGES.values()].map((e) => {
  const a = ROAD_NODES.get(e.a)!;
  const b = ROAD_NODES.get(e.b)!;
  return [a.x, a.z, b.x, b.z];
});

export function roadDistance(x: number, z: number, segs: readonly Seg[] = ROAD_SEGS) {
  let best = Infinity;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const d = distToSegment(x, z, s[0], s[1], s[2], s[3]);
    if (d < best) best = d;
  }
  return best;
}

// --- Static farm features (positions checked against roads in layout.test.ts) ------------------

export interface Circle {
  x: number;
  z: number;
  r: number;
}

export const FARM = {
  yard: { x: -304, z: 2, r: 20 },
  farmhouse: { x: -318, z: -8, rot: 0.15 },
  barn: { x: -292, z: 10, rot: -0.1 },
  silo: { x: -296, z: -10 },
  pond: { x: -307, z: 42, r: 8 },
  windmill: { x: -262, z: 104 },
  tractor: { x: -303, z: 14, rot: 0.9 },
} as const;

/** Wind turbine spots: four in the fields, two up on the western hills. */
export const TURBINE_SPOTS: [number, number][] = [
  [-352, -110],
  [-350, -58],
  [-352, 58],
  [-350, 110],
  [-385, -175],
  [-382, 182],
];

/** Exclusion circles for crops and trees (farm buildings, pond, windmill, turbines). */
export const FARM_EXCLUSIONS: Circle[] = [
  ...TURBINE_SPOTS.map(([x, z]) => ({ x, z, r: 3 })),
  { x: FARM.yard.x, z: FARM.yard.z, r: FARM.yard.r },
  { x: FARM.pond.x, z: FARM.pond.z, r: FARM.pond.r + 3 },
  { x: FARM.windmill.x, z: FARM.windmill.z, r: 7 },
];

/** The airport (runway along x) plus a 20 m clear margin: no trees, hills or props in here. */
export const AIRPORT_MARGIN = 20;
export const inAirport = (x: number, z: number, pad = 0) => inBox(ZONES.airport, x, z, AIRPORT_MARGIN + pad);

/** Tall props (wind turbines) must stay out of the airport's quadrant. */
export const tallPropAllowed = (x: number, z: number) => !(x < -200 && z < -200);

// --- Hills along the far west edge ---------------------------------------------------------------

/** An ellipsoid hill centred on the ground: horizontal radius r, peak height h. */
export interface Hill {
  x: number;
  z: number;
  r: number;
  h: number;
}

export function makeHills(seed = 7): Hill[] {
  const rand = mulberry32(seed);
  const hills: Hill[] = [];
  // front row: edge stays west of x = -357 so the farm lane at x = -345 is clear
  for (let z = -410; z <= 410; z += 38 + rand() * 14) {
    const r = 26 + rand() * 18;
    const x = -357 - r - rand() * 10;
    const h = { x, z, r, h: 9 + rand() * 13 };
    if (!hillTouchesAirport(h)) hills.push(h);
  }
  // back row: bigger, further out, a backdrop past the world edge
  for (let z = -440; z <= 440; z += 60 + rand() * 25) {
    const r = 50 + rand() * 30;
    const h = { x: -400 - r * 0.45 - rand() * 20, z, r, h: 22 + rand() * 20 };
    if (!hillTouchesAirport(h)) hills.push(h);
  }
  return hills;
}

function hillTouchesAirport(h: Hill) {
  const b = ZONES.airport;
  const m = AIRPORT_MARGIN;
  const cx = Math.max(b.minX - m, Math.min(h.x, b.maxX + m));
  const cz = Math.max(b.minZ - m, Math.min(h.z, b.maxZ + m));
  return (h.x - cx) ** 2 + (h.z - cz) ** 2 < h.r * h.r;
}

export function hillHeight(hills: readonly Hill[], x: number, z: number) {
  let y = 0;
  for (const h of hills) {
    const d2 = ((x - h.x) ** 2 + (z - h.z) ** 2) / (h.r * h.r);
    if (d2 < 1) y = Math.max(y, h.h * Math.sqrt(1 - d2));
  }
  return y;
}

// --- Wind turbines ----------------------------------------------------------------------------

export interface Turbine {
  x: number;
  z: number;
  y: number; // base height (on a hill or 0)
  scale: number;
  phase: number;
}

export function makeTurbines(hills: readonly Hill[]): Turbine[] {
  return TURBINE_SPOTS.map(([x, z], i) => ({
    x,
    z,
    y: Math.max(0, hillHeight(hills, x, z) - 0.6),
    scale: i >= 4 ? 1.1 : 1,
    phase: i * 1.7,
  }));
}

// --- Fields, hedgerows, dry-stone walls ---------------------------------------------------------

export type Crop = "wheat" | "rapeseed" | "grass" | "barley" | "veg" | "ploughed" | "stubble";

export const CROP_COLORS: Record<Crop, [string, string]> = {
  wheat: ["#e9c35a", "#dcb049"],
  rapeseed: ["#f5d91e", "#e8c814"],
  grass: ["#7dc457", "#74bb4f"],
  barley: ["#c9d36a", "#b7c25b"],
  veg: ["#4f9e3a", "#7b5a3c"],
  ploughed: ["#8a5f3c", "#77502f"],
  stubble: ["#e2cf8a", "#d6c27a"],
};
export const CROP_HEIGHT: Record<Crop, [number, number]> = {
  wheat: [0.55, 0.5],
  rapeseed: [0.5, 0.45],
  grass: [0.07, 0.07],
  barley: [0.45, 0.42],
  veg: [0.35, 0.1],
  ploughed: [0.16, 0.08],
  stubble: [0.1, 0.1],
};

export interface Stripe {
  x: number;
  z: number;
  sx: number;
  sz: number;
  h: number;
  color: string;
}

export interface LinePiece {
  x: number;
  z: number;
  len: number;
  alongX: boolean;
  kind: "hedge" | "wall";
}

export interface Plot extends Box {
  crop: Crop;
  okArea: number; // count of clear sample points (how much of the plot is usable)
}

export interface TreeSpot {
  x: number;
  y: number;
  z: number;
  species: 0 | 1 | 2; // 0 round oak, 1 conifer, 2 poplar
  scale: number;
  rot: number;
  shade: number; // 0..1 colour variation
}

export interface FieldLayout {
  plots: Plot[];
  stripes: Stripe[];
  pieces: LinePiece[];
  hedgeTrees: TreeSpot[];
  pastures: { box: Box; animal: "sheep" | "cow"; spots: [number, number][] }[];
  bales: { x: number; z: number; rot: number }[];
  yard: Stripe[];
}

const inCircles = (cs: readonly Circle[], x: number, z: number, pad = 0) =>
  cs.some((c) => (x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + pad) ** 2);

/** Walk a line in `step` increments, returning runs where ok() holds. */
function runs(from: number, to: number, step: number, ok: (t: number) => boolean) {
  const out: [number, number][] = [];
  let start: number | null = null;
  for (let t = from; t <= to + 1e-6; t += step) {
    const good = ok(t);
    if (good && start === null) start = t;
    if (!good && start !== null) {
      out.push([start, t - step]);
      start = null;
    }
  }
  if (start !== null) out.push([start, to]);
  return out;
}

export function makeFields(seed = 11): FieldLayout {
  const rand = mulberry32(seed);
  const cs = ZONES.countryside;
  const plotW = 26;
  const plotD = 35;
  const gap = 4;
  const cols = 4;
  const rows = 6;
  const clear = (x: number, z: number, roadPad = 7) =>
    roadDistance(x, z) >= roadPad && !inCircles(FARM_EXCLUSIONS, x, z);

  const crops: Crop[] = ["wheat", "rapeseed", "barley", "veg", "ploughed", "wheat", "grass", "rapeseed", "barley"];
  const plots: Plot[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const minX = cs.minX + 2 + c * (plotW + gap);
      const minZ = cs.minZ + 2 + r * (plotD + gap);
      let okArea = 0;
      for (let x = minX + 1; x < minX + plotW; x += 2) for (let z = minZ + 1; z < minZ + plotD; z += 2) if (clear(x, z)) okArea++;
      plots.push({ minX, maxX: minX + plotW, minZ, maxZ: minZ + plotD, crop: crops[Math.floor(rand() * crops.length)], okArea });
    }

  // Pastures: the three emptiest-of-roads plots that are fully clear
  const ranked = [...plots].sort((a, b) => b.okArea - a.okArea);
  const pastureIdx = ranked.slice(0, 3);
  pastureIdx.forEach((p) => (p.crop = "grass"));
  // one harvested field with round bales
  const stubble = ranked.find((p) => !pastureIdx.includes(p) && p.okArea > 120);
  if (stubble) stubble.crop = "stubble";

  const stripes: Stripe[] = [];
  const W = 2.5;
  for (const p of plots) {
    if (p.okArea < 8) continue;
    const alongX = rand() < 0.5;
    const [c0, c1] = CROP_COLORS[p.crop];
    const [h0, h1] = CROP_HEIGHT[p.crop];
    const across = alongX ? p.maxZ - p.minZ : p.maxX - p.minX;
    const n = Math.floor(across / W);
    for (let k = 0; k < n; k++) {
      const off = (alongX ? p.minZ : p.minX) + (k + 0.5) * W;
      const lo = alongX ? p.minX : p.minZ;
      const hi = alongX ? p.maxX : p.maxZ;
      for (const [a, b] of runs(lo + 0.5, hi - 0.5, 1, (t) => (alongX ? clear(t, off) : clear(off, t)))) {
        const len = b - a + 1;
        if (len < 3) continue;
        const mid = (a + b) / 2;
        const even = k % 2 === 0;
        stripes.push({
          x: alongX ? mid : off,
          z: alongX ? off : mid,
          sx: alongX ? len : W,
          sz: alongX ? W : len,
          h: even ? h0 : h1,
          color: even ? c0 : c1,
        });
      }
    }
  }

  // Hedges and walls on grid lines in the gaps between plots
  const pieces: LinePiece[] = [];
  const hedgeTrees: TreeSpot[] = [];
  const lineX = (x: number, z0: number, z1: number, kind: LinePiece["kind"]) => {
    for (const [a, b] of runs(z0, z1, 2.5, (t) => clear(x, t, 6.5))) {
      for (let t = a; t <= b; t += 2.5) {
        pieces.push({ x, z: t, len: 2.6, alongX: false, kind });
        if (kind === "hedge" && rand() < 0.07)
          hedgeTrees.push({ x, y: 0, z: t, species: 0, scale: 0.9 + rand() * 0.5, rot: rand() * 6.28, shade: rand() });
      }
    }
  };
  const lineZ = (z: number, x0: number, x1: number, kind: LinePiece["kind"]) => {
    for (const [a, b] of runs(x0, x1, 2.5, (t) => clear(t, z, 6.5))) {
      for (let t = a; t <= b; t += 2.5) {
        pieces.push({ x: t, z, len: 2.6, alongX: true, kind });
        if (kind === "hedge" && rand() < 0.07)
          hedgeTrees.push({ x: t, y: 0, z, species: 0, scale: 0.9 + rand() * 0.5, rot: rand() * 6.28, shade: rand() });
      }
    }
  };
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const p = plots[r * cols + c];
      const isPasture = pastureIdx.includes(p);
      const kind = (): LinePiece["kind"] => (isPasture || rand() < 0.3 ? "wall" : "hedge");
      lineX(p.minX - gap / 2, p.minZ - gap / 2, p.maxZ + gap / 2, kind());
      lineZ(p.minZ - gap / 2, p.minX - gap / 2, p.maxX + gap / 2, kind());
      if (c === cols - 1) lineX(p.maxX + gap / 2, p.minZ - gap / 2, p.maxZ + gap / 2, kind());
      if (r === rows - 1) lineZ(p.maxZ + gap / 2, p.minX - gap / 2, p.maxX + gap / 2, kind());
    }

  const pastures = pastureIdx.map((p, i) => {
    const spots: [number, number][] = [];
    for (let k = 0; k < 400 && spots.length < 60; k++) {
      const x = p.minX + 2 + rand() * (p.maxX - p.minX - 4);
      const z = p.minZ + 2 + rand() * (p.maxZ - p.minZ - 4);
      if (clear(x, z, 8)) spots.push([x, z]);
    }
    return { box: { minX: p.minX, maxX: p.maxX, minZ: p.minZ, maxZ: p.maxZ }, animal: (i === 1 ? "cow" : "sheep") as "sheep" | "cow", spots };
  });

  const bales: FieldLayout["bales"] = [];
  if (stubble)
    for (let k = 0; k < 60 && bales.length < 12; k++) {
      const x = stubble.minX + 3 + rand() * (stubble.maxX - stubble.minX - 6);
      const z = stubble.minZ + 3 + rand() * (stubble.maxZ - stubble.minZ - 6);
      if (clear(x, z, 8) && bales.every((b) => (b.x - x) ** 2 + (b.z - z) ** 2 > 16)) bales.push({ x, z, rot: rand() * 3.14 });
    }

  // Gravel farmyard inside the yard circle, kept off the lanes
  const yard: Stripe[] = [];
  const Y = FARM.yard;
  for (let z = Y.z - Y.r + 1; z < Y.z + Y.r; z += 2) {
    for (const [a, b] of runs(Y.x - Y.r, Y.x + Y.r, 1, (x) => (x - Y.x) ** 2 + (z - Y.z) ** 2 < Y.r * Y.r && roadDistance(x, z) >= 5.5)) {
      if (b - a < 1) continue;
      yard.push({ x: (a + b) / 2, z, sx: b - a + 1, sz: 2, h: 0.05, color: "#b49d72" });
    }
  }

  return { plots, stripes, pieces, hedgeTrees, pastures, bales, yard };
}

// --- Tree scatter across all open land ----------------------------------------------------------

// every other module's zone (new zones are picked up automatically); the airport gets a wider margin
const OTHER_ZONES: Box[] = Object.entries(ZONES)
  .filter(([name]) => name !== "countryside" && name !== "airport")
  .map(([, b]) => b);

export function makeTrees(hills: readonly Hill[], turbines: readonly Turbine[], seed = 23, max = 2600): TreeSpot[] {
  const rand = mulberry32(seed);
  const R = HIGHWAY_RING;
  const trees: TreeSpot[] = [];
  const cell = 4;
  const grid = new Set<string>();
  const key = (x: number, z: number) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
  const crowded = (x: number, z: number) => {
    const cx = Math.floor(x / cell);
    const cz = Math.floor(z / cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if (grid.has(`${cx + i},${cz + j}`)) return true;
    return false;
  };
  const turbineCircles: Circle[] = turbines.map((t) => ({ x: t.x, z: t.z, r: 5 }));
  const place = (x: number, z: number, species: TreeSpot["species"], scale: number) => {
    const y = Math.max(0, hillHeight(hills, x, z) - 0.6);
    trees.push({ x, y, z, species, scale, rot: rand() * Math.PI * 2, shade: rand() });
    grid.add(key(x, z));
  };

  // 1. Verge line just inside the highway ring
  const inset = R - 13;
  for (let side = 0; side < 4; side++) {
    for (let t = -inset + 4; t <= inset - 4; t += 9) {
      const tt = t + (rand() - 0.5) * 2;
      const [x, z] =
        side === 0 ? [tt, -inset] : side === 1 ? [inset, tt] : side === 2 ? [tt, inset] : [-inset, tt];
      if (roadDistance(x, z) < 9 || inBox(ZONES.downtown, x, z, 8) || inAirport(x, z) || crowded(x, z)) continue;
      place(x, z, rand() < 0.55 ? 2 : 0, 0.85 + rand() * 0.3);
    }
  }

  // 2. Clumpy woodland + scattered singles outside the ring
  const cs = ZONES.countryside;
  for (let i = 0; i < 40000 && trees.length < max; i++) {
    const x = -398 + rand() * 796;
    const z = -398 + rand() * 796;
    if (x > WATER_X - 10) continue;
    if (Math.abs(x) < R + 9 && Math.abs(z) < R + 9) continue;
    if (inBox(cs, x, z, 2)) continue;
    if (OTHER_ZONES.some((b) => inBox(b, x, z, 8)) || inAirport(x, z)) continue;
    const n = 0.5 + 0.5 * Math.sin(x * 0.029 + Math.sin(z * 0.021) * 2.2) * Math.cos(z * 0.026 - 1.1 + Math.sin(x * 0.013));
    if (rand() > 0.04 + 0.9 * n * n * n) continue;
    if (crowded(x, z) || inCircles(turbineCircles, x, z) || inCircles(FARM_EXCLUSIONS, x, z)) continue;
    if (roadDistance(x, z) < 9) continue;
    const onHill = hillHeight(hills, x, z) > 1;
    const r = rand();
    const species: TreeSpot["species"] = onHill || z < -300 ? (r < 0.65 ? 1 : 0) : r < 0.6 ? 0 : r < 0.85 ? 1 : 2;
    place(x, z, species, 0.75 + rand() * 0.6);
  }
  return trees;
}
