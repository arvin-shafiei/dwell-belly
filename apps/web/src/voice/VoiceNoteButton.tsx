"use client";
// Record a voice note (for example a driver who cannot type) and turn it into a case event. If the
// microphone is blocked or missing, the same note can be typed instead.
import { useRef, useState } from "react";
import { sendRecordedNote, sendTypedNote, type ViewEvent, type VoiceSource } from "./api";
import { micErrorMessage } from "./transcript";

const extensionFor = (mime: string) => (mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "m4a" : "webm");

// The console's slot passes { caseId, from, onEvent }: number and time are optional, because the
// re-run builder renumbers new events and stamps them on the case's own timeline.
export function VoiceNoteButton({ from, n = 0, at = "", source = "live_human", onEvent }: {
  from: string;
  caseId?: string;
  n?: number;
  at?: string;
  source?: VoiceSource;
  onEvent: (event: ViewEvent) => void;
}) {
  const [state, setState] = useState<"idle" | "recording" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const mime = rec.mimeType || "audio/webm";
        setState("sending");
        try {
          onEvent(await sendRecordedNote({ audio: new Blob(chunks.current, { type: mime }), filename: `voice-note.${extensionFor(mime)}`, from, n, at, source }));
        } catch (err) {
          setError(err instanceof Error ? err.message : "The voice note could not be sent");
        } finally {
          setState("idle");
        }
      };
      recorder.current = rec;
      rec.start();
      setState("recording");
    } catch (err) {
      setError(micErrorMessage(err));
    }
  }

  async function sendTyped() {
    if (!typed.trim()) return;
    setState("sending");
    try {
      onEvent(await sendTypedNote({ transcript: typed, from, n, at, source }));
      setTyped("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The note could not be sent");
    } finally {
      setState("idle");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-[#2a2a30] p-3 text-sm text-white">
      <div className="flex items-center gap-2">
        <span className="text-white/60">Voice note from {from}</span>
        {source === "simulated_persona" && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300">Simulated</span>}
      </div>
      {state === "recording" ? (
        <button onClick={() => recorder.current?.stop()} className="rounded bg-red-600 px-3 py-1.5 font-medium">● Stop and send</button>
      ) : (
        <button onClick={start} disabled={state === "sending"} className="rounded bg-[#ff6a1a] px-3 py-1.5 font-medium disabled:opacity-50">
          {state === "sending" ? "Transcribing…" : "🎙 Record voice note"}
        </button>
      )}
      {error && (
        <div className="flex flex-col gap-2">
          <p className="text-amber-300">{error}</p>
          <textarea value={typed} onChange={(e) => setTyped(e.target.value)} rows={2} placeholder="Type the note"
            className="rounded bg-black/30 p-2 text-white placeholder:text-white/30" />
          <button onClick={sendTyped} disabled={!typed.trim() || state === "sending"} className="rounded border border-white/20 px-3 py-1.5 disabled:opacity-50">Send typed note</button>
        </div>
      )}
    </div>
  );
}
