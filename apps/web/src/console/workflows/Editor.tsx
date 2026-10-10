"use client";
// n8n-style workflow editor for the agent's flows, with an execution overlay and live runs.
import "@xyflow/react/dist/style.css";
import "./workflows.css";
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  Background, BackgroundVariant, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow,
  type Connection, type Edge, type NodeChange,
} from "@xyflow/react";
import type { ExecutionRecord, Flow, FlowNode, NodeType, WorkflowRecord } from "../types";
import {
  architectValidate, deleteWorkflow, executeCase, getExecution, listExecutions, loadWorkflows, saveWorkflow,
  type ExecutionSummary,
} from "./api";
import { ArchitectPanel, Sparkle } from "./ArchitectPanel";
import { nameFrom, problemsByNode, revealFrame, revealOrder, slugify, type ArchitectUsage } from "./architect";
import { WorkflowMenu } from "./WorkflowMenu";
import { Badge, Btn } from "./bits";
import { ConsoleContext, HeaderActions } from "../ui";
import {
  addNode, connect, docSignature, edgeKey, moveNodes, removeEdges, removeNodes, sourceHandleFor,
  updateEdgeWhen, updateNode, type FlowDoc, type Pos,
} from "./doc";
import { EdgePanel, NodePanel } from "./DetailPanel";
import { ExecuteDialog } from "./ExecuteDialog";
import { ExecutionPicker } from "./ExecutionPicker";
import { CARD_W, FlowNodeCard, type CardNode } from "./FlowNodeCard";
import { checkpoint, initHistory, push, redo, replace, undo, type History } from "./history";
import { Icon } from "./icons";
import { layoutFlow, withPositions } from "./layout";
import { metaFor } from "./nodeTypes";
import { DND_MIME, Palette } from "./Palette";
import { buildOverlay, fmtMs, fmtUsd, pairKey, replayDelays } from "./status";

const nodeTypes = { card: FlowNodeCard };
type Selection = { kind: "node"; id: string } | { kind: "edge"; key: string } | null;
type Dims = Record<string, { width: number; height: number }>;

const docOf = (w: WorkflowRecord): FlowDoc => ({ flow: w.flow, positions: withPositions(w.flow, w.positions) });

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}

function EditorInner() {
  const rf = useReactFlow();
  const ctx = useContext(ConsoleContext); // null when rendered outside the console shell
  const wantWorkflow = useRef(ctx?.params.get("workflow") ?? null);
  const setParamsRef = useRef(ctx?.setParams);
  useEffect(() => { setParamsRef.current = ctx?.setParams; }, [ctx?.setParams]);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Workflows
  const [records, setRecords] = useState<WorkflowRecord[] | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [hist, setHist] = useState<History<FlowDoc> | null>(null);
  const [savedSig, setSavedSig] = useState("");
  const [save, setSave] = useState<{ state: "idle" | "saving" | "saved" | "error"; msg?: string }>({ state: "idle" });
  const [sel, setSel] = useState<Selection>(null);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [dims, setDims] = useState<Dims>({});
  const lastEdit = useRef<{ key: string; at: number } | null>(null);
  const saveRef = useRef<() => void>(() => {});

  // Executions
  const [executions, setExecutions] = useState<ExecutionSummary[] | null>(null);
  const [execError, setExecError] = useState<string | null>(null);
  const [execId, setExecId] = useState<string | null>(null);
  const [execution, setExecution] = useState<ExecutionRecord | null>(null);
  const [execLoadError, setExecLoadError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<number | null>(null); // live replay position; null = whole trace
  const [running, setRunning] = useState<{ caseId: string; dataset: string; since: number } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);

  // Architect (AI builder) + validation
  const [aiOpen, setAiOpen] = useState(false);
  const [draft, setDraft] = useState<{ record: WorkflowRecord; description: string; prevId: string | null } | null>(null);
  const [reveal, setReveal] = useState<{ order: string[]; count: number } | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [check, setCheck] = useState<{ sig: string; problems: string[]; state: "ok" | "problems" | "unavailable"; msg?: string } | null>(null);
  const [validating, setValidating] = useState(false);

  const doc = hist?.present ?? null;
  const current = draft?.record ?? records?.find((r) => r.id === currentId) ?? null;
  const docSig = useMemo(() => (doc ? docSignature(doc) : ""), [doc]);
  const dirty = !!doc && docSig !== savedSig;
  const liveCheck = check && check.sig === docSig ? check : null;
  const nodeProblems = useMemo(
    () => (liveCheck?.problems.length && doc ? problemsByNode(liveCheck.problems, doc.flow) : null),
    [liveCheck, doc],
  );

  const open = useCallback((w: WorkflowRecord) => {
    const d = docOf(w);
    setCurrentId(w.id);
    setHist(initHistory(d));
    setSavedSig(docSignature(d));
    setSel(null);
    setDraft(null);
    setReveal(null);
    setCheck(null);
    requestAnimationFrame(() => rf.fitView({ padding: 0.2, duration: 0 }));
  }, [rf]);

  useEffect(() => {
    let live = true;
    loadWorkflows().then(({ workflows, fallback: why }) => {
      if (!live) return;
      setRecords(workflows);
      setFallback(why);
      const first = workflows.find((w) => w.id === wantWorkflow.current) ?? workflows.find((w) => w.active) ?? workflows[0];
      open(first);
    });
    return () => { live = false; };
  }, [open]);

  const refreshExecutions = useCallback(() => {
    listExecutions(20).then((r) => {
      if (r.ok) { setExecutions(r.data?.executions ?? []); setExecError(null); }
      else { setExecutions([]); setExecError(r.status === 404 ? "Executions endpoint not available yet (404)." : `Could not load executions: ${r.error}`); }
    });
  }, []);
  useEffect(() => { refreshExecutions(); }, [refreshExecutions]);

  // Load the selected execution's trace.
  useEffect(() => {
    if (!execId) return;
    if (execution?.id === execId) return;
    let live = true;
    getExecution(execId).then((r) => {
      if (!live) return;
      if (r.ok && r.data?.execution) { setExecution(r.data.execution); setExecLoadError(null); }
      else { setExecution(null); setExecLoadError(r.ok ? "Execution not found." : `Could not load execution: ${r.error}`); }
    });
    return () => { live = false; };
  }, [execId, execution?.id]);

  // Live replay: step the cursor through the trace events.
  const delays = useMemo(() => (execution?.trace ? replayDelays(execution.trace, 5000) : []), [execution]);
  useEffect(() => {
    if (cursor === null || !execution?.trace) return;
    if (cursor >= execution.trace.events.length) {
      const t = setTimeout(() => setCursor(null), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCursor((c) => (c === null ? null : c + 1)), delays[cursor] ?? 100);
    return () => clearTimeout(t);
  }, [cursor, execution, delays]);

  const overlay = useMemo(() => {
    if (!execId || !execution?.trace || execution.id !== execId) return null;
    return buildOverlay(execution.trace, doc?.flow ?? null, cursor ?? undefined);
  }, [execId, execution, doc?.flow, cursor]);

  // ---------- edits ----------
  const commit = useCallback((fn: (d: FlowDoc) => FlowDoc, coalesce?: string) => {
    // Rapid edits of the same field (slider drags) collapse into one undo step.
    const now = Date.now();
    const same = !!coalesce && lastEdit.current?.key === coalesce && now - lastEdit.current.at < 1000;
    lastEdit.current = coalesce ? { key: coalesce, at: now } : null;
    setHist((h) => (h ? (same ? replace(h, fn(h.present)) : push(h, fn(h.present))) : h));
  }, []);

  const doUndo = useCallback(() => { lastEdit.current = null; setHist((h) => (h ? undo(h) : h)); }, []);
  const doRedo = useCallback(() => { lastEdit.current = null; setHist((h) => (h ? redo(h) : h)); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || !(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); doUndo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); doRedo(); }
      else if (k === "s") { e.preventDefault(); saveRef.current(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doUndo, doRedo]);

  const addAt = useCallback((type: NodeType, pos: Pos) => {
    if (!hist) return;
    const r = addNode(hist.present, type, pos);
    lastEdit.current = null;
    setHist(push(hist, r.doc));
    setSel({ kind: "node", id: r.id });
  }, [hist]);

  const addCentered = useCallback((type: NodeType) => {
    const r = wrapRef.current?.getBoundingClientRect();
    const p = r ? rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 }) : { x: 0, y: 0 };
    addAt(type, { x: p.x - CARD_W / 2 + (Math.random() - 0.5) * 40, y: p.y - 38 + (Math.random() - 0.5) * 40 });
  }, [rf, addAt]);

  const onDrop = useCallback((e: DragEvent) => {
    const type = e.dataTransfer.getData(DND_MIME) as NodeType;
    if (!type) return;
    e.preventDefault();
    const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addAt(type, { x: p.x - CARD_W / 2, y: p.y - 38 });
  }, [rf, addAt]);

  const onNodesChange = useCallback((changes: NodeChange<CardNode>[]) => {
    const moves: Record<string, Pos> = {};
    const nd: Dims = {};
    for (const c of changes) {
      if (c.type === "position" && c.position) moves[c.id] = c.position;
      if (c.type === "dimensions" && c.dimensions) nd[c.id] = c.dimensions;
    }
    if (Object.keys(nd).length) setDims((d) => ({ ...d, ...nd }));
    if (Object.keys(moves).length) setHist((h) => (h ? replace(h, moveNodes(h.present, moves)) : h));
  }, []);

  const onDelete = useCallback(({ nodes, edges }: { nodes: CardNode[]; edges: Edge[] }) => {
    const nodeIds = nodes.map((n) => n.id);
    const keys = edges.filter((e) => !e.id.startsWith("run:")).map((e) => e.id);
    if (!nodeIds.length && !keys.length) return;
    commit((d) => removeEdges(removeNodes(d, nodeIds), keys));
    setSel(null);
  }, [commit]);

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target) return;
    commit((d) => connect(d, c.source, c.target, c.sourceHandle));
  }, [commit]);

  const autoLayout = useCallback(() => {
    commit((d) => ({ ...d, positions: layoutFlow(d.flow) }));
    requestAnimationFrame(() => rf.fitView({ padding: 0.2, duration: 300 }));
  }, [commit, rf]);

  /** Ask the Architect to check the flow. Never blocks on a missing agent API. */
  const runValidate = useCallback(async (): Promise<"ok" | "problems" | "unavailable"> => {
    if (!doc) return "unavailable";
    const sig = docSignature(doc);
    setValidating(true);
    const r = await architectValidate({ flow: doc.flow });
    setValidating(false);
    if (r.ok && Array.isArray(r.data?.problems)) {
      const problems = r.data.problems;
      setCheck({ sig, problems, state: problems.length ? "problems" : "ok" });
      return problems.length ? "problems" : "ok";
    }
    setCheck({ sig, problems: [], state: "unavailable", msg: r.ok ? r.data?.error ?? "no answer" : r.error });
    return "unavailable";
  }, [doc]);

  const doSave = useCallback(async (force = false) => {
    if (!doc || !current) return;
    setSave({ state: "saving" });
    if (!force && (await runValidate()) === "problems") {
      setSave({ state: "error", msg: "The safety check found problems" });
      return;
    }
    const isDraft = !!draft;
    if (isDraft) setAccepting(true);
    const rec: WorkflowRecord = {
      ...current, flow: { ...doc.flow, id: current.id }, positions: doc.positions, updatedAt: new Date().toISOString(),
      ...(isDraft ? { source: "db" as const, active: false } : {}),
    };
    const r = await saveWorkflow(rec);
    setAccepting(false);
    if (r.ok) {
      const saved = r.data?.workflow ?? rec;
      setRecords((rs) => {
        const list = rs ?? [];
        return list.some((x) => x.id === saved.id) ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved];
      });
      if (isDraft) {
        setDraft(null);
        setCurrentId(saved.id);
        setParamsRef.current?.({ workflow: saved.id });
      }
      setSavedSig(docSignature(doc));
      setFallback(null);
      setSave({ state: "saved" });
      setTimeout(() => setSave((s) => (s.state === "saved" ? { state: "idle" } : s)), 2000);
    } else {
      setSave({ state: "error", msg: r.status === 404 ? "Save endpoint not available yet (404)" : `Save failed: ${r.error}` });
    }
  }, [doc, current, draft, runValidate]);

  // ---------- Architect drafts ----------
  const startDraft = useCallback((d: { flow: Flow; description: string; problems: string[]; usage?: ArchitectUsage[] }) => {
    const brief = d.description.split("\n\nChanges:")[0];
    const name = draft?.record.name ?? nameFrom(brief);
    const id = draft?.record.id ?? slugify(name, (records ?? []).map((r) => r.id));
    const flow: Flow = { ...d.flow, id, name };
    const next: FlowDoc = { flow, positions: layoutFlow(flow) };
    const record: WorkflowRecord = { id, name, flow, positions: next.positions, active: false, updatedAt: new Date().toISOString(), source: "db" };
    lastEdit.current = null;
    setDraft({ record, description: d.description, prevId: draft ? draft.prevId : currentId });
    setHist(initHistory(next));
    setSavedSig("");
    setSel(null);
    setDims({});
    setExecId(null);
    setCursor(null);
    setSave({ state: "idle" });
    setCheck(d.problems.length ? { sig: docSignature(next), problems: d.problems, state: "problems" } : null);
    setReveal({ order: revealOrder(flow), count: 0 });
  }, [draft, records, currentId]);

  const discardDraft = useCallback(() => {
    if (!draft) return;
    const prev = records?.find((r) => r.id === draft.prevId) ?? records?.[0];
    if (prev) open(prev);
    else { setDraft(null); setReveal(null); }
  }, [draft, records, open]);

  // Reveal the draft node by node, following the camera.
  useEffect(() => {
    if (!reveal) return;
    if (reveal.count >= reveal.order.length) {
      const t = setTimeout(() => { setReveal(null); rf.fitView({ padding: 0.2, duration: 450 }); }, 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setReveal((r) => (r ? { ...r, count: r.count + 1 } : r)), reveal.count === 0 ? 120 : 260);
    return () => clearTimeout(t);
  }, [reveal, rf]);
  const revealCount = reveal?.count ?? null;
  useEffect(() => {
    if (!revealCount) return;
    const t = setTimeout(() => rf.fitView({ padding: 0.35, duration: 220, maxZoom: 1.1 }), 40);
    return () => clearTimeout(t);
  }, [revealCount, rf]);

  // ---------- workflow list actions ----------
  const switchTo = useCallback((w: WorkflowRecord) => { open(w); setParamsRef.current?.({ workflow: w.id }); }, [open]);

  const duplicate = useCallback(async () => {
    if (!current || !doc || draft) return;
    const id = slugify(`${current.name} copy`, (records ?? []).map((r) => r.id));
    const rec: WorkflowRecord = {
      ...current, id, name: `${current.name} (copy)`, flow: { ...doc.flow, id }, positions: doc.positions,
      active: false, source: "db", updatedAt: new Date().toISOString(),
    };
    const r = await saveWorkflow(rec);
    if (!r.ok) { setSave({ state: "error", msg: `Duplicate failed: ${r.error}` }); return; }
    const saved = r.data?.workflow ?? rec;
    setRecords((rs) => [...(rs ?? []), saved]);
    switchTo(saved);
  }, [current, doc, draft, records, switchTo]);

  const rename = useCallback(async (name: string) => {
    if (!current) return;
    if (draft) { setDraft({ ...draft, record: { ...draft.record, name, flow: { ...draft.record.flow, name } } }); return; }
    // Rename the saved version only; unsaved canvas edits stay unsaved.
    const rec: WorkflowRecord = { ...current, name, flow: { ...current.flow, name }, updatedAt: new Date().toISOString() };
    const r = await saveWorkflow(rec);
    if (!r.ok) { setSave({ state: "error", msg: `Rename failed: ${r.error}` }); return; }
    const saved = r.data?.workflow ?? rec;
    setRecords((rs) => (rs ?? []).map((x) => (x.id === saved.id ? saved : x)));
  }, [current, draft]);

  const remove = useCallback(async () => {
    if (!current || draft || current.source !== "db") return;
    const r = await deleteWorkflow(current.id);
    if (!r.ok) { setSave({ state: "error", msg: `Delete failed: ${r.error}` }); return; }
    const rest = (records ?? []).filter((x) => x.id !== current.id);
    setRecords(rest);
    const next = rest.find((w) => w.active) ?? rest[0];
    if (next) switchTo(next);
  }, [current, draft, records, switchTo]);

  useEffect(() => { saveRef.current = () => { if (dirty) void doSave(); }; }, [dirty, doSave]);

  // ---------- execute ----------
  const runCase = useCallback(async (c: { id: string; dataset: string }) => {
    setDialog(false);
    setRunError(null);
    setRunning({ caseId: c.id, dataset: c.dataset, since: Date.now() });
    const r = await executeCase({ caseId: c.id, dataset: c.dataset, workflowId: currentId ?? undefined });
    if (!r.ok || !r.data?.execution) {
      setRunning(null);
      setRunError(r.ok ? "The API returned no execution." : r.status === 404 ? "Execute endpoint not available yet (404)." : `Execute failed: ${r.error}`);
      return;
    }
    let ex = r.data.execution;
    // If the API returns before the run finishes, poll until it does (max ~3 min).
    for (let i = 0; ex.status === "running" && i < 90; i++) {
      await new Promise((res) => setTimeout(res, 2000));
      const g = await getExecution(ex.id);
      if (g.ok && g.data?.execution) ex = g.data.execution;
    }
    setRunning(null);
    setExecution(ex);
    setExecId(ex.id);
    setExecLoadError(null);
    setCursor(ex.trace ? 0 : null);
    refreshExecutions();
  }, [currentId, refreshExecutions]);

  const selectExecution = useCallback((id: string | null) => {
    setExecId(id);
    setCursor(null);
    setExecLoadError(null);
  }, []);

  // ---------- canvas model ----------
  const rfNodes: CardNode[] = useMemo(() => {
    if (!doc) return [];
    const visible = reveal ? revealFrame(doc.flow, reveal.order, reveal.count).nodes : null;
    return doc.flow.nodes.filter((n) => !visible || visible.has(n.id)).map((n) => {
      const run = overlay?.nodes[n.id] ?? null;
      return {
        id: n.id,
        type: "card",
        position: doc.positions[n.id] ?? { x: 0, y: 0 },
        selected: sel?.kind === "node" && sel.id === n.id,
        measured: dims[n.id],
        data: { node: n, run, dimmed: !!overlay && !run, problems: nodeProblems?.byNode[n.id], appear: !!reveal },
      };
    });
  }, [doc, overlay, sel, dims, reveal, nodeProblems]);

  const rfEdges: Edge[] = useMemo(() => {
    if (!doc) return [];
    const ids = new Set(doc.flow.nodes.map((n) => n.id));
    const flowPairs = new Set(doc.flow.edges.map((e) => pairKey(e.from, e.to)));
    const shown = reveal ? revealFrame(doc.flow, reveal.order, reveal.count).edges : doc.flow.edges;
    const res: Edge[] = shown.map((e) => {
      const key = edgeKey(e);
      const taken = !!overlay?.taken.has(pairKey(e.from, e.to));
      const live = taken && cursor !== null;
      return {
        id: key,
        source: e.from,
        target: e.to,
        sourceHandle: sourceHandleFor(doc.flow, e),
        targetHandle: "in",
        label: e.when,
        selected: sel?.kind === "edge" && sel.key === key,
        animated: taken,
        className: overlay ? (taken ? "wf-taken" : "wf-faded") : undefined,
        labelStyle: { fill: taken ? "#4ade80" : "#d4d4d8", fontSize: 11, fontWeight: 600 },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
        zIndex: taken ? 1 : 0,
        ...(live ? { style: { strokeWidth: 3 } } : {}),
      };
    });
    // Hops the run took that the flow does not draw (e.g. action -> log): dotted, not editable.
    for (const t of overlay?.edges ?? []) {
      if (flowPairs.has(pairKey(t.from, t.to)) || !ids.has(t.from) || !ids.has(t.to)) continue;
      res.push({
        id: `run:${t.from}->${t.to}`, source: t.from, target: t.to, targetHandle: "in",
        sourceHandle: sourceHandleFor(doc.flow, { from: t.from, to: t.to, when: t.when }),
        label: t.when ? `${t.when} (run)` : "run", animated: true, className: "wf-extra",
        selectable: false, deletable: false, focusable: false,
        labelStyle: { fill: "#4ade80", fontSize: 10 }, labelBgPadding: [5, 2] as [number, number], labelBgBorderRadius: 4,
      });
    }
    return res;
  }, [doc, overlay, sel, cursor, reveal]);

  const selNode: FlowNode | null = sel?.kind === "node" ? doc?.flow.nodes.find((n) => n.id === sel.id) ?? null : null;
  const selEdge = sel?.kind === "edge" ? doc?.flow.edges.find((e) => edgeKey(e) === sel.key) ?? null : null;

  const execSummary = executions?.find((e) => e.id === execId) ?? null;
  const shownExec = execution && execution.id === execId ? execution : null;
  const simulated = shownExec?.simulated ?? execSummary?.simulated ?? false;

  const primaryActions = (
    <>
      <button
        type="button" onClick={() => { setAiOpen((o) => !o); setSel(null); }}
        className={`wf-ai-btn inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold text-white ${aiOpen ? "ring-2 ring-white/30" : ""}`}
        title="Let the Architect design a workflow from a description"
      >
        <Sparkle size={14} /> Build with AI
      </button>
      <Btn variant="outline" onClick={() => setDialog(true)} disabled={!!running || !!draft} title={draft ? "Accept the draft before running it" : "Run the agent on a case"}>
        <Icon name="play" size={13} /> Execute workflow
      </Btn>
      <Btn variant="primary" onClick={() => void doSave()} disabled={!dirty || save.state === "saving" || !!reveal} title="Validate, then save (⌘S)">
        <Icon name="save" size={14} /> {save.state === "saving" ? (validating ? "Checking…" : "Saving…") : draft ? "Accept & save" : "Save"}
      </Btn>
    </>
  );

  if (!doc || !records) {
    return <div className="grid h-full place-items-center bg-[#1f1f23] text-[13px] text-white/45">Loading workflow…</div>;
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#1f1f23] text-white">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 bg-[#19191d] px-3">
        {!paletteOpen && (
          <Btn onClick={() => setPaletteOpen(true)} title="Show nodes panel"><Icon name="plus" size={14} /> Nodes</Btn>
        )}
        <div className="flex min-w-0 items-center gap-2">
          <WorkflowMenu
            records={records} current={current} isDraft={!!draft} dirty={dirty}
            onOpen={switchTo} onDuplicate={() => void duplicate()} onRename={(n) => void rename(n)}
            onDelete={() => void remove()} onNew={() => { setAiOpen(true); setSel(null); }}
          />
          {draft && <Badge tone="violet" title="Generated by the Architect, not saved yet">AI draft</Badge>}
          {current?.source === "file" && !draft && <Badge title={fallback ?? "Read from apps/api/flows"}>from file</Badge>}
          {dirty ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-[#ff8a4c]"><span className="h-1.5 w-1.5 rounded-full bg-[#ff6a1a]" />Unsaved</span>
          ) : save.state === "saved" ? (
            <span className="text-[11px] text-[#4ade80]">Saved</span>
          ) : null}
        </div>

        <div className="ml-2 flex items-center gap-0.5 border-l border-white/10 pl-2">
          <Btn onClick={doUndo} disabled={!hist?.past.length} title="Undo (⌘Z)"><Icon name="undo" size={15} /></Btn>
          <Btn onClick={doRedo} disabled={!hist?.future.length} title="Redo (⇧⌘Z)"><Icon name="redo" size={15} /></Btn>
          <Btn onClick={autoLayout} title="Auto-layout"><Icon name="layout" size={15} /><span className="hidden xl:inline">Tidy up</span></Btn>
          <Btn onClick={() => void runValidate()} disabled={validating} title="Run the Architect's safety check on this flow">
            <Icon name="shield" size={15} /><span className="hidden xl:inline">{validating ? "Checking…" : "Validate"}</span>
          </Btn>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          {save.state === "error" && (
            <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-[#f87171]">
              <span className="truncate" title={save.msg}>{save.msg}</span>
              {liveCheck?.state === "problems" && (
                <button type="button" className="shrink-0 underline hover:text-white" onClick={() => void doSave(true)}>Save anyway</button>
              )}
            </span>
          )}
          <ExecutionPicker
            executions={executions} error={execError} selectedId={execId}
            onSelect={selectExecution} onRefresh={refreshExecutions}
          />
          {ctx?.headerSlot ? <HeaderActions>{primaryActions}</HeaderActions> : primaryActions}
        </div>
      </div>

      {/* Run strip */}
      {liveCheck && !reveal && (
        <div className={`flex shrink-0 flex-wrap items-start gap-x-3 gap-y-1 border-b border-white/10 px-3 py-1.5 text-[12px] ${liveCheck.state === "problems" ? "bg-[#ef4444]/[0.07]" : "bg-[#1b1b1f]"}`}>
          {liveCheck.state === "ok" && (
            <span className="inline-flex items-center gap-1.5 text-[#4ade80]"><Icon name="shield" size={13} /> Safety check passed: every action is gated, ask goes to a human, no cycles.</span>
          )}
          {liveCheck.state === "unavailable" && (
            <span className="text-[#fbbf24]">Could not run the safety check: {liveCheck.msg}</span>
          )}
          {liveCheck.state === "problems" && (
            <div className="min-w-0 flex-1 text-[#fca5a5]">
              <span className="font-semibold">{liveCheck.problems.length} problem{liveCheck.problems.length === 1 ? "" : "s"} found by the safety check</span>
              {nodeProblems?.general.length ? <span>: {nodeProblems.general.join(" · ")}</span> : null}
              {nodeProblems && Object.keys(nodeProblems.byNode).length > 0 && (
                <span className="text-white/50"> · marked on {Object.keys(nodeProblems.byNode).length} node(s)</span>
              )}
            </div>
          )}
          <button type="button" className="ml-auto text-white/40 hover:text-white" onClick={() => setCheck(null)} title="Dismiss"><Icon name="close" size={12} /></button>
        </div>
      )}
      {(running || runError || execId || fallback) && (
        <div className="flex min-h-9 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/10 bg-[#1b1b1f] px-3 py-1.5 text-[12px]">
          {running && (
            <span className="inline-flex items-center gap-2 text-[#ff8a4c]">
              <span className="wf-spin block h-3.5 w-3.5 rounded-full border-2 border-[#ff6a1a] border-t-transparent" />
              Running <code>{running.caseId}</code> through the agent… the canvas will replay it when it completes.
            </span>
          )}
          {runError && (
            <span className="text-[#f87171]">{runError} <button type="button" className="ml-1 underline" onClick={() => setRunError(null)}>dismiss</button></span>
          )}
          {execId && !running && (
            <>
              {execLoadError ? (
                <span className="text-[#f87171]">{execLoadError}</span>
              ) : !shownExec ? (
                <span className="text-white/45">Loading execution…</span>
              ) : (
                <>
                  <span className="text-white/45">Execution</span>
                  <code className="text-white/90">{shownExec.caseId}</code>
                  <Badge tone={shownExec.status === "success" ? "green" : shownExec.status === "error" ? "red" : "orange"}>
                    {overlay?.end?.outcome ?? shownExec.outcome ?? shownExec.status}
                  </Badge>
                  {simulated && <Badge tone="amber" title="City or mock run, not the real agent">SIMULATED</Badge>}
                  <span className="tabular-nums text-white/55">{fmtMs(shownExec.durationMs)} · {fmtUsd(shownExec.costUsd)} · {shownExec.dataset} · {shownExec.origin}</span>
                  {shownExec.trace && shownExec.trace.flowId !== doc.flow.id && (
                    <span className="text-[#fbbf24]">trace is from flow “{shownExec.trace.flowId}”</span>
                  )}
                  {!shownExec.trace && <span className="text-white/45">no trace recorded for this execution</span>}
                  {cursor !== null && <span className="text-[#ff8a4c]">replaying {cursor}/{shownExec.trace?.events.length ?? 0}</span>}
                  {overlay?.end?.nextAction && (
                    <span className="min-w-0 truncate text-white/55" title={overlay.end.nextAction.message}>
                      → {overlay.end.nextAction.channel} · {overlay.end.nextAction.recipient}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-1">
                    {shownExec.trace && <Btn onClick={() => setCursor(0)} title="Replay the run on the canvas"><Icon name="play" size={12} /> Replay</Btn>}
                    <Btn onClick={() => selectExecution(null)} title="Clear the execution overlay"><Icon name="close" size={12} /> Clear</Btn>
                  </span>
                </>
              )}
            </>
          )}
          {fallback && !execId && !running && (
            <span className="text-white/45">Showing <code>apps/api/flows/default-incident.json</code> ({fallback}).</span>
          )}
        </div>
      )}

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {paletteOpen && <Palette onAdd={addCentered} onClose={() => setPaletteOpen(false)} />}
        <div
          ref={wrapRef} className="wf-canvas relative min-w-0 flex-1"
          onDragOver={(e) => { if (e.dataTransfer.types.includes(DND_MIME)) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }}
          onDrop={onDrop}
        >
          <ReactFlow<CardNode, Edge>
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            colorMode="dark"
            onNodesChange={onNodesChange}
            onConnect={onConnect}
            onDelete={onDelete}
            onNodeDragStart={() => setHist((h) => (h ? checkpoint(h) : h))}
            onNodeClick={(_, n) => setSel({ kind: "node", id: n.id })}
            onEdgeClick={(_, e) => { if (!e.id.startsWith("run:")) setSel({ kind: "edge", key: e.id }); }}
            onPaneClick={() => setSel(null)}
            deleteKeyCode={["Backspace", "Delete"]}
            defaultEdgeOptions={{ type: "default" }}
            connectionRadius={28}
            minZoom={0.2}
            maxZoom={2}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.4} color="#3b3b44" bgColor="#1f1f23" />
            <Controls position="bottom-left" showInteractive={false} />
            <MiniMap
              position="bottom-right" pannable zoomable
              nodeColor={(n) => {
                const d = (n as CardNode).data;
                if (d?.run?.status === "ok") return "#22c55e";
                if (d?.run?.status === "error") return "#ef4444";
                return d ? metaFor(d.node.type).color : "#3a3a42";
              }}
              nodeBorderRadius={6}
              style={{ width: 168, height: 110 }}
            />
          </ReactFlow>
        </div>
        {aiOpen && (
          <div className={selNode || selEdge ? "hidden" : "flex h-full"}>
            <ArchitectPanel
              draft={draft ? { description: draft.description, revealing: !!reveal } : null}
              onDraft={startDraft}
              onAccept={() => void doSave()}
              onDiscard={discardDraft}
              accepting={accepting || save.state === "saving"}
              onClose={() => setAiOpen(false)}
            />
          </div>
        )}
        {selNode && (
          <NodePanel
            key={selNode.id}
            node={selNode}
            overlay={overlay}
            onChange={(patch) => commit((d) => updateNode(d, selNode.id, patch), `node:${selNode.id}:${Object.keys(patch).join(",")}`)}
            onDelete={() => { commit((d) => removeNodes(d, [selNode.id])); setSel(null); }}
            onClose={() => setSel(null)}
          />
        )}
        {selEdge && sel?.kind === "edge" && (
          <EdgePanel
            key={sel.key}
            edge={selEdge}
            onWhen={(w) => {
              if ((selEdge.when ?? "") === w.trim()) return;
              const next = { from: selEdge.from, to: selEdge.to, ...(w.trim() ? { when: w.trim() } : {}) };
              commit((d) => updateEdgeWhen(d, sel.key, w));
              setSel({ kind: "edge", key: edgeKey(next) });
            }}
            onDelete={() => { commit((d) => removeEdges(d, [sel.key])); setSel(null); }}
            onClose={() => setSel(null)}
          />
        )}
      </div>

      {dialog && <ExecuteDialog onRun={runCase} onClose={() => setDialog(false)} />}
    </div>
  );
}

export default function WorkflowEditor() {
  return (
    <ReactFlowProvider>
      <EditorInner />
    </ReactFlowProvider>
  );
}
