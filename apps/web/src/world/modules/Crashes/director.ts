// Pure crash-director logic: picking victims, picking scripted spots, naming roads, writing notes.
import { BLOCK } from "../../config";
import { getNode, ROAD_EDGES } from "../../roads";
import type { VehicleKind } from "../../registry";

export type CrashKind = "car_crash" | "truck_crash";
export type Scenario = "rear_end" | "solo" | "tbone" | "jackknife";

export interface Candidate {
  id: string;
  kind: VehicleKind;
  edgeKey: string | null;
  from: string | null;
  to: string | null;
  t: number;
  speed: number;
  stopped: boolean;
}

const CIVIL: ReadonlySet<VehicleKind> = new Set<VehicleKind>(["car", "taxi", "truck", "van"]);
const MAX_GAP_M = 14;
const MIN_SPEED = 1.5;

interface Opts {
  blocked: ReadonlySet<string>;
  kind?: CrashKind; // undefined: anything goes
}

function eligible(c: Candidate, o: Opts) {
  if (!CIVIL.has(c.kind) || c.stopped || c.speed < MIN_SPEED) return false;
  if (!c.from || !c.to || !c.edgeKey || o.blocked.has(c.edgeKey)) return false;
  if (o.kind === "car_crash" && c.kind === "truck") return false;
  return true;
}

function edgeLen(key: string) {
  return ROAD_EDGES.get(key)?.length ?? BLOCK;
}

/** Two moving vehicles on the same directed lane within MAX_GAP_M: returns [rear, front] or null. */
export function findRearEnd<T extends Candidate>(list: Iterable<T>, o: Opts): [T, T] | null {
  const ok: T[] = [];
  for (const c of list) if (eligible(c, o)) ok.push(c);
  let best: [T, T] | null = null;
  let bestGap = Infinity;
  for (let i = 0; i < ok.length; i++)
    for (let j = 0; j < ok.length; j++) {
      const a = ok[i];
      const b = ok[j];
      if (i === j || a.from !== b.from || a.to !== b.to || b.t <= a.t) continue;
      if (o.kind === "truck_crash" && a.kind !== "truck" && b.kind !== "truck") continue;
      const gap = (b.t - a.t) * edgeLen(a.edgeKey!);
      if (gap <= MAX_GAP_M && gap < bestGap) {
        bestGap = gap;
        best = [a, b];
      }
    }
  return best;
}

/** One moving eligible vehicle (a truck for truck_crash), random among the candidates. */
export function findSolo<T extends Candidate>(list: Iterable<T>, o: Opts, rand: () => number = Math.random): T | null {
  const ok: T[] = [];
  for (const c of list) if (eligible(c, o) && (o.kind !== "truck_crash" || c.kind === "truck")) ok.push(c);
  return ok.length ? ok[Math.floor(rand() * ok.length)] : null;
}

/** A random downtown street or highway edge for a scripted wreck. */
export function pickScriptedEdge(rand: () => number, blocked: ReadonlySet<string>, exclude: ReadonlySet<string>): string | null {
  const pool: string[] = [];
  for (const e of ROAD_EDGES.values())
    if ((e.kind === "street" || e.kind === "highway") && !blocked.has(e.key) && !exclude.has(e.key)) {
      if (e.kind === "street" && getNode(e.a).zone !== "downtown") continue;
      pool.push(e.key);
    }
  return pool.length ? pool[Math.floor(rand() * pool.length)] : null;
}

// --- Naming -----------------------------------------------------------------

// Columns (roads running north-south at x = i*40) and rows (east-west at z = j*40), i/j in -4..4.
const COLUMNS = ["Edgware Rd", "Baker St", "Gower St", "Kingsway", "Charing Cross Rd", "Bond St", "Regent St", "Bishopsgate", "Tower Bridge Rd"];
const ROWS = ["Euston Rd", "Oxford St", "Holborn", "Fleet St", "the Strand", "Piccadilly", "Pall Mall", "Victoria St", "the Embankment"];

export function roadName(key: string): string {
  const e = ROAD_EDGES.get(key);
  if (!e) return "a side street";
  if (e.kind === "highway") return "the A-Ring";
  if (e.kind === "ramp") return "the A-Ring slip road";
  const a = getNode(e.a);
  const b = getNode(e.b);
  if (a.zone === "downtown" && b.zone === "downtown") {
    if (a.z === b.z) return ROWS[Math.round(a.z / BLOCK) + 4] ?? "the high street";
    return COLUMNS[Math.round(a.x / BLOCK) + 4] ?? "the high street";
  }
  const zone = a.zone === "highway" ? b.zone : a.zone;
  return { docks: "Dock Rd", countryside: "Farm Lane", depot: "Depot Rd", suburbs: "Elm Grove" }[zone as string] ?? "a side street";
}

/** Compass direction of travel from -> to. North is -z. */
export function directionWord(from: string, to: string): string {
  const a = getNode(from);
  const b = getNode(to);
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? "eastbound" : "westbound";
  return dz >= 0 ? "southbound" : "northbound";
}

const NOTES: Record<Scenario, string[]> = {
  rear_end: [
    "Rear-end shunt on {road} {dir}, {a} ploughed into {b}, lane blocked",
    "{A} slammed into {b} on {road} {dir}, glass everywhere",
    "Pile-up on {road} {dir}: {a} rear-ended {b}, road closed",
  ],
  solo: [
    "{A} spun out on {road} {dir} and hit the barrier, lane blocked",
    "{A} lost control on {road} {dir}, wreck across the lane",
  ],
  tbone: [
    "Two cars T-boned on {road}, debris across both lanes",
    "Side-impact smash on {road} {dir}, both cars wrecked, road closed",
  ],
  jackknife: [
    "HGV jackknifed on {road} {dir}, 2 lanes blocked, cargo spilled",
    "Lorry jackknifed and on fire on {road} {dir}, road closed",
  ],
};

const NOUN: Partial<Record<VehicleKind, string>> = { car: "car", taxi: "black cab", truck: "HGV", van: "van" };

export function crashNote(
  kind: CrashKind,
  scenario: Scenario,
  from: string,
  to: string,
  rand: () => number = Math.random,
  a: VehicleKind = kind === "truck_crash" ? "truck" : "car",
  b: VehicleKind = "car",
): string {
  const key = from < to ? `${from}|${to}` : `${to}|${from}`;
  const list = NOTES[scenario];
  const tpl = list[Math.floor(rand() * list.length)] ?? list[0];
  const art = (k: VehicleKind) => {
    const n = NOUN[k] ?? "car";
    return /^[aeiouH]/.test(n) ? `an ${n}` : `a ${n}`;
  };
  const an = art(a);
  return tpl
    .replace("{road}", roadName(key))
    .replace("{dir}", directionWord(from, to))
    .replace("{A}", an[0].toUpperCase() + an.slice(1))
    .replace("{a}", an)
    .replace("{b}", art(b))
    .replace(/^the /, "The ");
}
