// Left-to-right layered auto-layout for a flow (no dependencies). Back edges are ignored so
// cycles still lay out; each node sits one column right of its deepest predecessor; rows inside
// a column follow their predecessor's row, with branches fanned out.
import type { Flow } from "../types";
import type { Pos } from "./doc";

export const COL_W = 300;
export const ROW_H = 130;

export function layoutFlow(flow: Pick<Flow, "nodes" | "edges">, origin: Pos = { x: 0, y: 0 }): Record<string, Pos> {
  const ids = flow.nodes.map((n) => n.id);
  const known = new Set(ids);
  const edges = flow.edges.filter((e) => known.has(e.from) && known.has(e.to) && e.from !== e.to);

  const out = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of edges) out.get(e.from)!.push(e.to);

  // Drop back edges found by DFS, starting from roots in declaration order.
  const back = new Set<string>();
  const state = new Map<string, 1 | 2>();
  const indeg = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const e of edges) indeg.set(e.to, indeg.get(e.to)! + 1);
  const starts = [...ids.filter((id) => indeg.get(id) === 0), ...ids];
  const visit = (u: string) => {
    state.set(u, 1);
    for (const v of out.get(u)!) {
      if (state.get(v) === 1) back.add(`${u}>${v}`);
      else if (!state.has(v)) visit(v);
    }
    state.set(u, 2);
  };
  for (const s of starts) if (!state.has(s)) visit(s);
  const dag = edges.filter((e) => !back.has(`${e.from}>${e.to}`));

  // Longest-path layering via Kahn's algorithm.
  const preds = new Map<string, string[]>(ids.map((id) => [id, []]));
  const deg = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const e of dag) { preds.get(e.to)!.push(e.from); deg.set(e.to, deg.get(e.to)! + 1); }
  const layer = new Map<string, number>(ids.map((id) => [id, 0]));
  const queue = ids.filter((id) => deg.get(id) === 0);
  const succ = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of dag) succ.get(e.from)!.push(e.to);
  while (queue.length) {
    const u = queue.shift()!;
    for (const v of succ.get(u)!) {
      layer.set(v, Math.max(layer.get(v)!, layer.get(u)! + 1));
      deg.set(v, deg.get(v)! - 1);
      if (deg.get(v) === 0) queue.push(v);
    }
  }

  // Rows: a node inherits the row of its first declared predecessor; a branching node fans its
  // successors out around its own row (gate allow / ask / block). Collisions inside a column are
  // pushed apart.
  const order: string[] = [];
  {
    const d = new Map<string, number>(ids.map((id) => [id, 0]));
    for (const e of dag) d.set(e.to, d.get(e.to)! + 1);
    const q = ids.filter((id) => d.get(id) === 0);
    while (q.length) {
      const u = q.shift()!;
      order.push(u);
      for (const v of succ.get(u)!) { d.set(v, d.get(v)! - 1); if (d.get(v) === 0) q.push(v); }
    }
  }
  const want = new Map<string, number>();
  let rootRow = 0;
  for (const id of order) {
    const p = preds.get(id)!;
    if (!p.length) { want.set(id, rootRow++); continue; }
    const near = p[0]; // first declared incoming edge = the main path into this node
    const sibs = [...new Set(succ.get(near)!)];
    const offset = sibs.length > 1 ? sibs.indexOf(id) - (sibs.length - 1) / 2 : 0;
    want.set(id, want.get(near)! + offset);
  }
  const roots = rootRow;
  const pos: Record<string, Pos> = {};
  const cols = new Map<number, string[]>();
  for (const id of ids) {
    const l = layer.get(id)!;
    if (!cols.has(l)) cols.set(l, []);
    cols.get(l)!.push(id);
  }
  for (const [l, col] of cols) {
    const sorted = [...col].sort((a, b) => want.get(a)! - want.get(b)! || ids.indexOf(a) - ids.indexOf(b));
    let last = -Infinity;
    for (const id of sorted) {
      const r = Math.max(want.get(id)!, last + 1);
      last = r;
      pos[id] = { x: origin.x + l * COL_W, y: origin.y + (r - (roots - 1) / 2) * ROW_H };
    }
  }
  return pos;
}

/** Positions for every node: saved ones kept, missing ones filled from the auto-layout. */
export function withPositions(flow: Flow, saved: Record<string, Pos> | undefined): Record<string, Pos> {
  const auto = layoutFlow(flow);
  const res: Record<string, Pos> = {};
  for (const n of flow.nodes) res[n.id] = saved?.[n.id] ?? auto[n.id];
  return res;
}
