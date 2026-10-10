import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { CaseBundle } from "./types.ts";

export const CLAUDE_MODEL = "claude-opus-5-5";
const USD_PER_MTOK = { input: 4, cacheRead: 0.2, cacheWrite: 5, output: 20 };
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

export function claude(client: Anthropic = new Anthropic({ timeout: CALL_TIMEOUT_MS, maxRetries: 2 })): Models {
  return {
    async structured({ system, user, schema, media = [], effort = "medium", signal }) {
      const started = Date.now();
      const request = (content: Anthropic.ContentBlockParam[]) => client.messages.parse({
        model: CLAUDE_MODEL,
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
      const costUsd = (u.input_tokens * USD_PER_MTOK.input
        + (u.cache_read_input_tokens ?? 0) * USD_PER_MTOK.cacheRead
        + (u.cache_creation_input_tokens ?? 0) * USD_PER_MTOK.cacheWrite
        + u.output_tokens * USD_PER_MTOK.output) / 1e6;
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
