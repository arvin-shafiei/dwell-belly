import { readFile } from "node:fs/promises";
import path from "node:path";
import { fromView, type CaseView } from "@/agent/load";
import { claude } from "@/agent/models";
import { runCase } from "@/agent/run";
import { json } from "@/lib/cors";
import type { Flow } from "@/lib/flow";
import { runPanel } from "@/lib/panel";

// POST /api/cases  body: a case view { id, title?, context?, events[], attachments? }
// Runs it through the incident flow and returns the trace the 2D and 3D views replay.
export async function POST(req: Request) {
  const view = (await req.json()) as CaseView;
  if (!view?.id || !Array.isArray(view.events)) {
    return json({ error: "body must be a case view with an id and an events array" }, { status: 400 });
  }
  const flow: Flow = JSON.parse(await readFile(path.join(process.cwd(), "flows", "default-incident.json"), "utf8"));
  const result = await runCase(fromView(view), {
    flow,
    models: claude(),
    panel: process.env.TYPESAFE_API_KEY ? runPanel : undefined,
    mode: "practice",
    runId: `api-${new Date().toISOString()}`,
  });
  return json({ trace: result.trace, outcome: result.outcome, outbox: result.outbox, card: result.card ?? null });
}

export function GET() {
  return json({ cases: [] });
}
