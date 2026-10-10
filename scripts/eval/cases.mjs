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

// Stricter than escalationView() in apps/api/src/lib/data.ts, which leaks the answer: the title
// and Context section often state it, and attachments are sent after the escalation.
// `withContext` keeps title and context so the two scores can be compared.
function publicCase(c, withContext) {
  const last = c.escalation_snapshot?.last_event;
  const recorded = c.events.find((e) => e.n === c.next_action?.recorded_event);
  const events = last ? c.events.filter((e) => e.n <= last) : c.events;
  const seen = events.map((e) => e.body).join("\n");
  // Some organiser keys name a team that appears nowhere in what the agent is shown. The agent
  // cannot know that name, so a request to the organisation's visible team to route it is accepted.
  const visible = events.map((e) => `${e.from} ${e.to} ${e.body}`).join("\n").toLowerCase();
  const [team, organisation] = c.next_action.recipient.split(",").map((part) => part.trim());
  const routed = organisation && !visible.includes(team.toLowerCase())
    ? [{ recipient: `Any team at ${organisation} that appears in the history`, channel: c.next_action.channel, summary: `${c.next_action.summary} (asking that team to act or to route it to the team that owns it)` }]
    : [];
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
      }, ...routed],
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

export async function loadCases(set, { withContext = false } = {}) {
  const pub = set === "generated" ? [] : (await loadPublicRaw()).map((c) => publicCase(c, withContext));
  const gen = set === "public" ? [] : (await readJsonDir(GENERATED_DIR)).map(generatedCase);
  return [...pub, ...gen];
}
