import { json } from "@/lib/cors";
import { escalationView, getCase } from "@/lib/data";

// GET /api/data/cases/delivery-021            full case (including outcome)
// GET /api/data/cases/delivery-021?view=escalation   only what was known at escalation
export async function GET(req: Request, ctx: RouteContext<"/api/data/cases/[id]">) {
  const { id } = await ctx.params;
  const c = await getCase(id);
  if (!c) return json({ error: `case ${id} not found` }, { status: 404 });
  const view = new URL(req.url).searchParams.get("view");
  return json(view === "escalation" ? escalationView(c) : c);
}
