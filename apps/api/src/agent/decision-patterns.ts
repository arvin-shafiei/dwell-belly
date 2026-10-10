// Runtime guidance is deliberately separate from the offline, case-specific answer-key catalogue.
import policy from "./decision-patterns.json" with { type: "json" };

export const DECISION_GROUPS = policy.groups;
export const DECISION_GROUP_IDS = DECISION_GROUPS.map((g) => g.id) as [string, ...string[]];
const BASE = ["owner_coordination", "truthful_status", "unfamiliar"];

export const decisionGroupIndex = () => DECISION_GROUPS.map((g) => `- ${g.id}: ${g.recognise}`).join("\n");

/** Unknown or missing labels never strand a case: general reasoning still applies. */
export function decisionGuidance(ids: readonly string[] = []): string {
  const wanted = new Set([...BASE, ...ids]);
  return DECISION_GROUPS.filter((g) => wanted.has(g.id)).map((g) => `- ${g.name}: ${g.guidance}`).join("\n");
}

export function decisionGroupNames(ids: readonly string[] = []): string[] {
  const wanted = new Set(ids);
  return DECISION_GROUPS.filter((g) => wanted.has(g.id)).map((g) => g.name);
}
