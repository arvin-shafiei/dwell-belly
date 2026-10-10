"use client";
// Right-hand pane of the Executions tab: header, eval verdict, and Timeline / ANSWER.md / REASONING.md tabs.
import { useState } from "react";
import type { ExecutionRecord } from "../types";
import { fmtCost, fmtDuration, fmtStarted, fmtTokens, traceTotals } from "./logic";
import Markdown from "./MarkdownView";
import Timeline from "./Timeline";
import { Badge, Button, SimulatedBadge, StatusDot, cx } from "./ui";
import VoiceSlot from "./VoiceSlot";

type View = "timeline" | "answer" | "reasoning";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-white/35">{label}</div>
      <div className="truncate font-mono text-xs tabular-nums text-white/85">{value}</div>
    </div>
  );
}

export function EvalVerdict({ ev }: { ev: NonNullable<ExecutionRecord["eval"]> }) {
  const color = ev.pass ? "#3ecf8e" : "#ff5c5c";
  return (
    <div className="flex items-start gap-3 rounded-lg px-3 py-2" style={{ background: `${color}14`, boxShadow: `inset 0 0 0 1px ${color}40` }}>
      <span className="mt-px text-[11px] font-bold uppercase tracking-wide" style={{ color }}>
        Eval {ev.pass ? "pass" : "fail"}
      </span>
      <span className="font-mono text-xs tabular-nums text-white/80">score {ev.score.toFixed(2)}</span>
      {ev.notes && <span className="min-w-0 flex-1 text-xs leading-relaxed text-white/65">{ev.notes}</span>}
    </div>
  );
}

export default function ExecutionDetail({
  execution, loading, error, onRerun, rerunning,
}: {
  execution: ExecutionRecord | null;
  loading: boolean;
  error: string | null;
  onRerun: (e: ExecutionRecord) => void;
  rerunning: boolean;
}) {
  const [view, setView] = useState<View>("timeline");

  if (!execution) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-xs text-white/40">
        {error ? <span className="text-[#ff5c5c]">{error}</span> : loading ? "Loading execution…" : "Select an execution on the left."}
      </div>
    );
  }
  const e = execution;
  const tt = traceTotals(e.trace);
  const tabs: { id: View; label: string; empty: boolean }[] = [
    { id: "timeline", label: "Timeline", empty: !e.trace },
    { id: "answer", label: "ANSWER.md", empty: !e.answerMd },
    { id: "reasoning", label: "REASONING.md", empty: !e.reasoningMd },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 space-y-3 border-b border-white/10 px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusDot status={e.status} size={10} />
          <h2 className="min-w-0 truncate text-base font-semibold text-white">{e.caseId}</h2>
          <Badge>{e.dataset}</Badge>
          {e.outcome && <Badge tone={e.outcome === "error" ? "err" : "accent"}>{e.outcome.replaceAll("_", " ")}</Badge>}
          {e.simulated && <SimulatedBadge />}
          <span className="ml-auto flex items-center gap-2">
            {error && <span className="max-w-64 truncate text-[11px] text-[#ff5c5c]" title={error}>{error}</span>}
            <Button
              variant="primary"
              onClick={() => onRerun(e)}
              disabled={rerunning || e.status === "running"}
              title="Run this case again through the agent (POST /api/console/execute)"
            >
              {rerunning ? "Starting…" : "↻ Re-run"}
            </Button>
          </span>
        </div>
        <div className="grid grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-6">
          <Stat label="Started" value={fmtStarted(e.startedAt)} />
          <Stat label="Duration" value={fmtDuration(e.durationMs)} />
          <Stat label="Cost" value={fmtCost(e.costUsd)} />
          <Stat label="Model calls" value={String(tt.calls)} />
          <Stat label="Tokens" value={`${fmtTokens(tt.tokensIn)} / ${fmtTokens(tt.tokensOut)}`} />
          <Stat label="Origin" value={e.origin} />
        </div>
        <VoiceSlot.Mounts execution={e} />
        {e.eval && <EvalVerdict ev={e.eval} />}
      </header>

      <nav className="flex shrink-0 gap-1 border-b border-white/10 px-4" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={view === t.id}
            onClick={() => setView(t.id)}
            className={cx(
              "-mb-px border-b-2 px-3 py-2 text-xs font-medium transition-colors",
              view === t.id ? "border-[#ff6a1a] text-white" : "border-transparent text-white/50 hover:text-white/80",
              t.empty && "opacity-50",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {view === "timeline" && <Timeline trace={e.trace} />}
        {view === "answer" &&
          (e.answerMd ? (
            <div className="mx-auto max-w-3xl px-6 py-5">
              <Markdown source={e.answerMd} />
            </div>
          ) : (
            <p className="p-4 text-xs text-white/45">No ANSWER.md for this execution.</p>
          ))}
        {view === "reasoning" &&
          (e.reasoningMd ? (
            <div className="mx-auto max-w-3xl px-6 py-5">
              <Markdown source={e.reasoningMd} />
            </div>
          ) : (
            <p className="p-4 text-xs text-white/45">No REASONING.md for this execution.</p>
          ))}
      </div>
    </div>
  );
}
