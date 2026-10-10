// Small helpers shared by the /api/console route handlers.
export function jsonError(err: unknown, status = 500): Response {
  const message = err instanceof Error ? err.message : String(err);
  const code = typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status : status;
  return Response.json({ error: message }, { status: code });
}
