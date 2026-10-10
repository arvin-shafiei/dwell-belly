"use client";
// A live voice call with the Desk Caller agent, in the browser (WebRTC). Every promise the agent wants
// to make is checked by the safety gate through the propose_commitment tool, and shown here as it
// happens. When the call ends, the transcript and anything recorded become case events.
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useRef, useState } from "react";
import { callTool, DENIAL, openSession, type CallStateInput, type HumanDecision, type SessionRequest, type ViewEvent } from "./api";
import { micErrorMessage, transcriptReducer, type Line } from "./transcript";

export interface CallResult { callId: string; events: ViewEvent[]; decision?: HumanDecision }

interface Props {
  request: SessionRequest;
  state: CallStateInput;
  simulated?: boolean;
  label?: string;
  onDone: (result: CallResult) => void;
}

export function CallDrawer(props: Props) {
  return (
    <ConversationProvider>
      <CallInner {...props} />
    </ConversationProvider>
  );
}

function CallInner({ request, state, simulated = false, label = "Start call", onDone }: Props) {
  const [lines, setLines] = useState<Line[]>([]);
  const [checks, setChecks] = useState<{ text: string; allowed: boolean; rule?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState<HumanDecision | null>(null);
  const call = useRef<(CallStateInput & { callId: string }) | null>(null);
  const linesRef = useRef<Line[]>([]);
  const extra = useRef<ViewEvent[]>([]);
  const decision = useRef<HumanDecision | undefined>(undefined);
  const finished = useRef(true);

  // A client tool handler: asks our API and returns its answer (always a string) to the voice agent.
  const tool = (name: string) => async (params: Record<string, unknown>): Promise<string> => {
    if (!call.current) return DENIAL;
    const res = await callTool(name, { ...call.current, decided: decision.current?.optionId }, params);
    if (name === "propose_commitment") setChecks((c) => [...c, { text: String(params.text ?? ""), allowed: res.allowed === true, rule: res.rule }]);
    if (res.event) extra.current.push(res.event);
    if (res.decision && !decision.current) { decision.current = res.decision; setDecided(res.decision); }
    return res.result;
  };

  const conversation = useConversation({
    clientTools: {
      submit_decision: tool("submit_decision"),
      propose_commitment: tool("propose_commitment"),
      record_fact: tool("record_fact"),
      request_human: tool("request_human"),
    },
    onMessage: (m) => setLines((l) => (linesRef.current = transcriptReducer(l, m))),
    onDisconnect: () => { void finish(); },
    onError: (message) => setError(typeof message === "string" ? message : "The call hit an error"),
  });

  async function start() {
    setError(null);
    setLines((linesRef.current = []));
    setChecks([]);
    setDecided(null);
    extra.current = [];
    decision.current = undefined;
    try {
      // Ask for the microphone inside the click, so the browser allows audio for this page.
      (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach((t) => t.stop());
    } catch (err) {
      setError(micErrorMessage(err).replace("type the note instead", "use tap approval instead"));
      return;
    }
    try {
      const session = await openSession(request);
      call.current = { ...state, callId: session.callId };
      finished.current = false;
      conversation.startSession({ conversationToken: session.token, connectionType: "webrtc", dynamicVariables: session.dynamicVariables });
    } catch (err) {
      setError(err instanceof Error ? err.message : "The call could not start");
    }
  }

  async function finish() {
    if (finished.current || !call.current) return;
    finished.current = true;
    const done = await callTool("finish", call.current, {}, { lines: linesRef.current });
    onDone({ callId: call.current.callId, events: [...(done.events ?? []), ...extra.current], decision: decision.current });
  }

  const live = conversation.status === "connected" || conversation.status === "connecting";
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-[#2a2a30] p-3 text-sm text-white">
      <div className="flex items-center gap-2">
        <span className="font-medium">{request.purpose === "approval" ? "Approval call" : "Call"}: {request.calleeName}</span>
        <span className="text-white/50">({conversation.status}{live && conversation.isSpeaking ? ", agent speaking" : ""})</span>
        {simulated && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300">Simulated</span>}
        <span className="ml-auto">
          {live ? (
            <button onClick={() => conversation.endSession()} className="rounded bg-red-600 px-3 py-1">End call</button>
          ) : (
            <button onClick={start} className="rounded bg-[#ff6a1a] px-3 py-1 font-medium">📞 {label}</button>
          )}
        </span>
      </div>
      {error && <p className="text-amber-300">{error}</p>}
      {decided && (
        <p className="rounded bg-emerald-500/15 px-2 py-1 text-emerald-300">
          Decided by voice: {decided.label} (“{decided.confirmation}”)
        </p>
      )}
      {checks.length > 0 && (
        <ul className="flex flex-col gap-1">
          {checks.map((c, i) => (
            <li key={i} className={c.allowed ? "text-emerald-300" : "text-red-300"}>
              {c.allowed ? "✓ allowed" : "✕ denied by the safety gate"}: “{c.text}”{c.rule ? ` (${c.rule})` : ""}
            </li>
          ))}
        </ul>
      )}
      <ol className="flex max-h-64 flex-col gap-1 overflow-y-auto">
        {lines.map((l, i) => (
          <li key={i}><span className="text-white/40">{l.role === "agent" ? "Desk agent" : request.calleeName}:</span> {l.message}</li>
        ))}
      </ol>
    </div>
  );
}
