import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateFlow } from "@/agent/architect";
import * as judge from "@/agent/judge";
import { fromView, type CaseView } from "@/agent/load";
import { claude } from "@/agent/models";
import { runCase } from "@/agent/run";
import { json } from "@/lib/cors";
import type { Flow } from "@/lib/flow";
import { runPanel } from "@/lib/panel";

// POST /api/cases  body: a case view { id, title?, context?, events[], attachments?, mode?, flow?, flowId? }
// `flowId` picks a flow file by id (default "default-incident").
// `flow` runs the case on an edited flow (the console editor); it is validated first and refused if unsound.
// Runs it through the incident flow and returns the trace the 2D and 3D views replay.
// Events voiced by a simulated persona are only admitted when mode is "demo".
export async function POST(req: Request) {
  const view = (await req.json()) as CaseView & { mode?: string; flow?: Flow; flowId?: string };
  if (!view?.id || !Array.isArray(view.events)) {
    return json({ error: "body must be a case view with an id and an events array" }, { status: 400 });
  }
  const demo = view.mode === "demo";
  const jev = Boolean(process.env.TYPESAFE_API_KEY);
  // `flowId` names a file in flows/. Only plain ids are accepted, so it cannot point outside that folder.
  const flowId = view.flowId && /^[a-z0-9-]+$/.test(view.flowId) ? view.flowId : "default-incident";
  const stored = await readFile(path.join(process.cwd(), "flows", `${flowId}.json`), "utf8").catch(() => null);
  if (!view.flow && !stored) return json({ error: `no flow named "${flowId}"` }, { status: 404 });
  const flow: Flow = view.flow ?? JSON.parse(stored as string);
  const problems = validateFlow(flow);
  if (problems.length) return json({ error: "the flow is not valid", problems }, { status: 422 });
  const result = await runCase(fromView(view, { allowSimulated: demo }), {
    flow,
    models: claude(),
    panel: jev ? runPanel : undefined,
    judge: jev ? judge : undefined,
    mode: demo ? "demo" : "practice",
    runId: `api-${new Date().toISOString()}`,
  });
  // A run that heard a simulated persona is labelled, so no view can present it as a real case.
  if (demo && view.events.some((e) => e.source === "simulated_persona")) result.trace.synthetic = true;
  return json({ trace: result.trace, outcome: result.outcome, outbox: result.outbox, card: result.card ?? null });
}

export function GET() {
  return json({ cases: [] });
}
