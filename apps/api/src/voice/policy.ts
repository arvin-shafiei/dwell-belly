// The one place that decides what voice may do in each mode. Every voice route and the loader ask
// here first. Reality (the scored 16:30 batch) and practice runs never place calls or take live or
// simulated voice; they may only transcribe audio files that arrived with a case.
import type { EventSource } from "../agent/load.ts";

export type VoiceMode = "practice" | "reality" | "demo";
export type VoiceSource = EventSource;
export type VoiceOp = "transcribe_attachment" | "transcribe_note" | "start_call" | "simulate";

export type PolicyResult = { ok: true } | { ok: false; reason: string };

export function voiceAllowed(mode: VoiceMode, op: VoiceOp, source?: VoiceSource): PolicyResult {
  if (source === "simulated_persona" && mode !== "demo") {
    return { ok: false, reason: "Simulated voices are only allowed in demo mode." };
  }
  if (mode === "demo" || op === "transcribe_attachment") return { ok: true };
  return { ok: false, reason: `Voice "${op}" is only allowed in demo mode, not in ${mode} runs.` };
}
