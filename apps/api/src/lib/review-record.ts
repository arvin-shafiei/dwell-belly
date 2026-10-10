import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RunResult } from "../agent/run";

/** Keep API handovers available to the human desk, even after the response/tab closes. */
export async function saveReviewRecord(result: RunResult) {
  if (!result.card || result.trace.mode === "reality") return;
  const root = path.basename(process.cwd()) === "api" ? path.resolve(process.cwd(), "../..") : process.cwd();
  const id = createHash("sha256").update(`${result.trace.runId}\n${result.trace.caseId}`).digest("hex").slice(0, 32);
  const dir = path.join(root, "runs/api", id);
  await mkdir(dir, { recursive: true });
  const snapshot = { understanding: result.understanding, decision: result.decision, gated: result.gated, outbox: result.outbox, card: result.card };
  await writeFile(path.join(dir, "result.json"), JSON.stringify(snapshot));
  const temp = path.join(dir, `${randomUUID()}.tmp`);
  try {
    await writeFile(temp, JSON.stringify(result.trace));
    await rename(temp, path.join(dir, "trace.json"));
  } finally { await unlink(temp).catch(() => {}); }
}
