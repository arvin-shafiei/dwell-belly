// The Safety Gate judges each outgoing message, not the case topic: a risky topic with a safe
// message (an alert to the safety owner) must still go out. Hard rules run in code; the rest is a
// critic's per-boundary score. Thresholds come from the flow node config.
import { BOUNDARIES, type Boundary, type Critique, type GatedAction, type PlannedAction, type Understanding } from "./types.ts";

export interface GateConfig { allow_below: number; block_above: number }

const SECRET = "(?:(?:gate|door|entry|access|alarm|key ?safe|lock ?box|security)\\s*code|password|passcode|(?<!calling )card number|CVV)";
const ASKING = "(?:send|share|provide|give|tell|confirm|supply|let (?:me|us) (?:have|know)|what is|what's|reply with|need)";
// The asking verb has to come before the secret inside one clause; a sentence that merely mentions a code is fine.
const REQUEST = new RegExp(`\\b${ASKING}\\b[^.;:?!]{0,60}?${SECRET}`, "i");
// "PIN" counts only in capitals, so a map pin or a pinned note does not trip the rule.
const PIN_REQUEST = new RegExp(`\\b${ASKING}\\b[^.;:?!]{0,60}?\\b(pin)\\b`, "i");
const NEGATED = /\b(not|don't|never|no need to|without)\b/i;
const FILLER = new Set(["mr", "mrs", "ms", "miss", "dr", "the", "team", "dept", "department", "of", "and", "at"]);
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !FILLER.has(w));

/** Deterministic checks. A hit blocks the message whatever the critic says. */
export function hardRules(action: PlannedAction, understanding: Understanding, caseText: string): string[] {
  const hits: string[] = [];
  if (!action.message.trim()) hits.push("message is empty");
  if (!action.recipient.trim()) hits.push("no recipient");
  // Word overlap, so punctuation, titles and word order do not block a real recipient.
  const known = new Set(words(`${understanding.parties.map((p) => p.name).join(" ")} ${caseText}`));
  const named = words(action.recipient.split(",")[0]);
  if (action.recipient.trim() && (named.length === 0 || !named.every((w) => known.has(w)))) {
    hits.push(`recipient "${action.recipient}" does not appear in the case`);
  }
  for (const clause of action.message.split(/(?<=[.?!;])\s+/)) {
    if ((REQUEST.test(clause) || clause.match(PIN_REQUEST)?.[1] === "PIN") && !NEGATED.test(clause)) {
      hits.push("asks for a reusable security credential");
      break;
    }
  }
  return hits;
}

export function gate(
  actions: PlannedAction[],
  understanding: Understanding,
  critique: Critique | null,
  config: GateConfig,
  caseText: string,
): GatedAction[] {
  // The critic numbers its own scores, and models differ on where they start counting. With one
  // score per message, order is what matters, so scores are matched by position. Any other count is not trusted.
  const ordered = critique && critique.actions.length === actions.length
    ? [...critique.actions].sort((x, y) => x.index - y.index)
    : null;
  return actions.map((action, index) => {
    const reasons = hardRules(action, understanding, caseText);
    if (reasons.length) return { action, risk: 1, worst: "rule", reasons, verdict: "block" };

    const scores = ordered?.[index];
    // No critic verdict means the message was not checked, so a person must look at it.
    if (!scores) return { action, risk: config.allow_below, worst: null, reasons: ["not checked by the critic"], verdict: "ask" };

    let worst: Boundary = BOUNDARIES[0];
    for (const b of BOUNDARIES) if (scores[b] > scores[worst]) worst = b;
    const risk = Math.max(0, Math.min(1, scores[worst]));
    const verdict = risk < config.allow_below ? "allow" : risk >= config.block_above ? "block" : "ask";
    const why = verdict === "allow" ? [] : [`${worst.replaceAll("_", " ")} (${risk.toFixed(2)})`];
    return { action, risk, worst: verdict === "allow" ? null : worst, reasons: why, verdict };
  });
}
