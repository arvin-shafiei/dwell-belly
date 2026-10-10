"use client";
// Vertical timeline of one execution's trace: steps with model calls, edges taken,
// the safety gate's risk against its thresholds, the human decision card and the final next action.
import { useState } from "react";
import type { Trace } from "../types";
import type { DecisionCard, NextAction } from "../../../../api/src/lib/trace";
import { buildTimeline, cardView, fmtCost, fmtDuration, fmtTokens, gateBar, type CardView, type GateInfo, type TimelineItem } from "./logic";
import { Badge, C } from "./ui";

type NodeItem = Extract<TimelineItem, { kind: "node" }>;

const label = (s: string) => s.replaceAll("_", " ");

function Rail({ color, last, children, dot = 10 }: { color: string; last?: boolean; children: React.ReactNode; dot?: number }) {
  return (
    <li className="relative flex gap-3">
      <div className="relative flex w-4 shrink-0 justify-center">
        {!last && <span className="absolute bottom-0 top-3 w-px bg-white/10" />}
        <span className="relative mt-1.5 rounded-full ring-4 ring-[#1f1f23]" style={{ width: dot, height: dot, background: color }} />
      </div>
      <div className="min-w-0 flex-1 pb-3">{children}</div>
    </li>
  );
}

function Tstamp({ t }: { t: number }) {
  return <span className="font-mono text-[10px] tabular-nums text-white/35">+{fmtDuration(t)}</span>;
}

export function GateBar({ gate }: { gate: GateInfo }) {
  const b = gateBar(gate);
  const tone = gate.decision === "allow" ? C.ok : gate.decision === "block" ? C.err : C.warn;
  return (
    <div className="mt-2 rounded-md bg-black/20 p-2.5 ring-1 ring-white/5">
      <div className="mb-1.5 flex items-center justify-between text-[11px]">
        <span className="text-white/60">
          Risk <span className="font-mono font-semibold tabular-nums text-white">{gate.risk.toFixed(2)}</span>
        </span>
        <Badge tone={gate.decision === "allow" ? "ok" : gate.decision === "block" ? "err" : "warn"}>{gate.decision}</Badge>
      </div>
      <div className="relative my-1 h-2">
        <div className="absolute inset-0 overflow-hidden rounded-full">
          <div className="absolute inset-y-0 left-0" style={{ width: `${b.allow}%`, background: `${C.ok}55` }} />
          <div className="absolute inset-y-0" style={{ left: `${b.allow}%`, width: `${Math.max(0, b.block - b.allow)}%`, background: `${C.warn}55` }} />
          <div className="absolute inset-y-0 right-0" style={{ left: `${b.block}%`, background: `${C.err}55` }} />
        </div>
        <span className="absolute -top-1 h-4 w-1 -translate-x-1/2 rounded bg-white" style={{ left: `${b.risk}%`, boxShadow: `0 0 6px ${tone}` }} />
      </div>
      <div className="flex justify-between gap-2 font-mono text-[9px] tabular-nums text-white/40">
        <span>
          <span style={{ color: C.ok }}>allow</span> &lt; {gate.allowBelow}
        </span>
        <span style={{ color: C.warn }}>ask</span>
        <span>
          <span style={{ color: C.err }}>block</span> &gt; {gate.blockAbove}
        </span>
      </div>
    </div>
  );
}

function BasisQuote({ e }: { e: CardView["evidence"][number] }) {
  const ring =
    e.style === "solid" ? "border border-solid border-white/25 bg-white/[0.04]"
    : e.style === "blue" ? "border border-solid border-[#6aa7ff]/50 bg-[#6aa7ff]/[0.06]"
    : "border border-dashed border-[#f5b83d]/60 bg-[#f5b83d]/[0.05]";
  const chip =
    e.style === "solid" ? "bg-white/85 text-[#1f1f23]"
    : e.style === "blue" ? "bg-[#6aa7ff]/20 text-[#6aa7ff]"
    : "border border-dashed border-[#f5b83d]/70 text-[#f5b83d]";
  return (
    <li className={`rounded-md px-2.5 py-1.5 ${ring}`}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate text-[11px] font-medium text-white/85">{e.who}</span>
        <span className={`ml-auto shrink-0 rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide ${chip}`}>{e.label}</span>
      </div>
      <q className="mt-0.5 block text-xs leading-relaxed text-white/70 before:content-['“'] after:content-['”']">{e.says}</q>
    </li>
  );
}

export function DecisionCardView({ card }: { card: DecisionCard }) {
  const v = cardView(card);
  return (
    <div className="mt-2 overflow-hidden rounded-lg bg-[#2a2a30] ring-1 ring-[#f5b83d]/40">
      <div className="flex items-center justify-between gap-2 bg-[#f5b83d]/10 px-3 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#f5b83d]">Human decision</span>
        <span className="truncate text-[11px] text-white/60">
          to <span className="text-white/90">{card.routeTo || "–"}</span>
          {card.deadlineMins ? <> · within {card.deadlineMins} min</> : null}
        </span>
      </div>
      <div className="space-y-2.5 p-3 text-xs text-white/75">
        {(v.headline.chip || v.headline.line) && (
          <div className="flex flex-wrap items-start gap-2">
            {v.headline.chip && <Badge tone={v.headline.chip.tone}>{v.headline.chip.label}</Badge>}
            {v.headline.line && <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-white">{v.headline.line}</p>}
          </div>
        )}
        {v.summary && <p className="leading-relaxed text-white/70">{v.summary}</p>}
        {v.clash && (
          <p>
            <span className="text-white/45">Clash: </span>
            {v.clash}
          </p>
        )}
        {v.evidence.length > 0 && (
          <div>
            <div className="mb-1 text-white/45">Evidence</div>
            <ul className="space-y-1">
              {v.evidence.map((e, i) => (
                <BasisQuote key={i} e={e} />
              ))}
            </ul>
          </div>
        )}
        {v.done.items.length > 0 && (
          <div>
            <div className="mb-0.5 text-white/45">{v.done.title}</div>
            <ul className="space-y-0.5">
              {v.done.items.map((t, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-[#3ecf8e]">✓</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {v.options.length > 0 && (
          <div>
            <div className="mb-1 text-white/45">Options</div>
            <ul className="space-y-1">
              {v.options.map((o) => (
                <li
                  key={o.id}
                  className={`rounded-md px-2.5 py-1.5 ring-1 ring-inset ${o.chosen ? "bg-[#ff6a1a]/15 ring-[#ff6a1a]/60" : "bg-white/5 ring-white/10"}`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-white/90">{o.label}</span>
                    <span className="ml-auto flex gap-1">
                      {o.chosen && <Badge tone="accent">chosen</Badge>}
                      <Badge tone={o.undoable ? "ok" : "err"}>{o.undoable ? "undoable" : "irreversible"}</Badge>
                    </span>
                  </div>
                  {o.effect && <p className="mt-0.5 text-[11px] leading-relaxed text-white/55">{o.effect}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {card.wouldChangeMyMind && (
          <p>
            <span className="text-white/45">What would change my mind: </span>
            {card.wouldChangeMyMind}
          </p>
        )}
        {card.fallback && (
          <p>
            <span className="text-white/45">Fallback if nobody answers: </span>
            {card.fallback}
          </p>
        )}
      </div>
    </div>
  );
}

export function MessageCard({ action, title = "Next action", ok }: { action: NextAction; title?: string; ok?: boolean }) {
  return (
    <div className="mt-2 overflow-hidden rounded-lg bg-[#2a2a30] ring-1 ring-[#ff6a1a]/40">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-[#ff6a1a]/10 px-3 py-1.5 text-[11px]">
        <span className="font-semibold uppercase tracking-wide text-[#ff6a1a]">{title}</span>
        <span className="min-w-0 truncate text-white/80">
          {action.recipient} <span className="text-white/35">·</span> {action.channel}
        </span>
        <span className="ml-auto flex gap-1">
          {ok === false && <Badge tone="err">failed</Badge>}
          <Badge tone={action.undoable ? "muted" : "err"}>{action.undoable ? "undoable" : "not undoable"}</Badge>
        </span>
      </div>
      <p className="whitespace-pre-wrap px-3 py-2.5 text-xs leading-relaxed text-white/85">{action.message}</p>
    </div>
  );
}

function OutputDetails({ output }: { output: unknown }) {
  const [open, setOpen] = useState(false);
  if (!output) return null;
  return (
    <div className="mt-1.5">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-[10px] uppercase tracking-wide text-white/35 hover:text-white/70">
        {open ? "▾" : "▸"} output
      </button>
      {open && (
        <pre className="mt-1 max-h-64 overflow-auto rounded bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-white/70">
          {JSON.stringify(output, null, 2)}
        </pre>
      )}
    </div>
  );
}

function NodeStep({ n }: { n: NodeItem }) {
  const special = n.gate || n.card || n.action;
  return (
    <div className="rounded-lg bg-[#2a2a30] px-3 py-2 ring-1 ring-white/5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[13px] font-medium text-white">{n.nodeId}</span>
        {n.nodeType !== n.nodeId && <span className="text-[11px] text-white/40">{label(n.nodeType)}</span>}
        {n.status === "error" && <Badge tone="err">error</Badge>}
        {n.status === "skipped" && <Badge>skipped</Badge>}
        {n.status === "running" && <Badge tone="accent">running</Badge>}
        <span className="ml-auto flex items-baseline gap-2 font-mono text-[10px] tabular-nums text-white/45">
          <span>{fmtDuration(n.latencyMs)}</span>
          {n.costUsd ? <span>{fmtCost(n.costUsd)}</span> : null}
          <Tstamp t={n.t} />
        </span>
      </div>
      {n.summary && <p className="mt-0.5 text-xs leading-relaxed text-white/65">{n.summary}</p>}
      {n.calls.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {n.calls.map((c, i) => (
            <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded bg-black/20 px-2 py-1 font-mono text-[10px] tabular-nums text-white/55">
              <span className={c.ok ? "text-[#6aa7ff]" : "text-[#ff5c5c]"}>{c.runner}</span>
              <span className="text-white/80">{c.model}</span>
              <span>
                {fmtTokens(c.tokensIn)} in · {fmtTokens(c.tokensOut)} out
              </span>
              <span>{fmtCost(c.costUsd)}</span>
              <span>{fmtDuration(c.latencyMs)}</span>
              {!c.ok && c.error && <span className="basis-full text-[#ff5c5c]">{c.error}</span>}
            </div>
          ))}
        </div>
      )}
      {n.gate && <GateBar gate={n.gate} />}
      {n.card && <DecisionCardView card={n.card} />}
      {n.action && <MessageCard action={n.action.done} title="Sent" ok={n.action.ok} />}
      {!special && <OutputDetails output={n.output} />}
    </div>
  );
}

export default function Timeline({ trace }: { trace: Trace | null }) {
  const items = buildTimeline(trace);
  if (!items.length) {
    return <p className="p-4 text-xs text-white/45">No trace recorded for this execution.</p>;
  }
  return (
    <ol className="p-4">
      {items.map((it, i) => {
        const last = i === items.length - 1;
        switch (it.kind) {
          case "run_start":
            return (
              <Rail key={i} color={C.info} last={last}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6aa7ff]">Case in</span>
                  <span className="min-w-0 truncate text-[13px] text-white">{it.title}</span>
                  <span className="ml-auto">
                    <Tstamp t={it.t} />
                  </span>
                </div>
                {it.inputs.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {it.inputs.map((inp) => (
                      <li key={inp.n} className="rounded bg-black/20 px-2 py-1 text-[11px] text-white/65">
                        <span className="font-mono text-white/35">#{inp.n}</span> <span className="text-white/85">{inp.from}</span>{" "}
                        <span className="text-white/35">via {inp.channel}</span>
                        <span className="block truncate text-white/55">{inp.excerpt}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Rail>
            );
          case "node": {
            const color = it.status === "error" ? C.err : it.status === "running" ? C.accent : it.status === "skipped" ? C.muted : C.ok;
            return (
              <Rail key={i} color={color} last={last}>
                <NodeStep n={it} />
              </Rail>
            );
          }
          case "edge":
            return (
              <Rail key={i} color="#55555f" last={last} dot={6}>
                <div className="-mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-white/40">
                  <span>{it.from}</span>
                  <span className="text-white/25">→</span>
                  <span>{it.to}</span>
                  {it.when && (
                    <Badge tone={it.when === "allow" ? "ok" : it.when === "block" ? "err" : it.when === "ask" ? "warn" : "muted"}>{it.when}</Badge>
                  )}
                </div>
              </Rail>
            );
          case "run_end":
            return (
              <Rail key={i} color={it.outcome === "error" ? C.err : C.accent} last={last} dot={12}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#ff6a1a]">Run end</span>
                  <Badge tone={it.outcome === "error" ? "err" : "accent"}>{label(it.outcome)}</Badge>
                  <span className="ml-auto font-mono text-[10px] tabular-nums text-white/45">
                    {fmtDuration(it.totalLatencyMs)} · {fmtCost(it.totalCostUsd)}
                  </span>
                </div>
                {it.error && <p className="mt-1 text-xs text-[#ff5c5c]">{it.error}</p>}
                {it.nextAction && <MessageCard action={it.nextAction} />}
              </Rail>
            );
        }
      })}
    </ol>
  );
}
