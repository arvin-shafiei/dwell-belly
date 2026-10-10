"use client";
// "Ask the Architect": a chat panel that has the agent design a flow for a described business.
// The generated flow is handed to the editor, which animates it onto the canvas as a draft.
import { useEffect, useRef, useState } from "react";
import type { Flow } from "../types";
import { Icon } from "./icons";
import { Badge, Btn } from "./bits";
import { architectBuild } from "./api";
import {
  EXAMPLE_PROMPTS, buildRequest, explainFlow, usageTotals, type ArchitectUsage, type Step,
} from "./architect";
import { fmtMs, fmtUsd } from "./status";
import { metaFor } from "./nodeTypes";

type Msg =
  | { id: number; role: "user"; text: string; refine: boolean }
  | { id: number; role: "architect"; flow: Flow | null; steps: Step[]; problems: string[]; usage?: ArchitectUsage[] }
  | { id: number; role: "error"; text: string };

/** Wall clock, read only from event handlers and timers. */
const now = () => Date.now();

export interface DraftState {
  description: string;
  revealing: boolean;
}

export function Sparkle({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9zM19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1-2.1-.9 2.1-.9zM5 15.5l.7 1.6 1.6.7-1.6.7L5 20.1l-.7-1.6-1.6-.7 1.6-.7z" />
    </svg>
  );
}

export function ArchitectPanel({ draft, onDraft, onAccept, onDiscard, accepting, onClose }: {
  draft: DraftState | null;
  onDraft: (d: { flow: Flow; description: string; problems: string[]; usage?: ArchitectUsage[] }) => void;
  onAccept: () => void;
  onDiscard: () => void;
  accepting: boolean;
  onClose: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<number | null>(null); // start time while waiting
  const [elapsed, setElapsed] = useState(0);
  const nextId = useRef(1);
  const scroller = useRef<HTMLDivElement>(null);
  const base = draft?.description ?? null; // the brief a refine builds on

  useEffect(() => {
    if (busy === null) return;
    const t = setInterval(() => setElapsed(Math.round((now() - busy) / 1000)), 500);
    return () => clearInterval(t);
  }, [busy]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  const send = async (raw: string) => {
    const input = raw.trim();
    if (!input || busy !== null) return;
    const refine = !!base;
    const req = refine ? buildRequest(base, input) : buildRequest(input);
    setMsgs((m) => [...m, { id: nextId.current++, role: "user", text: input, refine }]);
    setText("");
    setElapsed(0);
    setBusy(now());
    const r = await architectBuild(req);
    setBusy(null);
    if (!r.ok) {
      setMsgs((m) => [...m, { id: nextId.current++, role: "error", text: r.error }]);
      return;
    }
    const d = r.data ?? {};
    const problems = d.problems ?? [];
    if (d.flow) {
      setMsgs((m) => [...m, { id: nextId.current++, role: "architect", flow: d.flow!, steps: explainFlow(d.flow!), problems, usage: d.usage }]);
      onDraft({ flow: d.flow, description: req.description, problems, usage: d.usage });
    } else {
      setMsgs((m) => [...m, {
        id: nextId.current++, role: "architect", flow: null, steps: [], usage: d.usage,
        problems: problems.length ? problems : [d.error ?? "The Architect returned no flow."],
      }]);
    }
  };

  const latestArchitect = [...msgs].reverse().find((m) => m.role === "architect" && m.flow);

  return (
    <aside className="flex h-full w-full min-w-0 flex-col bg-[#19191d]">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#ff6a1a] to-[#a78bfa] text-white"><Sparkle size={16} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-white">Ask the Architect</div>
          <div className="truncate text-[11px] text-white/45">Describe the business; the agent wires the flow from existing nodes.</div>
        </div>
        <button type="button" onClick={onClose} title="Close" className="rounded p-1.5 text-white/45 hover:bg-white/10 hover:text-white"><Icon name="close" size={15} /></button>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.length === 0 && (
          <div className="space-y-3">
            <p className="text-[12px] leading-relaxed text-white/60">
              Tell the Architect what you deliver, who drives, and what can go wrong. It picks and wires nodes,
              sets the safety-gate thresholds, and the result is checked in code before it reaches the canvas.
            </p>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/35">Try one</div>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_PROMPTS.map((p) => (
                <button
                  key={p} type="button" onClick={() => void send(p)} disabled={busy !== null}
                  className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-left text-[11.5px] text-white/80 hover:border-[#ff6a1a]/60 hover:bg-[#ff6a1a]/10 disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m) => {
          if (m.role === "user") {
            return (
              <div key={m.id} className="ml-8 rounded-lg rounded-tr-sm bg-[#ff6a1a]/15 px-3 py-2 text-[12.5px] leading-snug text-white/90">
                {m.refine && <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#ff8a4c]">Changes</div>}
                {m.text}
              </div>
            );
          }
          if (m.role === "error") {
            return <div key={m.id} className="rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 px-3 py-2 text-[12px] leading-snug text-[#fca5a5]">{m.text}</div>;
          }
          const tot = usageTotals(m.usage);
          return (
            <div key={m.id} className="space-y-2.5 rounded-lg rounded-tl-sm border border-white/10 bg-[#222227] px-3 py-2.5">
              {m.flow ? (
                <div className="text-[12.5px] text-white/90">
                  Built <b>{m.flow.name}</b>: {m.flow.nodes.length} steps, {m.flow.edges.length} connections.
                  {m.flow.business && <div className="mt-0.5 text-[11px] text-white/45">{m.flow.business}</div>}
                </div>
              ) : (
                <div className="text-[12.5px] text-white/90">No flow this time. The check found:</div>
              )}
              {m.steps.length > 0 && (
                <ol className="space-y-1.5">
                  {m.steps.map((s, i) => {
                    const meta = metaFor(s.type);
                    return (
                      <li key={s.id} className="flex gap-2 text-[11.5px] leading-snug">
                        <span className="mt-[1px] w-4 shrink-0 text-right tabular-nums text-white/30">{i + 1}</span>
                        <span className="mt-[1px] shrink-0" style={{ color: meta.color }}><Icon name={meta.icon} size={13} /></span>
                        <span className="min-w-0">
                          <span className="font-medium text-white/90">{s.label}</span>
                          {s.id !== s.type && <code className="ml-1 text-[10px] text-white/35">{s.id}</code>}
                          <span className="block text-white/50">{s.role}</span>
                          {s.branches.length > 0 && <span className="block text-white/60">{s.branches.join(" · ")}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
              {m.problems.length > 0 && (
                <ul className="space-y-1 rounded-md bg-[#ef4444]/10 px-2.5 py-2 text-[11.5px] text-[#fca5a5]">
                  {m.problems.map((p, i) => <li key={i}>• {p}</li>)}
                </ul>
              )}
              {m.flow && m.problems.length === 0 && <div className="flex items-center gap-1.5 text-[11px] text-[#4ade80]"><Icon name="check" size={12} strokeWidth={3} /> Passed the safety check (gated actions, human on ask, no cycles)</div>}
              {tot && (
                <div className="text-[10.5px] tabular-nums text-white/40">
                  {tot.model} · {tot.calls} call{tot.calls === 1 ? "" : "s"} · {fmtMs(tot.latencyMs)} · {fmtUsd(tot.costUsd)}
                </div>
              )}
            </div>
          );
        })}

        {busy !== null && (
          <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-[#222227] px-3 py-2.5 text-[12px] text-white/70">
            <span className="text-[#ff8a4c] wf-pulse-soft"><Sparkle size={15} /></span>
            Designing the flow… <span className="tabular-nums text-white/40">{elapsed}s</span>
          </div>
        )}
      </div>

      {draft && latestArchitect && (
        <div className="flex items-center gap-2 border-t border-white/10 bg-[#1d1d22] px-4 py-2.5">
          <Badge tone="violet">Draft</Badge>
          <span className="min-w-0 flex-1 truncate text-[11px] text-white/50">{draft.revealing ? "Placing nodes…" : "Not saved yet"}</span>
          <Btn onClick={onDiscard} disabled={accepting}>Discard</Btn>
          <Btn variant="primary" onClick={onAccept} disabled={accepting || draft.revealing}>
            <Icon name="check" size={13} strokeWidth={2.6} /> {accepting ? "Saving…" : "Accept & save"}
          </Btn>
        </div>
      )}

      <form
        className="border-t border-white/10 p-3"
        onSubmit={(e) => { e.preventDefault(); void send(text); }}
      >
        <div className="rounded-lg border border-white/12 bg-black/25 focus-within:border-[#ff6a1a]/60">
          <textarea
            value={text} rows={3} disabled={busy !== null}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); }
            }}
            placeholder={base ? "Ask for changes… (e.g. add a missing-info check, stricter gate)" : "Describe your delivery business…"}
            className="block w-full resize-none bg-transparent px-3 pt-2.5 text-[12.5px] leading-snug text-white outline-none placeholder:text-white/35"
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="pl-1 text-[10px] text-white/30">{base ? "Refines the current draft" : "Enter to send · Shift+Enter for a new line"}</span>
            <button
              type="submit" disabled={!text.trim() || busy !== null}
              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[#ff6a1a] px-2.5 text-[12px] font-medium text-white hover:bg-[#ff7d38] disabled:bg-white/10 disabled:text-white/40"
            >
              <Sparkle size={12} /> {base ? "Refine" : "Build"}
            </button>
          </div>
        </div>
      </form>
    </aside>
  );
}
