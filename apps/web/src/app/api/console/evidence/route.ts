import { connection } from "next/server";
import { listCases } from "@/console/server/catalogue";
import { buildEvidence } from "@/console/server/evidence";
import { jsonError } from "@/console/server/http";
import { ensureImported } from "@/console/server/importer";
import { allExecutions } from "@/console/server/store";

// GET /api/console/evidence -> { rows, totals }: every case in every dataset with its latest run and verdict.
export async function GET() {
  await connection();
  try {
    await ensureImported();
    return Response.json(buildEvidence(await listCases(), allExecutions()));
  } catch (err) {
    return jsonError(err);
  }
}
