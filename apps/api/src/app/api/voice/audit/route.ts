// POST /api/voice/audit  body: { state: CallState, lines: { role: "user" | "agent", message }[] }
//   -> { checked, flagged, unchecked, event }
// Called by the browser after a call has ended and its transcript is saved: every line the voice agent
// said goes through the safety gate (voice/audit.ts). Separate from the tools route, so a slow check
// can never cost the call's transcript.
import * as judge from "@/agent/judge";
import { json } from "@/lib/cors";
import { auditCall } from "@/voice/audit";
import { gateConfig } from "@/voice/gateConfig";
import { voiceAllowed } from "@/voice/policy";
import type { CallState } from "@/voice/tools";

export async function POST(req: Request) {
  let body: { state?: CallState; lines?: { role: "user" | "agent"; message: string }[] };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return json({ error: "body must be JSON" }, { status: 400 });
  }
  const state = body?.state;
  if (!state || typeof state.callId !== "string" || typeof state.caseText !== "string" || typeof state.calleeName !== "string") {
    return json({ error: "state with callId, caseText and calleeName is required" }, { status: 400 });
  }
  if (!voiceAllowed(state.mode, "start_call", state.source).ok) return json({ error: "voice is not allowed in this mode" }, { status: 403 });
  const result = await auditCall(Array.isArray(body.lines) ? body.lines : [], state, {
    messageRisk: process.env.TYPESAFE_API_KEY ? judge.messageRisk : undefined,
    gateConfig: await gateConfig(),
  });
  return json(result);
}
