// Low-poly vehicle geometry, merged into one BufferGeometry per (archetype, part) so each part
// is a single InstancedMesh. Local frame: front is +z, left is +x, ground at y = 0.
import { BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Archetype } from "./driving";

export type Part = "paint" | "fixed" | "head" | "tail" | "indL" | "indR";
export const PARTS: Part[] = ["paint", "fixed", "head", "tail", "indL", "indR"];

interface Piece {
  part: Part;
  geo: BufferGeometry;
  color?: string;
}

const tmpColor = new Color();

function box(part: Part, w: number, h: number, l: number, x: number, y: number, z: number, color?: string): Piece {
  const g = new BoxGeometry(w, h, l);
  g.translate(x, y, z);
  return { part, geo: g, color };
}

function wheel(x: number, z: number, r: number, width = 0.28): Piece {
  const g = new CylinderGeometry(r, r, width, 8);
  g.rotateZ(Math.PI / 2);
  g.translate(x, r, z);
  return { part: "fixed", geo: g, color: "#1b1b1e" };
}

const GLASS = "#253241";
const TRIM = "#2e2f33";
const CHROME = "#b9bec4";

function lights(halfW: number, front: number, back: number, y: number, ySize = 0.16): Piece[] {
  const lw = Math.min(0.36, halfW * 0.4);
  const out: Piece[] = [];
  for (const s of [1, -1]) {
    out.push(box("head", lw, ySize, 0.06, s * (halfW - lw / 2 - 0.08), y, front + 0.02));
    out.push(box("tail", lw, ySize, 0.06, s * (halfW - lw / 2 - 0.08), y, back - 0.02));
  }
  // indicators: small cubes on the corners, left = +x
  for (const s of [1, -1]) {
    const part: Part = s === 1 ? "indL" : "indR";
    out.push(box(part, 0.14, 0.12, 0.12, s * (halfW + 0.01), y, front - 0.12));
    out.push(box(part, 0.14, 0.12, 0.12, s * (halfW + 0.01), y, back + 0.12));
  }
  return out;
}

interface CarSpec {
  L: number;
  W: number;
  bodyH: number;
  clearance: number;
  cabinL: number;
  cabinH: number;
  cabinZ: number;
  wheelR: number;
  wheelInset: number;
}

function car(s: CarSpec): Piece[] {
  const halfL = s.L / 2;
  const halfW = s.W / 2;
  const bodyY = s.clearance + s.bodyH / 2;
  const top = s.clearance + s.bodyH;
  const p: Piece[] = [
    box("paint", s.W, s.bodyH, s.L, 0, bodyY, 0),
    box("fixed", s.W - 0.12, s.cabinH, s.cabinL, 0, top + s.cabinH / 2, s.cabinZ, GLASS),
    box("paint", s.W - 0.08, 0.1, s.cabinL - 0.1, 0, top + s.cabinH + 0.05, s.cabinZ),
    box("fixed", s.W + 0.04, 0.18, 0.16, 0, s.clearance + 0.1, halfL, TRIM),
    box("fixed", s.W + 0.04, 0.18, 0.16, 0, s.clearance + 0.1, -halfL, TRIM),
  ];
  for (const x of [halfW - 0.1, -(halfW - 0.1)])
    for (const z of [halfL - s.wheelInset, -(halfL - s.wheelInset)]) p.push(wheel(x, z, s.wheelR));
  p.push(...lights(halfW, halfL, -halfL, bodyY + s.bodyH * 0.15));
  return p;
}

function hgv(): Piece[] {
  const W = 2.5;
  const cabL = 2.3;
  const front = 5.8;
  const cabZ = front - cabL / 2;
  const trailerL = 8.8;
  const trailerZ = front - cabL - 0.4 - trailerL / 2;
  const back = trailerZ - trailerL / 2;
  const p: Piece[] = [
    box("paint", W, 2.5, cabL, 0, 0.6 + 1.25, cabZ),
    box("fixed", W - 0.2, 0.9, 0.06, 0, 2.35, front + 0.01, GLASS),
    box("fixed", W + 0.04, 0.7, 1.0, 0, 2.35, front - 0.6, GLASS), // side windows
    box("fixed", 1.2, 0.5, 0.1, 0, 0.95, front + 0.02, CHROME), // grille
    box("paint", W - 0.3, 0.5, 1.4, 0, 3.35, cabZ - 0.2), // roof fairing
    box("fixed", 1.0, 0.25, L(front, back) - 0.4, 0, 0.6, (front + back) / 2, TRIM), // chassis
    box("fixed", W, 3.0, trailerL, 0, 1.1 + 1.5, trailerZ, "#e9ebee"),
    box("fixed", W + 0.04, 0.25, trailerL, 0, 1.3, trailerZ, "#9aa1aa"), // side skirt stripe
    box("fixed", W + 0.04, 0.3, 0.16, 0, 0.75, front, TRIM),
  ];
  for (const x of [W / 2 - 0.15, -(W / 2 - 0.15)]) {
    p.push(wheel(x, front - 1.0, 0.5, 0.36));
    p.push(wheel(x, front - cabL - 0.2, 0.5, 0.36));
    p.push(wheel(x, back + 1.2, 0.5, 0.36));
    p.push(wheel(x, back + 2.3, 0.5, 0.36));
  }
  p.push(...lights(W / 2, front, back, 0.95, 0.22));
  return p;
}

function L(front: number, back: number) {
  return front - back;
}

function cab(): Piece[] {
  // London black cab: tall, rounded-ish, with an amber TAXI roof sign
  const p = car({ L: 4.5, W: 1.85, bodyH: 0.75, clearance: 0.32, cabinL: 2.6, cabinH: 0.8, cabinZ: -0.25, wheelR: 0.36, wheelInset: 0.85 });
  p.push(box("fixed", 0.7, 0.2, 0.3, 0, 0.32 + 0.75 + 0.8 + 0.2, 0.6, "#ffb000"));
  p.push(box("fixed", 1.3, 0.25, 0.3, 0, 0.6, 2.26, CHROME));
  return p;
}

const SPECS: Record<Archetype, () => Piece[]> = {
  hatch: () => car({ L: 3.8, W: 1.72, bodyH: 0.62, clearance: 0.28, cabinL: 2.0, cabinH: 0.58, cabinZ: -0.3, wheelR: 0.32, wheelInset: 0.65 }),
  saloon: () => car({ L: 4.6, W: 1.8, bodyH: 0.6, clearance: 0.28, cabinL: 2.2, cabinH: 0.55, cabinZ: -0.2, wheelR: 0.33, wheelInset: 0.85 }),
  suv: () => car({ L: 4.7, W: 1.95, bodyH: 0.85, clearance: 0.42, cabinL: 2.9, cabinH: 0.68, cabinZ: -0.35, wheelR: 0.42, wheelInset: 0.85 }),
  cab,
  hgv,
};

export const HALF_LENGTH: Record<Archetype, number> = { hatch: 1.9, saloon: 2.3, suv: 2.35, cab: 2.25, hgv: 5.9 };

/** One merged geometry per part (null when the archetype has no pieces for that part). */
export function buildArchetype(kind: Archetype): Record<Part, BufferGeometry | null> {
  const pieces = SPECS[kind]();
  const out = {} as Record<Part, BufferGeometry | null>;
  for (const part of PARTS) {
    const list = pieces.filter((p) => p.part === part);
    if (!list.length) {
      out[part] = null;
      continue;
    }
    const geos = list.map((p) => {
      const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
      if (part === "fixed") {
        tmpColor.set(p.color ?? "#888888");
        const n = g.getAttribute("position").count;
        const arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          arr[i * 3] = tmpColor.r;
          arr[i * 3 + 1] = tmpColor.g;
          arr[i * 3 + 2] = tmpColor.b;
        }
        g.setAttribute("color", new BufferAttribute(arr, 3));
      }
      g.deleteAttribute("uv");
      return g;
    });
    out[part] = mergeGeometries(geos, false);
    for (const p of list) p.geo.dispose();
  }
  return out;
}

export const PALETTES: Record<Archetype, string[]> = {
  hatch: ["#d6453d", "#2f6db5", "#f2f2f2", "#e8b33a", "#3d8a5a", "#14a3b8", "#9aa3ab", "#f07aa0", "#7fc241"],
  saloon: ["#1f2a44", "#c9ccd1", "#2b2b2b", "#8a1f2b", "#3b5f8a", "#f2f2f2", "#5a6b5a", "#b5352d"],
  suv: ["#2b2b2b", "#f2f2f2", "#4a5568", "#2f4f3a", "#7a3fa0", "#c08a3e", "#9aa3ab"],
  cab: ["#141414", "#141414", "#141414", "#1d232c", "#3a1418"],
  hgv: ["#2a5db0", "#c43a2f", "#f2f2f2", "#2f8f4e", "#e3a21a", "#474b52"],
};
