import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

// The judge and the case generator do reading and comparison, which the cheaper model handles.
export const MODEL = "claude-sonnet-5-5";
const USD_PER_MTOK = { input: 2, output: 10 };

let client;
export const spend = { calls: 0, usd: 0, ms: 0 };

// One structured Claude call. Throws on refusal, truncation or unparseable output so the
// caller's per-case try/catch records it instead of scoring a half answer.
export async function ask({ system, user, schema, effort = "medium", maxTokens = 16000 }) {
  const started = Date.now();
  client ??= new Anthropic();
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { effort, format: zodOutputFormat(schema) },
  });
  const usd = (res.usage.input_tokens * USD_PER_MTOK.input + res.usage.output_tokens * USD_PER_MTOK.output) / 1e6;
  spend.calls += 1;
  spend.usd += usd;
  spend.ms += Date.now() - started;
  if (res.stop_reason !== "end_turn" || !res.parsed_output) {
    throw new Error(`Claude returned no usable output (stop_reason: ${res.stop_reason})`);
  }
  return { output: res.parsed_output, usd, ms: Date.now() - started };
}

// Runs fn over items with a fixed number in flight. A failing item becomes { error }.
export async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        results[i] = { error: err instanceof Error ? err.message : String(err) };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
