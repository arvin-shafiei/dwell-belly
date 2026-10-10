import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { Flow } from "../lib/flow.ts";
import { fromView, type CaseView } from "./load.ts";
import { selfTest, type GeneratedCase, type RunCaseFn } from "./selftest.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const flow: Flow = { id: "test-flow", name: "Test", business: "", nodes: [], edges: [] };

function makeCase(id: string, mutation: string, acceptable: string[]): GeneratedCase {
  return {
    id, mutation, title: `Case: ${id}`, context: "Background.", initial_request: "Where is my parcel?",
    events: [{ n: 1, timestamp: "2026-03-04T09:00:00Z", stage: "Escalation", channel: "Email", from: "A recipient", to: "The desk", body: "Where is my parcel?" }],
    expected: { acceptable_dispositions: acceptable },
  };
}

/** Answers each case id with a scripted outcome; an Error is thrown. */
function scripted(outcomes: Record<string, string | Error>): RunCaseFn & { seen: CaseView[] } {
  const seen: CaseView[] = [];
  const run = async (view: CaseView) => {
    seen.push(view);
    const outcome = outcomes[view.id];
    if (outcome instanceof Error) throw outcome;
    return { outcome };
  };
  return Object.assign(run, { seen });
}

test("maps each outcome to a disposition and scores it against the key", async () => {
  const cases = [
    makeCase("a", "noise", ["contact"]),
    makeCase("b", "missing_context", ["contact"]),
    makeCase("c", "out_of_policy_demand", ["contact", "escalate"]),
    makeCase("d", "out_of_policy_demand", ["escalate"]),
    makeCase("e", "no_action_needed", ["no_action"]),
    makeCase("f", "noise", ["contact"]),
    makeCase("g", "no_action_needed", ["no_action"]),
  ];
  const res = await selfTest(flow, cases, scripted({
    a: "acted", b: "asked_for_info", c: "escalated", d: "blocked", e: "no_action", f: "escalated", g: "acted",
  }));
  assert.equal(res.flowId, "test-flow");
  assert.equal(res.total, 7);
  assert.equal(res.passed, 5);
  assert.deepEqual(res.failed, [
    { id: "f", mutation: "noise", expected: ["contact"], got: "escalate" },
    { id: "g", mutation: "no_action_needed", expected: ["no_action"], got: "contact" },
  ]);
  assert.deepEqual(res.byMutation, {
    noise: { total: 2, passed: 1 },
    missing_context: { total: 1, passed: 1 },
    out_of_policy_demand: { total: 2, passed: 2 },
    no_action_needed: { total: 2, passed: 1 },
  });
  assert.deepEqual(res.errors, []);
});

test("a case that throws, errors or returns nonsense fails alone and the rest still run", async () => {
  const cases = [
    makeCase("a", "noise", ["contact"]),
    makeCase("b", "noise", ["contact"]),
    makeCase("c", "failed_action", ["contact"]),
    makeCase("d", "failed_action", ["contact"]),
    makeCase("e", "noise", ["contact"]),
  ];
  const run: RunCaseFn = async (view) => {
    if (view.id === "a") throw new Error("socket hang up");
    if (view.id === "b") return { outcome: "error", error: "case exceeded 300s" };
    if (view.id === "c") return { outcome: "delivered" };
    if (view.id === "d") return undefined as never;
    return { outcome: "acted" };
  };
  const res = await selfTest(flow, cases, run, { concurrency: 2 });
  assert.equal(res.total, 5);
  assert.equal(res.passed, 1);
  assert.deepEqual(res.failed.map((f) => [f.id, f.got]), [["a", "error"], ["b", "error"], ["c", "error"], ["d", "error"]]);
  assert.deepEqual(res.errors, [
    { id: "a", error: "socket hang up" },
    { id: "b", error: "case exceeded 300s" },
    { id: "c", error: 'runner returned an unknown outcome: "delivered"' },
    { id: "d", error: "runner returned an unknown outcome: undefined" },
  ]);
  assert.deepEqual(res.byMutation, { noise: { total: 3, passed: 1 }, failed_action: { total: 2, passed: 0 } });
});

test("a runner that throws before returning a promise is caught", async () => {
  const run = (() => { throw new Error("not async"); }) as unknown as RunCaseFn;
  const res = await selfTest(flow, [makeCase("a", "noise", ["contact"])], run);
  assert.deepEqual(res.errors, [{ id: "a", error: "not async" }]);
  assert.equal(res.passed, 0);
});

test("an error outcome never passes, even if a key lists it", async () => {
  const res = await selfTest(flow, [makeCase("a", "noise", ["error", "contact"])], scripted({ a: "error" }));
  assert.equal(res.passed, 0);
  assert.deepEqual(res.errors, [{ id: "a", error: "the run ended in an error outcome" }]);
});

test("a case that never answers times out and the rest still run", async () => {
  const run: RunCaseFn = (view) => (view.id === "stuck" ? new Promise(() => {}) : Promise.resolve({ outcome: "acted" }));
  const cases = [makeCase("stuck", "noise", ["contact"]), makeCase("b", "noise", ["contact"]), makeCase("c", "noise", ["contact"])];
  const res = await selfTest(flow, cases, run, { concurrency: 1, caseTimeoutMs: 20 });
  assert.equal(res.passed, 2);
  assert.deepEqual(res.failed, [{ id: "stuck", mutation: "noise", expected: ["contact"], got: "error" }]);
  assert.deepEqual(res.errors, [{ id: "stuck", error: "no result after 20 ms" }]);
});

test("malformed cases are reported without calling the runner", async () => {
  const run = scripted({ ok: "acted" });
  const cases = [null, { id: "no-key", mutation: "noise", events: [] }, { id: "no-events", expected: { acceptable_dispositions: ["contact"] } }, makeCase("ok", "noise", ["contact"])];
  const res = await selfTest(flow, cases as never, run);
  assert.equal(res.total, 4);
  assert.equal(res.passed, 1);
  assert.deepEqual(res.failed.map((f) => [f.id, f.mutation, f.got]), [["case 1", "unknown", "error"], ["no-key", "noise", "error"], ["no-events", "unknown", "error"]]);
  assert.equal(res.errors.length, 3);
  assert.deepEqual(run.seen.map((v) => v.id), ["ok"]);
});

test("empty input", async () => {
  const run = scripted({});
  const empty = { flowId: "test-flow", total: 0, passed: 0, failed: [], byMutation: {}, errors: [] };
  assert.deepEqual(await selfTest(flow, [], run), empty);
  assert.deepEqual(await selfTest(flow, undefined as never, run), empty);
  assert.equal(run.seen.length, 0);
});

test("never runs more cases at once than the limit, and reports in input order", async () => {
  const cases = Array.from({ length: 9 }, (_, i) => makeCase(`c${i}`, "noise", ["escalate"]));
  const release: (() => void)[] = [];
  let running = 0;
  let peak = 0;
  const run: RunCaseFn = async () => {
    running++;
    peak = Math.max(peak, running);
    await new Promise<void>((resolve) => release.push(resolve));
    running--;
    return { outcome: "acted" };
  };
  const pending = selfTest(flow, cases, run, { concurrency: 3 });
  // Later cases finish first, to show the report does not follow completion order.
  for (let done = 0; done < cases.length;) {
    await new Promise((resolve) => setImmediate(resolve));
    while (release.length) { release.pop()!(); done++; }
  }
  const res = await pending;
  assert.equal(peak, 3);
  assert.deepEqual(res.failed.map((f) => f.id), cases.map((c) => c.id));
});

test("a concurrency of zero or nonsense still runs every case", async () => {
  const cases = [makeCase("a", "noise", ["contact"]), makeCase("b", "noise", ["contact"])];
  for (const concurrency of [0, -2, Number.NaN]) {
    assert.equal((await selfTest(flow, cases, scripted({ a: "acted", b: "acted" }), { concurrency })).passed, 2);
  }
});

test("the runner sees the case but never the answer key, and gets the flow", async () => {
  const file = path.join(ROOT, "data/generated/delivery/gen-2101.json");
  const generated: GeneratedCase = JSON.parse(await readFile(file, "utf8"));
  const seen: { view: CaseView; flow: Flow }[] = [];
  const res = await selfTest(flow, [generated], async (view, f) => {
    seen.push({ view, flow: f });
    return { outcome: "acted" };
  });
  assert.equal(res.total, 1);
  assert.equal(seen[0].flow, flow);
  const view = seen[0].view;
  assert.deepEqual(Object.keys(view).sort(), ["attachments", "context", "events", "id", "initial_request", "title"]);
  assert.equal(view.events.length, generated.events.length);
  // The view is what load.ts turns into a bundle for the real runner.
  assert.ok(fromView(view).documents.some((d) => d.name === "history"));
  assert.equal(res.byMutation[generated.mutation].total, 1);
});

test("an outcome named like a built-in object property is an unknown outcome", async () => {
  const cases = ["constructor", "__proto__", "toString"].map((id) => makeCase(id, "noise", ["contact"]));
  const res = await selfTest(flow, cases, scripted({ constructor: "constructor", ["__proto__"]: "__proto__", toString: "toString" }));
  assert.deepEqual(res.failed.map((f) => f.got), ["error", "error", "error"]);
  assert.deepEqual(res.errors.map((e) => e.error), [
    'runner returned an unknown outcome: "constructor"',
    'runner returned an unknown outcome: "__proto__"',
    'runner returned an unknown outcome: "toString"',
  ]);
});

test("a mutation named like a built-in object property is tallied like any other", async () => {
  const cases = [makeCase("a", "constructor", ["contact"]), makeCase("b", "__proto__", ["contact"]), makeCase("c", "__proto__", ["escalate"])];
  const res = await selfTest(flow, cases, scripted({ a: "acted", b: "acted", c: "acted" }));
  assert.deepEqual(Object.keys(res.byMutation), ["constructor", "__proto__"]);
  assert.deepEqual({ ...res.byMutation.constructor }, { total: 1, passed: 1 });
  assert.deepEqual(Object.getOwnPropertyDescriptor(res.byMutation, "__proto__")?.value, { total: 2, passed: 1 });
  assert.equal(Object.hasOwn(Object.prototype, "total"), false);
  assert.equal(Object.hasOwn(Object, "total"), false);
});

test("a case time limit the timer cannot hold does not fail every case", async () => {
  const run: RunCaseFn = async () => {
    await new Promise((resolve) => setTimeout(resolve, 15));
    return { outcome: "acted" };
  };
  for (const caseTimeoutMs of [Number.POSITIVE_INFINITY, 2 ** 31, Number.NaN, 0, -5]) {
    const res = await selfTest(flow, [makeCase("a", "noise", ["contact"])], run, { caseTimeoutMs });
    assert.deepEqual([caseTimeoutMs, res.passed, res.errors], [caseTimeoutMs, 1, []]);
  }
});

test("a case list with holes counts every slot", async () => {
  const cases: GeneratedCase[] = new Array(3);
  cases[1] = makeCase("b", "noise", ["contact"]);
  const res = await selfTest(flow, cases, scripted({ b: "acted" }));
  assert.equal(res.total, 3);
  assert.equal(res.passed, 1);
  assert.deepEqual(res.failed.map((f) => f.id), ["case 1", "case 3"]);
  assert.equal(res.errors.length, 2);
});
