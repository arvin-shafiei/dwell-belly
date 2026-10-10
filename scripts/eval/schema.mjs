// Shapes shared by the case generator and the eval. Outcome and NextAction mirror the trace
// contract in docs/plans/2026-10-10-3d-workflow-viz-design.md §4, so the eval reads real traces.
import { z } from "zod";

export const OUTCOMES = ["acted", "asked_for_info", "escalated", "blocked", "no_action", "error"];

// What the eval compares: the three things an ops lead would call the same or different.
export const DISPOSITIONS = ["contact", "escalate", "no_action"];

export const OUTCOME_TO_DISPOSITION = {
  acted: "contact",
  asked_for_info: "contact",
  escalated: "escalate",
  blocked: "escalate",
  no_action: "no_action",
};

export const CHANNELS = [
  "Email", "Customer portal", "Dispatch chat", "Call transcript", "Pickup-point portal",
  "Depot work queue", "Business portal", "Safety incident queue", "Warehouse work queue",
  "Freight portal", "Broker portal",
];

// How render-raw.mjs lays out an adversarial case on disk. "standard" copies the practice cases' layout;
// the rest are layouts the Reality Test might use instead.
export const FORMATS = [
  "standard", "no_stage", "alt_dash", "no_anchors", "single_file", "plain_thread", "newest_first", "decision_point_mid",
];

export const Event = z.object({
  n: z.number().int(),
  timestamp: z.string(),
  stage: z.string(),
  channel: z.string(),
  from: z.string(),
  to: z.string(),
  body: z.string(),
});

export const Expected = z.object({
  acceptable_dispositions: z.array(z.enum(DISPOSITIONS)),
  acceptable_actions: z.array(z.object({
    recipient: z.string(),
    channel: z.string(),
    summary: z.string(),
  })),
  must: z.array(z.string()),
  must_not: z.array(z.string()),
  reference_message: z.string().nullable(),
});

// What Claude returns for one generated case. The id, mutation and seed are added by code.
export const GeneratedCaseDraft = z.object({
  title: z.string(),
  context: z.string(),
  initial_request: z.string(),
  events: z.array(Event),
  expected: Expected,
  rationale: z.string(),
});

export const AgentResult = z.object({
  outcome: z.enum(OUTCOMES),
  nextAction: z.object({
    recipient: z.string(),
    channel: z.string(),
    message: z.string(),
  }).nullable(),
  handoff: z.string().nullable(),
  wontDo: z.array(z.string()),
});

export const Judgement = z.object({
  recipient_match: z.boolean(),
  content: z.enum(["wrong", "partial", "right"]),
  must_missed: z.array(z.string()),
  violations: z.array(z.object({ rule: z.string(), evidence: z.string() })),
  note: z.string(),
});
