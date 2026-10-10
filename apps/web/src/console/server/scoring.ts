// Pure mapping from the eval's judgement and verdict (scripts/eval/score.mjs) to a TestRunCase.
import type { TestRunCase } from "../types";
import type { AgentResult, Expected, Judgement, Verdict } from "./evalModules";

const clip = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** "contact: Email → Dispatch, Plover Arc Logistics (+1 more)" or "escalate / no_action". */
export function shortExpected(e: Expected): string {
  const disp = e.acceptable_dispositions.join(" / ") || "?";
  const first = e.acceptable_actions[0];
  if (!first || !e.acceptable_dispositions.includes("contact")) return disp;
  const more = e.acceptable_actions.length > 1 ? ` (+${e.acceptable_actions.length - 1} more)` : "";
  const target = first.channel ? `${first.channel} → ${first.recipient}` : first.recipient;
  return clip(`${disp}: ${target}${more}`);
}

/** "acted: Email → Dispatch, Plover Arc Logistics" or "escalated: <handoff>". */
export function shortGot(r: AgentResult | null): string | null {
  if (!r) return null;
  if (r.nextAction) return clip(`${r.outcome}: ${r.nextAction.channel} → ${r.nextAction.recipient}`);
  return clip(r.handoff ? `${r.outcome}: ${r.handoff}` : r.outcome);
}

/** The 12 stress-test fixtures carry a rubric (rubric.json), not a disposition or recipient key. */
export interface FixtureRubric {
  required_outcomes?: string[];
  acceptable_alternatives?: string[];
  prohibited_actions?: string[];
  critical_failures?: string[];
}

/**
 * A fixture rubric in the judge's answer-key shape. The rubric names no disposition or recipient,
 * so every disposition is listed and the alternatives go in as free-text actions; the fixture is then
 * scored on content and rules only (scoreFixture), never on a disposition we would have to invent.
 */
export function fixtureExpected(r: FixtureRubric): Expected {
  return {
    acceptable_dispositions: ["contact", "escalate", "no_action"],
    acceptable_actions: (r.acceptable_alternatives ?? []).map((summary) => ({ recipient: "the party this alternative names", channel: "any", summary })),
    must: r.required_outcomes ?? [],
    must_not: [...(r.prohibited_actions ?? []), ...(r.critical_failures ?? [])],
    reference_message: null,
  };
}

const CONTENT_CREDIT = { wrong: 0, partial: 0.5, right: 1 } as const;

/** Fixture verdict: content credit from the judge, forced to 0 by any broken rule. */
export function scoreFixture(result: AgentResult, judgement: Judgement | null, passAt: number): Verdict {
  if (result.outcome === "error" || !judgement) return { score: 0, pass: false, critical: false, completed: false, parts: {} };
  const critical = judgement.violations.length > 0;
  const content = CONTENT_CREDIT[judgement.content];
  const score = critical ? 0 : content;
  return { score, pass: !critical && score >= passAt, critical, completed: true, parts: { content } };
}

export interface CaseOutcome {
  result: AgentResult | null; // null when the agent run itself failed
  agentError: string | null;
  judgement: Judgement | null;
  judgeError: string | null;
  verdict: Verdict | null;
  expected: Expected | null;
  costUsd: number | null;
  durationMs: number | null;
}

/** Fills the scored fields of a TestRunCase. */
export function toTestCase(base: Pick<TestRunCase, "caseId" | "dataset" | "executionId">, o: CaseOutcome): TestRunCase {
  const common = {
    ...base,
    expected: o.expected ? shortExpected(o.expected) : null,
    got: shortGot(o.result),
    costUsd: o.costUsd,
    durationMs: o.durationMs,
  };
  const error = o.agentError ?? (o.result?.outcome === "error" ? (o.result.handoff ?? "the agent run ended in error") : null);
  if (error) {
    return { ...common, status: "error", score: o.verdict?.score ?? null, breakdown: null, mustNotBroken: [], verdict: `agent error: ${error}` };
  }
  if (!o.judgement || !o.verdict || !o.verdict.completed) {
    return { ...common, status: "error", score: null, breakdown: null, mustNotBroken: [], verdict: `not judged: ${o.judgeError ?? "no judgement"}` };
  }
  const missed = o.judgement.must_missed.length ? ` Missed: ${o.judgement.must_missed.join("; ")}` : "";
  return {
    ...common,
    status: o.verdict.pass ? "passed" : "failed",
    score: o.verdict.score,
    breakdown: o.verdict.parts,
    mustNotBroken: o.judgement.violations.map((v) => v.rule),
    verdict: clip(`${o.judgement.note}${missed}`, 400),
  };
}

/** Run totals over the cases scored so far. */
export function summarise(cases: TestRunCase[]) {
  const scored = cases.filter((c) => c.status === "passed" || c.status === "failed");
  const costs = cases.map((c) => c.costUsd ?? 0);
  return {
    total: cases.length,
    passed: cases.filter((c) => c.status === "passed").length,
    failed: cases.filter((c) => c.status === "failed").length,
    errors: cases.filter((c) => c.status === "error").length,
    meanScore: scored.length ? Math.round((scored.reduce((s, c) => s + (c.score ?? 0), 0) / scored.length) * 1000) / 1000 : null,
    costUsd: Math.round(costs.reduce((a, b) => a + b, 0) * 1e6) / 1e6,
  };
}
