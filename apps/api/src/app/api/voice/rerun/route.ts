import { json } from "@/lib/cors";
import type { CaseView, ViewEvent } from "@/agent/load";
import { buildRerun, type OutboxLike } from "@/voice/rerun";

// POST /api/voice/rerun  body (JSON as text/plain): { view, previousOutbox?, newEvents, elapsedMs }.
// Returns { view, synthetic }: the case to send to POST /api/cases, with the desk's earlier messages and
// the new voice events stamped on the case's own timeline. Building only; it never runs the agent.
export async function POST(req: Request) {
  let body: { view?: CaseView; previousOutbox?: OutboxLike[]; newEvents?: ViewEvent[]; elapsedMs?: number };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return json({ error: "the request could not be read" }, { status: 400 });
  }
  if (!body?.view?.id || !Array.isArray(body.view.events) || !Array.isArray(body.newEvents)) {
    return json({ error: "view (with events) and newEvents are required" }, { status: 400 });
  }
  return json(buildRerun({
    view: body.view,
    previousOutbox: Array.isArray(body.previousOutbox) ? body.previousOutbox : [],
    newEvents: body.newEvents,
    elapsedMs: Number(body.elapsedMs) || 0,
    mode: "demo",
  }));
}
