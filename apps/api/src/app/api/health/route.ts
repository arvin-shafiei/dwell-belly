import { json } from "@/lib/cors";

export function GET() {
  return json({ ok: true, time: new Date().toISOString() });
}
