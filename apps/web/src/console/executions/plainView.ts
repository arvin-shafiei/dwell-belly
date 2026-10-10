// Plain-words view of a case run (docs/plans/ui-simplify-brief.md): the headline sentence,
// the message, the step checklist and the status word. Pure, so it is unit tested.
import { plainNode, plainOutcome, plainStep, riskWord, scrubLeaks } from "../../ui/plain";
export { plainDataset } from "../../ui/plain";
import type { ExecutionRecord } from "../types";
import type { NextAction } from "../../../../api/src/lib/trace";
import { buildTimeline, type TimelineItem } from "./logic";

type NodeItem = Extract<TimelineItem, { kind: "node" }>;
type EndItem = Extract<TimelineItem, { kind: "run_end" }>;

/** "Case 001: Recipient cannot attend" -> "Recipient cannot attend"; falls back to a readable id. */
export function caseName(caseId: string, title?: string | null): string {
  const t = scrubLeaks(title).replace(/^\s*case\s*[\w-]*\s*[:.\-–]\s*/i, "").trim();
  if (t) return t;
  const m = /^([a-z]+)[-_]?0*(\d+)$/i.exec(caseId);
  if (m) {
    const kind = m[1].toLowerCase();
    const n = m[2];
    if (kind === "gen") return `Practice case ${n}`;
    if (kind === "fixture" || kind === "fx") return `Hard case ${n}`;
    return `${kind[0].toUpperCase()}${kind.slice(1)} case ${n}`;
  }
  return caseId.replace(/[_-]+/g, " ");
}

/** One status word for the list: Sent / Needs a person / Asked a question / Stopped / Nothing to do. */
export function statusWord(e: { status: ExecutionRecord["status"]; outcome: string | null }): string {
  if (e.status === "running") return "Working…";
  if (e.outcome === "error" || (!e.outcome && e.status === "error")) return "Stopped";
  return plainOutcome(e.outcome);
}

export type StatusTone = "ok" | "warn" | "info" | "err" | "muted" | "accent";
export function statusTone(e: { status: ExecutionRecord["status"]; outcome: string | null }): StatusTone {
  if (e.status === "running") return "accent";
  if (e.status === "error") return "err";
  switch (e.outcome) {
    case "acted": return "ok";
    case "escalated": return "warn";
    case "asked_for_info": return "info";
    case "blocked":
    case "error": return "err";
    default: return "muted";
  }
}

/** "email" -> "Email"; "sms" -> "Text message". */
export function plainChannel(ch: string): string {
  const c = ch.toLowerCase();
  if (c.includes("email") || c === "mail") return "Email";
  if (c === "sms" || c.includes("text")) return "Text message";
  if (c.includes("phone") || c.includes("call") || c.includes("voice")) return "Phone call";
  if (c.includes("slack") || c.includes("chat")) return "Chat";
  return ch ? ch[0].toUpperCase() + ch.slice(1).replace(/[_-]+/g, " ") : "Message";
}

function sentVerb(ch: string): string {
  const p = plainChannel(ch);
  return p === "Email" ? "Emailed" : p === "Text message" ? "Texted" : p === "Phone call" ? "Called" : "Messaged";
}

function endOf(items: TimelineItem[]): EndItem | null {
  return (items.find((i) => i.kind === "run_end") as EndItem | undefined) ?? null;
}

function cardRouteTo(items: TimelineItem[]): string | null {
  for (const i of items) if (i.kind === "node" && i.card?.routeTo) return i.card.routeTo;
  return null;
}

function sentAction(items: TimelineItem[]): NextAction | null {
  for (const i of items) if (i.kind === "node" && i.action?.done) return i.action.done;
  return null;
}

/** The big sentence at the top of a case run. */
export function headline(e: Pick<ExecutionRecord, "status" | "outcome" | "trace">): string {
  const items = buildTimeline(e.trace);
  const end = endOf(items);
  const next = end?.nextAction ?? sentAction(items);
  const outcome = end?.outcome ?? e.outcome;
  if (e.status === "running" && !end) return "Working on it…";
  switch (outcome) {
    case "acted":
      return next ? `${sentVerb(next.channel)} ${scrubLeaks(next.recipient)}` : "Sent the reply";
    case "asked_for_info":
      return next ? `Asked ${scrubLeaks(next.recipient)} for more information` : "Asked for more information";
    case "escalated": {
      const who = cardRouteTo(items);
      return who ? `Handed this to ${scrubLeaks(who)} to decide` : "Handed this to a person to decide";
    }
    case "blocked":
      return "Stopped: it wasn't safe to send anything";
    case "no_action":
      return "Nothing needed doing";
    case "error":
      return "Something went wrong, so nothing was sent";
    default:
      return e.status === "error" ? "Something went wrong, so nothing was sent" : "Not finished";
  }
}

/** The message card: what went out (or what was prepared but held). */
export function messageOf(e: Pick<ExecutionRecord, "outcome" | "trace">): { title: string; to: string; how: string; message: string } | null {
  const items = buildTimeline(e.trace);
  const end = endOf(items);
  const next = sentAction(items) ?? end?.nextAction ?? null;
  if (!next) return null;
  const outcome = end?.outcome ?? e.outcome;
  const sent = outcome === "acted" || outcome === "asked_for_info";
  return { title: sent ? "What we sent" : "Message waiting to go", to: scrubLeaks(next.recipient), how: plainChannel(next.channel), message: next.message };
}

export interface Step {
  text: string;
  state: "ok" | "error" | "skipped" | "running";
}

/** Plain sentence for one step, or null to hide it (never the raw summary). */
export function stepText(n: NodeItem): string | null {
  if (n.status === "running") return plainNode(n.nodeType);
  if (n.status === "error") return `${plainNode(n.nodeType)}: didn't work`;
  const t = plainStep(n.nodeType, n.summary, n.output);
  if (t === null || n.status === "skipped") return null;
  if (n.gate) {
    const w = riskWord(n.gate.risk);
    return w ? `${t} (risk: ${w})` : t;
  }
  return t;
}

/** Short checklist of the steps that ran, in order. Steps with nothing to say are hidden. */
export function checklist(trace: ExecutionRecord["trace"]): Step[] {
  const seen = new Set<string>();
  const steps: Step[] = [];
  for (const it of buildTimeline(trace)) {
    if (it.kind !== "node" || seen.has(it.nodeId)) continue;
    seen.add(it.nodeId);
    const text = stepText(it);
    if (text) steps.push({ text, state: it.status });
  }
  return steps;
}

/** The first decision card in the run, if a person was asked. */
export function decisionCardOf(trace: ExecutionRecord["trace"]) {
  for (const it of buildTimeline(trace)) if (it.kind === "node" && it.card) return it.card;
  return null;
}
