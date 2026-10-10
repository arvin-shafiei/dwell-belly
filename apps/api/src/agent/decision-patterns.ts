// Runtime guidance is deliberately separate from the offline, case-specific answer-key catalogue.
import policy from "./decision-patterns.json" with { type: "json" };

export const DECISION_GROUPS = policy.groups;
export const DECISION_GROUP_IDS = DECISION_GROUPS.map((g) => g.id) as [string, ...string[]];
const BASE = ["owner_coordination", "truthful_status", "unfamiliar"];

export const CHAINING_GUIDANCE = `Resolve combined issues as constraints on one current plan:
- Identify all live requirements across vehicle/route capacity, recipient availability, site access, goods condition, commercial decisions, identity/authority and tool/channel failures. Attribute each to its owner and affected shipment.
- Require evidence that a restriction applies to this shipment. A named safety team, a crash or a generic mention of approval does not by itself make goods clearance or another extra approval mandatory.
- Safety and authority restrictions are hard boundaries. Within them, intersect confirmed operational feasibility with the verified customer's latest requirements. Preferences rank feasible alternatives; they do not create capacity or override a restriction. An offered fallback is not an instruction to book.
- A customer can replace their own date/time choice, not a carrier's capacity statement. A carrier can withdraw its own offer, not waive the customer's availability. A site can limit access, not approve goods safety. Reassess only affected downstream choices after a change; keep unrelated safe work moving.
- If an existing offer satisfies the current valid request and all required clearances, ask the booking owner to confirm it. If not, ask that owner for feasible options constrained by the customer's stated dates/times and access requirements. Do not re-ask the customer for a choice they already made, discard a condition, or book the nearest/default slot.
- No feasible overlap means request alternatives from the relevant owner or one targeted missing fact; do not escalate solely because constraints conflict. Route only a specific decision outside the desk's authority to a person.
- Keep future conditional steps in waiting_for until their prerequisites are confirmed. Re-read the complete accumulated history and earlier requests on every follow-up; distinguish a request sent from an outcome confirmed.`;

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
