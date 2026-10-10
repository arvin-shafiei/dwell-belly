import { MUTATIONS } from "./mutations.mjs";
import { CHANNELS } from "./schema.mjs";

// Returns a list of problems. Empty means the draft is usable.
export function problems(draft, mutation) {
  const out = [];
  const { events, expected } = draft;
  if (events.length < 2) out.push("fewer than 2 events");
  events.forEach((e, i) => {
    if (e.n !== i + 1) out.push(`event ${i + 1} is numbered ${e.n}`);
    if (!CHANNELS.includes(e.channel)) out.push(`event ${e.n} uses unknown channel "${e.channel}"`);
    if (i > 0 && e.timestamp <= events[i - 1].timestamp) out.push(`event ${e.n} is not later than event ${e.n - 1}`);
  });
  const last = events.at(-1);
  if (last && last.stage !== "Escalation") out.push("last event is not the escalation");
  if (last && !last.to.includes("Rivet Delivery Desk")) out.push("escalation is not addressed to the desk");
  const allowed = MUTATIONS[mutation].dispositions;
  if (expected.acceptable_dispositions.length === 0) out.push("no acceptable disposition");
  for (const d of expected.acceptable_dispositions) {
    if (!allowed.includes(d)) out.push(`disposition "${d}" does not fit ${mutation}`);
  }
  const contact = expected.acceptable_dispositions.includes("contact");
  if (contact && expected.acceptable_actions.length === 0) out.push("contact is acceptable but no action is listed");
  if (!contact && expected.acceptable_actions.length > 0) out.push("actions listed but contact is not acceptable");
  for (const a of expected.acceptable_actions) {
    if (!CHANNELS.includes(a.channel)) out.push(`answer key uses unknown channel "${a.channel}"`);
  }
  if (expected.must_not.length === 0) out.push("no must_not rules");
  return out;
}
