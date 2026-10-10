// Loads the two eval sets in one shape: { id, set, mutation, view, expected }.
// `view` is all the agent may see. `expected` never leaves the eval.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const DATA = path.resolve(import.meta.dirname, "..", "..", "data");
export const GENERATED_DIR = path.join(DATA, "generated", "delivery");
const PUBLIC_DIR = path.join(DATA, "cases", "delivery");

async function readJsonDir(dir) {
  const names = (await readdir(dir).catch(() => [])).filter((n) => n.endsWith(".json")).sort();
  return Promise.all(names.map(async (n) => JSON.parse(await readFile(path.join(dir, n), "utf8"))));
}

export async function loadPublicRaw() {
  return readJsonDir(PUBLIC_DIR);
}

// Same cut as escalationView() in apps/api/src/lib/data.ts.
function publicCase(c) {
  const last = c.escalation_snapshot?.last_event;
  const recorded = c.events.find((e) => e.n === c.next_action?.recorded_event);
  return {
    id: c.id,
    set: "public",
    mutation: "none",
    view: {
      id: c.id,
      track: c.track,
      title: c.title,
      context: c.context,
      initial_request: c.initial_request,
      events: last ? c.events.filter((e) => e.n <= last) : c.events,
      attachments: c.attachments,
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

function generatedCase(c) {
  return {
    id: c.id,
    set: "generated",
    mutation: c.mutation,
    view: {
      id: c.id,
      track: c.track,
      title: c.title,
      context: c.context,
      initial_request: c.initial_request,
      events: c.events,
      attachments: [],
    },
    expected: c.expected,
  };
}

export async function loadCases(set) {
  const pub = set === "generated" ? [] : (await loadPublicRaw()).map(publicCase);
  const gen = set === "public" ? [] : (await readJsonDir(GENERATED_DIR)).map(generatedCase);
  return [...pub, ...gen];
}
