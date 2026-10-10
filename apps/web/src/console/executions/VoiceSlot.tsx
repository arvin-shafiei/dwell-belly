"use client";
// Voice mount slots for the Executions tab (PRD I3, I5; voice plan Task 6 "for Arvin's mount slots").
//
// The voice layer ships its components in apps/web/src/voice/<Name>.tsx (named or default export) and
// wires each with one line in ./voiceComponents.ts:
//   VoiceNoteButton  { caseId, from, onEvent(e: ViewEvent) }
//   CallDrawer       { request: SessionRequest, state: CallState, simulated, onDone({ events, decision? }) }
//   ApproveByVoice   { card: DecisionCard, caseId, onDecision(d: HumanDecision) }
// Each slot loads its component with a dynamic import on the client. Until it is wired (or if it fails
// or throws), the slot renders a disabled "Voice not connected" placeholder, so the console always builds.
//
// Slots:
//   <VoiceSlot.NoteButton execution onEvent />        case header: driver voice note
//   <VoiceSlot.CallDrawer execution row onDone />      an outbox row on a Call / Phone channel
//   <VoiceSlot.ApproveByVoice execution card onDecision />  an open decision card
//   <VoiceSlot.Mounts execution />                     all three, wired to POST /api/console/execute re-runs
import { Component, Suspense, createElement, use, useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import type { CaseViewEvent, ConsoleApi, DecisionCard, ExecuteRequest, ExecutionRecord, HumanDecision, OutboxEntry } from "../types";
import { useConsoleNav } from "./nav";
import { VOICE_LOADERS, registeredVoiceComponent } from "./voiceComponents";
import { Badge, getJson } from "./ui";
import {
  approvalRerun, callableRows, callRequest, callRerun, callStateSeed, cardOpen, noCallLine, noteCaseText, noteRerun, type VoiceComponentName,
} from "./voiceSlots";

// The voice components' props are owned by the voice layer; the slots pass the documented shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>;

const loaded = new Map<VoiceComponentName, Promise<AnyComponent | null>>();

const asComponent = (c: unknown): AnyComponent | null =>
  typeof c === "function" || (typeof c === "object" && c !== null) ? (c as AnyComponent) : null;

/** Resolves to the voice component, or null when it is not wired in voiceComponents.ts or fails to load. */
export function loadVoiceComponent(name: VoiceComponentName): Promise<AnyComponent | null> {
  const direct = asComponent(registeredVoiceComponent(name));
  if (direct) return Promise.resolve(direct);
  let p = loaded.get(name);
  if (!p) {
    const loader = VOICE_LOADERS[name];
    p = loader
      ? loader().then((m) => asComponent(m[name] ?? m.default)).catch(() => null)
      : Promise.resolve(null);
    loaded.set(name, p);
  }
  return p;
}

const noopSubscribe = () => () => {};
/** True only after hydration: voice components touch the microphone and WebRTC, so never render them on the server. */
function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function MicIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

/** Disabled stand-in shown until the voice layer is installed. */
export function VoiceNotConnected({ label, reason }: { label: string; reason?: string }) {
  return (
    <button
      type="button"
      disabled
      title={reason ?? "Voice not connected: the voice layer (apps/web/src/voice) is not installed yet."}
      className="inline-flex cursor-not-allowed items-center gap-1.5 whitespace-nowrap rounded-md bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/35 ring-1 ring-inset ring-white/10"
    >
      <MicIcon />
      {label}
      <span className="text-white/25">· Voice not connected</span>
    </button>
  );
}

class SlotBoundary extends Component<{ label: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <VoiceNotConnected label={this.props.label} reason="The voice component failed to render." /> : this.props.children;
  }
}

function Loaded({ name, label, props }: { name: VoiceComponentName; label: string; props: Record<string, unknown> }) {
  // The promise is cached per name, so the component identity is stable across renders.
  const C = use(loadVoiceComponent(name));
  return C ? createElement(C, props) : <VoiceNotConnected label={label} />;
}

/** Shown while the voice component loads (it is fetched on first use). */
function VoiceLoading({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] text-white/40 ring-1 ring-inset ring-white/10">
      <MicIcon />
      {label} · loading…
    </span>
  );
}

/** Renders the named voice component if present, else the placeholder. */
function Slot({ name, label, props }: { name: VoiceComponentName; label: string; props: Record<string, unknown> }) {
  const client = useIsClient();
  const placeholder = <VoiceLoading label={label} />;
  if (!client) return placeholder;
  return (
    <SlotBoundary label={label}>
      <Suspense fallback={placeholder}>
        <Loaded name={name} label={label} props={props} />
      </Suspense>
    </SlotBoundary>
  );
}

function NoteButton({ execution, from = "Driver", onEvent }: { execution: ExecutionRecord; from?: string; onEvent: (e: CaseViewEvent) => void }) {
  return (
    <Slot
      name="VoiceNoteButton"
      label="Voice note"
      props={{ caseId: execution.caseId, caseText: noteCaseText(execution), from, recordLabel: `🎙 Record as the ${from.toLowerCase()}`, onEvent }}
    />
  );
}

function CallDrawer({
  execution, row, simulated = false, onDone,
}: {
  execution: ExecutionRecord;
  row: OutboxEntry;
  simulated?: boolean;
  onDone: (r: { events: CaseViewEvent[]; decision?: HumanDecision; callId?: string }) => void;
}) {
  return (
    <Slot
      name="CallDrawer"
      label={`Call ${row.action.recipient}`}
      props={{ request: callRequest(execution, row), state: callStateSeed(execution, row.action.recipient, simulated), simulated, label: `Start call as ${row.action.recipient}`, onDone }}
    />
  );
}

function ApproveByVoice({ execution, card, onDecision }: { execution: ExecutionRecord; card: DecisionCard; onDecision: (d: HumanDecision) => void }) {
  return <Slot name="ApproveByVoice" label="Approve by voice" props={{ card, caseId: execution.caseId, onDecision }} />;
}

/** The voice strip under the execution header: each voice moment re-runs the case and opens the new execution. */
function Mounts({ execution }: { execution: ExecutionRecord }) {
  const { go } = useConsoleNav();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const e = execution;
  const calls = callableRows(e.outbox);
  const card = cardOpen(e.card) ? e.card : null;

  const rerun = async (what: string, body: ExecuteRequest) => {
    setBusy(what);
    setError(null);
    try {
      const r = await getJson<ConsoleApi["POST /api/console/execute"]>("/api/console/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      go("executions", { id: r.execution.id }, true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {calls.length ? (
        calls.map((row, i) => (
          <VoiceCard key={`${row.action.recipient}-${i}`} icon="📞" title={`The agent decided to phone ${row.action.recipient}`}>
            {row.action.purpose && <p>Why: {row.action.purpose}</p>}
            <p>You play {row.action.recipient}. Our AI desk agent calls you. Anything it promises is checked before it says it.</p>
            <CallDrawer execution={e} row={row} onDone={(r) => rerun("call", callRerun(e, r))} />
          </VoiceCard>
        ))
      ) : (
        <p className="text-[13px] text-white/45">📞 {noCallLine(e.outbox)}</p>
      )}
      <VoiceCard icon="🎙" title="Be the driver">
        <p>Record a voice note the way a driver at the wheel would, in any language. You&apos;ll see it in English.</p>
        <NoteButton execution={e} onEvent={(ev) => rerun("voice note", noteRerun(e, ev))} />
      </VoiceCard>
      {card && (
        <VoiceCard icon="✅" title="A person must decide">
          <p>Say your choice out loud. The agent reads it back before it counts.</p>
          <ApproveByVoice execution={e} card={card} onDecision={(d) => rerun("approval", approvalRerun(e, d))} />
        </VoiceCard>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {e.voice && <Badge tone="info" title={e.voice.callId ? `call ${e.voice.callId}` : undefined}>by voice: {e.voice.trigger}</Badge>}
        {e.parentExecutionId && (
          <button type="button" className="text-[11px] text-white/45 underline-offset-2 hover:text-white/80 hover:underline" onClick={() => go("executions", { id: e.parentExecutionId! }, true)}>
            the run before this one
          </button>
        )}
        {busy && <span className="text-[12px] text-[#ff6a1a]">Re-running the case with the {busy}…</span>}
        {error && <span className="max-w-72 truncate text-[12px] text-[#ff5c5c]" title={error}>{error}</span>}
      </div>
    </div>
  );
}

/** One thing a person can do by voice: what it is, who they play, then the control. */
function VoiceCard({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="text-[14px] font-medium text-white/90">
        <span className="mr-1.5">{icon}</span>
        {title}
      </div>
      <div className="mt-1 flex flex-col gap-2 text-[13px] text-white/55">{children}</div>
    </div>
  );
}

export const VoiceSlot = { NoteButton, CallDrawer, ApproveByVoice, Mounts };
export default VoiceSlot;
