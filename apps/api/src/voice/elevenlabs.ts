// Thin ElevenLabs client: speech-to-text and WebRTC conversation tokens. Nothing here throws, every
// call has a timeout, and error text is built from the status code and our own words, never from
// what the provider sent back, so nothing instruction-like can travel into a case.

const API = "https://api.elevenlabs.io";

/** confidence: mean word probability (0 to 1); unclearWords: words heard with under 50% probability. */
export type TranscribeResult = { ok: true; text: string; language: string; confidence: number; unclearWords?: string[] } | { ok: false; error: string };
export type TokenResult = { ok: true; token: string } | { ok: false; error: string };

interface CallOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const keyOf = (opts: CallOptions) => opts.apiKey ?? process.env.ELEVENLABS_API_KEY ?? "";

function failure(err: unknown, timeoutMs: number): string {
  const name = err instanceof Error ? err.name : "";
  if (name === "TimeoutError" || name === "AbortError") return `ElevenLabs timed out after ${timeoutMs} ms`;
  return "ElevenLabs could not be reached";
}

const statusError = (status: number) =>
  status === 401 ? "ElevenLabs refused the key (401)"
  : status === 402 ? "ElevenLabs credits are used up (402)"
  : status === 429 ? "ElevenLabs rate limit reached (429)"
  : `ElevenLabs answered ${status}`;

export async function transcribe(
  audio: Uint8Array,
  opts: CallOptions & { filename: string; keyterms?: string[]; languageCode?: string },
): Promise<TranscribeResult> {
  const key = keyOf(opts);
  if (!key) return { ok: false, error: "no ElevenLabs key is set" };
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const form = new FormData();
  form.append("model_id", "scribe_v2");
  // Copied into an ArrayBuffer-backed array: the DOM Blob type rejects views over a SharedArrayBuffer.
  form.append("file", new Blob([new Uint8Array(audio)]), opts.filename);
  // Background noise tags like "(traffic)" would otherwise reach the case as if someone said them.
  form.append("tag_audio_events", "false");
  if (opts.languageCode) form.append("language_code", opts.languageCode);
  // Repeated fields: the API rejects a JSON-encoded list. Case references here stop "DL-6010" becoming "DL6210".
  for (const term of opts.keyterms ?? []) form.append("keyterms", term);
  try {
    const res = await (opts.fetchImpl ?? fetch)(`${API}/v1/speech-to-text`, {
      method: "POST",
      headers: { "xi-api-key": key },
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, error: statusError(res.status) };
    const body = (await res.json()) as { text?: unknown; language_code?: unknown; language_probability?: unknown; words?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return { ok: false, error: "nothing heard in the recording" };
    const words = (Array.isArray(body.words) ? body.words : [])
      .filter((w): w is { text: string; logprob: number } =>
        w?.type === "word" && typeof w.text === "string" && typeof w.logprob === "number" && Number.isFinite(w.logprob));
    const probs = words.map((w) => Math.exp(w.logprob));
    return {
      ok: true,
      text,
      language: typeof body.language_code === "string" ? body.language_code : "",
      // How sure the transcriber is of the words themselves; the language guess is only a fallback.
      confidence: probs.length ? probs.reduce((a, b) => a + b, 0) / probs.length
        : typeof body.language_probability === "number" ? body.language_probability : 0,
      unclearWords: words.filter((w) => Math.exp(w.logprob) < 0.5).map((w) => w.text),
    };
  } catch (err) {
    return { ok: false, error: failure(err, timeoutMs) };
  }
}

export async function conversationToken(agentId: string, opts: CallOptions = {}): Promise<TokenResult> {
  const key = keyOf(opts);
  if (!key) return { ok: false, error: "no ElevenLabs key is set" };
  if (!agentId) return { ok: false, error: "no ElevenLabs agent id is set" };
  const timeoutMs = opts.timeoutMs ?? 10_000;
  try {
    const res = await (opts.fetchImpl ?? fetch)(`${API}/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`, {
      method: "GET",
      headers: { "xi-api-key": key },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, error: statusError(res.status) };
    const body = (await res.json()) as { token?: unknown };
    if (typeof body.token !== "string" || !body.token) return { ok: false, error: "ElevenLabs returned no conversation token" };
    return { ok: true, token: body.token };
  } catch (err) {
    return { ok: false, error: failure(err, timeoutMs) };
  }
}
