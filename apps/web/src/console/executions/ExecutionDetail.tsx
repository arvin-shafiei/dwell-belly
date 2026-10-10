"use client";
// One case run in plain words: what happened (headline), the message, a person's decision if
// one is needed, and the steps as a checklist. Timings, costs, step log and the written
// reports are behind "Details".
import { useState } from "react";
import { cents, plainOutcome, scrubLeaks } from "../../ui/plain";
import type { ExecutionRecord } from "../types";
import { fmtDuration, fmtStarted, fmtTokens, traceTotals } from "./logic";
import Markdown from "./MarkdownView";
import { caseName, checklist, decisionCardOf, headline, messageOf, statusTone, statusWord } from "./plainView";
import Timeline, { DecisionCardView, MessageCard } from "./Timeline";
import { Badge, Button, cx } from "./ui";

type DetailView = "steps" | "answer" | "reasoning";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-white/40">{label}</div>
      <div className="truncate text-sm tabular-nums text-white/85">{value}</div>
    </div>
  );
}

export function Provenance({ simulated }: { simulated: boolean }) {
  return simulated ? (
    <Badge tone="warn" title="Made from the city, not a real case">Practice case</Badge>
  ) : (
    <Badge tone="ok" title="A real run of the agent">Live</Badge>
  );
}

function RightOrWrong({ ev }: { ev: NonNullable<ExecutionRecord["eval"]> }) {
  return ev.pass ? (
    <span className="text-sm font-medium text-[#3ecf8e]">✓ Right</span>
  ) : (
    <span className="text-sm font-medium text-[#ff5c5c]">✗ Wrong</span>
  );
}

function Details({ e }: { e: ExecutionRecord }) {
  const [view, setView] = useState<DetailView>("steps");
  const tt = traceTotals(e.trace);
  const tabs: { id: DetailView; label: string; has: boolean }[] = [
    { id: "steps", label: "Step log", has: !!e.trace },
    { id: "answer", label: "Answer", has: !!e.answerMd },
    { id: "reasoning", label: "Reasoning", has: !!e.reasoningMd },
  ];
  return (
    <div className="mt-3 space-y-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
        <Stat label="Took" value={fmtDuration(e.durationMs)} />
        <Stat label="Cost" value={cents(e.costUsd) || "–"} />
        <Stat label="AI calls" value={String(tt.calls)} />
        <Stat label="Words in / out" value={`${fmtTokens(tt.tokensIn)} / ${fmtTokens(tt.tokensOut)}`} />
        <Stat label="Case id" value={e.caseId} />
      </div>
      {e.eval && (
        <p className="text-[13px] text-white/65">
          Check: <RightOrWrong ev={e.eval} /> <span className="tabular-nums text-white/40">(score {e.eval.score.toFixed(2)})</span>
          {e.eval.notes && <span className="block text-white/55">{scrubLeaks(e.eval.notes)}</span>}
        </p>
      )}
      <div>
        <nav className="flex gap-1 border-b border-white/10" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={view === t.id}
              onClick={() => setView(t.id)}
              className={cx(
                "-mb-px border-b-2 px-3 py-2 text-xs font-medium",
                view === t.id ? "border-[#ff6a1a] text-white" : "border-transparent text-white/50 hover:text-white/80",
                !t.has && "opacity-50",
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
        {view === "steps" && <Timeline trace={e.trace} />}
        {view === "answer" &&
          (e.answerMd ? <div className="py-4"><Markdown source={e.answerMd} /></div> : <p className="py-4 text-xs text-white/45">No written answer for this case run.</p>)}
        {view === "reasoning" &&
          (e.reasoningMd ? <div className="py-4"><Markdown source={e.reasoningMd} /></div> : <p className="py-4 text-xs text-white/45">No written reasoning for this case run.</p>)}
      </div>
    </div>
  );
}

export default function ExecutionDetail({
  execution, title, loading, error, onRerun, rerunning,
}: {
  execution: ExecutionRecord | null;
  title: string | null;
  loading: boolean;
  error: string | null;
  onRerun: (e: ExecutionRecord) => void;
  rerunning: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);

  if (!execution) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-white/45">
        {error ? <span className="text-[#ff5c5c]">Couldn&apos;t load this case run.</span> : loading ? "Loading…" : "Pick a case run on the left."}
      </div>
    );
  }
  const e = execution;
  const runTitle = e.trace?.events.find((x) => x.kind === "run_start");
  const name = caseName(e.caseId, title ?? (runTitle?.kind === "run_start" ? runTitle.title : null));
  const msg = messageOf(e);
  const card = decisionCardOf(e.trace);
  const steps = checklist(e.trace);
  const tone = statusTone(e);
  const toneColor = { ok: "#3ecf8e", warn: "#f5b83d", info: "#6aa7ff", err: "#ff5c5c", muted: "#8b8b96", accent: "#ff6a1a" }[tone];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-6 lg:px-8">
        <header>
          <div className="flex flex-wrap items-center gap-2 text-sm text-white/50">
            <span className="min-w-0 truncate">{name}</span>
            <Provenance simulated={e.simulated} />
          </div>
          <h2 className="mt-2 text-2xl font-semibold leading-tight text-white">{headline(e)}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="font-medium" style={{ color: toneColor }}>{statusWord(e)}</span>
            <span className="text-white/45" title={e.startedAt}>{fmtStarted(e.startedAt)}</span>
            {e.eval && <RightOrWrong ev={e.eval} />}
            <span className="ml-auto flex items-center gap-3">
              {error && <span className="text-xs text-[#ff5c5c]">Couldn&apos;t start it. Try again.</span>}
              <Button variant="primary" className="!px-4 !py-2 !text-sm" onClick={() => onRerun(e)} disabled={rerunning || e.status === "running"}>
                {rerunning ? "Starting…" : "Run again"}
              </Button>
            </span>
          </div>
        </header>

        {msg && <MessageCard title={msg.title} to={msg.to} how={msg.how} message={msg.message} />}
        {card && <DecisionCardView card={card} />}

        {steps.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-white/60">Steps</h3>
            <ul className="space-y-1.5 text-[14px]">
              {steps.map((s, i) => (
                <li key={i} className="flex items-baseline gap-2.5">
                  <span
                    className={cx(
                      "w-4 shrink-0 text-center",
                      s.state === "ok" ? "text-[#3ecf8e]" : s.state === "error" ? "text-[#ff5c5c]" : s.state === "running" ? "text-[#ff6a1a]" : "text-white/30",
                    )}
                  >
                    {s.state === "ok" ? "✓" : s.state === "error" ? "✗" : s.state === "running" ? "…" : "–"}
                  </span>
                  <span className="text-white/85">{s.text}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {!steps.length && !msg && !card && e.status !== "running" && (
          <p className="text-sm text-white/45">Result: {plainOutcome(e.outcome)}. No steps were recorded.</p>
        )}

        <section className="border-t border-white/10 pt-3">
          <button type="button" onClick={() => setShowDetails((v) => !v)} className="text-sm text-white/50 hover:text-white/85">
            {showDetails ? "▾ Hide details" : "▸ Details"}
          </button>
          {showDetails && <Details e={e} />}
        </section>
      </div>
    </div>
  );
}
