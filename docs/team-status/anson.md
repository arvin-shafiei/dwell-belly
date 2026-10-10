# Anson: status for the team plan (10 Oct, 10:55)

## Who and what

Anson. Backend decisions, edge cases and the eval. Paths: `scripts/eval/`, `data/generated/`, `data/scraped/`, `apps/api/src/lib/panel.ts`, the `perspectives` node in `apps/api/flows/default-incident.json`.

## Built so far

**Nothing below is pushed.** Four commits sit on local `main` (a hook on my machine blocks pushing to main; I will push or open a PR next).

- **120 generated hard cases** in `data/generated/delivery/gen-NNN.json`, 10 for each of 12 patterns (conflicting info, failed action, missing context, noise, superseded request, out-of-policy demand, embedded instructions, unverified identity, needs human, safety hazard, no action needed, unusual exception). All pass `scripts/eval/validate-cases.mjs`. Answer keys are written by Claude and not yet reviewed; a blind review is about to run.
- **Eval** in `scripts/eval/`: `npm run eval` scores an agent on the 50 public plus 120 generated cases. Scoring arithmetic has 13 passing unit tests. **The Claude judge and the baseline agent have never run**: no API key on my machine yet.
- **Perspectives panel** in `apps/api/src/lib/panel.ts`: five seats (advocate, rule keeper, safety, sceptic, ops) ask 12 Jev questions in one call; thresholds and planner notes are in the flow node config. Typechecks and lints. **Never run against Jev** (no key).
- **Scraped seeds**: an agent is collecting anonymised real complaint scenarios into `data/scraped/seeds-web.json`. In progress. Reddit blocks non-browser access.
- **No runtime.** Nothing executes the flow or writes `ANSWERS/`. `POST /api/cases` still returns 501.

## Interfaces

Produces, generated case file:

```jsonc
{ "id": "gen-101", "track": "delivery", "generated": true, "mutation": "conflicting_information",
  "seed_case": "delivery-024", "grounding": null, "title": "...", "context": "...", "initial_request": "...",
  "events": [{ "n": 1, "timestamp": "...", "stage": "Context", "channel": "Email", "from": "...", "to": "...", "body": "..." }],
  "expected": { "acceptable_dispositions": ["contact"],          // contact | escalate | no_action
    "acceptable_actions": [{ "recipient": "...", "channel": "Email", "summary": "..." }],
    "must": ["..."], "must_not": ["..."], "reference_message": "..." },
  "rationale": "..." }
```

Produces, `apps/api/src/lib/panel.ts`:

```ts
export interface PanelRule {
  at_least: number;
  effect: "force_human" | "brief";
  note: string;
}
export interface PanelResult {
  ok: boolean;
  error?: string;
  seats: { id: string; name: string; answers: Record<string, number>; raised: string[] }[];
  forceHuman: boolean;
  notes: string[];
  model: string;
  latencyMs: number;
  tokensIn: number;
  costUsd: number;
}
export async function runPanel(state: unknown, rules: Record<string, PanelRule>, seats: Seat[] = SORTING_SEATS): Promise<PanelResult>
```

Consumes (assumed from the runtime, not built): `npm run eval -- --api <url>` POSTs the case view `{ id, track, title, context, initial_request, events, attachments }` and expects a `Trace` (docs/plans 3D design §4). It reads only:

```ts
{ kind: "run_end"; outcome: "acted" | "asked_for_info" | "escalated" | "blocked" | "no_action" | "error";
  nextAction?: { recipient: string; channel: string; message: string } }
{ kind: "node_end"; output: { type: "human_decision"; card: { routeTo; summary; fallback } } }
{ kind: "node_end"; output: { type: "planner"; wontDo: string[] } }
```

Or `--traces <dir>` reading `<dir>/<caseId>.json` in the same shape.

## Assumptions about other parts

- A runtime exists that emits that `Trace`. Nobody has claimed it in code yet.
- One `nextAction` per case. Oriol's stress test wants several actions and a `wait_until` type; my eval scores one action and three dispositions, so it needs changing if the team adopts that.
- The eval's public-case view passes `title` and `context`, which the stress test shows leak the answer. Not fixed yet.

## Voice in my area

- The panel takes any `state`, so a transcribed voice note or call is just another event. I need each event to carry `source: live_human | simulated_persona | audio_attachment` so the sceptic seat can weigh it and the eval can refuse simulated audio.
- A voice call as an action should arrive as a `nextAction` with `channel: "Call transcript"` and the script as `message`, so the eval scores it like any message.
- No generated case contains audio. I can add voice-note cases once the event shape is agreed.

## Next 2 hours

- 11:00 Push the work. Blind review of the 120 answer keys (running).
- 11:20 Fix the eval leak (strip title and context; report both).
- 11:30 Second wave of cases from the scraped seeds, with humane-handling requirements.
- 12:00 Run baseline plus judge once a Claude key exists.
- Blocked on: Claude and Jev keys; a decision on single action versus several; who builds the runtime.

## Risks

- **No runtime at 10:55.** Everything I built measures an agent that does not exist.
- Eval verdicts rest on unreviewed keys and an unrun judge.
- The panel adds a Jev dependency to every case; it returns `ok: false` and never throws, but it is untested live.
