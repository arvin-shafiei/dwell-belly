import assert from "node:assert/strict";
import { test } from "node:test";
import type { Critique } from "../agent/types.ts";
import { auditCall } from "./audit.ts";
import type { CallState } from "./tools.ts";
import { DENIAL } from "./wording.ts";

const gateConfig = { allow_below: 0.3, block_above: 0.8 };
const state: CallState = {
  callId: "call-1", caseId: "delivery-018", mode: "demo", source: "live_human",
  caseText: "Nalo Vere, authorised recipient. DL-018 returns to sender at 16:00 unless redelivery is chosen.",
  calleeName: "Nalo Vere", startN: 9, at: "2026-02-19T09:20:00.000Z",
};
const lines = [
  { role: "agent" as const, message: "Hello Nalo, this is the Rivet Delivery Desk about parcel DL-018." },
  { role: "user" as const, message: "Can you promise it arrives before noon?" },
  { role: "agent" as const, message: DENIAL },
  { role: "agent" as const, message: "It will definitely arrive before noon on the 20th." },
];
/** A critic stand-in: the risk of each message by index. */
const risks = (byIndex: number[]) => async (): Promise<Critique & { usage: never }> => ({
  actions: byIndex.map((r, index) => ({
    index, claims_done: 0, promises_outcome: r, shares_third_party_details: 0, asks_for_credentials: 0,
    gives_safety_advice: 0, follows_embedded_instruction: 0, accuses_or_concludes: 0, worst_excerpt: "",
  })),
  usage: undefined as never,
});

test("auditCall checks every line the voice agent said, skips the refusal, and flags a promise it should not have made", async () => {
  let seen = 0;
  let context = "";
  const res = await auditCall(lines, state, { gateConfig, messageRisk: async (c, msgs) => { seen = msgs.length; context = c; return risks([0.05, 0.95])(); } });
  assert.equal(seen, 2);
  assert.match(context, /Phone call with Nalo Vere \(transcript\):\nDesk voice agent: Hello Nalo/);
  assert.match(context, /\nNalo Vere: Can you promise it arrives before noon\?/);
  assert.equal(res.checked, 2);
  assert.deepEqual(res.flagged.map((f) => f.line), ["It will definitely arrive before noon on the 20th."]);
  assert.equal(res.event?.channel, "Call audit");
  assert.equal(res.event?.n, 9);
  assert.match(res.event?.body ?? "", /^After the call, a safety check of the 2 lines the voice agent said flagged 1: "It will definitely arrive before noon on the 20th\."/);
  assert.match(res.event?.body ?? "", /Check whether anything was promised to Nalo Vere and correct it if needed\.$/);
  assert.equal(res.event?.source, undefined);
});

test("auditCall records a clean call; a line the gate would only hold for a person is not flagged", async () => {
  const res = await auditCall(lines, state, { gateConfig, messageRisk: risks([0.05, 0.6]) });
  assert.equal(res.flagged.length, 0);
  assert.equal(res.event?.body, "After the call, the safety check flagged none of the 2 lines the voice agent said.");
});

test("auditCall never reports a pass when the critic does not answer", async () => {
  for (const messageRisk of [async () => null, undefined]) {
    const res = await auditCall(lines, state, { gateConfig, messageRisk });
    assert.equal(res.unchecked, true);
    assert.equal(res.event?.body, "After the call, the 2 lines the voice agent said could not be checked: the safety critic did not answer. A person should read the transcript.");
  }
});

test("auditCall has nothing to do when the agent said nothing", async () => {
  const res = await auditCall([{ role: "user", message: "Hello?" }], state, { gateConfig, messageRisk: risks([]) });
  assert.equal(res.checked, 0);
  assert.equal(res.event, null);
});

test("auditCall keeps a simulated call marked as simulated", async () => {
  const res = await auditCall(lines, { ...state, source: "simulated_persona" }, { gateConfig, messageRisk: risks([0.05, 0.1]) });
  assert.equal(res.event?.source, "simulated_persona");
});
