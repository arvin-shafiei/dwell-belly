"use client";
// Canvas node card: icon tile, title, runner chips, status tick, run badges, handles.
import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { FlowNode } from "../types";
import { Icon } from "./icons";
import { metaFor } from "./nodeTypes";
import { fmtMs, fmtUsd, type NodeRun } from "./status";
import { RunnerChips } from "./bits";

export type CardData = {
  node: FlowNode;
  run: NodeRun | null;
  /** An execution is overlaid and this node did not run in it. */
  dimmed: boolean;
};
export type CardNode = Node<CardData, "card">;

export const CARD_W = 240;

const GATE_COLORS: Record<string, string> = { allow: "#22c55e", ask: "#f59e0b", block: "#ef4444" };

function StatusMark({ run }: { run: NodeRun }) {
  if (run.status === "running") {
    return <span className="wf-spin block h-4 w-4 rounded-full border-2 border-[#ff6a1a] border-t-transparent" title="running" />;
  }
  if (run.status === "ok") {
    return (
      <span className="grid h-5 w-5 place-items-center rounded-full bg-[#22c55e] text-[#0b1f12]" title="ok">
        <Icon name="check" size={13} strokeWidth={3} />
      </span>
    );
  }
  if (run.status === "error") {
    return <span className="text-[#ef4444]" title="error"><Icon name="x_circle" size={20} strokeWidth={2.2} /></span>;
  }
  return <span className="text-white/40" title="skipped"><Icon name="minus_circle" size={20} strokeWidth={2.2} /></span>;
}

function FlowNodeCardImpl({ data, selected }: NodeProps<CardNode>) {
  const { node, run, dimmed } = data;
  const meta = metaFor(node.type);
  const outs = meta.outputs;
  const tall = !!outs && outs.length > 1;
  const border =
    run?.status === "error" ? "#ef4444"
      : run?.status === "running" ? "#ff6a1a"
      : run?.status === "ok" ? "#22c55e"
      : selected ? "#ff6a1a" : "#3a3a42";
  const showId = node.id !== node.type && node.id !== meta.label.toLowerCase();

  return (
    <div
      className={`relative rounded-xl bg-[#2a2a30] text-white shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-opacity ${dimmed ? "opacity-35" : ""} ${run?.status === "running" ? "wf-pulse" : ""}`}
      style={{
        width: CARD_W,
        height: tall ? 104 : 76,
        border: `1.5px solid ${border}`,
        boxShadow: selected ? `0 0 0 3px rgba(255,106,26,0.35), 0 6px 20px rgba(0,0,0,0.35)` : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} id="in" className="wf-handle" />

      <div className="flex h-full items-center gap-3 px-3">
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg"
          style={{ background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}44` }}
        >
          <Icon name={meta.icon} size={22} />
        </div>
        <div className="min-w-0 flex-1 pr-5">
          <div className="truncate text-[13px] font-semibold leading-tight">
            {meta.label}
            {showId && <span className="ml-1.5 font-normal text-white/40">{node.id}</span>}
          </div>
          <div className="mt-1.5"><RunnerChips runners={node.runs_on} /></div>
        </div>
      </div>

      {run && (
        <div className="absolute -right-2 -top-2">
          <StatusMark run={run} />
        </div>
      )}

      {run && run.status !== "running" && (
        <div className="absolute left-1 top-full mt-1.5 flex gap-1 whitespace-nowrap text-[10px] tabular-nums text-white/60">
          <span className="rounded bg-black/40 px-1.5 py-0.5">{fmtMs(run.latencyMs)}</span>
          {run.costUsd > 0 && <span className="rounded bg-black/40 px-1.5 py-0.5">{fmtUsd(run.costUsd)}</span>}
          <span className="rounded bg-black/40 px-1.5 py-0.5">{run.runs} item{run.runs === 1 ? "" : "s"}</span>
          {run.modelCalls.length > 0 && (
            <span className="rounded bg-black/40 px-1.5 py-0.5">{run.modelCalls.length} call{run.modelCalls.length === 1 ? "" : "s"}</span>
          )}
        </div>
      )}

      {outs && outs.length > 1 ? (
        outs.map((o, i) => {
          const top = `${((i + 1) / (outs.length + 1)) * 100}%`;
          return (
            <div key={o}>
              <span
                className="pointer-events-none absolute right-3 -translate-y-1/2 text-[10px] font-medium uppercase tracking-wide"
                style={{ top, color: GATE_COLORS[o] ?? "#cbd5e1" }}
              >
                {o}
              </span>
              <Handle
                type="source" position={Position.Right} id={o} className="wf-handle"
                style={{ top, background: GATE_COLORS[o] ?? undefined }}
              />
            </div>
          );
        })
      ) : (
        <Handle type="source" position={Position.Right} id="out" className="wf-handle" />
      )}
    </div>
  );
}

export const FlowNodeCard = memo(FlowNodeCardImpl);
