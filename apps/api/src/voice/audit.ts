// After a call, every line the voice agent actually said goes through the same safety gate as the
// desk's written messages (hard rules, then the critic's scores against the flow's thresholds), not only
// the sentences it chose to check during the call. The critic sees the whole call as context, and a
// line is flagged when the gate would block it outright: spoken lines in the "hold for a person" band
// are ordinary call talk ("I'll pass that on"), and flagging them would bury a real promise in noise.
// The result is a case event, so the agent can follow up. A critic that does not answer is reported as
// "could not be checked", never as a pass. Never throws.
import type { ViewEvent } from "../agent/load.ts";
import { gate, type GateConfig } from "../agent/gate.ts";
import type { messageRisk as MessageRisk } from "../agent/judge.ts";
import type { Understanding } from "../agent/types.ts";
import type { CallState } from "./tools.ts";
import { DENIAL } from "./wording.ts";

export interface AuditResult {
  checked: number;
  flagged: { line: string; reasons: string[] }[];
  unchecked: boolean;
  event: ViewEvent | null;
}

const AUDIT_TIMEOUT_MS = 4_000;

export async function auditCall(
  lines: { role: "user" | "agent"; message: string }[],
  state: CallState,
  deps: { messageRisk?: (...args: Parameters<typeof MessageRisk>) => ReturnType<typeof MessageRisk>; gateConfig: GateConfig; timeoutMs?: number },
): Promise<AuditResult> {
  const said = lines
    .filter((l) => l?.role === "agent" && typeof l.message === "string")
    .map((l) => l.message.trim())
    .filter((m) => m && m !== DENIAL);
  if (!said.length) return { checked: 0, flagged: [], unchecked: false, event: null };
  const timeoutMs = deps.timeoutMs ?? AUDIT_TIMEOUT_MS;
  const transcript = lines
    .filter((l) => typeof l?.message === "string" && l.message.trim())
    .map((l) => `${l.role === "agent" ? "Desk voice agent" : state.calleeName}: ${l.message.trim()}`)
    .join("\n");
  const context = `${state.caseText}\n\nPhone call with ${state.calleeName} (transcript):\n${transcript}`;
  const critique = deps.messageRisk
    ? await deps.messageRisk(context, said.map((message, index) => ({ index, to: state.calleeName, channel: "Call", message })), { timeoutMs }).catch(() => null)
    : null;
  const event = (body: string): ViewEvent => ({
    n: state.startN, timestamp: state.at, stage: null, channel: "Call audit", from: "Desk (call audit)", to: "Desk supervisor", body,
    ...(state.source === "simulated_persona" ? { source: "simulated_persona" as const } : {}),
  });
  const count = `${said.length} line${said.length === 1 ? "" : "s"}`;
  if (!critique) {
    return {
      checked: 0, flagged: [], unchecked: true,
      event: event(`After the call, the ${count} the voice agent said could not be checked: the safety critic did not answer. A person should read the transcript.`),
    };
  }
  const actions = said.map((message) => ({ recipient: state.calleeName, channel: "Call", kind: "status_update" as const, purpose: "said on a call", message }));
  // Only the party list is read from the analysis; the case text carries the names.
  const gated = gate(actions, { parties: [] } as unknown as Understanding, critique, deps.gateConfig, state.caseText);
  const flagged = gated.flatMap((g, i) => (g.verdict === "block" ? [{ line: said[i], reasons: g.reasons }] : []));
  if (!flagged.length) {
    return { checked: said.length, flagged, unchecked: false, event: event(`After the call, the safety check flagged none of the ${count} the voice agent said.`) };
  }
  const list = flagged.map((f) => `"${f.line}"${f.reasons.length ? ` (${f.reasons.join("; ")})` : ""}`).join("; ");
  return {
    checked: said.length, flagged, unchecked: false,
    event: event(`After the call, a safety check of the ${count} the voice agent said flagged ${flagged.length}: ${list}. Check whether anything was promised to ${state.calleeName} and correct it if needed.`),
  };
}
