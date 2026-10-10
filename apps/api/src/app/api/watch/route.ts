import { watch, type OrderEvent, type WatchContext } from "@/agent/watch";
import { json } from "@/lib/cors";

// POST /api/watch  { event, context? }  returns which check ran and whether it opens a case.
// The practice data has no order stream, so events come from the caller (the demo's made-up fleet).
export async function POST(req: Request) {
  const body = (await req.json()) as { event?: OrderEvent; context?: WatchContext };
  if (!body.event?.kind) return json({ error: "send an event with a kind" }, { status: 400 });
  return json(await watch(body.event, body.context ?? {}));
}
