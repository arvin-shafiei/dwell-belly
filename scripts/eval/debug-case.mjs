// Runs one eval case through the flow and prints what the gate did to each message.
// Usage: node --env-file-if-exists=.env.local scripts/eval/debug-case.mjs gen-408
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadCases } from "./cases.mjs";

const api = path.resolve(import.meta.dirname, "..", "..", "apps", "api");
const [{ runCase }, { fromView }, { claude }, { runPanel }, judge] = await Promise.all([
  import(path.join(api, "src/agent/run.ts")),
  import(path.join(api, "src/agent/load.ts")),
  import(path.join(api, "src/agent/models.ts")),
  import(path.join(api, "src/lib/panel.ts")),
  import(path.join(api, "src/agent/judge.ts")),
]);

const id = process.argv[2];
const found = (await loadCases("all")).find((c) => c.id === id);
if (!found) throw new Error(`No case ${id}`);
const flow = JSON.parse(await readFile(path.join(api, "flows/default-incident.json"), "utf8"));
const jev = Boolean(process.env.TYPESAFE_API_KEY);
const result = await runCase(fromView(found.view), { flow, models: claude(), panel: jev ? runPanel : undefined, judge: jev ? judge : undefined, mode: "practice", runId: "debug" });

console.log(`outcome: ${result.outcome}  revised: ${result.revised}  decision: ${result.decision?.decision_type}`);
for (const g of result.gated) {
  console.log(`\n[${g.verdict}] risk ${g.risk.toFixed(2)} worst ${g.worst} -> ${g.action.recipient} via ${g.action.channel}\n  reasons: ${g.reasons.join("; ") || "none"}\n  ${g.action.message.slice(0, 700)}`);
}
if (result.panel?.ok) console.log(`\npanel notes: ${result.panel.notes.join(" | ")}`);
if (result.error) console.log(`error at ${result.failedAt}: ${result.error}`);
