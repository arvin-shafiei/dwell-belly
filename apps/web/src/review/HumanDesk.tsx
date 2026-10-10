"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { decisionRerunBody, type DecisionRerunBody } from "../console/decisionRerun";
import { useDecisionRerun } from "../console/useDecisionRerun";
import { cents, plainOwner, plainStep, riskWord, scrubLeaks } from "../ui/plain";
import { deadlineLabel, keyEvidence, shortLine } from "./model";
import RerunStatus from "./RerunStatus";
import type { ReviewTask } from "./types";
import { useReviewQueue } from "./useReviewQueue";
import "./review.css";

type Source = "agent" | "simulation";
type Filter = "pending" | "decisions" | "all";

const MESSAGE_STATUS: Record<string, string> = { outbox_recorded: "Sent", proposed: "Planned", held: "Held", blocked: "Stopped", sent: "Sent" };

function Status({ task, now }: { task: ReviewTask; now: number }) {
  const overdue = task.status === "pending" && now > Date.parse(task.deadlineAt);
  const label = task.status === "pending" ? deadlineLabel(task, now).replace(/m overdue$/, " min late").replace(/m left$/, " min left") : task.status === "resolved" ? "Done in the city" : "Decided";
  return <span className={`review-status ${overdue ? "overdue" : task.status === "pending" ? "waiting" : "recorded"}`}>{label}</span>;
}

function CaseDetail({ task, now, onDecide }: {
  task: ReviewTask; now: number; onDecide: (task: ReviewTask, optionId: string, who: string, note: string) => Promise<ReviewTask | null>;
}) {
  const [selected, setSelected] = useState("");
  const [who, setWho] = useState(() => {
    try { return localStorage.getItem("rivet-reviewer") ?? ""; } catch { return ""; }
  });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // After a live card is saved, the case is run again by the agent with this choice (send once).
  const rerun = useDecisionRerun();
  const rerunBody = useRef<DecisionRerunBody | null>(null);
  const option = task.options.find((o) => o.id === selected);
  const readonly = task.mode === "reality";
  const canDecide = task.status === "pending" && !readonly;
  const overdue = task.status === "pending" && now > Date.parse(task.deadlineAt);
  const owner = plainOwner(task.routeTo);
  const reason = shortLine(task.mustDecide) || "Choose what happens next.";
  const evidence = keyEvidence(task);
  const steps = task.timeline.map((s) => plainStep(s.node, s.summary)).filter((s): s is string => Boolean(s));
  const risk = riskWord(task.risk);
  const cost = cents(task.costUsd);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!option || !who.trim() || saving) return;
    setSaving(true); setError(null);
    try {
      const saved = await onDecide(task, option.id, who.trim(), note.trim());
      try { localStorage.setItem("rivet-reviewer", who.trim()); } catch { /* approval still succeeds */ }
      setSuccess(true);
      const executionId = saved?.executionId ?? task.executionId;
      if (saved && executionId) {
        rerunBody.current = decisionRerunBody({ parentExecutionId: executionId, option, person: who });
        void rerun.run(rerunBody.current, option);
      }
    } catch (e) { setError(scrubLeaks(e instanceof Error ? e.message : "") || "Your decision wasn't saved. Try again."); }
    finally { setSaving(false); }
  }
  const retry = () => { if (rerunBody.current) void rerun.run(rerunBody.current); };
  return (
    <article className="review-detail" aria-label="A person needs to decide">
      <header className="review-case-heading">
        <div className="review-caption"><span>{task.caseId}</span><span className="review-tag">{task.simulated ? "Practice case" : "Live"}</span></div>
        <h2>{scrubLeaks(task.title) || "Case"}</h2>
        <div className="review-case-meta"><span>For <strong>{owner}</strong></span><Status task={task} now={now} /></div>
      </header>

      {task.decision ? (
        <section className="review-confirmation" role="status">
          <div className="review-label">{task.decision.execution === "simulation" ? "Done in the city" : "Decision saved"}</div>
          <h3>{task.decision.optionLabel}</h3>
          <p>By {task.decision.who}{task.decision.note ? `: ${task.decision.note}` : ""}</p>
          {task.decision.execution === "pending" && rerun.state.phase === "idle" && <p className="review-muted">{owner} will carry it out.</p>}
          <RerunStatus state={rerun.state} onRetry={retry} />
        </section>
      ) : (
        <form className="review-choice" onSubmit={submit}>
          <div className="review-label">A person needs to decide</div>
          <p className="review-reason">{reason}</p>
          {evidence.length > 0 && <ul className="review-evidence">{evidence.map((line, i) => <li key={i}>{line}</li>)}</ul>}
          {overdue && <p className="review-late">This is late. If nobody decides: {shortLine(task.fallback, 12)}</p>}
          {readonly && <p className="review-readonly">Test day result. View only.</p>}
          <fieldset disabled={!canDecide || saving || success}>
            <legend className="sr-only">Choose what happens next</legend>
            {task.options.map((o) => {
              const sub = shortLine(o.effect, 12);
              return (
                <label key={o.id} className={`review-option ${selected === o.id ? "selected" : ""}`}>
                  <input type="radio" name={`decision-${task.id}`} value={o.id} checked={selected === o.id} onChange={() => setSelected(o.id)} />
                  <span className="review-option-copy"><strong>{o.label}</strong>{sub ? <small>{sub}</small> : o.undoable && <small>Can be undone</small>}</span>
                </label>
              );
            })}
          </fieldset>
          {!task.options.length && <p className="review-readonly">No choices here. Keep it on hold and ask {owner}.</p>}
          {canDecide && task.options.length > 0 && !success && <>
            <div className="review-inputs">
              <label>Your name<input value={who} onChange={(e) => setWho(e.target.value)} maxLength={120} autoComplete="name" placeholder="Your name" required disabled={saving} /></label>
              <label>Note <span>(optional)</span><textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={1} placeholder="Anything the next person should know" disabled={saving} /></label>
            </div>
            <button className="review-primary" disabled={!option || !who.trim() || saving} type="submit">{saving ? "Saving…" : !option ? "Pick one above" : task.origin === "city" ? "Do it in the city" : "Save decision"}</button>
          </>}
          {error && <p className="review-error" role="alert">{error}</p>}
          {success && !task.decision && <p className="review-confirmation" role="status">Saved. Updating…</p>}
          {!task.decision && <RerunStatus state={rerun.state} onRetry={retry} />}
        </form>
      )}

      <details className="review-more">
        <summary>Details</summary>
        <div className="review-more-body">
          {shortLine(task.summary, 40) && <section><h4>What happened</h4><p>{shortLine(task.summary, 40)}</p></section>}
          {task.evidence.length > 0 && <section><h4>What people said</h4><ul>{task.evidence.map((e, i) => <li key={i}><strong>{scrubLeaks(e.who)}:</strong> {scrubLeaks(e.says)}</li>)}</ul></section>}
          {task.clash && <section><h4>The stories don&apos;t match</h4><p>{scrubLeaks(task.clash)}</p></section>}
          {scrubLeaks(task.wouldChangeMyMind) && <section><h4>What would settle it</h4><p>{scrubLeaks(task.wouldChangeMyMind)}</p></section>}
          {task.tried.length > 0 && <section><h4>Already done</h4><ul>{task.tried.map((item, i) => scrubLeaks(item) && <li key={i}>{shortLine(item, 20)}</li>)}</ul></section>}
          <section><h4>If nobody decides</h4><p>{scrubLeaks(task.fallback)}</p></section>
          {task.messages.length > 0 && <section><h4>Messages</h4>{task.messages.map((m, i) => <div key={i} className="review-message"><div className="review-caption"><span>To {scrubLeaks(m.from) || "someone"}{m.channel ? ` · ${scrubLeaks(m.channel)}` : ""}</span>{m.status && <span>{MESSAGE_STATUS[m.status] ?? scrubLeaks(m.status)}</span>}</div><p>{m.body}</p></div>)}</section>}
          {steps.length > 0 && <section><h4>Steps</h4><ol>{steps.map((s, i) => <li key={i}>{s}</li>)}</ol></section>}
          {(risk || cost || task.durationMs !== null) && <p className="review-caption">{[risk && `Risk: ${risk}`, cost, task.durationMs !== null && `${(task.durationMs / 1000).toFixed(1)}s`].filter(Boolean).join(" · ")}</p>}
        </div>
      </details>
    </article>
  );
}

export default function HumanDesk({ embedded = false, onClose, initialTaskId = "", initialSource = "agent" }: {
  embedded?: boolean; onClose?: () => void; initialTaskId?: string; initialSource?: Source;
}) {
  const { tasks, warnings, loading, error, now, refresh, decide } = useReviewQueue();
  const [source, setSource] = useState<Source>(initialSource);
  const [filter, setFilter] = useState<Filter>("pending");
  const [team, setTeam] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(initialTaskId);
  const detailRef = useRef<HTMLDivElement>(null);
  const sourceTasks = tasks.filter((t) => source === "simulation" ? t.simulated : !t.simulated);
  const pending = sourceTasks.filter((t) => t.status === "pending");
  const overdue = pending.filter((t) => now > Date.parse(t.deadlineAt)).length;
  const teams = [...new Set(sourceTasks.map((t) => t.routeTo))].sort();
  const shown = sourceTasks.filter((t) =>
    (filter === "all" || (filter === "pending" ? t.status === "pending" : t.status !== "pending")) &&
    (!team || t.routeTo === team) && `${t.title} ${t.caseId} ${t.summary} ${t.routeTo} ${plainOwner(t.routeTo)}`.toLowerCase().includes(search.toLowerCase()));
  const selected = shown.find((t) => t.id === selectedId || t.caseId === selectedId) ?? shown[0];
  function selectTask(task: ReviewTask) {
    setSelectedId(task.id);
    if (window.matchMedia("(max-width: 760px)").matches) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    if (!embedded) {
      const url = new URL(window.location.href);
      url.searchParams.set("case", task.id); url.searchParams.set("source", source);
      window.history.replaceState(null, "", url);
    }
  }
  async function apply(task: ReviewTask, option: string, who: string, note: string) {
    const saved = await decide(task, option, who, note);
    setFilter("decisions"); setSelectedId(task.id);
    return saved;
  }
  return (
    <div className={`review-desk ${embedded ? "review-embedded" : ""}`}>
      <header className="review-topbar">
        <Link href="/" className="review-brand" aria-label="Rivet home"><span className="review-brand-mark">R</span>Rivet</Link>
        <nav aria-label="Pages"><Link href="/?tab=workflows" onClick={onClose}>Playbooks</Link><Link href="/city" target={embedded ? "_blank" : undefined}>City</Link><span aria-current="page">Decisions</span></nav>
        {onClose && <button onClick={onClose} className="review-close" aria-label="Close decisions">×</button>}
      </header>
      <div className="review-page-heading">
        <div><h1>Decisions</h1><p><strong>{pending.length}</strong> waiting for a person{overdue > 0 && <span className="review-late-count"> · {overdue} late</span>}</p></div>
        <div className="review-source-switch" aria-label="Which cases">{(["agent", "simulation"] as const).map((value) => <button key={value} className={source === value ? "active" : ""} aria-pressed={source === value} onClick={() => { setSource(value); setTeam(""); setSelectedId(""); }}>{value === "agent" ? "Live" : "Practice cases"}</button>)}</div>
      </div>
      {source === "simulation" && <p className="review-note">Practice cases come from the city. Keep the city open.</p>}
      {error && <div className="review-error-banner" role="alert">{scrubLeaks(error) || "Couldn't load the cases."}<button type="button" onClick={() => void refresh()}>Try again</button></div>}
      {warnings.length > 0 && <p className="review-note">Some cases couldn&apos;t load.</p>}
      <div className="review-layout">
        <aside className="review-queue" aria-label="Cases">
          <div className="review-filters" aria-label="Show">
            {(["pending", "decisions", "all"] as const).map((value) => <button key={value} onClick={() => { setFilter(value); setSelectedId(""); }} aria-pressed={filter === value} className={filter === value ? "active" : ""}>{value === "pending" ? "Waiting" : value === "decisions" ? "Decided" : "All"}</button>)}
            <button className="review-refresh" onClick={() => void refresh()} aria-label="Refresh" title="Refresh">↻</button>
          </div>
          <label className="review-search"><span className="sr-only">Search cases</span><input type="search" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
          {teams.length > 1 && <div className="review-team-filters" aria-label="Who decides"><button aria-pressed={!team} onClick={() => setTeam("")}>Everyone</button>{teams.map((name) => <button key={name} aria-pressed={team === name} onClick={() => setTeam(name)}>{plainOwner(name)}</button>)}</div>}
          <div className="review-case-list">
            {loading && !tasks.length ? <div className="review-empty" role="status">Loading…</div> : shown.length ? shown.map((task) => <button key={task.id} className={`review-case-row ${selected?.id === task.id ? "selected" : ""}`} onClick={() => selectTask(task)} aria-pressed={selected?.id === task.id}>
              <div className="review-row-top"><h3>{scrubLeaks(task.title) || task.caseId}</h3>{task.urgency === "high" && task.status === "pending" && <span className="review-priority">Urgent</span>}</div>
              <div className="review-row-footer"><span>{plainOwner(task.routeTo)}</span><Status task={task} now={now} /></div>
            </button>) : <div className="review-empty"><h3>{search || team ? "No matches" : filter === "pending" ? "Nothing to decide" : "No decisions yet"}</h3>{!search && !team && source === "simulation" && filter === "pending" && <Link href="/city" target="_blank">Open the city</Link>}</div>}
          </div>
        </aside>
        <div className="review-detail-wrap" ref={detailRef}>{selected ? <CaseDetail key={selected.id} task={selected} now={now} onDecide={apply} /> : <div className="review-detail-empty"><h2>Nothing to decide</h2><p>Cases that need a person show up here.</p></div>}</div>
      </div>
    </div>
  );
}
