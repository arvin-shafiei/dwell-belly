// Loads the eval sets in one shape: { id, set, mutation, view, expected }.
// `view` is all the agent may see. `expected` never leaves the eval.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const DATA = path.resolve(import.meta.dirname, "..", "..", "data");
export const GENERATED_DIR = path.join(DATA, "generated", "delivery");
export const ADVERSARIAL_DIR = path.join(DATA, "adversarial", "delivery");
const PUBLIC_DIR = path.join(DATA, "cases", "delivery");

async function readJsonDir(dir) {
  const names = (await readdir(dir).catch(() => [])).filter((n) => n.endsWith(".json")).sort();
  return Promise.all(names.map(async (n) => JSON.parse(await readFile(path.join(dir, n), "utf8"))));
}

export async function loadPublicRaw() {
  return readJsonDir(PUBLIC_DIR);
}

// Stricter than escalationView() in apps/api/src/lib/data.ts, which leaks the answer: the title
// and Context section often state it, and attachments are sent after the escalation.
// `withContext` keeps title and context so the two scores can be compared.
function publicCase(c, withContext) {
  const last = c.escalation_snapshot?.last_event;
  const recorded = c.events.find((e) => e.n === c.next_action?.recorded_event);
  const events = last ? c.events.filter((e) => e.n <= last) : c.events;
  const seen = events.map((e) => e.body).join("\n");
  return {
    id: c.id,
    set: "public",
    mutation: "none",
    view: {
      id: c.id,
      track: c.track,
      title: withContext ? c.title : null,
      context: withContext ? c.context : null,
      initial_request: c.initial_request,
      events,
      attachments: c.attachments.filter((a) => seen.includes(a.name)),
    },
    expected: {
      acceptable_dispositions: ["contact"],
      acceptable_actions: [{
        recipient: c.next_action.recipient,
        channel: c.next_action.channel,
        summary: c.next_action.summary,
      }],
      must: [],
      must_not: c.boundaries ? [c.boundaries] : [],
      reference_message: recorded?.body ?? null,
    },
  };
}

// A missing attachment is left out, as it would be on disk; an unreadable one arrives with no text.
function generatedCase(c, set = "generated") {
  return {
    id: c.id,
    set,
    mutation: c.mutation,
    view: {
      id: c.id,
      track: c.track,
      title: c.title,
      context: c.context,
      initial_request: c.initial_request,
      events: c.events,
      attachments: (c.attachments ?? []).filter((a) => !a.missing).map((a) => ({ name: a.name, text: a.corrupt ? null : a.text })),
    },
    expected: c.expected,
  };
}

// set: all | public | generated | adversarial
export async function loadCases(set, { withContext = false } = {}) {
  const want = (name) => set === "all" || set === name;
  const pub = want("public") ? (await loadPublicRaw()).map((c) => publicCase(c, withContext)) : [];
  const gen = want("generated") ? (await readJsonDir(GENERATED_DIR)).map((c) => generatedCase(c)) : [];
  const adv = want("adversarial") ? (await readJsonDir(ADVERSARIAL_DIR)).map((c) => generatedCase(c, "adversarial")) : [];
  return [...pub, ...gen, ...adv];
}
