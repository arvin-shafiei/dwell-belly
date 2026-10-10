"use client";
// The HUD's decision toast for REAL decision cards only (mock cards go to the review drawer's Simulation tab).
// Fed by (a) replayed real traces whose human node carries a card and (b) the human review queue gaining a
// new agent card. Shows the agent's own fields (whyStopped, evidence, alreadyDone, options with effect).
// A choice is recorded through the review queue API (backendLink.recordDecision). If that fails, the choice
// stays local and is labelled NOT SENT. Nothing is re-run: the agent API has no humanDecision input yet.
import { useEffect, useRef, useState } from "react";
import { useWorld, type WorkflowEvent } from "../../store";
import type { ReviewTask } from "../../../review/types";
import { browserFetchJson, provenanceLabel, recordDecision, replayByRun, replayFor, type DecisionOutcome } from "../../backendLink";
import { isReal, newAsks } from "./flow";
import { GLASS, RealAgentTag } from "./parts";

type HudCard = NonNullable<WorkflowEvent["card"]>;

export interface ToastItem {
  key: string; // runId|traceCaseId
  caseLabel: string; // what the feed shows, e.g. "INC-003 · car crash"
  runId: string;
  traceCaseId: string;
  card: HudCard;
  prov: string;
  /** performance.now() when it arrived, for the deadline. */
  at: number;
}

/** A real replayed card event -> toast item (null for mock events or events without a card). */
export function toastFromEvent(e: WorkflowEvent, traceCaseId: string | undefined, at: number): ToastItem | null {
  if (!e.card || !isReal(e) || !e.runId) return null;
  const caseId = traceCaseId ?? e.caseId;
  return { key: `${e.runId}|${caseId}`, caseLabel: e.caseId, runId: e.runId, traceCaseId: caseId, card: e.card, prov: provenanceLabel(e), at };
}

/** A pending agent card from the review queue -> toast item (null for the city's simulated tasks). */
export function toastFromTask(t: ReviewTask, at: number): ToastItem | null {
  if (t.origin === "city" || t.status !== "pending") return null;
  const fallback = t.options.find((o) => o.label === t.fallback) ?? t.options.find((o) => o.undoable) ?? t.options[0];
  return {
    key: `${t.runId}|${t.caseId}`,
    caseLabel: t.caseId,
    runId: t.runId,
    traceCaseId: t.caseId,
    prov: t.simulated ? "Real agent · Synthetic case" : "Real agent",
    at,
    card: {
      cardId: t.cardId,
      summary: t.summary,
      routeTo: t.routeTo,
      options: t.options.map((o) => ({ id: o.id, label: o.label, safe: o.undoable, ...(o.effect ? { effect: o.effect } : {}) })),
      deadlineMs: Math.max(60_000, Date.parse(t.deadlineAt) - Date.parse(t.receivedAt)),
      fallbackOptionId: fallback?.id ?? "",
      whyStopped: { reason: "review_queue", line: t.mustDecide },
      ...(t.evidence.length ? { evidence: t.evidence } : {}),
      ...(t.tried.length ? { alreadyDone: t.tried } : {}),
      ...(t.clash ? { clash: t.clash } : {}),
      ...(t.wouldChangeMyMind ? { wouldChangeMyMind: t.wouldChangeMyMind } : {}),
      fallback: t.fallback,
    },
  };
}

function reviewer(): string {
  try {
    return localStorage.getItem("rivet-reviewer")?.trim() || "City HUD reviewer";
  } catch {
    return "City HUD reviewer";
  }
}

/** Log the person's choice on the case's feed line (source live_human; no cost). */
function pushChoice(item: ToastItem, label: string, result: DecisionOutcome) {
  useWorld.getState().pushWorkflow({
    id: `hd-${Math.random().toString(36).slice(2, 10)}`,
    t: performance.now(),
    caseId: item.caseLabel,
    nodeId: "human",
    status: "ok",
    summary: result.status === "recorded" ? `Chose "${label}" · recorded in the review queue, action pending` : `Chose "${label}" · NOT SENT (${result.reason})`,
    source: "live_human",
    runId: item.runId,
  });
}

/** Truncate to `n` chars with an ellipsis (whitespace collapsed). */
export function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`;
}

/** Option button text: at most 4 words and 28 chars. The full label and effect go in the tooltip. */
export function shortLabel(label: string): string {
  const words = label.replace(/\s+/g, " ").trim().split(" ");
  return clip(words.length > 4 ? `${words.slice(0, 4).join(" ")}…` : words.join(" "), 28);
}

const BASIS_DOT: Record<string, string> = {
  system_record: "bg-emerald-400",
  owning_team_statement: "bg-sky-400",
  unverified_claim: "bg-amber-400",
};

type Choice = { optionId: string; state: "sending" } | { optionId: string; state: "done"; result: DecisionOutcome };

export function RealDecisionToast({ tasks, loading, onOpenQueue }: { tasks: ReviewTask[]; loading: boolean; onOpenQueue: () => void }) {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [details, setDetails] = useState(false);
  const seenKeys = useRef(new Set<string>());
  const seededQueue = useRef(false);
  const lastId = useRef<string | null>(null);

  const enqueue = (items: ToastItem[]) => {
    const fresh = items.filter((i) => !seenKeys.current.has(i.key));
    if (!fresh.length) return;
    for (const i of fresh) seenKeys.current.add(i.key);
    setQueue((q) => [...q, ...fresh].slice(-6));
  };

  // (a) Replayed real traces: watch the store for new "ask" events that carry a card.
  useEffect(() => {
    const wf = useWorld.getState().workflow;
    lastId.current = wf.length ? wf[wf.length - 1].id : null;
    return useWorld.subscribe((s, prev) => {
      if (s.workflow === prev.workflow || s.workflow.length === 0) return;
      const fresh = newAsks(s.workflow, lastId.current);
      lastId.current = s.workflow[s.workflow.length - 1].id;
      const t = performance.now();
      const items = fresh.flatMap((e) => {
        const it = toastFromEvent(e, replayFor(e.caseId)?.trace.caseId, t);
        return it ? [it] : [];
      });
      if (items.length) enqueue(items);
    });
  }, []);

  // (b) The review queue gained an agent card. The first load only seeds (no backlog toasts); cards from a
  // run the city is replaying are skipped here, because the replay toasts them when it reaches the card.
  useEffect(() => {
    if (loading) return;
    const t = performance.now();
    const items = tasks.flatMap((task) => {
      const it = toastFromTask(task, t);
      return it ? [it] : [];
    });
    if (!seededQueue.current) {
      seededQueue.current = true;
      for (const i of items) seenKeys.current.add(i.key);
      return;
    }
    enqueue(items.filter((i) => !replayByRun(i.runId, i.traceCaseId)));
  }, [tasks, loading]);

  const cur = queue[0] ?? null;

  const dismiss = () => {
    setChoice(null);
    setDetails(false);
    setQueue((q) => q.slice(1));
  };

  async function choose(optionId: string) {
    if (!cur || choice) return;
    setChoice({ optionId, state: "sending" });
    const label = cur.card.options.find((o) => o.id === optionId)?.label ?? optionId;
    const result = await recordDecision(
      { runId: cur.runId, caseId: cur.traceCaseId, optionId, who: reviewer(), note: "Chosen in the city HUD", replay: replayByRun(cur.runId, cur.traceCaseId) },
      browserFetchJson,
    );
    setChoice({ optionId, state: "done", result });
    pushChoice(cur, label, result);
  }

  if (!cur) return null;
  const c = cur.card;
  const mins = Math.round(c.deadlineMs / 60_000);
  const picked = choice?.optionId ?? null;
  const why = c.whyStopped?.line || c.summary;
  const status =
    choice?.state === "sending" ? { text: "Recording…", cls: "text-white/50", title: "" }
    : choice?.state === "done"
      ? choice.result.status === "recorded"
        ? { text: "Recorded · not re-run", cls: "text-emerald-300", title: choice.result.note }
        : { text: "NOT SENT", cls: "text-amber-300", title: choice.result.reason }
      : null;
  return (
    <div key={cur.key} className={`${GLASS} hud-toast w-full max-w-[380px] border-amber-300/30`} role="alertdialog" aria-label="Decision needed" title={cur.caseLabel}>
      <div className="px-3 pb-2.5 pt-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-400" />
          <span className="min-w-0 truncate rounded bg-amber-400/15 px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-[0.12em] text-amber-200" title={c.routeTo}>
            {clip(c.routeTo.replaceAll("_", " "), 28)}
          </span>
          <RealAgentTag label={cur.prov} />
          {queue.length > 1 && <span className="ml-auto shrink-0 font-mono text-[10px] text-white/45">+{queue.length - 1}</span>}
        </div>
        <p className="mt-1.5 truncate text-[12px] font-medium text-white" title={why}>{clip(why, 90)}</p>
        {c.evidence && c.evidence.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {c.evidence.slice(0, 2).map((ev, i) => (
              <li key={i} className="flex items-center gap-1.5 text-[10.5px] text-white/60" title={`${ev.who}: ${ev.says} (${ev.basis.replaceAll("_", " ")})`}>
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${BASIS_DOT[ev.basis] ?? "bg-white/40"}`} />
                <span className="truncate">{clip(`${ev.who}: ${ev.says}`, 70)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap gap-1">
          {c.options.map((o) => {
            const on = picked === o.id;
            return (
              <button
                key={o.id}
                type="button"
                disabled={!!picked}
                onClick={() => void choose(o.id)}
                title={[o.label, o.effect, o.safe ? "Undoable" : ""].filter(Boolean).join(" · ")}
                className={`max-w-full truncate rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                  on
                    ? "border-[#ff6a1a] bg-[#ff6a1a] text-black"
                    : picked
                      ? "border-white/5 bg-white/[0.02] text-white/30"
                      : `${o.safe ? "border-emerald-400/30" : "border-white/12"} bg-white/[0.05] text-white/90 hover:border-[#ff6a1a]/60 hover:bg-[#ff6a1a]/15`
                }`}
              >
                {shortLabel(o.label)}
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px] text-white/45">
          <button type="button" onClick={() => setDetails((d) => !d)} className="text-white/55 hover:text-white" aria-expanded={details}>
            Details {details ? "▴" : "▾"}
          </button>
          {status ? <span className={`min-w-0 truncate ${status.cls}`} title={status.title}>{status.text}</span> : <span>{mins} min</span>}
          <span className="ml-auto flex shrink-0 gap-1">
            <button type="button" onClick={onOpenQueue} className="rounded border border-white/15 px-1.5 py-px text-white/70 hover:bg-white/10">Queue</button>
            <button type="button" onClick={dismiss} className="rounded border border-white/15 px-1.5 py-px text-white/70 hover:bg-white/10">{choice?.state === "done" ? "Close" : "Later"}</button>
          </span>
        </div>
        {details && (
          <div className="hud-scroll mt-1.5 max-h-40 space-y-1 overflow-y-auto border-t border-white/[0.07] pt-1.5 text-[10.5px] leading-snug text-white/60">
            {c.summary && c.summary !== why && <p>{c.summary}</p>}
            {c.clash && <p><span className="text-white/40">Clash: </span>{c.clash}</p>}
            {c.alreadyDone?.length ? <p><span className="text-white/40">Done: </span>{c.alreadyDone.join(" · ")}</p> : null}
            {c.wouldChangeMyMind && <p><span className="text-white/40">Would settle it: </span>{c.wouldChangeMyMind}</p>}
            {c.fallback && <p><span className="text-white/40">If nobody answers: </span>{c.fallback}</p>}
            {status?.title && <p><span className="text-white/40">Status: </span>{status.title}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
