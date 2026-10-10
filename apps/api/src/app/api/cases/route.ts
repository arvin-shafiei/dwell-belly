import { json } from "@/lib/cors";

// TODO: run an incoming event through the incident flow and return the case trace.
export async function POST(req: Request) {
  const event = await req.json();
  return json({ received: event, status: "not_implemented" }, { status: 501 });
}

export function GET() {
  return json({ cases: [] });
}
