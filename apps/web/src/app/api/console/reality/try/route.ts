import { connection } from "next/server";
import { jsonError, readBody } from "@/console/server/http";
import { CENTS_PER_CASE, TRY_DEFAULT, TRY_MAX, deliveryRawDir, listTryRuns, rawCases, startTry, tryCount } from "@/console/server/realityTry";

// GET  /api/console/reality/try -> { runs (newest first), available, max, centsPerCase }
// POST /api/console/reality/try { n } -> { run }: copies n raw Delivery practice cases to
// runs/reality-try/<stamp>/cases/1..n and runs `npm run reality` on them into runs/reality-try/<stamp>/ANSWERS.
export async function GET() {
  await connection();
  try {
    const track = await deliveryRawDir();
    const available = track ? (await rawCases(track)).length : 0;
    return Response.json({ runs: await listTryRuns(), available, max: TRY_MAX, defaultN: TRY_DEFAULT, centsPerCase: CENTS_PER_CASE });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  const body = await readBody<{ n?: unknown }>(req);
  const n = tryCount(body?.n ?? TRY_DEFAULT);
  if (n === null) return Response.json({ error: "n must be a number of cases (1 to 10)." }, { status: 400 });
  try {
    return Response.json({ run: await startTry(n) });
  } catch (err) {
    return jsonError(err);
  }
}
