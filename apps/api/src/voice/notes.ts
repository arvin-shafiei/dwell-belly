// A transcribed voice note as a case event. Voice is always the speaker's claim; a low-confidence
// transcript is marked so the agent does not treat a mis-hearing as evidence. A driver can speak any
// language (languageCode "auto"): the note keeps their words and says which language they spoke.
import type { ViewEvent } from "../agent/load.ts";
import type { TranscribeResult } from "./elevenlabs.ts";
import { voiceAllowed, type VoiceMode, type VoiceSource } from "./policy.ts";
import { caseKeyterms, withReferenceCheck } from "./references.ts";

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

export type NoteResult = { ok: true; event: ViewEvent; language?: string } | { ok: false; status: 400 | 403 | 422 | 502; error: string };

/** "pol" or "pl" -> "Polish". An unknown code comes back as it is. */
export function languageName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** A voice note from the UI: a recording to transcribe, or a typed fallback when the microphone is blocked. */
export async function handleNote(
  input: {
    mode: VoiceMode; source: VoiceSource; from: string; n: number; at: string;
    audio?: Uint8Array; filename?: string; transcript?: string;
    /** The case so far: its references, times and people guide transcription and catch mis-heard references. */
    caseText?: string;
    languageCode?: string;
  },
  deps: { transcribe: (audio: Uint8Array, opts: { filename: string; keyterms?: string[]; languageCode?: string }) => Promise<TranscribeResult> },
): Promise<NoteResult> {
  const allowed = voiceAllowed(input.mode, "transcribe_note", input.source);
  if (!allowed.ok) return { ok: false, status: 403, error: allowed.reason };
  const typed = input.transcript?.trim();
  if (typed) return { ok: true, event: noteToEvent({ ...input, transcript: typed, confidence: 1 }) };
  if (!input.audio || input.audio.length === 0) return { ok: false, status: 400, error: "send a recording or a typed note" };
  const caseText = input.caseText ?? "";
  const heard = await deps.transcribe(input.audio, {
    filename: input.filename || "voice-note.webm",
    keyterms: caseKeyterms(caseText),
    languageCode: input.languageCode === "auto" ? undefined : input.languageCode,
  });
  if (!heard.ok) return { ok: false, status: /nothing heard/i.test(heard.error) ? 422 : 502, error: heard.error };
  const language = heard.language ? languageName(heard.language) : undefined;
  const checked = withReferenceCheck(heard.text, caseText);
  const transcript = language && language !== "English" ? `[spoken in ${language}] ${checked}` : checked;
  return { ok: true, event: noteToEvent({ ...input, transcript, confidence: heard.confidence }), ...(language ? { language } : {}) };
}

