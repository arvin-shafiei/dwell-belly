import assert from "node:assert/strict";
import { test } from "node:test";
import { replan, type Drop, type Van } from "./replan.ts";

const NOW = "2026-03-02T09:00:00Z";

function van(id: string, over: Partial<Van> = {}): Van {
  return { id, available: true, chilled: false, capacityKg: 500, loadKg: 100, lat: 51.5, lng: -0.1, driverMinutesLeft: 240, ...over };
}

function drop(id: string, over: Partial<Drop> = {}): Drop {
  return { id, vanId: "V1", lat: 51.51, lng: -0.1, slotStart: "2026-03-02T09:00:00Z", slotEnd: "2026-03-02T12:00:00Z", weightKg: 20, ...over };
}

const down = van("V1", { available: false });

test("moves a stranded drop to the nearest van that can take it", () => {
  const out = replan([drop("D1")], [down, van("V3", { lat: 51.7 }), van("V2", { lat: 51.52 })], { now: NOW });
  assert.equal(out.ok, true);
  assert.deepEqual(out.moves, [{ dropId: "D1", from: "V1", to: "V2" }]);
  assert.deepEqual(out.unassigned, []);
});

test("leaves drops on working vans alone", () => {
  const out = replan([drop("D1", { vanId: "V2" })], [down, van("V2")], { now: NOW });
  assert.deepEqual(out, { ok: true, moves: [], unassigned: [] });
});

test("a chilled drop only goes to a chilled van, even a farther one", () => {
  const vans = [down, van("V2", { lat: 51.51 }), van("V3", { lat: 51.6, chilled: true })];
  const out = replan([drop("D1", { chilled: true })], vans, { now: NOW });
  assert.deepEqual(out.moves, [{ dropId: "D1", from: "V1", to: "V3" }]);
});

test("capacity fills up across moves", () => {
  const vans = [down, van("V2", { capacityKg: 130, loadKg: 100 })];
  const out = replan([drop("D1"), drop("D2", { slotEnd: "2026-03-02T13:00:00Z" })], vans, { now: NOW });
  assert.deepEqual(out.moves, [{ dropId: "D1", from: "V1", to: "V2" }]);
  assert.deepEqual(out.unassigned, [{ dropId: "D2", reason: "no van can take it: over capacity (1)" }]);
});

test("a van that would arrive after the slot end is not used", () => {
  // About 111 km at 30 km/h is well over three hours; the slot closes in one.
  const out = replan([drop("D1", { lat: 52.5, slotEnd: "2026-03-02T10:00:00Z" })], [down, van("V2")], { now: NOW });
  assert.deepEqual(out.unassigned, [{ dropId: "D1", reason: "no van can take it: would miss the slot (1)" }]);
});

test("waiting for a slot to open counts against driver hours", () => {
  const late = drop("D1", { slotStart: "2026-03-02T14:00:00Z", slotEnd: "2026-03-02T16:00:00Z" });
  const out = replan([late], [down, van("V2", { driverMinutesLeft: 120 })], { now: NOW });
  assert.deepEqual(out.unassigned, [{ dropId: "D1", reason: "no van can take it: not enough driver hours (1)" }]);
  assert.equal(replan([late], [down, van("V2", { driverMinutesLeft: 400 })], { now: NOW }).moves.length, 1);
});

test("a van that is busy until later starts from its freeAt time", () => {
  const tight = drop("D1", { slotEnd: "2026-03-02T09:30:00Z" });
  const out = replan([tight], [down, van("V2", { freeAt: "2026-03-02T10:00:00Z" })], { now: NOW });
  assert.equal(out.moves.length, 0);
  assert.match(out.unassigned[0].reason, /would miss the slot/);
});

test("the most urgent drop is placed first and the rejection reasons are counted", () => {
  const vans = [down, van("V2", { capacityKg: 125, loadKg: 100 }), van("V3", { available: false })];
  const drops = [drop("D-late", { slotEnd: "2026-03-02T15:00:00Z" }), drop("D-soon", { slotEnd: "2026-03-02T10:00:00Z" }), drop("D-v3", { vanId: "V3", chilled: true })];
  const out = replan(drops, vans, { now: NOW });
  assert.deepEqual(out.moves, [{ dropId: "D-soon", from: "V1", to: "V2" }]);
  assert.deepEqual(out.unassigned.map((u) => u.dropId), ["D-v3", "D-late"]);
  assert.equal(out.unassigned[0].reason, "no van can take it: not chilled (1)");
});

test("equally near vans tie-break on van id, whatever the input order", () => {
  const a = replan([drop("D1")], [van("V3"), down, van("V2")], { now: NOW });
  const b = replan([drop("D1")], [van("V2"), van("V3"), down], { now: NOW });
  assert.deepEqual(a, b);
  assert.equal(a.moves[0].to, "V2");
});

test("the same input gives the same output and inputs are not changed", () => {
  const drops = [drop("D2"), drop("D1"), drop("D3", { chilled: true })];
  const vans = [down, van("V2"), van("V3", { chilled: true, lat: 51.4 })];
  const before = JSON.stringify({ drops, vans });
  const first = replan(drops, vans, { now: NOW });
  assert.deepEqual(replan(drops, vans, { now: NOW }), first);
  assert.equal(JSON.stringify({ drops, vans }), before);
});

test("a drop on a van that is not in the fleet list is treated as stranded", () => {
  const out = replan([drop("D1", { vanId: "ghost" })], [van("V2")], { now: NOW });
  assert.deepEqual(out.moves, [{ dropId: "D1", from: "ghost", to: "V2" }]);
});

test("empty input and no available van", () => {
  assert.deepEqual(replan([], [], { now: NOW }), { ok: true, moves: [], unassigned: [] });
  assert.deepEqual(replan([drop("D1")], [down], { now: NOW }).unassigned, [{ dropId: "D1", reason: "no van is available" }]);
});

test("bad data is reported, never thrown", () => {
  const bad = drop("D1", { slotEnd: "not a time" });
  assert.deepEqual(replan([bad], [down, van("V2")], { now: NOW }).unassigned, [{ dropId: "D1", reason: "drop has no usable position, weight or slot" }]);

  const noClock = replan([drop("D1")], [down, van("V2")], { now: "soon" });
  assert.equal(noClock.ok, false);
  assert.match(noClock.error ?? "", /now/);

  assert.equal(replan([drop("D1")], [down, van("V2")], { now: NOW, speedKph: 0 }).ok, false);
  assert.equal(replan(null as never, [van("V2")], { now: NOW }).ok, false);
  assert.equal(replan([drop("D1")], [down, van("V2")], undefined as never).ok, false);

  // A van with unusable numbers is ignored, not allowed to take work on a NaN.
  const broken = van("V2", { capacityKg: Number.NaN });
  assert.deepEqual(replan([drop("D1")], [down, broken], { now: NOW }).unassigned, [{ dropId: "D1", reason: "no van is available" }]);
});

test("a slot that ends before it starts is unusable, not served after it closed", () => {
  const inverted = drop("D1", { slotStart: "2026-03-02T14:00:00Z", slotEnd: "2026-03-02T12:00:00Z" });
  const out = replan([inverted], [down, van("V2")], { now: NOW });
  assert.deepEqual(out.moves, []);
  assert.deepEqual(out.unassigned, [{ dropId: "D1", reason: "drop has no usable position, weight or slot" }]);
});

test("a negative weight cannot free up room on a van", () => {
  const vans = [down, van("V2", { capacityKg: 110, loadKg: 100 })];
  const out = replan([drop("D0", { weightKg: -50, slotEnd: "2026-03-02T10:00:00Z" }), drop("D1", { weightKg: 40 })], vans, { now: NOW });
  assert.deepEqual(out.moves, []);
  assert.deepEqual(out.unassigned, [
    { dropId: "D0", reason: "drop has no usable position, weight or slot" },
    { dropId: "D1", reason: "no van can take it: over capacity (1)" },
  ]);
});

test("a stranded drop without a usable id is reported, not silently lost", () => {
  const out = replan([drop("D1"), { ...drop("x"), id: 7 as never }, null as never], [down, van("V2")], { now: NOW });
  assert.equal(out.ok, true);
  assert.deepEqual(out.moves, [{ dropId: "D1", from: "V1", to: "V2" }]);
  assert.deepEqual(out.unassigned, [{ dropId: "7", reason: "drop has no usable id" }]);
});

test("text that only happens to end in a number is not read as a time", () => {
  assert.equal(replan([drop("D1")], [down, van("V2")], { now: "run 5" }).ok, false);
  const out = replan([drop("D1", { slotEnd: "slot 2030" })], [down, van("V2")], { now: NOW });
  assert.deepEqual(out.unassigned, [{ dropId: "D1", reason: "drop has no usable position, weight or slot" }]);
});
