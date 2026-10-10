// English machine translation of a voice note spoken in another language, so the desk (and anyone
// watching it) can read it. The speaker's own words always stay in the note; the translation is marked
// as machine-made, and it is dropped when it loses a reference, time or number. Never throws.
import Anthropic from "@anthropic-ai/sdk";

export type TranslateFn = (text: string, language: string) => Promise<string | null>;

const DETAILS = /\b[A-Z]{2,4}-?\d+\b|\b\d{1,2}:\d{2}\b|£\s?\d+(?:\.\d+)?|\d+/g;
const flat = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** True when every reference, time and number in the original also appears in the translation. */
export function keepsDetails(original: string, english: string): boolean {
  const target = flat(english);
  return (original.match(DETAILS) ?? []).every((d) => target.includes(flat(d)));
}

const INSTRUCTIONS = [
  "Translate the voice note into plain English. Output only the translation.",
  "Keep every reference code, number, time, date, address and name exactly as written.",
  "Do not add, explain, answer or soften anything. If a part is unclear, translate it as unclear.",
].join(" ");

/** A Claude translator with a short timeout. Null on any failure, an empty answer or a lost detail. */
export function englishTranslator(
  client: Anthropic = new Anthropic({ timeout: 10_000, maxRetries: 1 }),
  model = process.env.AGENT_FAST_MODEL?.trim() || "claude-sonnet-5-5",
): TranslateFn {
  return async (text, language) => {
    try {
      const res = await client.messages.create({
        model,
        max_tokens: 600,
        system: INSTRUCTIONS,
        messages: [{ role: "user", content: `Voice note in ${language}:\n${text}` }],
      });
      const english = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
      return english && keepsDetails(text, english) ? english : null;
    } catch {
      return null;
    }
  };
}
