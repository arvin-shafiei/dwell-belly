// Builds a workflow case script from a real delivery scenario (world/scenarios.ts) plus Reality Test
// modifiers. Pure: the only randomness comes from the injected rand().
import { getScenario, type CaseScenario, type Modifier, type Scene } from "../../scenarios";
import type { Outcome, ScenarioInput, Spec } from "./engine";

/** Scenes where even the plain case goes to a human (damage, safety, high value, loss). */
const HUMAN_SCENES = new Set<Scene>([
  "leaking_parcel", "cold_chain_breach", "damage_confirmed", "pod_missing_high_value", "lost_parcel",
]);

const lead = (s: string | null | undefined) => (s ?? "").split(",")[0].trim();

/** Short quote that fits `room` chars, with closing quote kept. */
function quote(text: string, room: number) {
  const t = text.replace(/\s+/g, " ").trim();
  return `"${t.length <= room - 2 ? t : t.slice(0, Math.max(4, room - 3)) + "…"}"`;
}

function fallback(id: string): CaseScenario {
  return {
    id, title: `Scenario ${id}`, scene: "tracking_stale", where: "office", shipment: null, context: null,
    request: "Where is my parcel?",
    messages: [{ channel: "Customer portal", from: "Customer", body: "Where is my parcel?" }],
    expected: { summary: "Acknowledge and open a trace with the carrier.", recipient: "Customer", channel: "Customer portal" },
    boundaries: null,
  };
}

export function scenarioSpec(input: ScenarioInput, rand: () => number): Spec {
  const s = getScenario(input.scenarioId) ?? fallback(input.scenarioId);
  const mods = new Set<Modifier>(input.modifiers);
  const has = (m: Modifier) => mods.has(m);
  const range = (a: number, b: number): [number, number] => [a, b];

  // Who the customer is and how they wrote in (for "ask one question" replies).
  const fromCustomer = s.messages.find((m) => m.body === s.request) ?? s.messages[s.messages.length - 1];
  const custChannel = fromCustomer?.channel ?? "Customer portal";
  const custName = lead(fromCustomer?.from) || "Customer";
  const exp = s.expected ?? { summary: "Acknowledge and investigate.", recipient: custName, channel: custChannel };
  const expChannel = exp.channel ?? custChannel;
  const expRecipient = exp.recipient ?? custName;

  // Ingest: the real messages plus one extra per modifier.
  const nMsgs = s.messages.length + mods.size;
  const head = `Ingest: ${nMsgs} msgs${has("noise") ? " · 3 noise ignored" : ""} · `;
  const ingest = head + quote(s.request ?? s.messages[0]?.body ?? s.title, 90 - head.length);

  const ref = s.shipment ?? "no shipment ref";
  const history = has("repeat_complaint")
    ? `History: ${ref} · broken promise: call back due yesterday · 3rd contact`
    : has("do_nothing")
      ? `History: ${ref} · already rebooked tomorrow 9–12, customer confirmed`
      : `History: ${ref} · ${s.context ?? s.title}`;

  const urgent = has("repeat_complaint") || has("time_pressure") || has("needs_human") || HUMAN_SCENES.has(s.scene);

  // Planner: the scenario's expected next action, with refusals noted up front.
  const refusals: string[] = [];
  if (has("prompt_injection")) refusals.push("injected text treated as data");
  if (has("out_of_policy")) refusals.push("won't promise £500 refund, merchant decides");
  if (has("privacy_request")) refusals.push("won't share third-party details");
  const plan = has("do_nothing")
    ? "Plan: nothing to do · already handled, no duplicate action"
    : has("missing_context")
      ? "Plan: ask for order no. + postcode first · no action until matched"
      : `Plan: ${[...refusals, exp.summary].join(" · ")}`;

  // Gate: injection blocks; humans for needs_human / deadlines / risky scenes.
  let riskRange = range(0.05, 0.25);
  let card = ["Send planned message", "Escalate to ops lead", "Investigate"];
  let safe = "Send planned message";
  let gateNote: string | undefined;
  if (has("prompt_injection")) riskRange = range(0.9, 0.97);
  else if (has("time_pressure")) {
    riskRange = range(0.5, 0.75);
    card = ["Act before deadline", "Extend hold", "Let it return"];
    safe = "Act before deadline";
    gateNote = "returns in 2h; no answer → act";
  } else if (has("needs_human")) {
    riskRange = range(0.55, 0.78);
    card = ["Send planned message", "Escalate to manager", "Hold"];
  } else if (HUMAN_SCENES.has(s.scene)) riskRange = range(0.32, 0.55);

  const outcome: Outcome | undefined = has("do_nothing") ? "no_action" : has("missing_context") ? "asked_for_info" : undefined;
  const action = has("missing_context")
    ? `${custChannel} → ${custName}: which order number and postcode?`
    : `${expChannel} → ${expRecipient}: ${exp.summary}`;

  // Light jitter so the triage probability isn't identical every run.
  const p = 0.86 + rand() * 0.1;

  return {
    kind: "scenario",
    title: s.title,
    caseLabel: s.id,
    scenario: input,
    ingestRunner: "claude",
    ingest,
    history,
    intent: s.scene,
    priority: urgent ? "high" : "medium",
    p,
    clash: has("conflicting_stories")
      ? "Clash: driver 'delivered, photo taken' vs customer 'nobody came' · believe neither"
      : undefined,
    group: has("cascade") ? "Group: 12 more on same route merged → 1 case, 1 message to all" : "Group: no related open cases",
    missing: has("missing_context") ? "Missing info: no order no. or address · ask one precise question first" : undefined,
    plan,
    risk: riskRange,
    riskRange,
    card,
    safe,
    gateNote,
    blockReason: has("prompt_injection") ? "prompt injection treated as data, logged" : "out of policy",
    action,
    target: lead(expRecipient),
    verifyFails: has("failed_action"),
    verifyFailText: "Verify: 503 from carrier email gateway · retrying once",
    verifyOk: has("failed_action")
      ? "Verify: retry delivered · no success claimed before ack"
      : `Verify: delivered to ${lead(expRecipient)} · ack logged`,
    noAction: has("do_nothing"),
    outcome,
    deliveryIds: s.shipment ? [s.shipment] : [],
  };
}
