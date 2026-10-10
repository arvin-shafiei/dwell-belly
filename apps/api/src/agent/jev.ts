// The one door to Jev for the agent: small typed questions about a piece of state, answered as
// probabilities, picks and scores that code can compare with thresholds from the flow config.
// askJev never throws. Any failure comes back as ok=false so the caller can fall back to the
// writing model instead of losing the case.

const JEV_URL = "https://api.typesafe.ai/v1/systemone";
export const JEV_MODEL = "jev-latest";
const JEV_USD_PER_INPUT_TOKEN = 42 / 1e9;
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_RETRY_DELAY_MS = 500;
// Rate limited and overloaded are the two answers worth one more try; anything else will not change.
const RETRY_STATUS = new Set([429, 529]);

export type JevQuestion =
  | { type: "noul"; instructions: string; criteria?: { true: string; false: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string | null> }
  | { type: "score"; instructions: string; criteria: string[] };

export interface JevOptions {
  fetch?: typeof fetch;
  /** Applies to each attempt separately. */
  timeoutMs?: number;
  retryDelayMs?: number;
  /** Defaults to TYPESAFE_API_KEY from the environment. */
  apiKey?: string;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface JevResult {
  ok: boolean;
  error?: string;
  /** noul: probability of yes, 0 to 1. score: position on the levels, from 0. choice: the option key. */
  answers: Record<string, number | string>;
  model: string;
  latencyMs: number;
  tokensIn: number;
  costUsd: number;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Returns the flattened answers, or a string saying what was wrong with the reply. */
function readAnswers(questions: Record<string, JevQuestion>, raw: unknown): Record<string, number | string> | string {
  if (typeof raw !== "object" || raw === null) return "no answers object";
  const given = raw as Record<string, unknown>;
  const answers: Record<string, number | string> = {};
  for (const [id, q] of Object.entries(questions)) {
    const a = given[id];
    if (typeof a !== "object" || a === null) return `no answer for "${id}"`;
    const value = (a as Record<string, unknown>)[q.type];
    if (q.type === "choice") {
      // An option that was never offered cannot be routed on, so it counts as a bad reply.
      if (typeof value !== "string" || !Object.hasOwn(q.criteria, value)) return `answer for "${id}" is not one of the options`;
      answers[id] = value;
    } else {
      if (typeof value !== "number" || !Number.isFinite(value)) return `answer for "${id}" is not a number`;
      // A value below the scale would read downstream as "no risk" or "not urgent", so it is a bad reply.
      if (q.type === "noul" && (value < 0 || value > 1)) return `answer for "${id}" is not between 0 and 1`;
      if (q.type === "score" && value < 0) return `answer for "${id}" is below the first level`;
      answers[id] = value;
    }
  }
  return answers;
}

/**
 * Asks Jev every question about `state` in one request. Never throws: a missing key, a timeout,
 * an error status or a reply that does not answer every question all return ok=false.
 */
export async function askJev(state: unknown, questions: Record<string, JevQuestion>, options: JevOptions = {}): Promise<JevResult> {
  const now = options.now ?? Date.now;
  const started = now();
  const failed = (error: string): JevResult =>
    ({ ok: false, error, answers: {}, model: JEV_MODEL, latencyMs: now() - started, tokensIn: 0, costUsd: 0 });

  try {
    const key = options.apiKey ?? process.env.TYPESAFE_API_KEY;
    if (!key) return failed("TYPESAFE_API_KEY is not set");
    if (Object.keys(questions).length === 0) return failed("no questions to ask");

    const doFetch = options.fetch ?? fetch;
    const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    const payload = JSON.stringify({ state, model: JEV_MODEL, questions });
    const post = () => doFetch(JEV_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: payload,
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });

    let res = await post();
    if (RETRY_STATUS.has(res.status)) {
      await res.body?.cancel().catch(() => {});
      await sleep(options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
      res = await post();
    }
    const text = await res.text();
    if (!res.ok) return failed(`Jev answered ${res.status}: ${text.slice(0, 200)}`);

    let body: { model?: unknown; answers?: unknown; usage?: { input_tokens?: unknown } };
    try {
      body = JSON.parse(text);
    } catch {
      return failed(`Jev reply was not JSON: ${text.slice(0, 200)}`);
    }
    if (typeof body !== "object" || body === null) return failed("Jev reply was not an object");

    const answers = readAnswers(questions, body.answers);
    if (typeof answers === "string") return failed(`Jev reply unusable: ${answers}`);

    const tokensIn = typeof body.usage?.input_tokens === "number" ? body.usage.input_tokens : 0;
    return {
      ok: true,
      answers,
      model: typeof body.model === "string" ? body.model : JEV_MODEL,
      latencyMs: now() - started,
      tokensIn,
      costUsd: tokensIn * JEV_USD_PER_INPUT_TOKEN,
    };
  } catch (err) {
    return failed(`Jev call failed: ${message(err)}`);
  }
}
