const ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: { "Access-Control-Allow-Origin": ORIGIN, ...init?.headers },
  });
}
