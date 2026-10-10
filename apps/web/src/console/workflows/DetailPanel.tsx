"use client";
// Right panel: parameters (runner, gate thresholds, config JSON) and the selected execution's
// Input / Output for the node. Also edits an edge's `when` label when an edge is selected.
import { useState } from "react";
import type { FlowEdge, FlowNode, Runner } from "../types";
import { Icon } from "./icons";
import { ALL_RUNNERS, metaFor, nodeTitle } from "./nodeTypes";
import { fmtMs, fmtUsd, inputsOf, type NodeRun, type RunOverlay } from "./status";
import { Badge, Btn, JsonView, RunnerChip, SectionLabel } from "./bits";

type Tab = "params" | "input" | "output";

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

function GateSliders({ config, risk, onChange }: {
  config: Record<string, unknown>; risk: number | null; onChange: (c: Record<string, unknown>) => void;
}) {
  const allow = num(config.allow_below, 0.3);
  const block = num(config.block_above, 0.8);
  const set = (k: "allow_below" | "block_above", v: number) => {
    const next = { ...config, [k]: Math.round(v * 100) / 100 };
    if (k === "allow_below" && v > block) next.block_above = next.allow_below;
    if (k === "block_above" && v < allow) next.allow_below = next.block_above;
    onChange(next);
  };
  return (
    <div className="space-y-3">
      <div className="relative h-3 overflow-hidden rounded-full bg-white/5">
        <div className="absolute inset-y-0 left-0 bg-[#22c55e]/70" style={{ width: `${allow * 100}%` }} />
        <div className="absolute inset-y-0 bg-[#f59e0b]/70" style={{ left: `${allow * 100}%`, width: `${(block - allow) * 100}%` }} />
        <div className="absolute inset-y-0 right-0 bg-[#ef4444]/70" style={{ width: `${(1 - block) * 100}%` }} />
        {risk !== null && (
          <div className="absolute inset-y-[-2px] w-[3px] rounded bg-white shadow" style={{ left: `calc(${risk * 100}% - 1px)` }} title={`risk ${risk.toFixed(2)} in this run`} />
        )}
      </div>
      <div className="flex justify-between text-[10px] uppercase tracking-wide">
        <span className="text-[#4ade80]">allow</span><span className="text-[#fbbf24]">ask a human</span><span className="text-[#f87171]">block</span>
      </div>
      {([["allow_below", "Allow below", allow, "#22c55e"], ["block_above", "Block at or above", block, "#ef4444"]] as const).map(([k, label, v, c]) => (
        <label key={k} className="block">
          <div className="flex items-center justify-between text-[12px] text-white/75">
            <span>{label} <code className="ml-1 text-[10px] text-white/35">{k}</code></span>
            <span className="tabular-nums font-semibold" style={{ color: c }}>{v.toFixed(2)}</span>
          </div>
          <input
            type="range" min={0} max={1} step={0.01} value={v}
            onChange={(e) => set(k, Number(e.target.value))}
            className="mt-1 w-full" style={{ accentColor: c }}
          />
        </label>
      ))}
      {risk !== null && <div className="text-[11px] text-white/50">White marker: risk {risk.toFixed(2)} in the selected execution.</div>}
    </div>
  );
}

function JsonEditor({ value, onApply }: { value: Record<string, unknown> | undefined; onApply: (v: Record<string, unknown> | undefined) => void }) {
  const initial = value === undefined ? "{}" : JSON.stringify(value, null, 2);
  const [text, setText] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const dirty = text !== initial;
  const apply = () => {
    try {
      const v = text.trim() ? JSON.parse(text) : {};
      if (v === null || typeof v !== "object" || Array.isArray(v)) throw new Error("config must be a JSON object");
      setErr(null);
      onApply(Object.keys(v).length ? v : undefined);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "invalid JSON");
    }
  };
  return (
    <div>
      <textarea
        value={text} spellCheck={false}
        onChange={(e) => { setText(e.target.value); setErr(null); }}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") apply(); e.stopPropagation(); }}
        className={`h-56 w-full resize-y rounded-md border bg-black/30 p-2.5 font-mono text-[11px] leading-relaxed text-white/85 outline-none ${err ? "border-[#ef4444]/70" : "border-white/10 focus:border-[#ff6a1a]/60"}`}
      />
      <div className="mt-1.5 flex items-center gap-2">
        <Btn variant="outline" onClick={apply} disabled={!dirty}>Apply</Btn>
        {dirty && <Btn onClick={() => { setText(initial); setErr(null); }}>Reset</Btn>}
        <span className="ml-auto text-[10px] text-white/35">⌘/Ctrl + Enter</span>
      </div>
      {err && <div className="mt-1.5 text-[11px] text-[#f87171]">{err}</div>}
    </div>
  );
}

function RunStats({ run }: { run: NodeRun }) {
  const tone = run.status === "ok" ? "green" : run.status === "error" ? "red" : run.status === "running" ? "orange" : "grey";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={tone}>{run.status}</Badge>
        <span className="text-[11px] tabular-nums text-white/60">{fmtMs(run.latencyMs)} · {fmtUsd(run.costUsd)} · {run.runs} item{run.runs === 1 ? "" : "s"}</span>
      </div>
      {run.summary && <div className="text-[12px] leading-snug text-white/85">{run.summary}</div>}
    </div>
  );
}

function ModelCalls({ run }: { run: NodeRun }) {
  if (!run.modelCalls.length) return <div className="text-[11px] text-white/40">No model calls (code only, or a view over an earlier call).</div>;
  return (
    <table className="w-full text-left text-[11px] tabular-nums">
      <thead className="text-white/40">
        <tr><th className="py-1 font-medium">Runner</th><th className="font-medium">Model</th><th className="text-right font-medium">Latency</th><th className="text-right font-medium">Tokens</th><th className="text-right font-medium">Cost</th></tr>
      </thead>
      <tbody>
        {run.modelCalls.map((c, i) => (
          <tr key={i} className="border-t border-white/5 text-white/75" title={c.error}>
            <td className="py-1"><RunnerChip runner={c.runner} /></td>
            <td className="max-w-[110px] truncate">{c.model}{!c.ok && <span className="ml-1 text-[#f87171]">failed</span>}</td>
            <td className="text-right">{fmtMs(c.latencyMs)}</td>
            <td className="text-right">{c.tokensIn}/{c.tokensOut}</td>
            <td className="text-right">{fmtUsd(c.costUsd)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NoRun({ overlay }: { overlay: RunOverlay | null }) {
  return (
    <div className="rounded-md border border-dashed border-white/10 p-4 text-center text-[12px] text-white/45">
      {overlay ? "This node did not run in the selected execution." : "Pick an execution in the header to see this node's data."}
    </div>
  );
}

export function NodePanel({ node, overlay, onChange, onDelete, onClose }: {
  node: FlowNode;
  overlay: RunOverlay | null;
  onChange: (patch: Partial<Omit<FlowNode, "id">>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("params");
  const meta = metaFor(node.type);
  const run = overlay?.nodes[node.id] ?? null;
  const gateOut = run?.output && run.output.type === "safety_gate" ? (run.output as { risk?: number }) : null;
  const risk = typeof gateOut?.risk === "number" ? gateOut.risk : null;
  const configSig = JSON.stringify(node.config ?? null);

  const toggleRunner = (r: Runner) => {
    const has = node.runs_on.includes(r);
    onChange({ runs_on: has ? node.runs_on.filter((x) => x !== r) : ALL_RUNNERS.filter((x) => x === r || node.runs_on.includes(x)) });
  };

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-white/10 bg-[#19191d]">
      <div className="flex items-start gap-2.5 px-4 pb-3 pt-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: `${meta.color}22`, color: meta.color }}>
          <Icon name={meta.icon} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-white">{nodeTitle(node)}</div>
          <div className="truncate text-[11px] text-white/45"><code>{node.id}</code> · {node.type}</div>
        </div>
        <button type="button" onClick={onDelete} title="Delete node" className="rounded p-1.5 text-white/45 hover:bg-[#ef4444]/15 hover:text-[#f87171]"><Icon name="trash" size={15} /></button>
        <button type="button" onClick={onClose} title="Close" className="rounded p-1.5 text-white/45 hover:bg-white/10 hover:text-white"><Icon name="close" size={15} /></button>
      </div>
      <div className="flex gap-1 border-b border-white/10 px-3">
        {([["params", "Parameters"], ["input", "Input"], ["output", "Output"]] as const).map(([k, l]) => (
          <button
            key={k} type="button" onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-2.5 pb-2 pt-1 text-[12px] font-medium ${tab === k ? "border-[#ff6a1a] text-white" : "border-transparent text-white/50 hover:text-white/80"}`}
          >
            {l}{k !== "params" && run && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[#22c55e] align-middle" />}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {tab === "params" && (
          <>
            <p className="text-[12px] leading-snug text-white/55">{meta.description}</p>
            <div>
              <SectionLabel>Runs on</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {ALL_RUNNERS.map((r) => <RunnerChip key={r} runner={r} active={node.runs_on.includes(r)} onClick={() => toggleRunner(r)} />)}
              </div>
            </div>
            {node.type === "safety_gate" && (
              <div>
                <SectionLabel>Thresholds (risk 0–1)</SectionLabel>
                <GateSliders config={node.config ?? {}} risk={risk} onChange={(c) => onChange({ config: c })} />
              </div>
            )}
            <div>
              <SectionLabel>Config (JSON)</SectionLabel>
              <JsonEditor key={`${node.id}:${configSig}`} value={node.config} onApply={(c) => onChange({ config: c })} />
            </div>
          </>
        )}

        {tab === "input" && (
          !overlay ? <NoRun overlay={null} /> : (() => {
            const ins = inputsOf(overlay, node.id);
            const isFirst = run?.order === 0;
            if (isFirst && overlay.start) {
              return (
                <div className="space-y-3">
                  <SectionLabel>Case inputs · {overlay.start.title}</SectionLabel>
                  {overlay.start.inputs.length === 0 && <div className="text-[12px] text-white/45">No inputs listed in the trace.</div>}
                  {overlay.start.inputs.map((i) => (
                    <div key={i.n} className="rounded-md border border-white/10 bg-black/20 p-2.5">
                      <div className="text-[11px] text-white/45">#{i.n} · {i.channel} · {i.from}</div>
                      <div className="mt-1 text-[12px] leading-snug text-white/80">{i.excerpt}</div>
                    </div>
                  ))}
                </div>
              );
            }
            if (!ins.length) return <NoRun overlay={overlay} />;
            return (
              <div className="space-y-4">
                {ins.map((r) => {
                  const e = overlay.edges.find((x) => x.from === r.nodeId && x.to === node.id);
                  return (
                    <div key={r.nodeId} className="space-y-2">
                      <SectionLabel>From {metaFor(r.nodeType).label} <code className="normal-case">{r.nodeId}</code>{e?.when ? ` · ${e.when}` : ""}</SectionLabel>
                      <RunStats run={r} />
                      {r.output && <JsonView value={r.output} />}
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}

        {tab === "output" && (
          !run ? <NoRun overlay={overlay} /> : (
            <div className="space-y-4">
              <RunStats run={run} />
              <div>
                <SectionLabel>Output</SectionLabel>
                {run.output ? <JsonView value={run.output} /> : <div className="text-[11px] text-white/40">No structured output; see the summary above.</div>}
              </div>
              <div>
                <SectionLabel>Model calls</SectionLabel>
                <ModelCalls run={run} />
              </div>
            </div>
          )
        )}
      </div>
    </aside>
  );
}

export function EdgePanel({ edge, onWhen, onDelete, onClose }: {
  edge: FlowEdge; onWhen: (when: string) => void; onDelete: () => void; onClose: () => void;
}) {
  const [text, setText] = useState(edge.when ?? "");
  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-white/10 bg-[#19191d]">
      <div className="flex items-center gap-2 px-4 pb-3 pt-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-white">Connection</div>
          <div className="truncate text-[11px] text-white/45"><code>{edge.from}</code> → <code>{edge.to}</code></div>
        </div>
        <button type="button" onClick={onDelete} title="Delete connection" className="rounded p-1.5 text-white/45 hover:bg-[#ef4444]/15 hover:text-[#f87171]"><Icon name="trash" size={15} /></button>
        <button type="button" onClick={onClose} title="Close" className="rounded p-1.5 text-white/45 hover:bg-white/10 hover:text-white"><Icon name="close" size={15} /></button>
      </div>
      <div className="space-y-2 border-t border-white/10 px-4 py-4">
        <SectionLabel>When (condition label)</SectionLabel>
        <input
          value={text} onChange={(e) => setText(e.target.value)}
          onBlur={() => onWhen(text)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") onWhen(text); }}
          placeholder="always"
          className="h-8 w-full rounded-md border border-white/10 bg-black/30 px-2 text-[12px] text-white outline-none focus:border-[#ff6a1a]/60"
        />
        <p className="text-[11px] text-white/40">Safety gate outputs use allow / ask / block. Leave empty for an unconditional hop.</p>
      </div>
    </aside>
  );
}
