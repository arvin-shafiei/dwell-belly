import { json } from "@/lib/cors";
import { transcribe } from "@/voice/elevenlabs";
import { handleNote } from "@/voice/notes";
import type { VoiceMode, VoiceSource } from "@/voice/policy";

const MODES: VoiceMode[] = ["practice", "reality", "demo"];
const SOURCES: VoiceSource[] = ["live_human", "simulated_persona", "audio_attachment"];

// POST /api/voice/note: multipart (an "audio" file plus fields), or a JSON body sent as text/plain so
// the browser needs no CORS preflight. Fields: mode, source, from, n, at, and transcript for a typed note.
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
  const res = await handleNote(
    {
      mode, source, audio, filename,
      from: String(fields.from ?? "Unknown caller"),
      n: Number(fields.n ?? 0) || 0,
      at: String(fields.at ?? ""),
      transcript: typeof fields.transcript === "string" ? fields.transcript : undefined,
    },
    { transcribe },
  );
  return res.ok ? json({ event: res.event }) : json({ error: res.error }, { status: res.status });
}
