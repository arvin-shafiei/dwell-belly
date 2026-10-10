import { json } from "@/lib/cors";
import { listCases } from "@/lib/data";

// GET /api/data/cases?track=delivery
export async function GET(req: Request) {
  const track = new URL(req.url).searchParams.get("track") ?? undefined;
  return json({ cases: await listCases(track) });
}
