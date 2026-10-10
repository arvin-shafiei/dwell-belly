import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateFlow } from "@/agent/architect";
import { runFlowGraph, usesGraph } from "@/agent/graph";
import { historyStore } from "@/agent/history";
import * as judge from "@/agent/judge";
import { fromView, type CaseView } from "@/agent/load";
import { claude } from "@/agent/models";
import { runCase } from "@/agent/run";
import { json } from "@/lib/cors";
import type { Flow } from "@/lib/flow";
import { runPanel } from "@/lib/panel";
import { saveReviewRecord } from "@/lib/review-record";

// POST /api/cases  body: a case view { id, title?, context?, events[], attachments?, mode?, flow?, flowId? }
// `flowId` picks a flow file by id (default "default-incident").
// `flow` runs the case on an edited flow (the console editor); it is validated first and refused if unsound.
// The default flow runs through runCase, the scored path. An explicit `flow` (console-edited or
// Architect-built) or any other stored flow is walked node by node by runFlowGraph, so its branches
// and per-node settings decide what runs. Returns the trace the 2D and 3D views replay.
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
  const options = {
    flow,
    models: claude(),
    panel: jev ? runPanel : undefined,
    judge: jev ? judge : undefined,
    mode: demo ? ("demo" as const) : ("practice" as const),
    runId: `api-${new Date().toISOString()}`,
  };
  const bundle = fromView(view, { allowSimulated: demo });
  const result = usesGraph({ flow: view.flow, flowId })
    // A group_check node reads the shared case history; without one it treats the case as single.
    ? await runFlowGraph(bundle, { ...options, history: historyStore(path.resolve(process.cwd(), "..", "..", ".case-history", "runs.jsonl")) })
    : await runCase(bundle, options);
  // A run that heard a simulated persona is labelled, so no view can present it as a real case.
  if (demo && view.events.some((e) => e.source === "simulated_persona")) result.trace.synthetic = true;
  let reviewWarning: string | undefined;
  try { await saveReviewRecord(result); }
  catch { reviewWarning = "The decision card could not be saved to the human review queue. Keep this response for handover."; }
  return json({ trace: result.trace, outcome: result.outcome, outbox: result.outbox, card: result.card ?? null, ...(reviewWarning && { reviewWarning }) });
}

export function GET() {
  return json({ cases: [] });
}
