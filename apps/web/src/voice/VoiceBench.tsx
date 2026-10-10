"use client";
// Developer bench: one case, every voice piece, real API calls. Not linked from the console.
import { useEffect, useMemo, useState } from "react";
import { AGENT_API, buildRerunView, runCase, type CaseView, type DecisionCard, type HumanDecision, type ViewEvent } from "./api";
import { ApproveByVoice } from "./ApproveByVoice";
import { CallDrawer } from "./CallDrawer";
import { createRerunClock } from "./rerunClock";
import { VoiceNoteButton } from "./VoiceNoteButton";

const CASE_ID = "delivery-003";

export function VoiceBench() {
  const [view, setView] = useState<CaseView | null>(null);
  const [pending, setPending] = useState<ViewEvent[]>([]);
  const [outbox, setOutbox] = useState<unknown[]>([]);
  const [card, setCard] = useState<DecisionCard | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [decision, setDecision] = useState<HumanDecision | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clock] = useState(() => createRerunClock());

  useEffect(() => {
    fetch(`${AGENT_API}/api/data/cases/${CASE_ID}?view=escalation`, { cache: "no-store" })
      .then((r) => r.json())
      .then((v: CaseView) => setView({ id: v.id, title: v.title, events: v.events }))
      .catch(() => setError("Could not load the case. Is the API running on :4000?"));
  }, []);

  const lastN = useMemo(() => Math.max(0, ...(view?.events ?? []).map((e) => e.n)) + pending.length, [view, pending]);
  const caseText = useMemo(() => (view?.events ?? []).map((e) => `${e.from ?? ""}: ${e.body}`).join("\n"), [view]);
  const lastAt = view?.events.at(-1)?.timestamp ?? "";

  async function rerun() {
    if (!view) return;
    setBusy("Re-running the case through the pipeline (30 to 150 s)…");
    setError(null);
    try {
      const built = await buildRerunView({ view, previousOutbox: outbox, newEvents: pending, elapsedMs: clock.elapsed() });
      const res = await runCase(built.view);
      clock.markRun();
      setView(built.view);
      setPending([]);
      setOutbox(res.outbox);
      setCard(res.card);
      setOutcome(res.outcome);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The re-run failed");
    } finally {
      setBusy(null);
    }
  }

  if (!view) return <p className="p-6 text-white/60">{error ?? "Loading case…"}</p>;
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 bg-[#1f1f23] p-6 text-white">
      <h1 className="text-lg font-semibold">Voice bench: {view.title ?? view.id}</h1>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h2 className="text-sm uppercase tracking-wide text-white/50">Case events</h2>
          <ol className="flex flex-col gap-1 text-sm">
            {[...view.events, ...pending].map((e) => (
              <li key={`${e.n}-${e.body.slice(0, 12)}`} className={pending.includes(e) ? "text-[#ff6a1a]" : ""}>
                <span className="text-white/40">{e.n}. {e.channel} from {e.from}{e.source ? ` (voice: ${e.source})` : ""}:</span> {e.body}
              </li>
            ))}
          </ol>
          <button onClick={rerun} disabled={!!busy} className="mt-2 rounded bg-white/10 px-3 py-1.5 text-sm disabled:opacity-50">
            Re-run case{pending.length ? ` with ${pending.length} new event(s)` : ""}
          </button>
          {busy && <p className="text-sm text-white/60">{busy}</p>}
          {error && <p className="text-sm text-amber-300">{error}</p>}
          {outcome && <p className="text-sm">Outcome: <b>{outcome}</b></p>}
          {decision && <p className="text-sm text-emerald-300">Manager decided by voice: {decision.label}</p>}
        </div>
        <div className="flex flex-col gap-3">
          <VoiceNoteButton from="Fen Orlo, route driver" n={lastN + 1} at={lastAt} onEvent={(e) => setPending((p) => [...p, e])} />
          <CallDrawer
            request={{ mode: "demo", purpose: "call", caseId: view.id, calleeRole: "recipient", calleeName: "Elva Kesh", brief: caseText.slice(-600), goal: "Get the driver through the gate without asking for any code.", questions: ["Can you buzz the driver in or come down to the gate now?"] }}
            state={{ caseId: view.id, mode: "demo", source: "live_human", caseText, calleeName: "Elva Kesh", startN: lastN + 1, at: lastAt }}
            onDone={(r) => setPending((p) => [...p, ...r.events])}
          />
          {card && (
            <ApproveByVoice card={card} caseId={view.id} caseText={caseText} managerName="Oriol" startN={lastN + 1} at={lastAt}
              onDecision={setDecision} onEvents={(events) => setPending((p) => [...p, ...events])} />
          )}
        </div>
      </section>
    </main>
  );
}
