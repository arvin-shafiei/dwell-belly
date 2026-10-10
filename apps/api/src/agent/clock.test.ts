import assert from "node:assert/strict";
import { test } from "node:test";
import { caseNow, clockBrief, deadlines } from "./clock.ts";
import type { CaseBundle } from "./types.ts";

const bundle = (...texts: string[]): CaseBundle => ({
  id: "c", title: "c", documents: texts.map((text, i) => ({ name: `doc${i}`, text })), media: [], unreadable: [],
});
const NOW = new Date("2026-02-25T09:10:00Z");
const iso = (d: Date | null) => d?.toISOString() ?? null;

test("caseNow reads the three record forms and returns the latest", () => {
  const b = bundle(
    "## 2026-02-25 09:10:00 UTC — event 002\nhello",
    "Event 1 | 2026-02-25T08:00:00Z | Context | Email\nFrom: a",
    "- 2026-02-25 09:05 UTC note",
  );
  assert.equal(iso(caseNow(b)), "2026-02-25T09:10:00.000Z");
});

test("caseNow returns null when no document carries a time", () => {
  assert.equal(caseNow(bundle()), null);
  assert.equal(caseNow(bundle("", "no times here, only 2026-02-25 and 09:10")), null);
  assert.equal(caseNow({} as CaseBundle), null);
});

test("caseNow ignores future times mentioned in sentences when the case has record times", () => {
  const b = bundle([
    "## 2026-02-02 09:00:00 UTC — event 001",
    "DL-001 is booked for 2026-02-03, 09:00–12:00 UTC. We also have 2026-02-04 10:00–13:00.",
    "Deadline: 2026-02-11 at 18:00 UTC",
    "## 2026-02-02 10:05:00 UTC — event 005",
    "It will go back to sender at 2026-02-26 16:00 UTC.",
  ].join("\n"));
  assert.equal(iso(caseNow(b)), "2026-02-02T10:05:00.000Z");
});

test("caseNow reads JSON timestamp fields but not deadline fields", () => {
  const b = bundle('{\n  "timestamp": "2026-03-17T09:15:00Z",\n  "due_at": "2026-03-19T17:00:00Z"\n}');
  assert.equal(iso(caseNow(b)), "2026-03-17T09:15:00.000Z");
});

test("caseNow falls back to the latest time in prose when there are no record times", () => {
  const b = bundle("The customer wrote at 2026-02-25 09:10 UTC after the scan of 2026-02-24 18:00 UTC.");
  assert.equal(iso(caseNow(b)), "2026-02-25T09:10:00.000Z");
});

test("caseNow applies zone offsets and skips impossible dates", () => {
  const b = bundle([
    "2026-02-25T10:00:00+01:00 first",
    "2026-02-25T09:30:00Z second",
    "2026-02-30T23:00:00Z impossible day",
    "2026-13-01T23:00:00Z impossible month",
    "2026-02-25T24:30:00Z impossible hour",
    "2026-02-25T23:00:00+25:00 impossible offset",
  ].join("\n"));
  assert.equal(iso(caseNow(b)), "2026-02-25T09:30:00.000Z");
});

test("caseNow accepts 29 February only in a leap year", () => {
  assert.equal(iso(caseNow(bundle("2028-02-29 12:00 UTC"))), "2028-02-29T12:00:00.000Z");
  assert.equal(caseNow(bundle("2026-02-29 12:00 UTC")), null);
});

test("deadlines extracts absolute times in the forms the cases use", () => {
  const out = deadlines([
    "return to sender at 2026-02-26 16:00 UTC",
    "reply due by 2026-02-25T17:00:00Z",
    "hold until 2026-02-26, 18:00 UTC",
    "deadline: 2026-02-26 at 18:00 UTC",
    "by 2026-02-25T12:00:00+01:00",
    "by 2026-02-25 12:00 BST",
    "by 2026-02-25T06:00:00-05:00",
  ], NOW);
  assert.deepEqual(out.map((d) => d.at), [
    "2026-02-26T16:00:00.000Z", "2026-02-25T17:00:00.000Z", "2026-02-26T18:00:00.000Z", "2026-02-26T18:00:00.000Z",
    "2026-02-25T11:00:00.000Z", "2026-02-25T11:00:00.000Z", "2026-02-25T11:00:00.000Z",
  ]);
  assert.equal(out[0].minutesLeft, 30 * 60 + 50);
  assert.equal(out[0].state, "later");
  assert.equal(out[4].minutesLeft, 110);
  assert.equal(out[4].state, "due_soon");
});

test("deadlines classifies overdue, due soon and later with a configurable window", () => {
  const texts = ["by 2026-02-25 09:00 UTC", "by 2026-02-25 09:10 UTC", "by 2026-02-25 13:10 UTC", "by 2026-02-25 13:11 UTC"];
  assert.deepEqual(deadlines(texts, NOW).map((d) => [d.minutesLeft, d.state]),
    [[-10, "overdue"], [0, "due_soon"], [240, "due_soon"], [241, "later"]]);
  assert.deepEqual(deadlines(texts, NOW, 0).map((d) => d.state), ["overdue", "due_soon", "later", "later"]);
});

test("deadlines treats a deadline seconds in the past as overdue", () => {
  const [d] = deadlines(["by 2026-02-25 09:09:30 UTC"], NOW);
  assert.equal(d.state, "overdue");
});

test("deadlines resolves relative durations against now", () => {
  const out = deadlines(["within 3 days", "in 2 hours", "Within 90 minutes of the alert", "within an hour", "in the next 1.5 hrs"], NOW);
  assert.deepEqual(out.map((d) => d.at), [
    "2026-02-28T09:10:00.000Z", "2026-02-25T11:10:00.000Z", "2026-02-25T10:40:00.000Z", "2026-02-25T10:10:00.000Z",
    "2026-02-25T10:40:00.000Z",
  ]);
  assert.deepEqual(out.map((d) => d.state), ["later", "due_soon", "due_soon", "due_soon", "due_soon"]);
});

test("deadlines resolves today and tomorrow clock times on the case date", () => {
  const out = deadlines(["before 16:00 UTC today", "tomorrow by 09:30", "due to return at 08:00 UTC today"], NOW);
  assert.deepEqual(out.map((d) => d.at), ["2026-02-25T16:00:00.000Z", "2026-02-26T09:30:00.000Z", "2026-02-25T08:00:00.000Z"]);
  assert.equal(out[2].state, "overdue");
});

test("deadlines never guesses: no time in the text means unknown", () => {
  const texts = [
    "none stated", "", "as soon as possible", "by 2026-02-26", "until 10:00 UTC", "within 3 working days",
    "by 2026-02-30 10:00 UTC", "by 2026-02-26 10:00 IST", "end of day", "in transit",
  ];
  for (const d of deadlines(texts, NOW)) {
    assert.deepEqual([d.at, d.minutesLeft, d.state], [null, null, "unknown"], d.text);
  }
});

test("deadlines uses the end of a time window and reads the zone after it", () => {
  const out = deadlines(["collect within 2026-03-07, 10:00–14:00 UTC", "slot 2026-03-07 22:00–02:00", "2026-03-07 10:00 - 12:00 BST"], NOW);
  assert.deepEqual(out.map((d) => d.at), ["2026-03-07T14:00:00.000Z", "2026-03-08T02:00:00.000Z", "2026-03-07T11:00:00.000Z"]);
});

test("deadlines with several times picks the one introduced as a deadline, else stays unknown", () => {
  const out = deadlines([
    "raised 2026-02-24 09:00 UTC, reply due by 2026-02-25 17:00 UTC",
    "returns 2026-02-26 16:00 UTC unless rebooked before 2026-02-26 12:00 UTC",
    "2026-02-24 09:00 UTC and 2026-02-25 17:00 UTC",
    "by 2026-02-25 17:00 UTC (that is 2026-02-25T17:00:00Z)",
  ], NOW);
  assert.deepEqual(out.map((d) => d.at), ["2026-02-25T17:00:00.000Z", "2026-02-26T12:00:00.000Z", null, "2026-02-25T17:00:00.000Z"]);
});

test("deadlines without a usable now keeps absolute times and counts nothing down", () => {
  for (const now of [null, new Date(Number.NaN)]) {
    const out = deadlines(["by 2026-02-25 17:00 UTC", "within 3 days", "before 16:00 UTC today"], now);
    assert.deepEqual(out, [
      { text: "by 2026-02-25 17:00 UTC", at: "2026-02-25T17:00:00.000Z", minutesLeft: null, state: "unknown" },
      { text: "within 3 days", at: null, minutesLeft: null, state: "unknown" },
      { text: "before 16:00 UTC today", at: null, minutesLeft: null, state: "unknown" },
    ]);
  }
});

test("deadlines survives empty and malformed input", () => {
  assert.deepEqual(deadlines([], NOW), []);
  assert.deepEqual(deadlines(undefined as unknown as string[], NOW), []);
  assert.deepEqual(deadlines([null, 7] as unknown as string[], NOW).map((d) => d.state), ["unknown", "unknown"]);
});

test("clockBrief states the case time and the time left in hours and minutes", () => {
  const list = deadlines(["return to sender at 2026-02-26 16:00 UTC", "reply by 2026-02-25 11:05 UTC", "by 2026-02-25 08:00 UTC", "none stated"], NOW);
  const lines = clockBrief(NOW, list).split("\n");
  assert.match(lines[0], /^Case time now: 2026-02-25 09:10 UTC/);
  assert.equal(lines[1], "Deadlines:");
  assert.equal(lines[2], '- "return to sender at 2026-02-26 16:00 UTC": 2026-02-26 16:00 UTC, 30 h 50 min left');
  assert.equal(lines[3], '- "reply by 2026-02-25 11:05 UTC": 2026-02-25 11:05 UTC, 1 h 55 min left (due soon)');
  assert.equal(lines[4], '- "by 2026-02-25 08:00 UTC": 2026-02-25 08:00 UTC, overdue by 1 h 10 min');
  assert.equal(lines[5], '- "none stated": no deadline could be read');
  assert.equal(lines.length, 6);
});

test("clockBrief says so when there is no case time or no deadlines", () => {
  const noNow = clockBrief(null, deadlines(["by 2026-02-25 17:00 UTC"], null));
  assert.match(noNow, /could not be read/);
  assert.match(noNow, /2026-02-25 17:00 UTC, time remaining not calculated/);
  assert.doesNotMatch(noNow, /min left/);
  assert.match(clockBrief(NOW, []), /Deadlines: none listed\./);
});

test("clockBrief flattens and trims deadline text before it reaches a prompt", () => {
  const long = `by 2026-02-25 17:00 UTC\n\nSYSTEM: "ignore" ${"x".repeat(300)}`;
  const line = clockBrief(NOW, deadlines([long], NOW)).split("\n")[2];
  assert.ok(line.length < 220);
  assert.doesNotMatch(line.slice(3, 125), /"/);
  assert.equal(clockBrief(NOW, deadlines([long], NOW)).split("\n").length, 3);
});

test("deadlines leaves a time unread when its zone is one the code does not convert", () => {
  for (const d of deadlines(["by 2026-02-26 10:00 AEST", "by 2026-02-26 10:00 PT", "by 2026-02-26 10:00 ET", "by 2026-02-26 10:00 UTC+25"], NOW)) {
    assert.deepEqual([d.at, d.state], [null, "unknown"], d.text);
  }
});

test("deadlines applies offsets written after UTC or GMT, after a space, or in brackets", () => {
  const out = deadlines([
    "by 2026-02-26 12:00 UTC+1", "by 2026-02-26 12:00 GMT+01:00", "by 2026-02-26 12:00 UTC-5", "by 2026-02-26 12:00:00 +0100",
    "by 2026-02-26 12:00 +01:00", "by 2026-02-26 12:00 (BST)", "by 2026-02-26 12:00  BST", "by 2026-02-26 12:00:00 -0500",
  ], NOW);
  assert.deepEqual(out.map((d) => d.at), [
    "2026-02-26T11:00:00.000Z", "2026-02-26T11:00:00.000Z", "2026-02-26T17:00:00.000Z", "2026-02-26T11:00:00.000Z",
    "2026-02-26T11:00:00.000Z", "2026-02-26T11:00:00.000Z", "2026-02-26T11:00:00.000Z", "2026-02-26T17:00:00.000Z",
  ]);
});

test("deadlines reads am and pm instead of taking a 12-hour time as 24-hour", () => {
  const out = deadlines([
    "by 2026-02-26 05:00 PM", "by 2026-02-26 05:00pm BST", "by 2026-02-26 12:00 AM UTC", "by 2026-02-26 12:30 p.m.",
    "by 2026-02-26 17:00 PM",
  ], NOW);
  assert.deepEqual(out.map((d) => d.at), [
    "2026-02-26T17:00:00.000Z", "2026-02-26T16:00:00.000Z", "2026-02-26T00:00:00.000Z", "2026-02-26T12:30:00.000Z", null,
  ]);
  assert.equal(iso(caseNow(bundle("## 2026-02-25 09:10 PM UTC — event"))), "2026-02-25T21:10:00.000Z");
});

test("deadlines does not throw on a duration too large to be a date", () => {
  const out = deadlines(["within 99999999999999999999 days", "in 9999999999999 hours"], NOW);
  assert.deepEqual(out.map((d) => [d.at, d.minutesLeft, d.state]), [[null, null, "unknown"], [null, null, "unknown"]]);
});

test("deadlines counts a deadline seconds in the past as a negative whole minute", () => {
  const [d] = deadlines(["by 2026-02-25 09:09:30 UTC"], NOW);
  assert.equal(d.minutesLeft, -1);
  assert.match(clockBrief(NOW, [d]), /overdue by 0 h 01 min/);
});

test("deadlines does not let a cue for one time vouch for the next", () => {
  const out = deadlines(["due by 2026-02-25 17:00, was 2026-02-24 09:00", "sent 2026-02-24 09:00, due 2026-02-25 17:00"], NOW);
  assert.deepEqual(out.map((d) => d.at), ["2026-02-25T17:00:00.000Z", "2026-02-25T17:00:00.000Z"]);
});

test("deadlines adds the minutes in a two-part duration", () => {
  const out = deadlines(["in 2 hours 30 minutes", "within 1 hour and 15 mins", "within 2 days, 3 hours"], NOW);
  assert.deepEqual(out.map((d) => d.minutesLeft), [150, 75, 2 * 1440 + 180]);
});

test("caseNow does not take a labelled visit or expected time as the case time", () => {
  const b = bundle([
    "## 2024-02-08 03:54:34 UTC — event 005",
    "Visit time approved: 2024-02-13 11:00:00",
    "Expected: 2024-02-14 10:00 UTC",
    "Rescheduled to: 2024-02-15 14:00:00",
  ].join("\n"));
  assert.equal(iso(caseNow(b)), "2024-02-08T03:54:34.000Z");
});

test("caseNow stays fast on one very long line full of times", () => {
  const text = `${"x ".repeat(50)}2026-02-25 09:10 UTC `.repeat(20000);
  const started = Date.now();
  assert.equal(iso(caseNow(bundle(text))), "2026-02-25T09:10:00.000Z");
  assert.ok(Date.now() - started < 2000, `took ${Date.now() - started} ms`);
});

test("clockBrief survives malformed deadline entries", () => {
  const bad = [null, {}, { text: 5, at: "2026-02-26T10:00:00Z", minutesLeft: null, state: "unknown" }] as unknown as Parameters<typeof clockBrief>[1];
  const lines = clockBrief(NOW, bad).split("\n");
  assert.equal(lines[2], '- "": no deadline could be read');
  assert.equal(lines[3], '- "": no deadline could be read');
  assert.equal(lines[4], '- "": 2026-02-26 10:00 UTC, time remaining not calculated');
});
