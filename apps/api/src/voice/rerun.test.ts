import assert from "node:assert/strict";
import { test } from "node:test";
import type { CaseView, ViewEvent } from "../agent/load.ts";
import { buildRerun, caseTime, priorDeskEvents } from "./rerun.ts";

const ev = (n: number, timestamp: string, body: string, extra: Partial<ViewEvent> = {}): ViewEvent =>
  ({ n, timestamp, stage: null, channel: "Email", from: "Dispatch", to: "Desk", body, ...extra });

const view: CaseView = {
  id: "delivery-003",
  title: "Driver cannot access a gated building",
  events: [ev(1, "2026-02-04T09:00:00Z", "Driver at the gate."), ev(2, "2026-02-04 09:10:00 UTC", "Please contact the recipient.")],
};

test("caseTime adds elapsed time to the last case event, never the wall clock", () => {
  assert.equal(caseTime(view, 90_000), "2026-02-04T09:11:30.000Z");
  assert.equal(caseTime({ id: "x", events: [ev(1, "not a time", "hi")] }, 5_000), "");
});

test("priorDeskEvents turns recorded outbox entries into desk events and skips held and blocked ones", () => {
  const outbox = [
    { status: "recorded", action: { recipient: "Elva Kesh, recipient", channel: "Call transcript", message: "Can you let the driver in?" } },
    { status: "held_for_human", action: { recipient: "Merchant", channel: "Email", message: "Offer a credit." } },
    { status: "blocked", action: { recipient: "Neighbour", channel: "Email", message: "Share the code." } },
  ];
  const events = priorDeskEvents(outbox, 3, "2026-02-04T09:11:30.000Z");
  assert.deepEqual(events, [{
    n: 3, timestamp: "2026-02-04T09:11:30.000Z", stage: null, channel: "Call transcript",
    from: "Desk", to: "Elva Kesh, recipient", body: "Already sent by the desk: Can you let the driver in?",
  }]);
});

test("buildRerun appends prior desk events then new voice events, numbered after the last event, on case time", () => {
  const note = ev(99, "2026-10-10T12:30:00Z", "Gate's locked, I can wait 10 minutes.", { channel: "Voice note", from: "Fen Orlo, route driver", source: "live_human" });
  const out = buildRerun({
    view,
    previousOutbox: [{ status: "recorded", action: { recipient: "Dispatch", channel: "Email", message: "Driver is waiting at the gate." } }],
    newEvents: [note],
    elapsedMs: 60_000,
    mode: "demo",
  });
  assert.equal(out.view.events.length, 4);
  assert.deepEqual(out.view.events.map((e) => e.n), [1, 2, 3, 4]);
  assert.equal(out.view.events[2].from, "Desk");
  assert.equal(out.view.events[3].body, "Gate's locked, I can wait 10 minutes.");
  // The wall-clock time on the new event is replaced by the case's own time.
  assert.equal(out.view.events[3].timestamp, "2026-02-04T09:11:00.000Z");
  assert.equal(out.view.events[3].source, "live_human");
  assert.equal(out.synthetic, false);
  // The original view is not mutated.
  assert.equal(view.events.length, 2);
});

test("buildRerun marks synthetic when a simulated_persona event is present", () => {
  const persona = ev(1, "", "I'm at the gate.", { channel: "Voice note", source: "simulated_persona" });
  assert.equal(buildRerun({ view, newEvents: [persona], elapsedMs: 0, mode: "demo" }).synthetic, true);
});
