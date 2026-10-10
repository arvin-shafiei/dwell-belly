// Pure route following: move a cursor along a Route by a distance in metres.
import type { Route } from "./dispatch";

export interface Cursor {
  seg: number; // leg index: nodes[seg] -> nodes[seg + 1]
  t: number; // 0..1 along that leg
}

export interface StepResult {
  arrived: boolean;
  /** Node index where the unit had to stop because the next leg can't be entered (re-plan from there). */
  blockedAt: number | null;
}

type LenFn = (a: string, b: string) => number;

/** Mutates `cur`. `canEnter(a, b)` is asked before each new leg after the first. */
export function advance(
  route: Route,
  cur: Cursor,
  metres: number,
  edgeLength: LenFn,
  canEnter: (a: string, b: string) => boolean,
): StepResult {
  const last = route.nodes.length - 2;
  if (last < 0) return { arrived: true, blockedAt: null };
  let left = metres;
  for (let guard = 0; guard < 64; guard++) {
    const a = route.nodes[cur.seg];
    const b = route.nodes[cur.seg + 1];
    const len = Math.max(0.01, edgeLength(a, b));
    const endT = cur.seg === last ? route.stopT : 1;
    const remain = endT - cur.t;
    const dT = left / len;
    if (dT < remain) {
      cur.t += dT;
      return { arrived: false, blockedAt: null };
    }
    left -= Math.max(0, remain) * len;
    cur.t = endT;
    if (cur.seg >= last) return { arrived: true, blockedAt: null };
    if (!canEnter(route.nodes[cur.seg + 1], route.nodes[cur.seg + 2])) return { arrived: false, blockedAt: cur.seg + 1 };
    cur.seg += 1;
    cur.t = 0;
    if (left <= 0) return { arrived: false, blockedAt: null };
  }
  return { arrived: false, blockedAt: null };
}

/** Metres left to the stop point. */
export function remainingMetres(route: Route, cur: Cursor, edgeLength: LenFn) {
  const last = route.nodes.length - 2;
  if (last < 0) return 0;
  let m = 0;
  for (let s = cur.seg; s <= last; s++) {
    const len = edgeLength(route.nodes[s], route.nodes[s + 1]);
    const from = s === cur.seg ? cur.t : 0;
    const to = s === last ? route.stopT : 1;
    m += Math.max(0, to - from) * len;
  }
  return m;
}
