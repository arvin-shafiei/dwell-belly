import { connection } from "next/server";
import { jsonError } from "@/console/server/http";
import { ensureImported, refreshAnswersIfChanged } from "@/console/server/importer";
import { realityReport } from "@/console/server/reality";

// GET /api/console/reality -> { cases, summary, runlog }: the Reality Test run in ANSWERS/
// (npm run reality), one row per case folder, re-imported whenever the folder changes.
export async function GET() {
  await connection();
  try {
    await ensureImported();
    await refreshAnswersIfChanged();
    return Response.json(await realityReport());
  } catch (err) {
    return jsonError(err);
  }
}
