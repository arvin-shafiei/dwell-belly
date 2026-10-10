// A transcribed voice note as a case event. Voice is always the speaker's claim; a low-confidence
// transcript is marked so the agent does not treat a mis-hearing as evidence.
import type { ViewEvent } from "../agent/load.ts";
import type { VoiceSource } from "./policy.ts";

export const UNCLEAR_BELOW = 0.6;

export function noteToEvent(note: {
  n: number;
  at: string;
  from: string;
  transcript: string;
  source: VoiceSource;
  confidence: number;
}): ViewEvent {
  const body = note.confidence < UNCLEAR_BELOW ? `[unclear transcription] ${note.transcript}` : note.transcript;
  return { n: note.n, timestamp: note.at, stage: null, channel: "Voice note", from: note.from, to: "Desk", body, source: note.source };
}
