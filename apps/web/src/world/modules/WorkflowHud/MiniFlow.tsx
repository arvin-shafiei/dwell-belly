"use client";
// n8n-style mini flowchart of the incident flow, lit from the most recent case's events.
import { memo, useMemo } from "react";
import type { WorkflowEvent } from "../../store";
import { FLOW_EDGES, FLOW_NODES, gateBranch, nodeStatuses, RUNNER_OF, summariseCases, type FlowNode, type NodeStatus } from "./flow";
import { RUNNER_COLOR, RUNNER_LABEL, STATUS_COLOR, STATE_STYLE } from "./theme";

const W = 76;
const H = 28;
const COL = 89;
const ROW = 50;
const PAD_X = 4;
const PAD_Y = 8;
const VB_W = PAD_X * 2 + COL * 3 + W;
const VB_H = PAD_Y * 2 + ROW * 3 + H;

const BY_ID = new Map(FLOW_NODES.map((n) => [n.id, n]));
const pos = (n: FlowNode) => ({ x: PAD_X + n.col * COL, y: PAD_Y + n.row * ROW });

function edgePath(a: FlowNode, b: FlowNode) {
  const pa = pos(a);
  const pb = pos(b);
  if (a.row === b.row) {
    const fwd = b.col > a.col;
    const sx = fwd ? pa.x + W : pa.x;
    const ex = fwd ? pb.x : pb.x + W;
    const y = pa.y + H / 2;
    return { d: `M${sx},${y} L${ex},${y}`, mx: (sx + ex) / 2, my: y };
  }
  const sx = pa.x + W / 2;
  const sy = pa.y + H;
  const ex = pb.x + W / 2;
  const ey = pb.y;
  const k = (ey - sy) * 0.6;
  return {
    d: `M${sx},${sy} C${sx},${sy + k} ${ex},${ey - k} ${ex},${ey}`,
    mx: (sx + ex) / 2,
    my: (sy + ey) / 2,
  };
}

const EDGES = FLOW_EDGES.map((e) => ({ ...e, ...edgePath(BY_ID.get(e.from)!, BY_ID.get(e.to)!) }));

function MiniFlowInner({ events }: { events: readonly WorkflowEvent[] }) {
  const latest = events.length ? events[events.length - 1] : null;
  const caseId = latest?.caseId ?? null;
  const st = useMemo<Record<string, NodeStatus>>(() => (caseId ? nodeStatuses(events, caseId) : {}), [events, caseId]);
  const branch = gateBranch(st);
  const caseState = useMemo(
    () => (caseId ? summariseCases(events, 50).find((c) => c.caseId === caseId)?.state : undefined),
    [events, caseId],
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-white/85">{caseId ?? "no case yet"}</span>
          {caseState && (
            <span className={`rounded px-1.5 py-px font-mono text-[9px] uppercase tracking-wider ${STATE_STYLE[caseState].chip}`}>
              {STATE_STYLE[caseState].label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5 text-[9px] uppercase tracking-wider text-white/45">
          {(["jev", "claude", "code"] as const).map((r) => (
            <span key={r} className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: RUNNER_COLOR[r] }} />
              {RUNNER_LABEL[r]}
            </span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="block h-auto w-full" role="img" aria-label="Incident workflow">
        <defs>
          <pattern id="hud-grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.6" fill="rgba(255,255,255,0.07)" />
          </pattern>
        </defs>
        <rect width={VB_W} height={VB_H} fill="url(#hud-grid)" rx="8" />
        {EDGES.map((e) => {
          const target = st[e.to];
          const isBranch = !!e.when;
          const taken = isBranch ? branch === e.when && !!st.gate : !!target && !!st[e.from];
          const color = taken && target ? STATUS_COLOR[target] : taken ? STATUS_COLOR[st.gate ?? "ok"] : "rgba(255,255,255,0.14)";
          const flowing = taken && target === "start";
          return (
            <g key={`${e.from}-${e.to}`}>
              <path
                d={e.d}
                fill="none"
                stroke={color}
                strokeWidth={taken ? 1.6 : 1}
                strokeOpacity={taken ? 0.9 : 1}
                strokeDasharray={flowing ? "4 4" : isBranch && !taken ? "2 3" : undefined}
              >
                {flowing && <animate attributeName="stroke-dashoffset" from="16" to="0" dur="0.6s" repeatCount="indefinite" />}
              </path>
              {isBranch && (
                <text
                  x={e.mx + (e.when === "allow" ? 5 : 0)}
                  y={e.my + (e.when === "allow" ? 3 : -2)}
                  textAnchor={e.when === "allow" ? "start" : "middle"}
                  fontSize="7.5"
                  className="font-mono uppercase"
                  fill={taken ? color : "rgba(255,255,255,0.35)"}
                >
                  {e.when}
                </text>
              )}
            </g>
          );
        })}
        {FLOW_NODES.map((n) => {
          const p = pos(n);
          const s = st[n.id];
          const c = s ? STATUS_COLOR[s] : null;
          return (
            <g key={n.id} transform={`translate(${p.x},${p.y})`}>
              {s === "start" && (
                <rect x={-3} y={-3} width={W + 6} height={H + 6} rx={9} fill="none" stroke={c!} strokeWidth={2}>
                  <animate attributeName="opacity" values="0.9;0.1;0.9" dur="1.1s" repeatCount="indefinite" />
                </rect>
              )}
              <rect
                width={W}
                height={H}
                rx={7}
                fill={c ? `${c}22` : "rgba(16,18,24,0.85)"}
                stroke={c ?? "rgba(255,255,255,0.16)"}
                strokeWidth={c ? 1.3 : 1}
              />
              <rect x={0} y={6} width={2.5} height={H - 12} rx={1} fill={RUNNER_COLOR[n.runner]} />
              <text x={9} y={H / 2 + 3.2} fontSize="9" fill={c ? "#fff" : "rgba(255,255,255,0.7)"} fontWeight={c ? 600 : 400}>
                {n.label}
              </text>
              {c && <circle cx={W - 8} cy={H / 2} r={2.6} fill={c} />}
            </g>
          );
        })}
      </svg>
      {latest && <NowLine e={latest} />}
    </div>
  );
}

function NowLine({ e }: { e: WorkflowEvent }) {
  const runner = RUNNER_OF[e.nodeId] ?? "code";
  const label = BY_ID.get(e.nodeId)?.label ?? e.nodeId;
  return (
    <div className="mt-2 flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1.5">
      <span
        className="shrink-0 rounded px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-wider text-black"
        style={{ background: RUNNER_COLOR[runner] }}
      >
        {RUNNER_LABEL[runner]}
      </span>
      <span className="shrink-0 text-[11px] font-medium" style={{ color: STATUS_COLOR[e.status] }}>
        {label}
      </span>
      <span className="truncate text-[11px] text-white/60">{e.summary}</span>
    </div>
  );
}

export const MiniFlow = memo(MiniFlowInner);
