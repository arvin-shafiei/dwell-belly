// Self-Test runs a flow over generated cases that carry an answer key and reports where the
// flow's disposition falls outside the key. It only compares dispositions (contact, escalate,
// no action); message content is scored by the eval. The runner is injected, so this file knows
// nothing about models, and one case that throws, hangs or is malformed never stops the rest.
import type { Flow } from "../lib/flow.ts";
import type { CaseView } from "./load.ts";

export type Disposition = "contact" | "escalate" | "no_action" | "error";

const OUTCOME_TO_DISPOSITION: Record<string, Disposition> = {
  acted: "contact",
  asked_for_info: "contact",
  escalated: "escalate",
  blocked: "escalate",
  no_action: "no_action",
  error: "error",
};

/** The fields of a generated case this module reads. See data/generated/README.md. */
export interface GeneratedCase {
  id: string;
  mutation: string;
  title?: string | null;
  context?: string | null;
  initial_request?: string | null;
  events: CaseView["events"];
  expected: { acceptable_dispositions: string[] };
}

export type RunCaseFn = (view: CaseView, flow: Flow) => Promise<{ outcome: string; error?: string }>;

export interface SelfTestOptions {
  concurrency?: number;
  /** Longer than the runner's own per-case limit, so this only fires when the runner itself hangs. */
  caseTimeoutMs?: number;
}

export interface SelfTestResult {
  flowId: string;
  total: number;
  passed: number;
  failed: { id: string; mutation: string; expected: string[]; got: Disposition }[];
  byMutation: Record<string, { total: number; passed: number }>;
  errors: { id: string; error: string }[];
}

const MAX_TIMER_MS = 2_147_483_647;

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** What the flow may see: the answer key, the mutation name and the rationale stay behind. */
function viewOf(c: GeneratedCase): CaseView {
  return { id: c.id, title: c.title ?? null, context: c.context ?? null, initial_request: c.initial_request ?? null, events: c.events, attachments: [] };
}

async function runOne(c: GeneratedCase, flow: Flow, run: RunCaseFn, timeoutMs: number): Promise<{ got: Disposition; error?: string }> {
  if (!Array.isArray(c?.events) || !Array.isArray(c?.expected?.acceptable_dispositions)) {
    return { got: "error", error: "case has no events or no expected.acceptable_dispositions" };
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      // Wrapped so a runner that throws before returning a promise is caught like a rejection.
      Promise.resolve().then(() => run(viewOf(c), flow)),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`no result after ${timeoutMs} ms`)), timeoutMs); }),
    ]);
    const outcome = String(result?.outcome);
    const got = Object.hasOwn(OUTCOME_TO_DISPOSITION, outcome) ? OUTCOME_TO_DISPOSITION[outcome] : undefined;
    if (!got) return { got: "error", error: `runner returned an unknown outcome: ${JSON.stringify(result?.outcome)}` };
    if (got === "error") return { got, error: result.error ?? "the run ended in an error outcome" };
    return { got };
  } catch (err) {
    return { got: "error", error: message(err) };
  } finally {
    clearTimeout(timer);
  }
}

export async function selfTest(flow: Flow, cases: GeneratedCase[], run: RunCaseFn, options: SelfTestOptions = {}): Promise<SelfTestResult> {
  // Copied so holes become slots that are counted, and so the caller changing the list mid-run cannot skew the tally.
  const list = Array.isArray(cases) ? Array.from(cases) : [];
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? 4) || 1);
  // A delay the timer cannot hold fires after 1 ms, which would fail every case.
  const asked = options.caseTimeoutMs;
  const timeoutMs = typeof asked === "number" && asked > 0 ? Math.min(asked, MAX_TIMER_MS) : 330_000;
  const results: { got: Disposition; error?: string }[] = new Array(list.length);

  let next = 0;
  async function worker() {
    while (next < list.length) {
      const i = next++;
      results[i] = await runOne(list[i], flow, run, timeoutMs).catch((err) => ({ got: "error" as const, error: message(err) }));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));

  // Tallied after the pool finishes and in input order, so the report does not depend on which case came back first.
  const out: SelfTestResult = { flowId: flow?.id ?? "", total: list.length, passed: 0, failed: [], byMutation: {}, errors: [] };
  const tallies = new Map<string, { total: number; passed: number }>();
  list.forEach((c, i) => {
    const id = typeof c?.id === "string" ? c.id : `case ${i + 1}`;
    const mutation = typeof c?.mutation === "string" ? c.mutation : "unknown";
    const expected = Array.isArray(c?.expected?.acceptable_dispositions) ? c.expected.acceptable_dispositions : [];
    const { got, error } = results[i];
    // A Map, because a mutation named "constructor" or "__proto__" would find an inherited property on a plain object.
    const tally = tallies.get(mutation) ?? { total: 0, passed: 0 };
    tallies.set(mutation, tally);
    tally.total++;
    if (error !== undefined) out.errors.push({ id, error });
    if (got !== "error" && expected.includes(got)) {
      out.passed++;
      tally.passed++;
    } else {
      out.failed.push({ id, mutation, expected, got });
    }
  });
  out.byMutation = Object.fromEntries(tallies);
  return out;
}
