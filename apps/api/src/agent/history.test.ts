import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import {
  DEFAULT_STORE_FILE, groupCandidates, historyStore, learner, lookup, openPromises, readRuns, record, references,
  type HumanDecision, type MinutesLeft, type Store,
} from "./history.ts";
import type { RunResult } from "./run.ts";
import type { Decision, PlannedAction, Understanding } from "./types.ts";

const dir = await mkdtemp(path.join(os.tmpdir(), "case-history-"));
after(() => rm(dir, { recursive: true, force: true }));
let n = 0;
const freshStore = (): Store => historyStore(path.join(dir, `store-${++n}`, "runs.jsonl"));

const T0 = Date.parse("2026-03-01T10:00:00.000Z");
const at = (minutes: number) => new Date(T0 + minutes * 60_000);

const action: PlannedAction = { recipient: "Depot control", channel: "Email", kind: "request_to_owner", purpose: "Ask for a recovery plan", message: "Please confirm the plan." };

interface Shape {
  id: string;
  text?: string;
  caseType?: string;
  owner?: string;
  customer?: string;
  outcome?: RunResult["outcome"];
  commitments?: Understanding["commitments"];
  waitingFor?: Decision["waiting_for"];
  outbox?: RunResult["outbox"];
  failed?: boolean;
}

/** Only the fields history reads; the rest of a RunResult is irrelevant here. */
function run(s: Shape): RunResult {
  const understanding = {
    case_type: s.caseType ?? "late delivery", urgency: "medium", decision_owner: s.owner ?? "Depot control",
    parties: [{ name: s.customer ?? `Customer of ${s.id}`, role: "customer", controls: "nothing stated" }, { name: "Depot control", role: "carrier_team", controls: "vans" }],
    commitments: s.commitments ?? [],
  } as unknown as Understanding;
  return {
    bundle: { id: s.id, title: `Case ${s.id}`, documents: [{ name: "index.md", text: s.text ?? "" }], media: [], unreadable: [] },
    outcome: s.outcome ?? "acted",
    understanding: s.failed ? undefined : understanding,
    decision: s.failed ? undefined : { waiting_for: s.waitingFor ?? [] } as unknown as Decision,
    gated: [], outbox: s.outbox ?? [], revised: false,
  } as unknown as RunResult;
}

test("references finds each reference once and ignores look-alikes", () => {
  assert.deepEqual(references("Order DL-024 and TG-912. Invoice INV-953, again DL-024."), ["DL-024", "TG-912", "INV-953"]);
  assert.deepEqual(references("dl-024, A-12, TOOLONG-12, DL-, DL024, xDL-5"), []);
  assert.deepEqual(references(""), []);
});

test("the default store sits in .case-history at the repo root", () => {
  assert.equal(historyStore().file, DEFAULT_STORE_FILE);
  assert.match(DEFAULT_STORE_FILE, /\.case-history[\\/]runs\.jsonl$/);
});

test("record appends one line per run with only the messages that were recorded", async () => {
  const store = freshStore();
  const saved = await record(store, run({
    id: "c1", text: "Parcel DL-024 is late.",
    commitments: [{ what: "Call back", owed_by: "Desk", status: "confirmed", due: "tomorrow 09:00" }],
    waitingFor: [{ what: "Recovery plan", from: "Depot control", by: "none stated" }],
    outbox: [
      { action, status: "recorded", note: "" },
      { action: { ...action, recipient: "Customer" }, status: "held_for_human", note: "" },
      { action: { ...action, recipient: "Press" }, status: "blocked", note: "" },
    ],
  }), at(0));
  assert.equal(saved.ok, true);
  await record(store, run({ id: "c2" }), at(1));

  const lines = (await readFile(store.file, "utf8")).trim().split("\n");
  assert.equal(lines.length, 2);
  assert.deepEqual(JSON.parse(lines[0]), {
    caseId: "c1", at: "2026-03-01T10:00:00.000Z", outcome: "acted", caseType: "late delivery", urgency: "medium",
    references: ["DL-024"],
    parties: [{ name: "Customer of c1", role: "customer" }, { name: "Depot control", role: "carrier_team" }],
    decisionOwner: "Depot control",
    commitments: [{ what: "Call back", owed_by: "Desk", status: "confirmed", due: "tomorrow 09:00" }],
    messages: [{ recipient: "Depot control", channel: "Email", kind: "request_to_owner", purpose: "Ask for a recovery plan" }],
    waitingFor: [{ what: "Recovery plan", from: "Depot control", by: "none stated" }],
  });
});

test("a run that failed before any analysis is still recorded, with empty analysis fields", async () => {
  const store = freshStore();
  const saved = await record(store, run({ id: "c1", text: "DL-024", outcome: "error", failed: true }), at(0));
  assert.equal(saved.ok && saved.record.caseType, "");
  assert.deepEqual(saved.ok && saved.record.references, ["DL-024"]);
  assert.deepEqual(saved.ok && saved.record.commitments, []);
});

test("record reports a disk error instead of throwing", async () => {
  const blocker = path.join(dir, "a-file");
  await writeFile(blocker, "not a directory");
  const saved = await record(historyStore(path.join(blocker, "runs.jsonl")), run({ id: "c1" }), at(0));
  assert.equal(saved.ok, false);
  assert.match(saved.ok ? "" : saved.error, /could not write case history/);
});

test("a missing store is an empty history and damaged lines are skipped, not fatal", async () => {
  const store = freshStore();
  assert.deepEqual(await readRuns(store), { ok: true, records: [], skipped: 0 });
  assert.deepEqual(await lookup(store, { references: ["DL-024"], parties: [] }), { ok: true, byReference: [], byCustomer: [] });

  await record(store, run({ id: "c1", text: "DL-024" }), at(0));
  await writeFile(store.file, `${await readFile(store.file, "utf8")}{"caseId":"torn\n\n[1,2]\n{"caseId":"c9"}\n`);
  const read = await readRuns(store);
  assert.equal(read.records.length, 1);
  assert.equal(read.skipped, 3);
});

test("an unreadable store is reported by every reader and never thrown", async () => {
  const store = historyStore(dir);
  const read = await readRuns(store);
  assert.equal(read.ok, false);
  const found = await lookup(store, { references: ["DL-024"], parties: [] });
  assert.equal(found.ok, false);
  assert.match(found.error ?? "", /could not read case history/);
  assert.equal(await groupCandidates(store, run({ id: "c1", text: "DL-024" }), at(0), { minSize: 1 }), null);
  const promises = await openPromises(store, at(0), () => 5);
  assert.equal(promises.ok, false);
  assert.deepEqual(promises.overdue, []);
});

test("lookup returns shared references newest first, then the same customer, and never the asking case", async () => {
  const store = freshStore();
  await record(store, run({ id: "old", text: "DL-024 damaged", customer: "Sorin Vaal" }), at(0));
  await record(store, run({ id: "new", text: "Chasing DL-024" }), at(10));
  await record(store, run({ id: "same-customer", text: "TG-900", customer: "  sorin   VAAL " }), at(20));
  await record(store, run({ id: "unrelated", text: "TG-901" }), at(30));
  await record(store, run({ id: "me", text: "DL-024", customer: "Sorin Vaal" }), at(40));

  const found = await lookup(store, {
    references: ["DL-024"], caseId: "me",
    parties: [{ name: "Sorin Vaal", role: "customer" }, { name: "Customer of unrelated", role: "carrier_team" }],
  });
  assert.equal(found.ok, true);
  assert.deepEqual(found.byReference.map((r) => r.caseId), ["new", "old"]);
  assert.deepEqual(found.byCustomer.map((r) => r.caseId), ["same-customer"]);
});

test("lookup counts a re-run case once, using its latest run", async () => {
  const store = freshStore();
  await record(store, run({ id: "c1", text: "DL-024", outcome: "error" }), at(0));
  await record(store, run({ id: "c1", text: "DL-024", outcome: "escalated" }), at(5));
  const found = await lookup(store, { references: ["DL-024"], parties: [] });
  assert.deepEqual(found.byReference.map((r) => [r.caseId, r.outcome]), [["c1", "escalated"]]);
});

test("cases with the same owner and type inside the window form a group with the rule in the reason", async () => {
  const store = freshStore();
  await record(store, run({ id: "a" }), at(0));
  await record(store, run({ id: "b", owner: "depot  CONTROL", caseType: "Late Delivery" }), at(30));
  const group = await groupCandidates(store, run({ id: "c" }), at(60));
  assert.deepEqual(group, {
    groupId: "owner-depot-control-type-late-delivery", memberCaseIds: ["c", "b", "a"], size: 3,
    reason: '3 open cases of type "late delivery" with the same decision owner (Depot control) in the last 180 minutes',
  });
});

test("no group below the minimum size, outside the window, for another owner or type, or for closed cases", async () => {
  const store = freshStore();
  await record(store, run({ id: "a" }), at(0));
  assert.equal(await groupCandidates(store, run({ id: "c" }), at(60)), null);

  await record(store, run({ id: "too-old" }), at(-200));
  await record(store, run({ id: "other-owner", owner: "Claims" }), at(10));
  await record(store, run({ id: "other-type", caseType: "damaged" }), at(10));
  await record(store, run({ id: "closed", outcome: "no_action" }), at(10));
  // The asking case's own earlier run must not count towards its group.
  await record(store, run({ id: "c" }), at(20));
  assert.equal(await groupCandidates(store, run({ id: "c" }), at(60)), null);

  assert.equal((await groupCandidates(store, run({ id: "c" }), at(60), { minSize: 2 }))?.size, 2);
  assert.equal((await groupCandidates(store, run({ id: "c" }), at(60), { windowMinutes: 300 }))?.size, 3);
});

test("a shared reference groups cases whatever their owner, type or age", async () => {
  const store = freshStore();
  await record(store, run({ id: "a", text: "Van VAN-77 broke down", owner: "Claims", caseType: "damaged" }), at(-5000));
  await record(store, run({ id: "b", text: "VAN-77 again", owner: "Depot", caseType: "missing" }), at(-10));
  const group = await groupCandidates(store, run({ id: "c", text: "My parcel was on VAN-77, order DL-001" }), at(0));
  assert.deepEqual(group, { groupId: "ref-VAN-77", memberCaseIds: ["c", "b", "a"], size: 3, reason: "3 open cases mention reference VAN-77" });
});

test("failed runs are never grouped by their empty owner and type", async () => {
  const store = freshStore();
  await record(store, run({ id: "a", failed: true, outcome: "error" }), at(0));
  await record(store, run({ id: "b", failed: true, outcome: "error" }), at(0));
  assert.equal(await groupCandidates(store, run({ id: "c", failed: true, outcome: "error" }), at(1)), null);
});

test("open promises are split by time left using the function passed in", async () => {
  const store = freshStore();
  const minutes: Record<string, number | null> = { late: -30, soon: 45, edge: 60, far: 600, "none stated": null };
  const calls: [string, string][] = [];
  const minutesLeft: MinutesLeft = (due, now) => { calls.push([due, now.toISOString()]); return minutes[due] ?? null; };
  await record(store, run({
    id: "c1",
    commitments: [
      { what: "Refund decision", owed_by: "Claims", status: "requested", due: "late" },
      { what: "Redelivery slot", owed_by: "Depot control", status: "confirmed", due: "far" },
      { what: "Old offer", owed_by: "Claims", status: "withdrawn", due: "late" },
      { what: "Refused request", owed_by: "Claims", status: "rejected_or_failed", due: "late" },
    ],
    waitingFor: [{ what: "Photo of the label", from: "Customer", by: "soon" }, { what: "Driver statement", from: "Depot control", by: "none stated" }],
  }), at(0));
  await record(store, run({ id: "c2", waitingFor: [{ what: "Scan record", from: "Tracking", by: "edge" }] }), at(1));

  const p = await openPromises(store, at(5), minutesLeft);
  assert.equal(p.ok, true);
  assert.deepEqual(p.overdue, [{ caseId: "c1", kind: "commitment", what: "Refund decision", who: "Claims", due: "late", minutesLeft: -30 }]);
  assert.deepEqual(p.dueSoon.map((x) => [x.caseId, x.kind, x.what, x.minutesLeft]),
    [["c1", "waiting_for", "Photo of the label", 45], ["c2", "waiting_for", "Scan record", 60]]);
  assert.deepEqual(p.later.map((x) => x.what), ["Redelivery slot"]);
  assert.deepEqual(p.undated.map((x) => [x.what, x.minutesLeft]), [["Driver statement", null]]);
  assert.ok(calls.every(([, now]) => now === at(5).toISOString()));

  const tighter = await openPromises(store, at(5), minutesLeft, { dueSoonMinutes: 50 });
  assert.deepEqual(tighter.dueSoon.map((x) => x.what), ["Photo of the label"]);
  assert.deepEqual(tighter.later.map((x) => x.what), ["Scan record", "Redelivery slot"]);
});

test("open promises come from the latest run of a case, and a broken time function leaves items undated", async () => {
  const store = freshStore();
  await record(store, run({ id: "c1", waitingFor: [{ what: "First ask", from: "Depot", by: "x" }] }), at(0));
  await record(store, run({ id: "c1", waitingFor: [{ what: "Second ask", from: "Depot", by: "x" }] }), at(5));
  const thrown = await openPromises(store, at(10), () => { throw new Error("cannot parse"); });
  assert.deepEqual(thrown.undated.map((x) => x.what), ["Second ask"]);
  const nan = await openPromises(store, at(10), () => Number.NaN);
  assert.deepEqual(nan.undated.map((x) => x.what), ["Second ask"]);
  assert.deepEqual(await openPromises(freshStore(), at(0), () => 1), { ok: true, overdue: [], dueSoon: [], later: [], undated: [] });
});

const cards = (caseType: string, risk: number, options: string): HumanDecision[] =>
  [...options].map((o) => ({ caseType, risk, option: o === "a" ? "approve" : o === "r" ? "reject" : "edit" }));

test("the learner suggests widening after enough approvals just above the threshold", () => {
  const suggestions = learner([...cards("late parcel", 0.35, "aaaaa"), ...cards("Late Parcel", 0.32, "e")]);
  assert.equal(suggestions.length, 1);
  assert.deepEqual({ ...suggestions[0], evidence: { ...suggestions[0].evidence, summary: "" } }, {
    caseType: "Late Parcel", currentAllowBelow: 0.3, suggestedAllowBelow: 0.4,
    evidence: { cards: 6, approved: 5, edited: 1, riskFrom: 0.3, riskTo: 0.4, summary: "" },
  });
  assert.match(suggestions[0].evidence.summary, /approved 5 of the last 6/);
});

test("the learner stays quiet on a rejection, too few approvals, or cards outside the band", () => {
  assert.deepEqual(learner([]), []);
  assert.deepEqual(learner(cards("late parcel", 0.35, "aaaaar")), []);
  assert.deepEqual(learner(cards("late parcel", 0.35, "aaaa")), []);
  assert.deepEqual(learner(cards("late parcel", 0.35, "aaaaee")), []);
  assert.deepEqual(learner(cards("late parcel", 0.45, "aaaaaa")), []);
  assert.deepEqual(learner(cards("late parcel", 0.2, "aaaaaa")), []);
  assert.deepEqual(learner(cards("late parcel", Number.NaN, "aaaaaa")), []);
  // Approvals spread over two case types do not add up.
  assert.deepEqual(learner([...cards("late parcel", 0.35, "aaa"), ...cards("damaged", 0.35, "aaa")]), []);
});

test("only the last cards count: an old rejection is forgiven, a recent one is not", () => {
  assert.equal(learner(cards("late parcel", 0.35, "raaaaaa")).length, 1);
  assert.deepEqual(learner(cards("late parcel", 0.35, "aaaaaara")), []);
});

test("the learner never suggests above the ceiling and reads its limits from config", () => {
  const capped = learner(cards("late parcel", 0.42, "aaaaaa"), { allowBelow: 0.4, bandWidth: 0.3 });
  assert.equal(capped[0].suggestedAllowBelow, 0.5);
  assert.deepEqual(learner(cards("late parcel", 0.55, "aaaaaa"), { allowBelow: 0.4, bandWidth: 0.3 }), []);
  assert.deepEqual(learner(cards("late parcel", 0.5, "aaaaaa"), { allowBelow: 0.5 }), []);
  assert.equal(learner(cards("late parcel", 0.35, "aaa"), { minApprovals: 3, lastCards: 3 }).length, 1);
  assert.equal(learner(cards("late parcel", 0.55, "aaaaaa"), { allowBelow: 0.5, ceiling: 0.7 })[0].suggestedAllowBelow, 0.6);
});

test("a stored line whose lists hold the wrong shapes is skipped, so no reader throws on it", async () => {
  const store = freshStore();
  const saved = await record(store, run({ id: "good", text: "DL-024", customer: "Sorin Vaal" }), at(0));
  assert.equal(saved.ok, true);
  const good = saved.ok ? saved.record : undefined;
  const damaged = [
    { ...good, caseId: "bad-party", references: [], parties: [null] },
    { ...good, caseId: "bad-name", references: [], parties: [{ role: "customer" }] },
    { ...good, caseId: "bad-commitment", commitments: [null] },
    { ...good, caseId: "bad-waiting", waitingFor: ["soon"] },
    { ...good, caseId: "bad-reference", references: [24] },
  ];
  await writeFile(store.file, `${await readFile(store.file, "utf8")}${damaged.map((d) => JSON.stringify(d)).join("\n")}\n`);

  const read = await readRuns(store);
  assert.deepEqual([read.records.map((r) => r.caseId), read.skipped], [["good"], 5]);
  const found = await lookup(store, { references: ["TG-1"], parties: [{ name: "Sorin Vaal", role: "customer" }] });
  assert.deepEqual(found.byCustomer.map((r) => r.caseId), ["good"]);
  const promises = await openPromises(store, at(1), () => 5);
  assert.equal(promises.ok, true);
  assert.equal(await groupCandidates(store, run({ id: "me", text: "DL-024" }), at(1)), null);
});

test("grouping returns null instead of throwing when the clock value is not a real time", async () => {
  const store = freshStore();
  await record(store, run({ id: "a", text: "DL-024" }), at(0));
  await record(store, run({ id: "b", text: "DL-024" }), at(1));
  assert.equal(await groupCandidates(store, run({ id: "c", text: "DL-024" }), new Date(Number.NaN)), null);
});

test("a re-run that failed does not wipe the promises the earlier run found", async () => {
  const store = freshStore();
  await record(store, run({
    id: "c1", commitments: [{ what: "Refund decision", owed_by: "Claims", status: "confirmed", due: "late" }],
    waitingFor: [{ what: "Photo of the label", from: "Customer", by: "late" }],
  }), at(0));
  await record(store, run({ id: "c1", outcome: "error", failed: true }), at(5));
  const p = await openPromises(store, at(10), () => -30);
  assert.deepEqual(p.overdue.map((x) => [x.caseId, x.what]), [["c1", "Refund decision"], ["c1", "Photo of the label"]]);

  // A later run that did complete replaces the earlier one, even when it found nothing owed.
  await record(store, run({ id: "c1" }), at(8));
  assert.deepEqual((await openPromises(store, at(10), () => -30)).overdue, []);
});

test("rounding never lifts the learner's suggestion above the ceiling", () => {
  const [s] = learner(cards("late parcel", 0.42, "aaaaaa"), { allowBelow: 0.4, bandWidth: 0.3, ceiling: 0.456 });
  assert.ok(s.suggestedAllowBelow <= 0.456, `suggested ${s.suggestedAllowBelow}`);
  assert.ok(s.evidence.riskTo <= 0.456);
});
