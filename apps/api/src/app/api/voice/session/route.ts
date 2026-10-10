import { json } from "@/lib/cors";
import { conversationToken } from "@/voice/elevenlabs";
import { buildSession, type SessionRequest } from "@/voice/session";

// POST /api/voice/session  body (JSON sent as text/plain): a SessionRequest.
// Returns { callId, token, dynamicVariables } for the browser to start a WebRTC call with the Desk
// Caller agent. The ElevenLabs key never leaves the server; the browser only gets a short-lived token.
export async function POST(req: Request) {
  let body: SessionRequest;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return json({ error: "the request could not be read" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || typeof body.caseId !== "string" || (body.purpose !== "approval" && body.purpose !== "call")) {
    return json({ error: "caseId and purpose (approval or call) are required" }, { status: 400 });
  }
  const session = buildSession({ ...body, brief: String(body.brief ?? ""), goal: String(body.goal ?? "") });
  if (!session.ok) return json({ error: session.error }, { status: session.status });
  const token = await conversationToken(process.env.ELEVENLABS_AGENT_ID ?? "");
  if (!token.ok) return json({ error: token.error }, { status: 502 });
  return json({ callId: session.callId, token: token.token, dynamicVariables: session.dynamicVariables });
}
