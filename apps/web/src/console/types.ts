// Shared contract for the Rivet desk console (the n8n-style control panel at "/").
// Server side: apps/web/src/console/server/* + apps/web/src/app/api/console/** (SQLite via node:sqlite).
// Client side: apps/web/src/console/** tabs. Data rule (PRD J0): real outputs only, never mock data
// presented as real. Anything simulated carries `simulated: true` and must be labelled in the UI.
import type { Trace } from "../../../api/src/lib/trace";
import type { DecisionCard } from "../../../api/src/lib/trace";
import type { Flow, FlowEdge, FlowNode, NodeType, Runner } from "../../../api/src/lib/flow";

export type { Trace, DecisionCard, Flow, FlowEdge, FlowNode, NodeType, Runner };

// ---------- voice (PRD Part I, I5; docs/superpowers/plans/2026-10-10-voice-layer.md) ----------

/** Where a voiced event came from. Absent on ordinary written messages. Mirrors apps/api load.ts EventSource. */
export type VoiceSource = "live_human" | "simulated_persona" | "audio_attachment";

/** One case event as the agent API receives it (POST /api/cases view.events[]). Voice events carry `source`. */
export interface CaseViewEvent {
  n: number;
  timestamp: string; // "" means: stamp it on the case's own timeline
  stage: string | null;
  channel: string | null; // "Voice note", "Call", ...
  from: string | null;
  to: string | null;
  body: string;
  source?: VoiceSource;
}

/** A trusted human decision on a decision card (tap or voice). Mirrors apps/api run.ts RunOptions.humanDecision. */
export interface HumanDecision {
  optionId: string;
  label: string;
  by: "tap" | "voice";
  who: string;
  confirmation?: string;
}

/** One outgoing message after the gate, as POST /api/cases returns it (apps/api agent/types.ts OutboxEntry). */
export interface OutboxEntry {
  action: { recipient: string; channel: string; kind: string; purpose: string; message: string };
  status: "recorded" | "failed" | "held_for_human" | "blocked";
  note: string;
}

/** What started a voice execution. */
export interface ExecutionVoice {
  trigger: "note" | "call" | "approval";
  callId?: string;
}

/** Body of POST /api/console/execute. */
export interface ExecuteRequest {
  caseId: string;
  dataset?: string;
  workflowId?: string;
  /** Re-run of this execution: its outbox becomes "Already sent by the desk" events, and the new row links back. */
  parentExecutionId?: string;
  /** Voice events (notes, call transcripts) appended after the case's own events. Missing timestamps are stamped on the case timeline. */
  extraEvents?: CaseViewEvent[];
  /** A trusted human decision for the agent's card (passed to the agent API as `humanDecision`). */
  humanDecision?: HumanDecision;
  /** What voice moment triggered this run; sets origin "voice". */
  voice?: ExecutionVoice;
  /** Agent mode. Defaults to "demo" when any voice input is present (PRD I2: voice is demo-only). */
  mode?: "practice" | "demo";
  /** Real ms since the parent run, for stamping voice events. Defaults to now minus the parent's start. */
  elapsedMs?: number;
}

/** A saved workflow (n8n "workflow"). The default one is apps/api/flows/default-incident.json. */
export interface WorkflowRecord {
  id: string; // "default-incident" or a uuid
  name: string;
  flow: Flow; // nodes + edges + node config (thresholds etc.)
  /** Canvas positions per node id, saved by the editor. */
  positions: Record<string, { x: number; y: number }>;
  active: boolean;
  updatedAt: string; // ISO
  source: "file" | "db"; // file = read from apps/api/flows, db = saved in SQLite
}

/** One run of the agent on one case (n8n "execution"). */
export interface ExecutionRecord {
  id: string;
  caseId: string; // "delivery-024", "gen-007", a Reality Test folder name...
  dataset: string; // "public" | "generated" | "grounded" | "fixtures" | "reality" | "adhoc" | "city"
  workflowId: string;
  status: "running" | "success" | "error";
  outcome: string | null; // Trace run_end outcome
  startedAt: string; // ISO
  durationMs: number | null;
  costUsd: number | null;
  /** Where it came from: a runner file on disk, the eval results, or an "Execute" click in the console. */
  origin: "answers" | "runs" | "examples" | "console" | "city" | "voice";
  simulated: boolean; // true only for city/mock runs; the console must label these
  trace: Trace | null;
  answerMd: string | null;
  reasoningMd: string | null;
  /** Eval verdict when one exists. */
  eval: { pass: boolean; score: number; notes?: string } | null;
  error?: string | null;
  /** Set when this run re-ran another execution (voice note, call or approval). */
  parentExecutionId?: string | null;
  /** Gated outgoing messages from the agent API response (POST /api/cases `outbox`). */
  outbox?: OutboxEntry[] | null;
  /** The decision card from the agent API response (POST /api/cases `card`), when the agent stopped for a person. */
  card?: DecisionCard | null;
  /** Present when a voice moment triggered this run. */
  voice?: ExecutionVoice | null;
}

/** A row of the evidence grid: every tested case across every dataset. */
export interface EvidenceRow {
  caseId: string;
  dataset: string;
  title: string | null;
  decision: string | null; // outcome / decision type
  nextAction: string | null; // "Email → Delivery investigations, Plover Arc"
  gate: string | null; // "allow" | "ask" | "block"
  pass: boolean | null; // null = not evaluated
  score: number | null;
  costUsd: number | null;
  durationMs: number | null;
  executionId: string | null;
}

/** API (all JSON, under /api/console). */
export interface ConsoleApi {
  "GET /api/console/workflows": { workflows: WorkflowRecord[] };
  "PUT /api/console/workflows/:id": { workflow: WorkflowRecord }; // body: WorkflowRecord
  "GET /api/console/executions?limit&dataset": { executions: Omit<ExecutionRecord, "trace" | "answerMd" | "reasoningMd">[] };
  "GET /api/console/executions/:id": { execution: ExecutionRecord };
  "POST /api/console/execute": { execution: ExecutionRecord }; // body: ExecuteRequest -> runs via apps/api POST /api/cases
  "POST /api/console/import": { imported: number }; // rescan ANSWERS/, runs/, examples/ into SQLite
  "GET /api/console/evidence": { rows: EvidenceRow[]; totals: { cases: number; evaluated: number; passed: number; costUsd: number } };
  "GET /api/console/cases?dataset&q": { cases: { id: string; dataset: string; title: string | null }[] };
  "GET /api/console/status": { agentApi: boolean; agentUrl: string; dbPath: string; counts: Record<string, number> };
}
