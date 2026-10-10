"use client";
// Test panel: run a workflow version over a scenario set (real agent + real judge), watch cases
// land live, paint a case's path on the canvas, ask the Architect to improve from the failures,
// keep versions, and see the learning curve. Every number here comes from the test-run API.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Flow, ImproveProposal, ScenarioSetId, TestRun, TestRunCase, WorkflowVersion } from "../types";
import { Icon } from "./icons";
import { Badge, Btn, SectionLabel } from "./bits";
import {
  cancelTestRun, createVersion, getTestRun, improveFlow, listCases, listScenarioSets, listTestRuns, listVersions,
  startTestRun, type ScenarioSetInfo, type TestRunBody,
} from "./api";
import {
  AUTO_MAX_ITERATIONS, MAX_MISSES, POLL_MS, autoNext, autoStart, costPerCase, initialPoll, latestVersion,
  learningCurve, passRate, pollReducer, retestBody, type AutoState,
} from "./testing";
import { LearningCurve } from "./LearningCurve";
import { Sparkle } from "./ArchitectPanel";
import { fmtMs, fmtUsd } from "./status";

const FALLBACK_SETS: ScenarioSetInfo[] = [
  { id: "quick", label: "Quick 5", count: 5 },
  { id: "fixtures", label: "Edge-case fixtures", count: 12 },
  { id: "adversarial", label: "Adversarial", count: 0 },
  { id: "generated", label: "Generated", count: 0 },
  { id: "custom", label: "Custom", count: 0 },
];

type RunSummary = Omit<TestRun, "cases">;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pct = (r: number) => `${Math.round(r * 100)}%`;

export function RealBadge() {
  return (
    <span title="Run by the real agent API and scored by the eval judge (scripts/eval/score.mjs)">
      <Badge tone="green">REAL</Badge>
    </span>
  );
}

function CaseRow({ c, selected, onClick }: { c: TestRunCase; selected: boolean; onClick: () => void }) {
  const icon =
    c.status === "queued" ? <span className="block h-3.5 w-3.5 rounded-full border-2 border-white/20" title="queued" />
      : c.status === "running" ? <span className="wf-spin block h-3.5 w-3.5 rounded-full border-2 border-[#ff6a1a] border-t-transparent" title="running" />
      : c.status === "passed" ? <span className="grid h-4 w-4 place-items-center rounded-full bg-[#22c55e] text-[#0b1f12]" title="passed"><Icon name="check" size={11} strokeWidth={3.2} /></span>
      : c.status === "failed" ? <span className="text-[#ef4444]" title="failed"><Icon name="x_circle" size={17} strokeWidth={2.2} /></span>
      : <span className="text-[#fbbf24]" title="error"><Icon name="minus_circle" size={17} strokeWidth={2.2} /></span>;
  const done = c.status === "passed" || c.status === "failed" || c.status === "error";
  return (
    <button
      type="button" onClick={onClick} disabled={!c.executionId}
      title={c.executionId ? "Show this case's path on the canvas" : "No execution recorded yet"}
      className={`block w-full rounded-md border px-2.5 py-2 text-left transition-colors ${selected ? "border-[#ff6a1a]/60 bg-[#ff6a1a]/10" : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]"} disabled:cursor-default`}
    >
      <div className="flex items-center gap-2">
        <span className="shrink-0">{icon}</span>
        <code className="min-w-0 flex-1 truncate text-[12px] text-white/90">{c.caseId}</code>
        <span className="text-[10px] text-white/35">{c.dataset}</span>
        {c.score !== null && (
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${c.status === "passed" ? "bg-[#22c55e]/15 text-[#4ade80]" : "bg-[#ef4444]/15 text-[#f87171]"}`}>
            {c.score.toFixed(2)}
          </span>
        )}
      </div>
      {done && (
        <div className="mt-1.5 space-y-0.5 pl-6 text-[11px] leading-snug">
          {c.expected && <div className="text-white/50"><span className="text-white/30">expected </span>{c.expected}</div>}
          {c.got && <div className={c.status === "passed" ? "text-white/70" : "text-[#fca5a5]"}><span className="text-white/30">got </span>{c.got}</div>}
          {c.mustNotBroken.map((m) => <div key={m} className="font-medium text-[#f87171]">✗ broke must-not: {m}</div>)}
          {c.verdict && <div className="italic text-white/45">{c.verdict}</div>}
          <div className="tabular-nums text-white/35">{fmtUsd(c.costUsd)} · {fmtMs(c.durationMs)}</div>
        </div>
      )}
    </button>
  );
}

function ConfirmAuto({ cases, perCase, onGo, onCancel }: { cases: number; perCase: number | null; onGo: () => void; onCancel: () => void }) {
  const runs = AUTO_MAX_ITERATIONS + 1;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onMouseDown={onCancel}>
      <div role="dialog" aria-label="Auto-improve" className="w-full max-w-[440px] rounded-xl border border-white/10 bg-[#222227] p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 text-[15px] font-semibold text-white"><span className="text-[#c4b5fd]"><Sparkle size={16} /></span> Auto-improve ×{AUTO_MAX_ITERATIONS}</div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-white/70">
          Runs test → improve → accept → re-test, up to {AUTO_MAX_ITERATIONS} times, and stops early when the pass rate stops rising.
          Each accepted proposal is saved as a new version.
        </p>
        <div className="mt-3 rounded-md border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-3 py-2.5 text-[12px] leading-relaxed text-[#fcd34d]">
          This spends real model money: up to {runs} test runs × {cases} case{cases === 1 ? "" : "s"} = {runs * cases} agent runs, plus {AUTO_MAX_ITERATIONS} Architect calls.
          {perCase !== null
            ? <> At {fmtUsd(perCase)} per case from earlier runs, budget about <b>{fmtUsd(perCase * cases * runs)}</b> plus the Architect.</>
            : <> No earlier runs to estimate from yet.</>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Btn onClick={onCancel}>Cancel</Btn>
          <Btn variant="primary" onClick={onGo}><Sparkle size={12} /> Start</Btn>
        </div>
      </div>
    </div>
  );
}

export function TestPanel({ workflowId, blocked, hint, selectedExecId, onShowExecution, onProposal, onLoadVersion, onMakeCurrent, versionsTick, onClose }: {
  workflowId: string | null;
  /** Why testing is unavailable right now (draft, unsaved changes), or null. */
  blocked: string | null;
  selectedExecId: string | null;
  onShowExecution: (id: string | null) => void;
  /** Show (or clear) a proposal as a diff against `base` on the canvas. */
  onProposal: (p: { proposal: ImproveProposal; base: Flow | null } | null) => void;
  /** Soft warning shown above the controls (e.g. unsaved canvas edits). */
  hint?: string | null;
  onLoadVersion: (v: WorkflowVersion) => void;
  /** Make a version the workflow Execute uses (PUT the workflow). */
  onMakeCurrent: (v: WorkflowVersion) => Promise<boolean>;
  /** Bumped when the editor saved a new version. */
  versionsTick?: number;
  onClose: () => void;
}) {
  const [sets, setSets] = useState<ScenarioSetInfo[]>(FALLBACK_SETS);
  const [setsNote, setSetsNote] = useState<string | null>(null);
  const [setId, setSetId] = useState<ScenarioSetId>("quick");
  const [filter, setFilter] = useState("");
  const [limit, setLimit] = useState(5);
  const [custom, setCustom] = useState<string[]>([]);
  const [caseQ, setCaseQ] = useState("");
  const [caseHits, setCaseHits] = useState<{ id: string; dataset: string; title: string | null }[]>([]);

  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [version, setVersion] = useState<number | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [poll, dispatch] = useReducer(pollReducer, initialPoll);
  const [proposal, setProposal] = useState<ImproveProposal | null>(null);
  const [improving, setImproving] = useState(false);
  const [busyMsg, setBusyMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<{ version: number; run: TestRun } | null>(null);
  const [auto, setAuto] = useState<AutoState | null>(null);
  const [confirmAuto, setConfirmAuto] = useState(false);
  const cancelRef = useRef(false);
  const stopAutoRef = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; cancelRef.current = true; stopAutoRef.current = true; }; }, []);

  const run = poll.run;
  const running = poll.phase === "starting" || poll.phase === "polling";
  const autoRunning = !!auto && auto.step !== "stopped";
  const set = sets.find((s) => s.id === setId);
  const perCase = useMemo(() => costPerCase(runs), [runs]);
  const curve = useMemo(() => learningCurve(runs), [runs]);
  const caseCount = setId === "custom" ? custom.length : Math.min(limit, set?.count || limit);

  // ---- loading
  useEffect(() => {
    let live = true;
    listScenarioSets().then((r) => {
      if (!live) return;
      if (r.ok && r.data?.sets?.length) { setSets(r.data.sets); setSetsNote(null); }
      else setSetsNote(r.ok ? "No scenario sets listed." : r.status === 404 ? "Test routes are not available yet (404)." : `Could not load scenario sets: ${r.error}`);
    });
    return () => { live = false; };
  }, []);

  const refreshVersions = useCallback(async (select?: number) => {
    if (!workflowId) return [] as WorkflowVersion[];
    const r = await listVersions(workflowId);
    const vs = r.ok ? [...(r.data?.versions ?? [])].sort((a, b) => b.version - a.version) : [];
    if (!alive.current) return vs;
    setVersions(vs);
    setVersion((cur) => select ?? (cur !== null && vs.some((v) => v.version === cur) ? cur : latestVersion(vs)?.version ?? null));
    return vs;
  }, [workflowId]);

  const refreshRuns = useCallback(async () => {
    if (!workflowId) return;
    const r = await listTestRuns(workflowId);
    if (alive.current && r.ok) setRuns(r.data?.testRuns ?? []);
  }, [workflowId]);

  useEffect(() => {
    let live = true;
    if (!workflowId) return;
    Promise.all([listVersions(workflowId), listTestRuns(workflowId)]).then(([v, t]) => {
      if (!live) return;
      const vs = v.ok ? [...(v.data?.versions ?? [])].sort((a, b) => b.version - a.version) : [];
      setVersions(vs);
      setVersion(latestVersion(vs)?.version ?? null);
      setRuns(t.ok ? t.data?.testRuns ?? [] : []);
    });
    return () => { live = false; };
  }, [workflowId]);

  useEffect(() => {
    if (!versionsTick) return;
    const t = setTimeout(() => { void refreshVersions(); }, 0);
    return () => clearTimeout(t);
  }, [versionsTick, refreshVersions]);

  useEffect(() => {
    if (setId !== "custom") return;
    let live = true;
    const t = setTimeout(() => {
      listCases(caseQ).then((r) => { if (live) setCaseHits(r.ok ? (r.data?.cases ?? []).slice(0, 40) : []); });
    }, caseQ ? 200 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [setId, caseQ]);

  // ---- running a test to completion (shared by the button and the auto loop)
  const runTest = useCallback(async (body: TestRunBody): Promise<TestRun | null> => {
    cancelRef.current = false;
    setError(null);
    setAccepted(null);
    dispatch({ type: "start" });
    const r = await startTestRun(body);
    if (!r.ok || !r.data?.testRun) {
      const msg = r.ok ? "The API returned no test run." : r.status === 404 ? "Test runs are not available yet (404)." : `Could not start the test: ${r.error}`;
      dispatch({ type: "start_failed", error: msg });
      return null;
    }
    let tr = r.data.testRun;
    dispatch({ type: "started", run: tr });
    let misses = 0;
    while (tr.status === "running") {
      await sleep(POLL_MS);
      if (cancelRef.current || !alive.current) return null;
      const g = await getTestRun(tr.id);
      if (g.ok && g.data?.testRun) {
        tr = g.data.testRun;
        misses = 0;
        dispatch({ type: "poll_ok", run: tr });
      } else {
        misses += 1;
        dispatch({ type: "poll_failed", error: g.ok ? "empty answer" : g.error, status: g.ok ? 200 : g.status });
        if ((!g.ok && g.status === 404) || misses >= MAX_MISSES) return null;
      }
    }
    void refreshRuns();
    void refreshVersions();
    return tr;
  }, [refreshRuns, refreshVersions]);

  const body = (): TestRunBody | null => {
    if (!workflowId) return null;
    const b: TestRunBody = { workflowId, set: setId, limit };
    if (version !== null) b.version = version;
    if (filter && set?.filters?.includes(filter)) b.filter = filter;
    if (setId === "custom") { b.caseIds = custom; b.limit = Math.min(20, Math.max(1, custom.length)); }
    return b;
  };

  const cancel = async () => {
    cancelRef.current = true;
    stopAutoRef.current = true;
    dispatch({ type: "cancel" });
    if (run) await cancelTestRun(run.id);
    void refreshRuns();
  };

  // ---- improve
  const improve = useCallback(async (tr: TestRun): Promise<ImproveProposal | null> => {
    if (!workflowId) return null;
    setImproving(true);
    setError(null);
    const r = await improveFlow({ workflowId, testRunId: tr.id });
    setImproving(false);
    if (!r.ok || !r.data?.proposal) {
      setError(r.ok ? "The Architect returned no proposal." : r.status === 404 ? "Improve is not available yet (404)." : `Improve failed: ${r.error}`);
      return null;
    }
    const p = r.data.proposal;
    setProposal(p);
    onProposal({ proposal: p, base: versions.find((v) => v.version === p.fromVersion)?.flow ?? null });
    return p;
  }, [workflowId, versions, onProposal]);

  const accept = useCallback(async (p: ImproveProposal): Promise<WorkflowVersion | null> => {
    if (!workflowId) return null;
    setBusyMsg("Saving the new version…");
    const r = await createVersion(workflowId, {
      flow: p.flow, createdBy: "improve", note: [p.changes.join("; "), p.rationale].filter(Boolean).join(" — ") || null, parentVersion: p.fromVersion,
    });
    setBusyMsg(null);
    if (!r.ok || !r.data?.version) {
      setError(r.ok ? "The API returned no version." : r.status === 404 ? "Versions are not available yet (404)." : `Could not save the version: ${r.error}`);
      return null;
    }
    const v = r.data.version;
    setProposal(null);
    onProposal(null);
    await refreshVersions(v.version);
    // Accepting makes it the workflow Execute and the agent use.
    if (!(await onMakeCurrent(v))) onLoadVersion(v);
    return v;
  }, [workflowId, onProposal, onLoadVersion, onMakeCurrent, refreshVersions]);

  const reject = () => { setProposal(null); onProposal(null); };

  // ---- auto-improve loop
  const autoImprove = async () => {
    setConfirmAuto(false);
    const first = body();
    if (!first || !workflowId) return;
    stopAutoRef.current = false;
    let s = autoStart();
    setAuto(s);
    let next: TestRunBody = first;
    let last: TestRun | null = null;
    let current: ImproveProposal | null = null;
    while (s.step !== "stopped") {
      if (stopAutoRef.current || !alive.current) { s = autoNext(s, { type: "stop" }); break; }
      if (s.step === "test") {
        const tr = await runTest(next);
        s = tr ? autoNext(s, { type: "tested", status: tr.status, summary: tr.summary }) : autoNext(s, { type: "failed", error: "the test run did not finish" });
        if (tr) last = tr;
      } else if (s.step === "improve") {
        current = last ? await improve(last) : null;
        s = current ? autoNext(s, { type: "improved", proposal: current }) : autoNext(s, { type: "failed", error: "no proposal from the Architect" });
        if (s.step === "accept") await sleep(2200); // let the diff sit on the canvas for a moment
      } else if (s.step === "accept") {
        const v = current ? await accept(current) : null;
        s = v && last ? autoNext(s, { type: "accepted", version: v.version }) : autoNext(s, { type: "failed", error: "could not save the new version" });
        if (v && last) next = retestBody(last, v.version);
      }
      if (alive.current) setAuto(s);
    }
    if (alive.current) setAuto(s);
  };

  const retest = async () => {
    if (!accepted) return;
    await runTest(retestBody(accepted.run, accepted.version));
  };

  const failures = run ? run.summary.failed + run.summary.errors : 0;
  const finished = poll.phase === "done" && run;
  const disabled = !!blocked || !workflowId || running || autoRunning || improving || !!proposal;

  return (
    <aside className="flex h-full w-full min-w-0 flex-col bg-[#19191d]">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#22c55e]/15 text-[16px]">🧪</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[14px] font-semibold text-white">Test &amp; improve <RealBadge /></div>
          <div className="truncate text-[11px] text-white/45">Real agent runs, scored by the eval judge.</div>
        </div>
        <button type="button" onClick={onClose} title="Close" className="rounded p-1.5 text-white/45 hover:bg-white/10 hover:text-white"><Icon name="close" size={15} /></button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {!blocked && hint && <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-[11.5px] text-white/60">{hint}</div>}
        {blocked && <div className="rounded-md border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-3 py-2 text-[12px] text-[#fcd34d]">{blocked}</div>}

        {/* Version */}
        <div>
          <SectionLabel>Version</SectionLabel>
          {versions.length ? (
            <select
              value={version ?? ""} disabled={running || autoRunning}
              onChange={(e) => {
                const v = versions.find((x) => x.version === Number(e.target.value));
                if (v) { setVersion(v.version); onLoadVersion(v); }
              }}
              className="h-8 w-full rounded-md border border-white/10 bg-[#222227] px-2 text-[12px] text-white outline-none"
            >
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  v{v.version} · {v.createdBy}{v.note ? ` · ${v.note.slice(0, 60)}` : ""}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-[11.5px] text-white/45">No versions yet: the first test run starts v1 from the saved workflow.</div>
          )}
          {versions.length > 0 && version !== null && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="min-w-0 flex-1 text-[11px] text-white/40">Picking a version previews it on the canvas.</span>
              <Btn
                variant="outline" disabled={running || autoRunning || !!busyMsg || !!blocked}
                title="Save this version as the workflow, so Execute and the agent use it"
                onClick={async () => {
                  const v = versions.find((x) => x.version === version);
                  if (!v) return;
                  setBusyMsg(`Making v${v.version} current…`);
                  await onMakeCurrent(v);
                  setBusyMsg(null);
                }}
              >
                Make v{version} current
              </Btn>
            </div>
          )}
        </div>

        {/* Scenario set */}
        <div>
          <SectionLabel>Scenarios</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {sets.map((s) => (
              <button
                key={s.id} type="button" onClick={() => { setSetId(s.id); setFilter(""); }} title={s.label} disabled={running || autoRunning}
                className={`rounded-full border px-2.5 py-1 text-[11.5px] ${setId === s.id ? "border-[#ff6a1a]/70 bg-[#ff6a1a]/15 text-white" : "border-white/12 text-white/70 hover:bg-white/[0.05]"}`}
              >
                {s.label.split(":")[0]}{s.count ? <span className="ml-1 text-white/35">{s.count}</span> : null}
              </button>
            ))}
          </div>
          {setsNote && <div className="mt-1.5 text-[11px] text-[#fbbf24]">{setsNote}</div>}
          {set && set.label.includes(":") && <div className="mt-1.5 text-[11px] text-white/45">{set.label.split(":").slice(1).join(":").trim()}</div>}
          {(set?.filters?.length ?? 0) > 0 && (
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="mt-2 h-8 w-full rounded-md border border-white/10 bg-[#222227] px-2 text-[12px] text-white outline-none">
              <option value="">{setId === "generated" ? "Any difficulty / mutation" : "Any category"}</option>
              {(set?.filters ?? []).map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          )}
          {setId === "custom" && (
            <div className="mt-2 space-y-1.5">
              <input
                value={caseQ} onChange={(e) => setCaseQ(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="Search cases…"
                className="h-8 w-full rounded-md border border-white/10 bg-black/25 px-2 text-[12px] text-white outline-none focus:border-[#ff6a1a]/60"
              />
              {custom.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {custom.map((id) => (
                    <button key={id} type="button" onClick={() => setCustom((c) => c.filter((x) => x !== id))} className="rounded bg-[#ff6a1a]/15 px-1.5 py-0.5 text-[11px] text-[#ffb084]" title="Remove">
                      {id} ×
                    </button>
                  ))}
                </div>
              )}
              <div className="max-h-32 overflow-y-auto rounded-md border border-white/[0.07]">
                {caseHits.map((c) => {
                  const on = custom.includes(c.id);
                  return (
                    <label key={`${c.dataset}/${c.id}`} className="flex cursor-pointer items-center gap-2 px-2 py-1 text-[11.5px] hover:bg-white/[0.04]">
                      <input
                        type="checkbox" checked={on} disabled={!on && custom.length >= 20}
                        onChange={() => setCustom((cs) => (on ? cs.filter((x) => x !== c.id) : [...cs, c.id]))}
                        className="accent-[#ff6a1a]"
                      />
                      <code className="text-white/85">{c.id}</code>
                      <span className="min-w-0 flex-1 truncate text-white/40">{c.title ?? ""}</span>
                    </label>
                  );
                })}
                {!caseHits.length && <div className="px-2 py-2 text-[11px] text-white/35">No cases found.</div>}
              </div>
            </div>
          )}
        </div>

        {setId !== "custom" && (
          <div>
            <div className="flex items-center justify-between">
              <SectionLabel>Cases</SectionLabel>
              <span className="text-[12px] font-semibold tabular-nums text-white/85">{limit}</span>
            </div>
            <input type="range" min={1} max={20} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-full" style={{ accentColor: "#ff6a1a" }} />
          </div>
        )}
        <div className="text-[11px] text-white/45">
          {perCase !== null
            ? <>Cost hint: about <b className="text-white/70">{fmtUsd(perCase * Math.max(1, caseCount))}</b> ({fmtUsd(perCase)} per case, from earlier runs)</>
            : <>Cost hint: one real agent run per case; no earlier runs to estimate from.</>}
        </div>

        <div className="flex flex-wrap gap-2">
          {running ? (
            <Btn variant="outline" onClick={() => void cancel()}><Icon name="close" size={13} /> Cancel</Btn>
          ) : (
            <Btn variant="primary" disabled={disabled || (setId === "custom" && !custom.length)} onClick={() => { const b = body(); if (b) void runTest(b); }}>
              <Icon name="play" size={13} /> Run test
            </Btn>
          )}
          {autoRunning ? (
            <Btn variant="outline" onClick={() => { stopAutoRef.current = true; void cancel(); }}>Stop auto-improve</Btn>
          ) : (
            <Btn variant="outline" disabled={disabled || (setId === "custom" && !custom.length)} onClick={() => setConfirmAuto(true)}>
              <Sparkle size={12} /> Auto-improve ×{AUTO_MAX_ITERATIONS}
            </Btn>
          )}
        </div>

        {auto && (
          <div className="rounded-md border border-[#a78bfa]/30 bg-[#a78bfa]/[0.07] px-3 py-2">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#c4b5fd]">
              {autoRunning && <span className="wf-pulse-soft"><Sparkle size={11} /></span>} Auto-improve {autoRunning ? `· step ${auto.step}` : "· finished"}
            </div>
            <ol className="space-y-0.5 text-[11.5px] text-white/70">
              {auto.log.map((l, i) => <li key={i} className={l.startsWith("Stopped") ? "text-[#fcd34d]" : ""}>{l}</li>)}
            </ol>
            {auto.rates.length > 1 && (
              <div className="mt-1 text-[11px] tabular-nums text-white/50">Pass rate: {auto.rates.map(pct).join(" → ")}</div>
            )}
          </div>
        )}

        {error && <div className="rounded-md bg-[#ef4444]/10 px-3 py-2 text-[12px] text-[#fca5a5]">{error}</div>}
        {poll.phase === "error" && poll.error && <div className="rounded-md bg-[#ef4444]/10 px-3 py-2 text-[12px] text-[#fca5a5]">{poll.error}</div>}
        {busyMsg && <div className="text-[12px] text-white/60">{busyMsg}</div>}

        {/* Current run */}
        {(run || poll.phase === "starting") && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-md border border-white/10 bg-[#222227] px-3 py-2 text-[12px]">
              {poll.phase === "starting" && <span className="text-white/60">Starting test run…</span>}
              {run && (
                <>
                  <span className="text-white/45">v{run.version} · {run.set}{run.filter ? `/${run.filter}` : ""}</span>
                  {running && <span className="wf-spin block h-3 w-3 rounded-full border-2 border-[#ff6a1a] border-t-transparent" />}
                  <span className="font-semibold tabular-nums text-white">
                    {run.summary.passed}/{run.summary.total} passed{run.summary.total ? ` · ${pct(passRate(run.summary))}` : ""}
                  </span>
                  <span className="tabular-nums text-white/60">mean {run.summary.meanScore !== null ? run.summary.meanScore.toFixed(2) : "–"}</span>
                  <span className="tabular-nums text-white/60">{fmtUsd(run.summary.costUsd)}</span>
                  {run.summary.errors > 0 && <Badge tone="amber">{run.summary.errors} error{run.summary.errors === 1 ? "" : "s"}</Badge>}
                  {poll.phase === "cancelled" && <Badge>cancelled</Badge>}
                  <span className="ml-auto"><RealBadge /></span>
                </>
              )}
            </div>
            {run?.cases.map((c) => (
              <CaseRow
                key={`${c.dataset}/${c.caseId}`} c={c} selected={!!c.executionId && c.executionId === selectedExecId}
                onClick={() => c.executionId && onShowExecution(c.executionId === selectedExecId ? null : c.executionId)}
              />
            ))}
          </div>
        )}

        {/* Improve */}
        {finished && failures > 0 && !proposal && !autoRunning && (
          <button
            type="button" disabled={improving || !!blocked} onClick={() => void improve(run!)}
            className="wf-ai-btn flex h-9 w-full items-center justify-center gap-2 rounded-md text-[12.5px] font-semibold text-white disabled:opacity-60"
          >
            {improving ? <><span className="wf-pulse-soft"><Sparkle size={14} /></span> The Architect is studying {failures} failure{failures === 1 ? "" : "s"}…</>
              : <><Sparkle size={14} /> Improve with AI ({failures} failure{failures === 1 ? "" : "s"})</>}
          </button>
        )}
        {finished && failures === 0 && run!.summary.total > 0 && (
          <div className="flex items-center gap-1.5 text-[12px] text-[#4ade80]"><Icon name="check" size={13} strokeWidth={3} /> Every case passed.</div>
        )}

        {proposal && (
          <div className="space-y-2.5 rounded-lg border border-[#a78bfa]/40 bg-[#a78bfa]/[0.06] px-3 py-3">
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white">
              <span className="text-[#c4b5fd]"><Sparkle size={13} /></span> Proposal from v{proposal.fromVersion}
              <span className="ml-auto"><RealBadge /></span>
            </div>
            <div className="text-[11px] text-white/45">Shown as a diff on the canvas: green added, red removed, amber changed.</div>
            {proposal.changes.length > 0 && (
              <ul className="space-y-1 text-[12px] text-white/85">
                {proposal.changes.map((c, i) => <li key={i}>• {c}</li>)}
              </ul>
            )}
            {proposal.rationale && <p className="text-[11.5px] leading-relaxed text-white/60">{proposal.rationale}</p>}
            {proposal.problems.length > 0 && (
              <ul className="space-y-0.5 rounded-md bg-[#ef4444]/10 px-2.5 py-2 text-[11.5px] text-[#fca5a5]">
                {proposal.problems.map((p, i) => <li key={i}>• {p}</li>)}
              </ul>
            )}
            {!autoRunning && (
              <div className="flex gap-2">
                <Btn onClick={reject}>Reject</Btn>
                <Btn
                  variant="primary" disabled={proposal.problems.length > 0 || !!busyMsg}
                  title={proposal.problems.length ? "The proposal failed the safety check" : "Save as a new version"}
                  onClick={async () => { const r = run; const v = await accept(proposal); if (v && r) setAccepted({ version: v.version, run: r }); }}
                >
                  <Icon name="check" size={13} strokeWidth={2.6} /> Accept as new version
                </Btn>
              </div>
            )}
          </div>
        )}

        {accepted && !running && !autoRunning && (
          <div className="flex items-center gap-2 rounded-md border border-[#22c55e]/30 bg-[#22c55e]/[0.07] px-3 py-2 text-[12px] text-white/80">
            Saved v{accepted.version}.
            <Btn variant="primary" className="ml-auto" onClick={() => void retest()}>
              <Icon name="play" size={12} /> Re-test on the same {accepted.run.cases.length} cases
            </Btn>
          </div>
        )}

        {/* Learning curve */}
        <div>
          <SectionLabel>Learning curve</SectionLabel>
          <LearningCurve points={curve} current={version} />
        </div>

        {runs.length > 0 && (
          <div>
            <SectionLabel>Recent test runs</SectionLabel>
            <div className="space-y-1">
              {[...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 8).map((r) => (
                <button
                  key={r.id} type="button" disabled={running || autoRunning}
                  onClick={async () => {
                    const g = await getTestRun(r.id);
                    if (g.ok && g.data?.testRun) dispatch({ type: "started", run: g.data.testRun });
                  }}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11.5px] hover:bg-white/[0.05] ${run?.id === r.id ? "bg-white/[0.05]" : ""}`}
                >
                  <span className="w-7 font-semibold text-white/70">v{r.version}</span>
                  <span className="min-w-0 flex-1 truncate text-white/50">{r.set}{r.filter ? `/${r.filter}` : ""} · {r.status}</span>
                  <span className="tabular-nums text-white/70">{r.summary.passed}/{r.summary.total}</span>
                  <span className="w-12 text-right tabular-nums text-white/45">{fmtUsd(r.summary.costUsd)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {confirmAuto && <ConfirmAuto cases={Math.max(1, caseCount)} perCase={perCase} onGo={() => void autoImprove()} onCancel={() => setConfirmAuto(false)} />}
    </aside>
  );
}
