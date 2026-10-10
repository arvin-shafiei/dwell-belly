# UI simplification brief

The user wants the desk console (`/`) and the city HUD (`/city`) **clean, easy, and not AI-looking**: simple enough that a 5-year-old gets it at a glance. They also want **no prompt leaks**: no internal ids, model or prompt wording, config keys or developer jargon in the visible text.

## Rules

1. **Plain words, short.** Use one short sentence or a label instead of a paragraph. Max ~8 words per label and ~15 per sentence. No explanations of how the system works on the main screens; if it's needed at all, put it behind a small "?" or "Details".
2. **No prompt leaks.** Never show:
   - raw node types or ids (`safety_gate`, `perspectives`, `human_decision`, `log_damage_held`, `CASE-0012 · delivery-024` raw ids are OK only in a small grey caption);
   - model or runner names (Jev, Claude, claude-sonnet, OR-Tools);
   - config keys (`allow_below`, `block_above`);
   - prompt or system text, such as NODE_ROLES descriptions like "Scores the risk of each proposed step; thresholds in config decide…";
   - JSON;
   - words like "trace", "mock", "synthetic persona", "mutation", "disposition", "stub", "flow node", "edge", "run_end".
3. **Glossary.** Use these names everywhere a person reads text:

| Internal | Show as |
|---|---|
| ingest | Read the messages |
| history_lookup | Check past orders |
| triage | What kind of problem? |
| perspectives | Second opinions |
| clash_check | Do the stories match? |
| group_check | Same cause as others? |
| missing_info | Anything missing? |
| planner | Plan the reply |
| safety_gate | Safety check |
| human_decision | Ask a person |
| action | Send it |
| verify | Did it work? |
| case_log | Done |
| promise_tracker | Follow up later |
| replan_route | Change the route |
| allow / ask / block | OK / Ask a person / Stop |
| acted / escalated / asked_for_info / no_action / blocked | Sent / Needs a person / Asked a question / Nothing to do / Stopped |
| execution / run | Case run |
| workflow | Playbook (or "Steps") |
| evidence grid | Results |
| test run / scenario set | Practice run / Practice cases |
| decision card | "A person needs to decide" |
| synthetic case | Practice case (made from the city) |
| REAL AGENT | Live |
| risk 0.62 | Risk: medium (low / medium / high) |
| cost $0.0781 | 8¢ (in a small grey caption, if shown at all) |

   AI-generated node names (`node.name`, like "Cold-chain safety gate") are fine to show, since they're already plain.
4. **Not AI-looking:** no purple or pink gradients, no ✨ sparkles or emoji in buttons, no glowing borders, no "Ask the Architect" magic copy. Use a calm, flat design: white or very light grey background (or one simple dark theme, consistent), one accent colour (Rivet orange `#ff6a1a`) used sparingly, system font, generous spacing, large clear buttons, and simple icons. One primary action per screen.
5. **Less on screen.** Hide advanced controls (JSON editors, runner chips, version notes, cost breakdowns, debug badges) behind an "Advanced" toggle that's off by default. Show counts as big simple numbers with a word ("12 Sent", "3 Need a person").
6. **Honesty stays.** Keep provenance labels, but in plain words: "Live" for real agent results, "Practice case" for city-made cases. Never show a fake number.
7. **Don't break anything:** same data and same APIs, keep tests passing (update text assertions), and keep `/` and `/city` returning 200. No git, no pkill, and stay in your owned files. Put the glossary in ONE shared file, `apps/web/src/ui/plain.ts` (`plainNode(type)`, `plainOutcome(o)`, `plainGate(g)`, `riskWord(n)`, `cents(usd)`), created by the console-shell agent. Other agents import it; if it doesn't exist yet, create it with exactly those exports (first writer wins, so don't overwrite it, only extend it).

## Addendum: raw step summaries are the worst leak

The backend writes developer summaries into each step's `node_end.summary`, e.g. "triage: missed_or_failed_delivery · medium", "perspectives: skipped: no Jev key", "ingest: 1 files, 0 attachments read", "verify: accepted by the outbox; receipt and reply unverified", "planner: act: Plover Arc Logistics owns the route review…", "gate: 2 of 2 messages cleared".

**Never render `summary` raw.** Every UI must go through `plainStep(nodeType, summary, output?)` in `apps/web/src/ui/plain.ts`, which returns a short plain sentence or `null` (null = hide the step):
- **ingest:** "Read the messages".
- **history:** "Checked past orders", or "Found 2 open promises".
- **triage:** "Problem: missed delivery", via `plainCaseType` (snake_case → words, with a map for the known types).
- **perspectives:** "Got second opinions"; if skipped or no key, return `null` and hide it.
- **clash:** "The stories don't match: <short reason>" or "The stories match".
- **planner:** "Plan: send a message", "Plan: ask a question" or "Plan: ask a person", plus the owner in plain words; never the raw reasoning.
- **gate:** "Safety check passed" / "Safety check: 1 held for a person" / "Safety check stopped it".
- **action:** "Message sent" / "2 messages sent".
- **verify:** "Sent, waiting for a reply".
- **log:** hide it.

Also strip anything that matches `/Jev|Claude|outbox|config|trace|run_end|\bkey\b/i` from any user-visible string, and replace snake_case with words. The `plain.ts` owner implements `plainStep` with tests; everyone else uses it.
