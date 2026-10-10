import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { CaseBundle } from "./types.ts";

// USD per million tokens. A model missing from this table cannot be used: its cost would be logged wrong.
const PRICES: Record<string, { input: number; cacheRead: number; cacheWrite: number; output: number }> = {
  "claude-opus-5-5": { input: 4, cacheRead: 0.2, cacheWrite: 5, output: 20 },
  "claude-sonnet-5-5": { input: 2, cacheRead: 0.2, cacheWrite: 2.5, output: 10 },
};
// Two tiers. "strong" is for the one step where judgement decides the outcome (choosing what to
// do and writing the messages). "fast" reads the case and checks the drafts, at half the price.
export const DEFAULT_MODELS = { strong: "claude-opus-5-5", fast: "claude-sonnet-5-5" };
export type Tier = keyof typeof DEFAULT_MODELS;

/** The models for this run: AGENT_MODEL and AGENT_FAST_MODEL when set, otherwise the defaults. */
export function chosenModels(env: Record<string, string | undefined> = process.env): Record<Tier, string> {
  const models = { strong: env.AGENT_MODEL?.trim() || DEFAULT_MODELS.strong, fast: env.AGENT_FAST_MODEL?.trim() || DEFAULT_MODELS.fast };
  for (const model of Object.values(models)) {
    if (!PRICES[model]) throw new Error(`Model "${model}" is not supported. Use one of: ${Object.keys(PRICES).join(", ")}`);
  }
  return models;
}

// One attempt must be able to finish a long reply; the case-level timeout in run.ts bounds the total.
const CALL_TIMEOUT_MS = 150_000;

export interface ModelUsage {
  model: string;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export interface StructuredCall<S extends z.ZodType> {
  system: string;
  user: string;
  schema: S;
  media?: CaseBundle["media"];
  effort?: "low" | "medium" | "high";
  /** Defaults to "fast". Ask for "strong" only where the extra judgement changes the outcome. */
  tier?: Tier;
  signal?: AbortSignal;
}

/** The only door to a writing model. Tests pass a fake; the runner passes claude(). */
export interface Models {
  structured<S extends z.ZodType>(call: StructuredCall<S>): Promise<{ output: z.infer<S>; usage: ModelUsage }>;
}

function mediaBlock(m: CaseBundle["media"][number]): Anthropic.ContentBlockParam {
  const source = { type: "base64" as const, data: m.base64 };
  if (m.mediaType === "application/pdf") {
    return { type: "document", title: m.name, source: { ...source, media_type: "application/pdf" } };
  }
  return { type: "image", source: { ...source, media_type: m.mediaType as "image/png" | "image/jpeg" | "image/gif" | "image/webp" } };
}

export function claude(client: Anthropic = new Anthropic({ timeout: CALL_TIMEOUT_MS, maxRetries: 2 }), models: Record<Tier, string> = chosenModels()): Models {
  return {
    async structured({ system, user, schema, media = [], effort = "medium", tier = "fast", signal }) {
      const started = Date.now();
      const model = models[tier];
      const price = PRICES[model];
      const request = (content: Anthropic.ContentBlockParam[]) => client.messages.parse({
        model,
        max_tokens: 12000,
        // The system prompt is identical for every case in a batch, so it is cached.
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content }],
        output_config: { effort, format: zodOutputFormat(schema) },
      }, { signal });
      const res = await request([...media.map(mediaBlock), { type: "text", text: user }]).catch((err) => {
        // An attachment the API will not take (corrupt, too many pages) must not cost the whole case.
        if (!(err instanceof Anthropic.BadRequestError) || media.length === 0) throw err;
        return request([{ type: "text", text: `${user}\n\nAttachments that could not be read and were left out: ${media.map((m) => m.name).join("; ")}` }]);
      });
      const u = res.usage;
      const costUsd = (u.input_tokens * price.input
        + (u.cache_read_input_tokens ?? 0) * price.cacheRead
        + (u.cache_creation_input_tokens ?? 0) * price.cacheWrite
        + u.output_tokens * price.output) / 1e6;
      const usage: ModelUsage = {
        model: res.model,
        latencyMs: Date.now() - started,
        tokensIn: u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
        tokensOut: u.output_tokens,
        costUsd,
      };
      if (res.stop_reason !== "end_turn" || res.parsed_output == null) {
        throw new Error(`model returned no usable output (stop_reason: ${res.stop_reason})`);
      }
      return { output: res.parsed_output as z.infer<typeof schema>, usage };
    },
  };
}
