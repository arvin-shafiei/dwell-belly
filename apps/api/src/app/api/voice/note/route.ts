import { json } from "@/lib/cors";
import { escalationView, getCase } from "@/lib/data";
import { caseTextOf } from "@/voice/references";
import { transcribe } from "@/voice/elevenlabs";
import { handleNote } from "@/voice/notes";
import type { VoiceMode, VoiceSource } from "@/voice/policy";
import { englishTranslator } from "@/voice/translate";

const MODES: VoiceMode[] = ["practice", "reality", "demo"];
const SOURCES: VoiceSource[] = ["live_human", "simulated_persona", "audio_attachment"];

// POST /api/voice/note: multipart (an "audio" file plus fields), or a JSON body sent as text/plain so
// the browser needs no CORS preflight. Fields: mode, source, from, n, at, transcript for a typed note,
// caseId or caseText (the case's references guide transcription), and languageCode (default "en"; "auto" lets the transcriber detect the language).
// Returns { event } to append to the case, or { error } with 400, 403, 422 or 502.
export async function POST(req: Request) {
  let fields: Record<string, unknown>;
  let audio: Uint8Array | undefined;
  let filename: string | undefined;
  try {
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await req.formData();
      fields = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string"));
      const file = form.get("audio");
      if (file instanceof Blob) {
        audio = new Uint8Array(await file.arrayBuffer());
        filename = file instanceof File ? file.name : undefined;
      }
    } else {
      fields = JSON.parse(await req.text());
    }
  } catch {
    return json({ error: "the request could not be read" }, { status: 400 });
  }
  const mode = String(fields.mode ?? "") as VoiceMode;
  const source = String(fields.source ?? "") as VoiceSource;
  if (!MODES.includes(mode) || !SOURCES.includes(source)) {
    return json({ error: "mode and source must be valid values" }, { status: 400 });
  }
  // The case's own references guide transcription; looked up by id when the caller did not send the text.
  let caseText = typeof fields.caseText === "string" ? fields.caseText : "";
  if (!caseText && typeof fields.caseId === "string") {
    const known = await getCase(fields.caseId).catch(() => null);
    if (known) caseText = caseTextOf(escalationView(known).events);
  }
  const res = await handleNote(
    {
      mode, source, audio, filename,
      from: String(fields.from ?? "Unknown caller"),
      n: Number(fields.n ?? 0) || 0,
      at: String(fields.at ?? ""),
      transcript: typeof fields.transcript === "string" ? fields.transcript : undefined,
      caseText,
      languageCode: typeof fields.languageCode === "string" && fields.languageCode ? fields.languageCode : "en",
    },
    // A note in another language gets an English machine translation when Claude is configured.
    { transcribe, translate: process.env.ANTHROPIC_API_KEY ? englishTranslator() : undefined },
  );
  return res.ok
    ? json({ event: res.event, ...(res.language ? { language: res.language } : {}), ...(res.translation ? { translation: res.translation } : {}) })
    : json({ error: res.error }, { status: res.status });
}
