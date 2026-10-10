// Fixed sentences the voice agent says. Kept free of imports so the web app can check its own copy
// against them.
export const DENIAL = "I can't promise that. The team that owns this decides, and I'll pass your request on.";

const FAILED: Record<string, string> = {
  submit_decision: "I couldn't record that decision. Please choose on screen instead.",
  record_fact: "I couldn't note that down. Could you say it again?",
  request_human: "I couldn't reach a person just now. The team will follow up.",
};

/** What the voice agent says when a tool fails or runs out of time. A promise check fails closed (the
 * refusal); a decision, a note or a handover says plainly that it did not go through. */
export function fallbackReply(tool: string): string {
  return FAILED[tool] ?? DENIAL;
}
