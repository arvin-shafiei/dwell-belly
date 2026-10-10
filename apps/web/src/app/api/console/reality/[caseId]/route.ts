import type { NextRequest } from "next/server";
import { jsonError } from "@/console/server/http";
import { realityFiles } from "@/console/server/reality";

// GET /api/console/reality/:caseId -> { answerMd, reasoningMd }, read-only from ANSWERS/<caseId>/.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await ctx.params;
  try {
    const files = await realityFiles(decodeURIComponent(caseId));
    if (!files) return Response.json({ error: `no Reality case folder ${caseId}` }, { status: 404 });
    return Response.json(files);
  } catch (err) {
    return jsonError(err);
  }
}
