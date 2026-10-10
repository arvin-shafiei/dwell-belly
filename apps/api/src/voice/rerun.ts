// Builds the input for re-running a case after something new came in by voice. Two rules keep the
// re-run accurate: new events sit on the case's own timeline (a wall-clock stamp would move the
// agent's "now" months ahead and make every deadline look missed), and the desk's earlier messages
// are part of the case, so the agent never sends the same thing twice.
import type { CaseView, ViewEvent } from "../agent/load.ts";
import type { VoiceMode } from "./policy.ts";

export interface OutboxLike {
  status: string;
  action: { recipient: string; channel: string; message: string };
}

/** The last event's time plus the real time that has passed since, or "" when the case has no readable time. */
export function caseTime(view: CaseView, elapsedMs: number): string {
  let latest: number | null = null;
  for (const e of view.events) {
    const ms = Date.parse(e.timestamp);
    if (!Number.isNaN(ms) && (latest === null || ms > latest)) latest = ms;
  }
  return latest === null ? "" : new Date(latest + Math.max(0, elapsedMs)).toISOString();
}

/** Messages the desk already sent, as events. Held, blocked and failed ones never went anywhere. */
export function priorDeskEvents(outbox: OutboxLike[], startN: number, at: string): ViewEvent[] {
  return outbox
    .filter((o) => o.status === "recorded")
    .map((o, i) => ({
      n: startN + i,
      timestamp: at,
      stage: null,
      channel: o.action.channel,
      from: "Desk",
      to: o.action.recipient,
      body: `Already sent by the desk: ${o.action.message}`,
    }));
}

export function buildRerun(input: {
  view: CaseView;
  previousOutbox?: OutboxLike[];
  newEvents: ViewEvent[];
  elapsedMs: number;
  mode: VoiceMode;
}): { view: CaseView; synthetic: boolean } {
  const at = caseTime(input.view, input.elapsedMs);
  const lastN = input.view.events.reduce((max, e) => Math.max(max, e.n), 0);
  const prior = priorDeskEvents(input.previousOutbox ?? [], lastN + 1, at);
  const added = input.newEvents.map((e, i) => ({ ...e, n: lastN + prior.length + 1 + i, timestamp: at }));
  const events = [...input.view.events, ...prior, ...added];
  return {
    view: { ...input.view, events },
    synthetic: events.some((e) => e.source === "simulated_persona"),
  };
}
