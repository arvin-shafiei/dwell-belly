import { json } from "@/lib/cors";

// `agent.ready` is what a UI should check before offering a real run: without the writing-model
// key every case would only get a failure answer. Only presence is reported, never a value.
export function GET() {
  const claude = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  const jev = Boolean(process.env.TYPESAFE_API_KEY);
  return json({ ok: true, time: new Date().toISOString(), agent: { ready: claude, claude, jev } });
}
