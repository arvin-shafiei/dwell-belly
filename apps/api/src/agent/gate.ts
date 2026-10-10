// The Safety Gate judges each outgoing message, not the case topic: a risky topic with a safe
// message (an alert to the safety owner) must still go out. Hard rules run in code; the rest is a
// critic's per-boundary score. Thresholds come from the flow node config.
import { BOUNDARIES, type Boundary, type Critique, type GatedAction, type PlannedAction, type Understanding } from "./types.ts";

export interface GateConfig { allow_below: number; block_above: number }

const SECRET = /(gate|door|entry|access|alarm|key ?safe|lock ?box|security)\s*code|\bPIN\b|password|passcode|card number|\bCVV\b/i;
const ASKING = /\b(send|share|provide|give|tell|confirm|supply|let (me|us) (have|know)|what is|what's|reply with|need)\b/i;

/** Deterministic checks. A hit blocks the message whatever the critic says. */
export function hardRules(action: PlannedAction, understanding: Understanding, caseText: string): string[] {
  const hits: string[] = [];
  if (!action.message.trim()) hits.push("message is empty");
  if (!action.recipient.trim()) hits.push("no recipient");
  const known = understanding.parties.map((p) => p.name.toLowerCase());
  const recipient = action.recipient.toLowerCase();
  const inParties = known.some((name) => name.includes(recipient) || recipient.includes(name));
  // The analysis may not list every team; a name that appears anywhere in the case is real.
  const inCase = caseText.toLowerCase().includes(recipient.split(",")[0].trim());
  if (recipient && !inParties && !inCase) {
    hits.push(`recipient "${action.recipient}" does not appear in the case`);
  }
  for (const sentence of action.message.split(/(?<=[.?!])\s+/)) {
    if (SECRET.test(sentence) && ASKING.test(sentence) && !/\b(do not|don't|never|no need to|without)\b/i.test(sentence)) {
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
  return actions.map((action, index) => {
    const reasons = hardRules(action, understanding, caseText);
    if (reasons.length) return { action, risk: 1, worst: "rule", reasons, verdict: "block" };

    const scores = critique?.actions.find((a) => a.index === index);
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
