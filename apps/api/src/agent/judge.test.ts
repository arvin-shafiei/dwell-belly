// Run: node --test apps/api/src/agent/judge.test.ts
// No network and no key: fetch, the clock and the retry wait are all fakes.
import assert from "node:assert/strict";
import test from "node:test";
import { askJev, JEV_MODEL, type JevOptions, type JevQuestion } from "./jev.ts";
import { CASE_TYPES, clash, messageRisk, triage } from "./judge.ts";
import { BOUNDARIES, Critique } from "./types.ts";

interface Sent { state: unknown; model: string; questions: Record<string, JevQuestion> }
type Reply = { status?: number; body: unknown } | Error | ((sent: Sent) => { status?: number; body: unknown });

/** Replies are used in order; the requests it saw are kept for assertions. */
function fakeFetch(...replies: Reply[]) {
  const sent: Sent[] = [];
  const headers: Record<string, string>[] = [];
  const impl = (async (_url: string | URL | Request, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body)) as Sent;
    sent.push(request);
    headers.push(init?.headers as Record<string, string>);
    const next = replies.shift();
    if (next === undefined) throw new Error("fake fetch: no reply scripted");
    if (next instanceof Error) throw next;
    const { status = 200, body } = typeof next === "function" ? next(request) : next;
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as typeof fetch;
  return { impl, sent, headers };
}

function harness(...replies: Reply[]) {
  const f = fakeFetch(...replies);
  const waits: number[] = [];
  let t = 1_000;
  const options: JevOptions = {
    fetch: f.impl,
    apiKey: "test-key",
    now: () => (t += 40),
    sleep: async (ms) => { waits.push(ms); },
  };
  return { ...f, waits, options };
}

const reply = (answers: Record<string, unknown>, inputTokens = 1000) =>
  ({ body: { model: "jev-1.13.0", answers, usage: { input_tokens: inputTokens, output_tokens: 20 } } });
const noul = (p: number) => ({ type: "noul", noul: p });
const urgent: Record<string, JevQuestion> = { urgent: { type: "noul", instructions: "Does this convey urgency?" } };

test("askJev flattens noul, choice and score answers and prices the call from input tokens", async () => {
  const h = harness(reply({
    a: noul(0.95),
    b: { type: "choice", choice: "billing", probabilities: { billing: 0.9, other: 0.1 }, confidence: 0.8 },
    c: { type: "score", score: 1.4, confidence: 0.5 },
  }, 2_000_000));
  const r = await askJev("state", {
    a: { type: "noul", instructions: "?" },
    b: { type: "choice", instructions: "?", criteria: { billing: null, other: null } },
    c: { type: "score", instructions: "?", criteria: ["low", "high"] },
  }, h.options);
  assert.equal(r.ok, true);
  assert.deepEqual(r.answers, { a: 0.95, b: "billing", c: 1.4 });
  assert.equal(r.model, "jev-1.13.0");
  assert.equal(r.tokensIn, 2_000_000);
  assert.ok(Math.abs(r.costUsd - 0.084) < 1e-12);
  assert.equal(r.latencyMs, 40);
  assert.equal(h.sent[0].model, JEV_MODEL);
  assert.equal(h.headers[0].authorization, "Bearer test-key");
});

test("askJev without a key fails without calling the network", async () => {
  const h = harness();
  const saved = process.env.TYPESAFE_API_KEY;
  delete process.env.TYPESAFE_API_KEY;
  try {
    const r = await askJev("state", urgent, { ...h.options, apiKey: undefined });
    assert.equal(r.ok, false);
    assert.match(r.error ?? "", /TYPESAFE_API_KEY is not set/);
    assert.deepEqual(r.answers, {});
    assert.equal(r.costUsd, 0);
    assert.equal(h.sent.length, 0);
  } finally {
    if (saved !== undefined) process.env.TYPESAFE_API_KEY = saved;
  }
});

test("askJev with no questions fails without calling the network", async () => {
  const h = harness();
  const r = await askJev("state", {}, h.options);
  assert.equal(r.ok, false);
  assert.equal(h.sent.length, 0);
});

for (const status of [429, 529]) {
  test(`askJev retries once after a ${status} and waits the configured backoff`, async () => {
    const h = harness({ status, body: "busy" }, reply({ urgent: noul(0.7) }));
    const r = await askJev("state", urgent, { ...h.options, retryDelayMs: 250 });
    assert.equal(r.ok, true);
    assert.equal(r.answers.urgent, 0.7);
    assert.equal(h.sent.length, 2);
    assert.deepEqual(h.waits, [250]);
  });
}

test("askJev gives up after the second 429 and reports the status", async () => {
  const h = harness({ status: 429, body: "slow down" }, { status: 429, body: "slow down" });
  const r = await askJev("state", urgent, h.options);
  assert.equal(r.ok, false);
  assert.match(r.error ?? "", /429: slow down/);
  assert.equal(h.sent.length, 2);
});

test("askJev does not retry other error statuses", async () => {
  const h = harness({ status: 500, body: "boom" });
  const r = await askJev("state", urgent, h.options);
  assert.equal(r.ok, false);
  assert.match(r.error ?? "", /500/);
  assert.equal(h.sent.length, 1);
  assert.deepEqual(h.waits, []);
});

test("askJev aborts a call that outlives its timeout and reports it", async () => {
  let signalled = false;
  const hang = ((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => { signalled = true; reject(init.signal?.reason); });
  })) as typeof fetch;
  const r = await askJev("state", urgent, { fetch: hang, apiKey: "test-key", timeoutMs: 5 });
  assert.equal(signalled, true);
  assert.equal(r.ok, false);
  assert.match(r.error ?? "", /Jev call failed/);
});

test("askJev reports a network error instead of throwing", async () => {
  const h = harness(new TypeError("fetch failed"));
  const r = await askJev("state", urgent, h.options);
  assert.equal(r.ok, false);
  assert.match(r.error ?? "", /fetch failed/);
});

test("askJev rejects replies that are not JSON, miss a question, or answer with the wrong type", async () => {
  const bad: Reply[] = [
    { body: "<html>gateway</html>" },
    { body: "null" },
    reply({}),
    reply({ urgent: { type: "noul", noul: "high" } }),
    reply({ urgent: { type: "score", score: 1 } }),
  ];
  for (const b of bad) {
    const r = await askJev("state", urgent, harness(b).options);
    assert.equal(r.ok, false, JSON.stringify(b));
    assert.deepEqual(r.answers, {});
  }
  const pick: Record<string, JevQuestion> = { kind: { type: "choice", instructions: "?", criteria: { a: null, b: null } } };
  const r = await askJev("state", pick, harness(reply({ kind: { type: "choice", choice: "c" } })).options);
  assert.equal(r.ok, false);
  assert.match(r.error ?? "", /not one of the options/);
});

test("askJev survives state that cannot be serialised", async () => {
  const loop: Record<string, unknown> = {};
  loop.self = loop;
  const r = await askJev(loop, urgent, harness().options);
  assert.equal(r.ok, false);
});

const triageReply = (choice: string, score: number) =>
  reply({ case_type: { type: "choice", choice }, urgency: { type: "score", score } });

test("triage asks one choice and one score and maps the score through the thresholds", async () => {
  const h = harness(triageReply("cold_chain", 1.8));
  const r = await triage("Chilled order left on the dock overnight.", h.options);
  assert.equal(r?.caseType, "cold_chain");
  assert.equal(r?.urgency, "high");
  assert.equal(r?.urgencyScore, 1.8);
  assert.deepEqual(r?.usage, { model: "jev-1.13.0", latencyMs: 40, tokensIn: 1000, tokensOut: 0, costUsd: 1000 * 42 / 1e9 });
  const q = h.sent[0].questions;
  assert.deepEqual(Object.keys(q), ["case_type", "urgency"]);
  assert.equal(q.case_type.type, "choice");
  assert.deepEqual(Object.keys(q.case_type.criteria ?? {}), Object.keys(CASE_TYPES));
  assert.equal(Object.keys(CASE_TYPES).length, 13);
  assert.equal(q.urgency.type, "score");
  assert.equal(h.sent[0].state, "Chilled order left on the dock overnight.");
});

test("triage urgency thresholds are parameters, not fixed", async () => {
  const at = async (score: number, o: { mediumAt?: number; highAt?: number } = {}) =>
    (await triage("case", { ...harness(triageReply("other", score)).options, ...o }))?.urgency;
  assert.equal(await at(0.2), "low");
  assert.equal(await at(0.5), "medium");
  assert.equal(await at(1.49), "medium");
  assert.equal(await at(1.5), "high");
  assert.equal(await at(1.2, { highAt: 1 }), "high");
  assert.equal(await at(0.8, { mediumAt: 1 }), "low");
});

test("triage returns null on empty text, a failed call or a case type that was not offered", async () => {
  const empty = harness();
  assert.equal(await triage("  \n", empty.options), null);
  assert.equal(empty.sent.length, 0);
  assert.equal(await triage("case", harness({ status: 500, body: "boom" }).options), null);
  assert.equal(await triage("case", harness(triageReply("weather", 1)).options), null);
  assert.equal(await triage("case", { ...harness().options, apiKey: "" }), null);
});

const claims = [
  { who: "Tracking record", says: "Delivered 09:12, signed for." },
  { who: "Recipient", says: "Nothing has arrived." },
];

test("clash asks one noul about the claims and returns its probability", async () => {
  const h = harness(reply({ clash: noul(0.91) }));
  const r = await clash(claims, h.options);
  assert.equal(r?.p, 0.91);
  assert.equal(r?.usage.tokensIn, 1000);
  assert.deepEqual(Object.keys(h.sent[0].questions), ["clash"]);
  assert.equal(h.sent[0].questions.clash.type, "noul");
  assert.deepEqual(h.sent[0].state, { claims });
});

test("clash returns null with fewer than two claims or when Jev fails", async () => {
  const none = harness();
  assert.equal(await clash([], none.options), null);
  assert.equal(await clash(claims.slice(0, 1), none.options), null);
  assert.equal(none.sent.length, 0);
  assert.equal(await clash(claims, harness(new Error("socket hang up")).options), null);
  assert.equal(await clash(claims, harness({ body: "not json" }).options), null);
});

const messages = [
  { index: 0, to: "Delivery investigations", channel: "Email", message: "Please check the proof of delivery and tell us what it shows." },
  { index: 1, to: "Recipient", channel: "Customer portal", message: "Your refund will reach you tomorrow." },
];

test("messageRisk scores every message on every boundary in one request, shaped like Critique", async () => {
  const h = harness((sent) => reply(Object.fromEntries(Object.keys(sent.questions).map((id) =>
    [id, noul(id === "m1.promises_outcome" ? 0.93 : 0.04)]))));
  const r = await messageRisk("Case text.", messages, h.options);
  assert.ok(r);
  assert.equal(h.sent.length, 1);
  assert.equal(Object.keys(h.sent[0].questions).length, messages.length * BOUNDARIES.length);
  assert.ok(h.sent[0].questions["m0.promises_outcome"]);
  assert.deepEqual(h.sent[0].state, {
    case: "Case text.",
    outgoing_messages: {
      m0: { to: messages[0].to, channel: messages[0].channel, message: messages[0].message },
      m1: { to: messages[1].to, channel: messages[1].channel, message: messages[1].message },
    },
  });
  const { usage, ...critique } = r;
  assert.deepEqual(Critique.parse(critique), critique);
  assert.deepEqual(critique.actions.map((a) => a.index), [0, 1]);
  assert.equal(critique.actions[1].promises_outcome, 0.93);
  assert.equal(critique.actions[0].promises_outcome, 0.04);
  assert.equal(critique.actions[1].worst_excerpt, "");
  assert.equal(usage.model, "jev-1.13.0");
});

test("every boundary question is a yes/no with both criteria, points at its own message and exempts requests to the owner", async () => {
  const h = harness((sent) => reply(Object.fromEntries(Object.keys(sent.questions).map((id) => [id, noul(0)]))));
  await messageRisk("Case text.", messages, h.options);
  for (const [id, q] of Object.entries(h.sent[0].questions)) {
    assert.equal(q.type, "noul", id);
    if (q.type !== "noul") continue;
    assert.ok(q.criteria?.true && q.criteria.false, id);
    assert.ok(q.instructions.includes(`\`outgoing_messages.${id.split(".")[0]}\``), id);
    assert.match(q.instructions, /^Does the outgoing message .*\?/, id);
    assert.match(q.instructions, /investigate, book or decide is a request: it is not a promise/, id);
  }
});

test("messageRisk keeps the caller's indexes when they are not 0..n", async () => {
  const h = harness((sent) => reply(Object.fromEntries(Object.keys(sent.questions).map((id) => [id, noul(id.startsWith("m7.") ? 0.6 : 0.1)]))));
  const r = await messageRisk("Case text.", [{ ...messages[0], index: 7 }, { ...messages[1], index: 2 }], h.options);
  assert.deepEqual(r?.actions.map((a) => [a.index, a.claims_done]), [[7, 0.6], [2, 0.1]]);
});

test("messageRisk returns null on no messages, repeated indexes, a failed call or a partial reply", async () => {
  const none = harness();
  assert.equal(await messageRisk("Case text.", [], none.options), null);
  assert.equal(await messageRisk("Case text.", [messages[0], { ...messages[1], index: 0 }], none.options), null);
  assert.equal(await messageRisk("Case text.", [{ ...messages[0], index: 0.5 }], none.options), null);
  assert.equal(none.sent.length, 0);
  assert.equal(await messageRisk("Case text.", messages, harness({ status: 529, body: "" }, { status: 529, body: "" }).options), null);
  // One boundary left unanswered must not read as "no risk" for that boundary.
  const partial = harness((sent) => reply(Object.fromEntries(Object.keys(sent.questions).slice(1).map((id) => [id, noul(0)]))));
  assert.equal(await messageRisk("Case text.", messages, partial.options), null);
});

test("askJev rejects a probability outside 0 to 1 and a negative score instead of passing them on", async () => {
  for (const p of [-0.2, 1.7]) {
    const r = await askJev("state", urgent, harness(reply({ urgent: noul(p) })).options);
    assert.equal(r.ok, false, String(p));
    assert.match(r.error ?? "", /between 0 and 1/);
  }
  const level: Record<string, JevQuestion> = { level: { type: "score", instructions: "?", criteria: ["low", "high"] } };
  const r = await askJev("state", level, harness(reply({ level: { type: "score", score: -1 } })).options);
  assert.equal(r.ok, false);
  for (const p of [0, 1]) {
    assert.equal((await askJev("state", urgent, harness(reply({ urgent: noul(p) })).options)).answers.urgent, p);
  }
});

test("a negative probability from Jev never reaches the caller as a no-risk verdict", async () => {
  const negative = () => harness((sent) => reply(Object.fromEntries(Object.keys(sent.questions).map((id) => [id, noul(-1)]))));
  assert.equal(await messageRisk("Case text.", messages, negative().options), null);
  assert.equal(await clash(claims, negative().options), null);
});

test("the judgements return null instead of throwing on input that is not the declared shape", async () => {
  const h = harness();
  const bad = <T>(value: unknown) => value as T;
  assert.equal(await triage(bad<string>(undefined), h.options), null);
  assert.equal(await triage(bad<string>({ text: "case" }), h.options), null);
  assert.equal(await clash(bad<typeof claims>(null), h.options), null);
  assert.equal(await clash(bad<typeof claims>([null, claims[0]]), h.options), null);
  assert.equal(await messageRisk("Case text.", bad<typeof messages>(undefined), h.options), null);
  assert.equal(await messageRisk("Case text.", bad<typeof messages>([null]), h.options), null);
  assert.equal(h.sent.length, 0);
});

test("triage returns null rather than a silent low when a threshold is not a number", async () => {
  const withThreshold = (o: { mediumAt?: number; highAt?: number }) =>
    triage("case", { ...harness(triageReply("safety", 2)).options, ...o });
  assert.equal(await withThreshold({ highAt: Number.NaN }), null);
  assert.equal(await withThreshold({ mediumAt: Number.NaN }), null);
  assert.equal(await withThreshold({ highAt: "1.5" as unknown as number }), null);
});

test("a missing key or unserialisable state stops before the network, for that reason", async () => {
  const noKey = harness(triageReply("other", 1));
  assert.equal(await triage("case", { ...noKey.options, apiKey: "" }), null);
  assert.equal(noKey.sent.length, 0);
  const loop: Record<string, unknown> = {};
  loop.self = loop;
  const h = harness(reply({ urgent: noul(0.5) }));
  const r = await askJev(loop, urgent, h.options);
  assert.equal(r.ok, false);
  assert.match(r.error ?? "", /circular/i);
  assert.equal(h.sent.length, 0);
});
