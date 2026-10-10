// "Improve": asks the Architect (agent API POST /api/architect) for a revised flow, given the current
// flow's shape and a digest of what went wrong in a test run. Saves nothing: the UI saves an accepted
// proposal as a new version (createdBy "improve", note = rationale).
import type { Flow, ImproveProposal, TestRun, TestRunCase } from "../types";
import { agentUrl } from "./execute";
import { diffFlows } from "./flowDiff";
import { getTestRun } from "./testruns";
import { getVersion, isFlowShape } from "./versions";

export const ARCHITECT_TIMEOUT_MS = 5 * 60_000;
const LOW_SCORE = 0.7;

export class ImproveError extends Error {
  constructor(message: string, readonly status: number, readonly problems?: string[]) {
    super(message);
  }
}

/** The cases worth learning from: failed, errored, or scored under 0.7, worst first. */
export function weakCases(run: Pick<TestRun, "cases">): TestRunCase[] {
  return run.cases
    .filter((c) => c.status === "failed" || c.status === "error" || (c.score !== null && c.score < LOW_SCORE))
    .sort((a, b) => (a.score ?? -1) - (b.score ?? -1));
}

/** The flow as compact text: nodes with their settings, then edges with branch labels. */
export function flowShape(flow: Flow): string {
  const nodes = flow.nodes.map((n) => {
    const c = n.config ?? {};
    const bits: string[] = [];
    if (c.allow_below !== undefined || c.block_above !== undefined) bits.push(`allow_below ${String(c.allow_below)}, block_above ${String(c.block_above)}`);
    const rules = c.rules as Record<string, { at_least?: unknown; effect?: unknown }> | undefined;
    if (rules) bits.push(`rules: ${Object.entries(rules).map(([q, r]) => `${q}≥${String(r.at_least)}→${String(r.effect)}`).join("; ")}`);
    return `- ${n.id} (${n.type}, runs on ${n.runs_on.join("+")})${bits.length ? `: ${bits.join(" | ")}` : ""}`;
  });
  const edges = flow.edges.map((e) => `- ${e.from} → ${e.to}${e.when ? ` [${e.when}]` : ""}`);
  return `Nodes:\n${nodes.join("\n")}\nEdges:\n${edges.join("\n")}`;
}

export function failureDigest(run: TestRun, maxCases = 12): string {
  const weak = weakCases(run).slice(0, maxCases);
  const s = run.summary;
  const head = `Test run on the "${run.set}" set: ${s.passed}/${s.total} passed, ${s.failed} failed, ${s.errors} errors, mean score ${s.meanScore ?? "n/a"}.`;
  if (!weak.length) return `${head}\nNo case failed or scored low.`;
  const lines = weak.map((c) => {
    const parts = [`- ${c.caseId} (${c.dataset}): ${c.status}${c.score !== null ? `, score ${c.score}` : ""}`];
    if (c.expected) parts.push(`  expected: ${c.expected}`);
    if (c.got) parts.push(`  agent did: ${c.got}`);
    if (c.mustNotBroken.length) parts.push(`  rules broken: ${c.mustNotBroken.join("; ")}`);
    if (c.verdict) parts.push(`  judge: ${c.verdict}`);
    return parts.join("\n");
  });
  return `${head}\nCases that went wrong, worst first:\n${lines.join("\n")}`;
}

export function improveDescription(flow: Flow, run: TestRun): string {
  return [
    `Business: ${flow.business || flow.name}. This is a revision of an existing incident flow ("${flow.name}"), not a new design.`,
    "Keep the parts that work and change what the failures below point at: add or split branches, add a check before the step that went wrong, tighten or loosen a gate's thresholds, adjust perspectives rules. Do not remove safety checks to make a case pass.",
    `Current flow:\n${flowShape(flow)}`,
    failureDigest(run),
  ].join("\n\n");
}

/** A short "why" for the proposal, tied to the failures and the changes. */
export function rationaleFor(run: TestRun, changes: string[]): string {
  const weak = weakCases(run);
  const broke = [...new Set(weak.flatMap((c) => c.mustNotBroken))];
  const parts = [
    `Proposed by the Architect from test run ${run.id.slice(0, 8)} (v${run.version}, ${run.set}: ${run.summary.passed}/${run.summary.total} passed, mean ${run.summary.meanScore ?? "n/a"}).`,
    weak.length ? `Targets ${weak.length} weak case(s): ${weak.slice(0, 6).map((c) => c.caseId).join(", ")}${weak.length > 6 ? "…" : ""}.` : "No case failed; the revision is a refinement.",
  ];
  if (broke.length) parts.push(`Rules broken in the run: ${broke.slice(0, 4).join("; ")}${broke.length > 4 ? "…" : ""}.`);
  parts.push(changes.length ? `${changes.length} change(s), e.g. ${changes.slice(0, 3).join("; ")}.` : "The Architect returned the same flow.");
  return parts.join(" ");
}

async function postArchitect(body: unknown, timeoutMs: number): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${agentUrl()}/api/architect`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { error: text.slice(0, 300) };
  }
  return { status: res.status, json };
}

export async function improve(body: { workflowId?: unknown; testRunId?: unknown }): Promise<ImproveProposal> {
  if (typeof body.testRunId !== "string") throw new ImproveError("testRunId is required", 400);
  const run = getTestRun(body.testRunId);
  if (!run) throw new ImproveError(`no test run ${body.testRunId}`, 404);
  const workflowId = typeof body.workflowId === "string" && body.workflowId ? body.workflowId : run.workflowId;
  if (workflowId !== run.workflowId) throw new ImproveError(`test run ${run.id} is for ${run.workflowId}, not ${workflowId}`, 400);
  if (run.status === "running") throw new ImproveError("the test run is still running", 409);
  const from = await getVersion(workflowId, run.version);
  if (!from) throw new ImproveError(`no version ${run.version} of ${workflowId}`, 404);

  let built: { status: number; json: Record<string, unknown> };
  try {
    built = await postArchitect({ description: improveDescription(from.flow, run) }, ARCHITECT_TIMEOUT_MS);
  } catch (err) {
    throw new ImproveError(`the Architect did not answer: ${err instanceof Error ? err.message : String(err)}`, 502);
  }
  const proposed = built.json.flow;
  if (built.status !== 200 || !built.json.ok || !isFlowShape(proposed)) {
    const problems = Array.isArray(built.json.problems) ? (built.json.problems as string[]) : [];
    throw new ImproveError(String(built.json.error ?? "the Architect could not produce a valid revision"), 502, problems);
  }
  // Keep the workflow's identity; the Architect names its own drafts.
  const flow: Flow = { ...proposed, id: from.flow.id, name: from.flow.name, business: from.flow.business || proposed.business };
  const check = await postArchitect({ flow }, 20_000).catch(() => null);
  const problems = check && Array.isArray(check.json.problems) ? (check.json.problems as string[]) : check ? [] : ["could not re-check the proposed flow with the agent API"];
  const changes = diffFlows(from.flow, flow);
  return { workflowId, fromVersion: from.version, testRunId: run.id, flow, problems, changes, rationale: rationaleFor(run, changes) };
}
