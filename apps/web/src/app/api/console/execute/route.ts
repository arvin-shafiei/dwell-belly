import { jsonError } from "@/console/server/http";
import { execute } from "@/console/server/execute";

// POST /api/console/execute  body: { caseId, dataset?, workflowId? } -> { execution }.
// Sends the eval's view of the case to the agent API (AGENT_API_URL, default http://localhost:4000)
// and waits for the trace (up to 5 minutes). The row shows as "running" in the list meanwhile.
export async function POST(req: Request) {
  let body: { caseId?: unknown; dataset?: unknown; workflowId?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  if (typeof body.caseId !== "string" || !body.caseId) {
    return Response.json({ error: "body.caseId is required" }, { status: 400 });
  }
  try {
    const execution = await execute({
      caseId: body.caseId,
      dataset: typeof body.dataset === "string" ? body.dataset : null,
      workflowId: typeof body.workflowId === "string" ? body.workflowId : null,
    });
    return Response.json({ execution });
  } catch (err) {
    return jsonError(err);
  }
}
