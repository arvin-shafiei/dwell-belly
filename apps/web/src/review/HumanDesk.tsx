"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { deadlineLabel } from "./model";
import type { ReviewTask } from "./types";
import { useReviewQueue } from "./useReviewQueue";
import "./review.css";

type Source = "agent" | "simulation";
type Filter = "pending" | "decisions" | "all";

function Status({ task, now }: { task: ReviewTask; now: number }) {
  const overdue = task.status === "pending" && now > Date.parse(task.deadlineAt);
  return <span className={`review-status ${overdue ? "overdue" : task.status === "pending" ? "waiting" : "recorded"}`}>{deadlineLabel(task, now)}</span>;
}

function CaseDetail({ task, now, onDecide }: {
  task: ReviewTask; now: number; onDecide: (task: ReviewTask, optionId: string, who: string, note: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState("");
  const [who, setWho] = useState(() => {
    try { return localStorage.getItem("rivet-reviewer") ?? ""; } catch { return ""; }
  });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const option = task.options.find((o) => o.id === selected);
  const readonly = task.mode === "reality";
  const canDecide = task.status === "pending" && !readonly;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!option || !who.trim() || saving) return;
    setSaving(true); setError(null);
    try {
      await onDecide(task, option.id, who.trim(), note.trim());
      try { localStorage.setItem("rivet-reviewer", who.trim()); } catch { /* approval still succeeds */ }
      setSuccess(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Your decision was not saved"); }
    finally { setSaving(false); }
  }
  return (
    <article className="review-detail" aria-label="Decision card">
      <header className="review-case-heading">
        <div className="review-eyebrow"><span>{task.caseId}</span><span className={task.simulated ? "review-sim-label" : "review-agent-label"}>{task.simulated ? "Simulated" : `${task.mode} case · agent`}</span></div>
        <h2>{task.title}</h2>
        <div className="review-case-meta"><span>Routed to <strong>{task.routeTo.replaceAll("_", " ")}</strong></span><Status task={task} now={now} /></div>
      </header>

      <section className="review-brief">
        <div className="review-section-label">The handover</div>
        <p className="review-summary">{task.summary}</p>
        <p className="review-muted">{task.mustDecide}</p>
      </section>

      {task.evidence.length > 0 && <section className="review-key-evidence"><h3>Evidence behind the decision</h3>{task.evidence.map((item, i) => <div key={i}><div><strong>{item.who}</strong><span>{item.basis.replaceAll("_", " ")}</span></div><p>{item.says}</p></div>)}</section>}

      <div className="review-evidence-grid">
        <section className={`review-evidence ${task.clash ? "has-clash" : ""}`}>
          <h3>{task.clash ? "Stories do not agree" : "No clash reported"}</h3>
          <p>{task.clash ?? "The agent did not report conflicting evidence. The decision still needs a person."}</p>
        </section>
        <section className="review-evidence">
          <h3>What would settle it</h3>
          <p>{task.wouldChangeMyMind || "The agent did not specify the missing fact. Check with the owning team before choosing."}</p>
        </section>
      </div>

      <section className="review-tried">
        <h3>Before the handover</h3>
        {task.tried.length ? <ul>{task.tried.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p className="review-muted">No prior attempts were listed on this card.</p>}
      </section>

      {task.decision ? (
        <section className="review-confirmation" role="status">
          <div className="review-section-label">{task.decision.execution === "simulation" ? "Applied to simulation" : "Decision recorded · action pending"}</div>
          <h3>{task.decision.optionLabel}</h3>
          <p>Chosen by {task.decision.who}{task.decision.note ? `: ${task.decision.note}` : ""}</p>
          {task.decision.execution === "pending" && <p>The owning team has not confirmed execution. This decision is saved for handover.</p>}
        </section>
      ) : (
        <form className="review-choice" onSubmit={submit}>
          <div className="review-choice-heading"><h3>Your decision</h3>{task.risk !== null && <span className="review-risk">Gate risk {Math.round(task.risk * 100)}%</span>}</div>
          {readonly && <p className="review-readonly">Reality Test results are read-only. This card is shown as evidence.</p>}
          <fieldset disabled={!canDecide || saving || success}>
            <legend className="sr-only">Choose a next step</legend>
            {task.options.map((o, i) => (
              <label key={o.id} className={`review-option ${selected === o.id ? "selected" : ""}`}>
                <input type="radio" name={`decision-${task.id}`} value={o.id} checked={selected === o.id} onChange={() => setSelected(o.id)} />
                <span className="review-option-number">{String(i + 1).padStart(2, "0")}</span>
                <span className="review-option-copy"><strong>{o.label}</strong><small>{o.effect || (o.undoable ? "Marked undoable by the agent" : "Requires your authority to proceed")}</small></span>
                <span className="review-radio" aria-hidden="true" />
              </label>
            ))}
          </fieldset>
          {!task.options.length && <p className="review-readonly">The agent supplied no decision options. Keep the case on hold and ask {task.routeTo} to decide.</p>}
          {canDecide && task.options.length > 0 && !success && <>
            <div className="review-inputs">
              <label>Your name<input value={who} onChange={(e) => setWho(e.target.value)} maxLength={120} autoComplete="name" placeholder="Who is deciding?" required disabled={saving} /></label>
              <label>Handover note <span>(optional)</span><textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={2} placeholder="Add context for the next person" disabled={saving} /></label>
            </div>
            {option && <p className="review-confirm-copy">You are choosing <strong>{option.label}</strong>. {task.origin === "city" ? "This updates the simulation." : "Your decision will be saved; execution remains with the owning team."}</p>}
            <button className="review-primary" disabled={!option || !who.trim() || saving} type="submit">{saving ? "Recording decision…" : task.origin === "city" ? "Apply to simulation" : "Record decision"}<span aria-hidden="true">↗</span></button>
          </>}
          {error && <p className="review-error" role="alert">{error}</p>}
          {success && !task.decision && <p className="review-confirmation" role="status">Decision accepted. Waiting for the case to update.</p>}
        </form>
      )}

      <section className="review-fallback">
        <div className="review-section-label">If nobody answers</div>
        <p>{task.fallback}</p>
        {task.status === "pending" && now > Date.parse(task.deadlineAt) && <small>{task.simulated ? "The simulation applies its configured fallback when its clock advances." : "The deadline has passed. Ask the owning lead to review this fallback; no action is reported as completed."}</small>}
      </section>

      {task.messages.length > 0 && <details className="review-history"><summary>Messages and held actions <span>{task.messages.length}</span></summary><div>{task.messages.map((message, i) => <section key={i}><div className="review-message-meta">{message.channel} → {message.from}<span>{message.status?.replaceAll("_", " ")}</span></div><p>{message.body}</p>{message.note && <small>{message.note}</small>}</section>)}</div></details>}
      <details className="review-history"><summary>Agent history <span>{task.timeline.length} steps</span></summary><ol>{task.timeline.map((step, i) => <li key={i}><span>{step.node.replaceAll("_", " ")}</span><p>{step.summary}</p></li>)}</ol></details>
      <footer className="review-detail-footer"><span>{task.simulated ? "Estimated simulation cost" : "Recorded agent cost"}: {task.costUsd === null ? "unavailable" : `$${task.costUsd.toFixed(4)}`}</span>{task.durationMs !== null && <span>{(task.durationMs / 1000).toFixed(1)}s processing</span>}</footer>
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
    (!team || t.routeTo === team) && `${t.title} ${t.caseId} ${t.summary} ${t.routeTo}`.toLowerCase().includes(search.toLowerCase()));
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
    await decide(task, option, who, note);
    setFilter("decisions"); setSelectedId(task.id);
  }
  return (
    <div className={`review-desk ${embedded ? "review-embedded" : ""}`}>
      <header className="review-topbar">
        <Link href="/" className="review-brand" aria-label="Rivet operations console"><span className="review-brand-mark">R</span><span>Rivet<span className="review-brand-sub">Operations desk</span></span></Link>
        <nav aria-label="View navigation"><Link href="/?tab=workflows" onClick={onClose}>Workflows</Link><Link href="/city" target={embedded ? "_blank" : undefined}>City simulation</Link><span aria-current="page">Human review</span></nav>
        {onClose ? <button onClick={onClose} className="review-close" aria-label="Close human review">×</button> : <span className="review-connection"><i />Queue updates automatically</span>}
      </header>
      <div className="review-page-heading">
        <div><div className="review-eyebrow">The agent pauses. You decide.</div><h1>Human review <span>{pending.length}</span></h1><p>Cases that need your judgement before the next step.</p></div>
        <div className="review-source-switch" aria-label="Case source">{(["agent", "simulation"] as const).map((value) => <button key={value} className={source === value ? "active" : ""} aria-pressed={source === value} onClick={() => { setSource(value); setTeam(""); setSelectedId(""); }}>{value === "agent" ? "Agent cases" : "Simulation"}</button>)}</div>
      </div>
      {source === "simulation" && <div className="review-simulation-banner">SIMULATED <span>Choices apply to the city demo. Keep the simulation open in this browser.</span></div>}
      {error && <div className="review-error-banner" role="alert">{error}<button type="button" onClick={() => void refresh()}>Try again</button></div>}
      {warnings.length > 0 && <details className="review-warnings"><summary>{warnings.length} trace{warnings.length === 1 ? "" : "s"} could not be read</summary>{warnings.map((w, i) => <p key={i}>{w}</p>)}</details>}
      <div className="review-layout">
        <aside className="review-queue" aria-label="Human intervention queue">
          <div className="review-queue-toolbar"><span>{overdue ? `${overdue} overdue · review first` : "Sorted by urgency, then deadline"}</span><button onClick={() => void refresh()} aria-label="Refresh queue" title="Refresh queue">↻</button></div>
          <div className="review-filters" aria-label="Queue status">{(["pending", "decisions", "all"] as const).map((value) => <button key={value} onClick={() => { setFilter(value); setSelectedId(""); }} aria-pressed={filter === value} className={filter === value ? "active" : ""}>{value === "pending" ? "Needs decision" : value === "decisions" ? "Decisions" : "All"}{value === "pending" && <span>{pending.length}</span>}</button>)}</div>
          <label className="review-search"><span className="sr-only">Search cases</span><span aria-hidden="true">⌕</span><input type="search" placeholder="Search a case, team or issue" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
          {teams.length > 0 && <div className="review-team-filters" aria-label="Responsible team"><button aria-pressed={!team} onClick={() => setTeam("")}>All teams</button>{teams.map((name) => <button key={name} aria-pressed={team === name} onClick={() => setTeam(name)}>{name.replaceAll("_", " ")}</button>)}</div>}
          <div className="review-case-list">
            {loading && !tasks.length ? <div className="review-empty" role="status">Loading decision cards…</div> : shown.length ? shown.map((task) => <button key={task.id} className={`review-case-row ${selected?.id === task.id ? "selected" : ""}`} onClick={() => selectTask(task)} aria-pressed={selected?.id === task.id}>
              <div className="review-row-top"><span className="review-case-id">{task.caseId}</span><span className={`review-priority ${task.urgency}`}>{task.urgency === "high" ? "Urgent" : task.urgency === "low" ? "Low" : "Review"}</span></div>
              <h3>{task.title}</h3><p>{task.mustDecide || task.summary}</p>
              <div className="review-row-footer"><span>{task.routeTo.replaceAll("_", " ")}</span><Status task={task} now={now} /></div>
              {task.clash && <div className="review-clash-tag">Conflicting evidence</div>}
            </button>) : <div className="review-empty"><span className="review-empty-mark" aria-hidden="true">✓</span><h3>{search || team ? "No matching cases" : filter === "pending" ? "No decisions waiting" : "No recorded decisions"}</h3><p>{search || team ? "Try another search or team." : source === "simulation" ? "Open the city and run a scenario. Cases held at the human decision step appear here." : "Held cases appear here when the agent or batch runner saves a decision card."}</p>{source === "simulation" && <Link href="/city" target="_blank">Open city simulation ↗</Link>}</div>}
          </div>
          <div className="review-queue-footer">{source === "simulation" ? "Simulation decisions stay separate from agent results" : "Original answer files stay unchanged"}</div>
        </aside>
        <div className="review-detail-wrap" ref={detailRef}>{selected ? <CaseDetail key={selected.id} task={selected} now={now} onDecide={apply} /> : <div className="review-detail-empty"><div className="review-hold-symbol" aria-hidden="true">Ⅱ</div><h2>A clear handover, when it matters.</h2><p>The agent brings the context. You choose the next step.</p><div><span>Who owns it</span><span>What conflicts</span><span>What happens next</span></div></div>}</div>
      </div>
    </div>
  );
}
