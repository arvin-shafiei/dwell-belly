import { buildFlow, validateFlow } from "@/agent/architect";
import { claude } from "@/agent/models";
import { json } from "@/lib/cors";
import type { Flow } from "@/lib/flow";

// POST /api/architect  { description }  returns a flow arranged from the existing node types, already validated
// POST /api/architect  { flow }         returns the problems with a hand-edited flow (empty when sound)
export async function POST(req: Request) {
  const body = (await req.json()) as { description?: string; flow?: Flow };
  if (body.flow) return json({ problems: validateFlow(body.flow) });
  if (!body.description?.trim()) return json({ error: "send a description of the business, or a flow to check" }, { status: 400 });
  const built = await buildFlow(body.description, claude());
  return json(built, { status: built.ok ? 200 : 422 });
}
