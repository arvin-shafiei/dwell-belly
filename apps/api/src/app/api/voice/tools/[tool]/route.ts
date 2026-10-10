import { readFile } from "node:fs/promises";
import path from "node:path";
import * as judge from "@/agent/judge";
import type { GateConfig } from "@/agent/gate";
import { json } from "@/lib/cors";
import type { Flow } from "@/lib/flow";
import { voiceAllowed } from "@/voice/policy";
import { checkCommitment, DENIAL, recordFact, requestHuman, submitDecision, TOOL_BUDGET_MS, type CallState } from "@/voice/tools";

const DEFAULT_GATE: GateConfig = { allow_below: 0.3, block_above: 0.8 };

/** The same thresholds the safety gate uses for written messages, from the flow config. */
async function gateConfig(): Promise<GateConfig> {
  try {
    const flow: Flow = JSON.parse(await readFile(path.join(process.cwd(), "flows", "default-incident.json"), "utf8"));
    return { ...DEFAULT_GATE, ...(flow.nodes.find((n) => n.type === "safety_gate")?.config as Partial<GateConfig> | undefined) };
  } catch {
    return DEFAULT_GATE;
  }
}

type ToolReply = { result: string; [k: string]: unknown };

// POST /api/voice/tools/:tool  body (JSON as text/plain): { state: CallState, args }.
// Called by the browser's client-tool handlers during a call. Always answers within the budget, and
// with the denial wording on anything unexpected, so the voice agent is never left waiting or silent.
export async function POST(req: Request, { params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  let body: { state?: CallState; args?: Record<string, string> };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return json({ result: DENIAL }, { status: 400 });
  }
  const state = body?.state;
  const args = body?.args ?? {};
  if (!state || typeof state.callId !== "string" || typeof state.caseText !== "string") return json({ result: DENIAL }, { status: 400 });
  if (!voiceAllowed(state.mode, "start_call", state.source).ok) return json({ result: DENIAL }, { status: 403 });

  const work = async (): Promise<ToolReply> => {
    switch (tool) {
      case "propose_commitment": {
        const res = await checkCommitment(String(args.text ?? ""), state, {
          messageRisk: process.env.TYPESAFE_API_KEY ? judge.messageRisk : undefined,
          gateConfig: await gateConfig(),
        });
        return { result: res.reply, allowed: res.allowed, rule: res.rule };
      }
      case "submit_decision": {
        const res = submitDecision(state, { option_id: String(args.option_id ?? ""), spoken_confirmation: String(args.spoken_confirmation ?? "") });
        return res.ok ? { result: res.reply, decision: res.decision, duplicate: res.duplicate } : { result: res.reply };
      }
      case "record_fact":
        return { result: "Noted.", event: recordFact(state, { field: String(args.field ?? ""), value: String(args.value ?? ""), speaker_role: String(args.speaker_role ?? "") }) };
      case "request_human":
        return { result: "I'll pass this to a person at the desk. Thank you, goodbye.", event: requestHuman(state, { reason: String(args.reason ?? "") }) };
      default:
        return { result: DENIAL, error: `unknown tool ${tool}` };
    }
  };
  const reply = await Promise.race([
    work().catch((): ToolReply => ({ result: DENIAL })),
    new Promise<ToolReply>((resolve) => setTimeout(() => resolve({ result: DENIAL, timedOut: true }), TOOL_BUDGET_MS)),
  ]);
  return json(reply);
}
