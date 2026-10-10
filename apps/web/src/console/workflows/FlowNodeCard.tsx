"use client";
// Canvas node card: icon tile, title, runner chips, status tick, run badges, handles.
import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { FlowNode } from "../types";
import { Icon } from "./icons";
import { metaFor, nodeTitle } from "./nodeTypes";
import { fmtMs, fmtUsd, type NodeRun } from "./status";
import { fmtValue, type DiffMark, type NodeChange } from "./testing";
import { RunnerChips } from "./bits";
import { CARD_H, CARD_W, GATE_H } from "./layout";

export type CardData = {
  node: FlowNode;
  run: NodeRun | null;
  /** An execution is overlaid and this node did not run in it. */
  dimmed: boolean;
  /** Validation problems that name this node. */
  problems?: string[];
  /** Just placed by the Architect reveal: play the appear animation. */
  appear?: boolean;
  /** Shown as part of an improvement proposal diff. */
  diff?: { mark: DiffMark; change?: NodeChange };
  /** The node is drawn more than once in the tree (display-time unmerge). */
  shared?: { count: number; stub: boolean };
  /** Back edges (retry loops) leaving this node, as labels like "retry → Action". */
  loops?: string[];
};
export type CardNode = Node<CardData, "card">;

export { CARD_W };

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
  const { node, run, dimmed, problems, appear, diff, shared, loops } = data;
  const mark = diff?.mark ?? null;
  const bad = !!problems?.length;
  const meta = metaFor(node.type);
  const outs = meta.outputs;
  const tall = !!outs && outs.length > 1;
  const border =
    mark === "added" ? "#22c55e"
      : mark === "removed" ? "#ef4444"
      : mark === "changed" ? "#f59e0b"
      : bad || run?.status === "error" ? "#ef4444"
      : run?.status === "running" ? "#ff6a1a"
      : run?.status === "ok" ? "#22c55e"
      : selected ? "#ff6a1a" : "#3a3a42";
  const title = nodeTitle(node);
  const named = title !== meta.label;
  const showId = !named && node.id !== node.type && node.id !== meta.label.toLowerCase();

  return (
    <div
      className={`relative rounded-xl bg-[#2a2a30] text-white shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-opacity ${dimmed ? "opacity-35" : ""} ${run?.status === "running" ? "wf-pulse" : ""} ${appear ? "wf-appear" : ""} ${mark ? `wf-diff-${mark}` : ""} ${diff && !mark ? "opacity-60" : ""}`}
      style={{
        width: CARD_W,
        height: tall ? GATE_H : CARD_H,
        border: `1.5px ${mark === "removed" ? "dashed" : "solid"} ${border}`,
        boxShadow: mark === "added" ? "0 0 0 3px rgba(34,197,94,0.3), 0 0 26px rgba(34,197,94,0.45)"
          : mark === "removed" ? "0 0 0 3px rgba(239,68,68,0.22), 0 0 22px rgba(239,68,68,0.3)"
          : mark === "changed" ? "0 0 0 3px rgba(245,158,11,0.25)"
          : selected ? `0 0 0 3px rgba(255,106,26,0.35), 0 6px 20px rgba(0,0,0,0.35)` : undefined,
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
          <div className={`truncate text-[13px] font-semibold leading-tight ${mark === "removed" ? "text-white/50 line-through" : ""}`}>
            <span title={named ? `${title} (${node.id})` : node.id}>{title}</span>
            {showId && <span className="ml-1.5 font-normal text-white/40">{node.id}</span>}
          </div>
          {named && <div className="mt-0.5 truncate text-[10.5px] leading-tight text-white/45">{meta.label}</div>}
          <div className={named ? "mt-1" : "mt-1.5"}><RunnerChips runners={node.runs_on} /></div>
        </div>
      </div>

      {shared && shared.count > 1 && (
        <div
          className="absolute bottom-1.5 right-2 rounded bg-white/[0.08] px-1.5 py-[1px] text-[9.5px] font-medium text-white/55"
          title={shared.stub
            ? `Shared by ${shared.count} branches. This copy only marks the hand-off; the node's next steps are drawn once, at its main copy. Edits apply to the one node.`
            : `Shared by ${shared.count} branches; each branch shows its own copy. Edits apply to the one node.`}
        >
          shared ×{shared.count}{shared.stub ? " ↗" : ""}
        </div>
      )}
      {loops && loops.length > 0 && (
        <div
          className="absolute -top-2.5 right-7 rounded-full border border-[#f59e0b]/50 bg-[#1f1f23] px-1.5 py-[1px] text-[9.5px] font-semibold text-[#fbbf24]"
          title={loops.join("\n")}
        >
          ↺ {loops[0]}{loops.length > 1 ? ` +${loops.length - 1}` : ""}
        </div>
      )}
      {mark && (
        <div
          className="absolute -top-2.5 left-3 rounded px-1.5 py-[1px] text-[9.5px] font-bold uppercase tracking-wide"
          style={{ background: border, color: mark === "changed" ? "#1f1300" : "#fff" }}
        >
          {mark}
        </div>
      )}
      {diff?.change && (diff.change.config.length > 0 || diff.change.runners) && (
        <div className="absolute left-1 right-1 top-full mt-1.5 space-y-0.5 text-[10.5px] leading-tight tabular-nums">
          {diff.change.config.slice(0, diff.change.runners ? 1 : 2).map((c) => (
            <div key={c.key} className="truncate rounded bg-black/50 px-1.5 py-0.5 text-[#fcd34d]" title={`${c.key}: ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`}>
              {c.key} <span className="text-white/45 line-through">{fmtValue(c.from)}</span> → <b>{fmtValue(c.to)}</b>
            </div>
          ))}
          {diff.change.runners && (
            <div className="truncate rounded bg-black/50 px-1.5 py-0.5 text-[#fcd34d]">
              runs on <span className="text-white/45 line-through">{diff.change.runners.from.join("+")}</span> → <b>{diff.change.runners.to.join("+")}</b>
            </div>
          )}
        </div>
      )}
      {bad && (
        <div
          className="absolute -left-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-[#ef4444] px-1 text-[11px] font-bold text-white"
          title={problems!.join("\n")}
        >
          !
        </div>
      )}
      {bad && (
        <div className="absolute left-1 right-1 top-full mt-1.5 line-clamp-2 text-[10px] leading-tight text-[#fca5a5]" title={problems!.join("\n")}>
          {problems![0]}
        </div>
      )}

      {run && (
        <div className="absolute -right-2 -top-2">
          <StatusMark run={run} />
        </div>
      )}

      {run && run.status !== "running" && !bad && (
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
