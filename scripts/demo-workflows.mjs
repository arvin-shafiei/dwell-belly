// Prepare real Architect outputs and sandbox rehearsals in the running console.
// npm run demo:workflows -- build | rehearse | feedback
// Nothing activates a default flow or sends external messages. Failures remain recorded.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const root = path.resolve(import.meta.dirname, "..");
const web = (process.env.DEMO_CONSOLE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const plan = JSON.parse(await readFile(path.join(root, "data/demo-workflows/scenarios.json"), "utf8"));
const evidenceDir = path.join(root, "eval/demo-workflows");
await mkdir(evidenceDir, { recursive: true });
const stage = process.argv[2] ?? "build";
const timestamp = new Date().toISOString().replaceAll(":", "-");
const report = { startedAt: new Date().toISOString(), stage, provenance: plan.provenance, steps: [], error: null };
const reportFile = path.join(evidenceDir, `${stage}-${timestamp}.json`);
async function persist() { await writeFile(reportFile, JSON.stringify(report, null, 2) + "\n"); }
async function call(route, body, method = "POST") {
  const res = await fetch(web + route, { method, headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(330_000) });
  const data = await res.json();
  if (!res.ok) throw new Error(`${route}: ${res.status} ${data.error ?? JSON.stringify(data)}`);
  return data;
}
async function execute(body, label) {
  const { execution } = await call("/api/console/execute", { ...body, mode: "demo" });
  report.steps.push({ label, request: body, execution });
  await persist();
  console.log(`${label}: ${execution.status}/${execution.outcome} ${execution.id}`);
  if (execution.status !== "success") throw new Error(execution.error ?? `${label} did not finish`);
  return execution;
}

try {
  if (stage === "build") {
    for (const item of plan.workflows) {
      const file = path.join(root, `apps/api/flows/${item.id}.json`);
      const existing = await readFile(file, "utf8").catch(() => null);
      const built = existing ? null : await call("/api/console/architect", { description: item.description });
      if (built && (!built.ok || !built.flow || built.problems?.length)) throw new Error(`Architect could not build ${item.id}: ${JSON.stringify(built.problems)}`);
      const flow = existing ? JSON.parse(existing) : { ...built.flow, id: item.id, name: item.name };
      const validation = await call("/api/console/architect", { flow });
      if (validation.problems?.length) throw new Error(`Invalid ${item.id}: ${validation.problems.join("; ")}`);
      if (!existing) await writeFile(file, JSON.stringify(flow, null, 2) + "\n");
      await call(`/api/console/workflows/${item.id}`, { name: item.name, flow, positions: {}, active: false }, "PUT");
      const { versions } = await call(`/api/console/workflows/${item.id}/versions`, undefined, "GET");
      report.steps.push({ id: item.id, brief: item.description, generatedNow: !!built, architect: built, flowSha256: createHash("sha256").update(JSON.stringify(flow)).digest("hex"), nodes: flow.nodes.length, version: versions[0].version });
      await persist();
      console.log(`${item.id}: ${flow.nodes.length} nodes, saved in console`);
    }
  } else if (stage === "rehearse") {
    await execute({ caseId: "gen-3302", dataset: "generated", workflowId: "demo-delivery-recovery" }, "independent recovery case");
    let parent;
    let previousN = 0;
    for (const [index, id] of ["gen-3401", "gen-3402", "gen-3403", "gen-3404"].entries()) {
      const source = JSON.parse(await readFile(path.join(root, `data/generated/delivery/${id}.json`), "utf8"));
      const incoming = source.events.filter((e) => e.n > previousN && e.from !== "Iona Quill, Rivet Delivery Desk")
        .map((e) => ({ ...e, source: "simulated_persona" }));
      previousN = Math.max(...source.events.map((e) => e.n));
      parent = await execute({ ...(parent ? { parentExecutionId: parent.id, extraEvents: incoming, elapsedMs: 0 } : { caseId: id, dataset: "generated" }), workflowId: "demo-cold-chain" }, id);
    }
    await execute({ parentExecutionId: parent.id, workflowId: "demo-cold-chain", elapsedMs: 0, extraEvents: [
      { n: 0, timestamp: "2026-10-12T12:10:00Z", stage: "Follow-up", channel: "Email", from: "Dispatch", to: "Desk", body: "DL-8400: Monday 11:00–12:00 booking was confirmed. Delivery to the clinic receiving desk is complete; proof of delivery was checked against the agreed address and signed by the authorised receiver. No outstanding operational action remains.", source: "simulated_persona" },
      { n: 0, timestamp: "2026-10-12T12:15:00Z", stage: "Follow-up", channel: "Customer portal", from: "Recipient", to: "Desk", body: "DL-8400 received at the agreed clinic. Everything is resolved. No further action requested.", source: "simulated_persona" },
    ] }, "owner-confirmed completion (simulated events)");
    await execute({ caseId: plan.feedback.caseId, dataset: plan.feedback.dataset, workflowId: plan.feedback.workflowId }, "human authority case");
  } else if (stage === "feedback") {
    const { execution } = await call("/api/console/execute", { caseId: plan.feedback.caseId, dataset: plan.feedback.dataset, workflowId: plan.feedback.workflowId, mode: "demo" });
    report.steps.push({ label: "before correction", execution });
    await persist();
    if (execution.status !== "success") throw new Error(execution.error ?? "before run failed");
    const { proposal } = await call("/api/console/improve", { workflowId: plan.feedback.workflowId, executionId: execution.id, correction: plan.feedback.correction, author: plan.feedback.author });
    report.steps.push({ label: "synthetic supervisor correction and proposal", feedback: plan.feedback, proposal });
    await persist();
    if (proposal.problems.length || !proposal.changes.length) throw new Error("Proposal has no valid changes");
    // The proposal stays a draft in the product. Rehearse its exact graph directly through the API;
    // never silently accept or activate a correction on behalf of a human.
    const source = JSON.parse(await readFile(path.join(root, `data/generated/delivery/${plan.feedback.caseId}.json`), "utf8"));
    const last = source.escalation_snapshot?.last_event ?? Math.max(...source.events.map((e) => e.n));
    const view = { id: source.id, initial_request: source.initial_request, events: source.events.filter((e) => e.n <= last), attachments: source.attachments ?? [], mode: "demo", flow: proposal.flow };
    const api = (process.env.DEMO_AGENT_URL ?? "http://localhost:4000").replace(/\/$/, "");
    const res = await fetch(api + "/api/cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(view), signal: AbortSignal.timeout(330_000) });
    const result = await res.json();
    report.steps.push({ label: "draft correction dry run (not accepted)", input: view, result });
    await persist();
    if (!res.ok || result.outcome === "error") throw new Error(result.error ?? "draft dry run failed");
    console.log(`Feedback ${proposal.feedbackId}: ${proposal.changes.length} proposed changes; draft outcome ${result.outcome}`);
  } else throw new Error("Choose build, rehearse or feedback");
} catch (err) {
  report.error = err instanceof Error ? err.message : String(err);
  process.exitCode = 1;
  console.error(report.error);
} finally {
  report.finishedAt = new Date().toISOString();
  await persist();
  console.log(`Actual execution evidence: ${reportFile}`);
}
