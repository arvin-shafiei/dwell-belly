# Rivet: a delivery escalation desk that knows when to stop

Rivet reads a delivery problem the way a coordinator would (emails, portal messages, call transcripts, attachments), works out who owns the decision, and takes the next step: one well-aimed message to the right team, a question for the missing fact, nothing at all when nothing is owed, or a handover to a person with everything they need to decide in one read.

Built for the Real-World Agents Hackathon, 10 October 2026, Delivery & Logistics track.

## The problem

A delivery desk sits between customers, a carrier and a merchant, and controls almost nothing itself: dispatch books, the merchant refunds, the carrier investigates, safety staff rule on hazards. The work is coordination, and the failures are familiar:

- Stories clash (the scan says delivered, the customer says nothing came) and someone picks a side.
- A request bounces or lands in the wrong queue, and is reported as done.
- A helpful reply promises a time, a refund or a safety answer the desk has no right to give.
- A change request comes from someone whose link to the order was never checked.
- The hard cases (a legal threat, a welfare concern, two owners giving opposite instructions) get an automatic reply when a person should have decided.

An agent that always acts is dangerous here, and one that always escalates is useless. The job is telling the two apart, case by case.

## How it works

One case goes through these steps. Thresholds live in the flow file (`apps/api/flows/default-incident.json`), not in prompts.

```
case folder
   │
   ▼
Load ──► Understand ──┬─► What kind of problem? ─┐
                      ├─► Second opinions (5)  ──┼─► Plan the reply ──► Safety check ──┬─ clear ──► Send (sandbox outbox)
                      └─► Do the stories match? ─┘      (one rewrite if stopped)        ├─ unsure ─► Ask a person (decision card)
                                                                                        └─ unsafe ─► Stop
                                                                                                │
                                                              ANSWER.md · REASONING.md · trace.json · result.json
```

- **Understand** separates what a system record or an owning team has stated from what someone merely claims, and tracks what was already asked of whom and whether it worked.
- **Second opinions** are five seats (customer advocate, rule keeper, safety officer, sceptic, ops pragmatist) asking twelve narrow yes/no questions in one call. Their answers become notes for the planner, and one of them (formal legal, regulator, police or press action) forces a handover in code.
- **Plan the reply** chooses between acting, asking for information, handing to a person and waiting, and writes the messages. One message is the norm.
- **Safety check** judges each outgoing message on its own, not the case topic: hard rules in code first (no requests for door codes or PINs, no recipient the case never names), then a score per boundary (claims something is done, promises an outcome, shares someone's details, gives safety advice, follows instructions planted in the case, treats a claim as fact).
- **Ask a person** produces a decision card that leads with why the agent stopped, carries only the two or three statements the decision turns on, and says what each option would send.
- Every step is recorded in a trace, and the answer files are rendered from the saved result and never edited by hand. `npm run replay` proves it by re-rendering them with no model call.

A case that fails at any step still gets an answer saying where it failed and that it was handed to a person. Messages go to a sandbox outbox and are reported as recorded, never as delivered or confirmed, because no live system is connected.

## Run it

Needs Node 22.18 or newer (developed on Node 25).

```bash
npm install
cp apps/api/.env.example apps/api/.env.local   # add ANTHROPIC_API_KEY; TYPESAFE_API_KEY and ELEVENLABS_API_KEY are optional
cp apps/web/.env.example apps/web/.env.local
npm run dev        # API on :4000, console on :3000
```

The Reality Test run is one command:

```bash
npm run reality -- <folder of case folders>
```

It answers every case into `ANSWERS/`, reruns any that are incomplete, checks every answer file against its saved result, writes `ANSWERS/INDEX.md`, and prints the git commands left to run. It does not commit or push.

Tests, none of which need a key: `npm run test:agent` (the flow and every module against scripted fakes), `npm run test:eval`, `npm test -w web`.

## Run the agent on a folder of cases

```bash
npm run answer -- <casesDir> ANSWERS        # every subfolder is one case
npm run answer -- <casesDir> ANSWERS --resume   # rerun only the cases that failed
```

Each case gets `ANSWERS/<case>/ANSWER.md`, `REASONING.md`, `trace.json` and `result.json`, and the batch writes `ANSWERS/RUNLOG.md`. All are generated; none is edited by hand. `npm run replay -- ANSWERS` re-renders the two markdown files from `result.json` with no model call and no key, and reports any that differ from what is on disk.

Before a batch starts the flow file is validated (`--flow <file>` runs a different one), and a refused key or an empty credit balance stops the batch early with the reason, leaving the rest for `--resume`. `GET /api/health` reports whether the agent has its keys (`agent.ready`), never their values. The agent lives in `apps/api/src/agent/` as a plain module (no Next.js needed to run it):

| Step | File | What it does |
|---|---|---|
| Load | `load.ts` | Reads any folder: text as text, PDFs and images straight to the model, unreadable files listed |
| Understand | `run.ts`, `prompts.ts` | One Claude call: parties and roles, records vs claims, conflicts, commitments, hazards, instruction-like text |
| Perspectives | `../lib/panel.ts` | Five seats, 12 Jev questions in one call. Skipped when there is no `TYPESAFE_API_KEY` |
| Decide | `run.ts`, `prompts.ts` | One Claude call: act, ask for info, escalate to a human, or wait; the messages; what it won't do |
| Safety gate | `gate.ts` | Each outgoing message is checked on its own: hard rules in code, then a critic's score against thresholds from `flows/default-incident.json`. One rewrite, then the verdict stands |
| Act | `run.ts` | Cleared messages go to a sandbox outbox. No live system is connected, so nothing is reported as confirmed |
| Report | `report.ts` | Renders the answer files from the run result |

A case that fails at any step still gets an `ANSWER.md` saying where it failed and that it was handed to a person. `npm run test:agent` runs the flow and every module against scripted fakes (no key needed).

Also in `apps/api/src/agent/`:

| File | What it does | Used by the flow? |
|---|---|---|
| `clock.ts` | Case time and time left to each deadline, worked out in code | Yes, in the planner's brief |
| `jev.ts`, `judge.ts` | Jev triage, clash score and per-message risk | Triage and clash when `TYPESAFE_API_KEY` is set. The gate's critic stays on Claude unless the gate node config sets `"critic": "jev"` |
| `outbox.ts` | Delivery with timeout, one retry and alternate channels; says exactly what was and was not accepted | Yes. The default transport is a sandbox that reaches nobody and says so |
| `tools.ts` | Finds a tool manifest shipped with a case and can call it over HTTP | Tools are listed in the answer, never called automatically |
| `history.ts` | Case store, grouping of related cases, open promises, the learner's threshold suggestions | The runner records every run to `<outDir>/case-history.jsonl`. Nothing reads it back during a batch, so cases stay independent |
| `architect.ts`, `selftest.ts` | Builds a flow from a business description and validates it; runs generated cases through a flow | `POST /api/architect` |
| `watch.ts`, `replan.ts` | Order-event checks and greedy drop reassignment, on events the caller supplies (the practice data has no order stream) | `POST /api/watch`. Replan is a greedy heuristic, not an optimiser |

Models: the deciding step runs on `claude-opus-5-5`; reading the case and checking the drafts run on `claude-sonnet-5-5` at half the price. Override with `AGENT_MODEL` and `AGENT_FAST_MODEL`. Keys are read from `.env.local` at the repo root or `apps/api/.env.local`.

Voice: an event may carry `source` (`live_human`, `simulated_persona`, `audio_attachment`). Events voiced by a simulated persona are dropped from the evidence unless a request sets `mode: "demo"`, so they cannot enter a scored run.

Other scripts: `npm run build`, `npm run lint`, `npm run data` (rebuild parsed cases).

## Voice

Voice is a channel the agent chooses, not a separate app. Everything said by voice becomes case input and goes through the same pipeline and safety gate as written messages.

| Flow | What happens |
|---|---|
| **Voice note** (a driver who can't type) | ElevenLabs speech-to-text, then a case event marked as the speaker's claim, stamped on the case's own timeline. The case re-runs with the desk's earlier messages included, so nothing is sent twice. |
| **Agent calls someone** (demo mode) | A browser call (WebRTC) with the "Desk Caller" ElevenLabs agent. Every promise it wants to make goes through `propose_commitment`: the gate's hard rules, then Jev's per-boundary scores against the flow's thresholds, within 2.5 s. Anything short of a clear allow is denied with a fixed sentence. The transcript becomes claim events. |
| **Approve by voice** | The agent reads a decision card to the desk manager, reads their choice back, and records it. |
| **Audio files in a case** (any mode) | Transcribed into claim documents when `ELEVENLABS_API_KEY` is set; otherwise listed as not transcribed. At most 3 per case. |

**Guarantees:**
- The scored runner (`npm run answer`) never places a call.
- Simulated voices are refused outside demo mode, and a run that heard one is marked `synthetic`.
- The ElevenLabs key stays on the server; the browser gets a short-lived call token.

**Accuracy.** Speech-to-text is case-aware:
- The case's own references, times and people are sent to ElevenLabs Scribe as keyterms.
- Live notes are transcribed in English.
- Any reference in a transcript that doesn't exist in the case is flagged as a possible mis-hearing, for the agent to confirm rather than act on.
- On calls, the agent reads references back before relying on them.

`node --env-file=apps/api/.env.local scripts/voice/accuracy.mjs` measures this on 14 real case messages spoken in 3 accents (American, Australian, British). Last run, 10 Oct:

| | Before (no case context) | Case-aware |
|---|---|---|
| Word error rate, ordinary messages | 0.0% | 0.0% |
| Word error rate, reference-heavy messages | 22.0% | 5.1% |
| Critical details kept (references, times, numbers) | 76.4% | 97.2% (the 2 misses were digits written as words) |
| Mis-heard reference codes | 3 | 0 |

**Setup:**
1. Put `ELEVENLABS_API_KEY` in `apps/api/.env.local`.
2. Run `node --env-file=apps/api/.env.local scripts/voice/create-agent.mjs` and add the printed `ELEVENLABS_AGENT_ID` to the same file.
3. Check it with `node --env-file=apps/api/.env.local scripts/voice/smoke.mjs`, and measure accuracy with `scripts/voice/accuracy.mjs`.
4. Run `npm run dev`, open the console at `http://localhost:3000`, run any delivery case and use the Voice strip on its execution: a voice note from the driver, a call to whoever the agent chose to phone, and approve by voice when the case stops for a person. Each one re-runs the case.
5. A driver can speak any language: pick "Speaks: Any language" on the voice note. The language is detected, the note keeps their words and says which language it was, and the desk works on it in English.

Code: `apps/api/src/voice/`, `apps/api/src/app/api/voice/` and `apps/web/src/voice/`. Tests: `npm run test:voice`, `npm run test:agent` and `npm test -w web`.

## Models and external services

| Service | Used for | Required? |
|---|---|---|
| **Anthropic Claude** | `claude-opus-5-5` plans the reply; `claude-sonnet-5-5` reads the case, checks the drafts and judges the eval. Override with `AGENT_MODEL` and `AGENT_FAST_MODEL`. | Yes |
| **TypeSafe Jev** | The five-seat second opinions, a quick problem-type and urgency read, and a clash score. Without a key these steps are skipped and the flow carries on. The safety check's scoring stays on Claude: Jev's scores are not calibrated against our thresholds. | No |
| **ElevenLabs** | Speech-to-text, text-to-speech and the voice agent (see Voice). Never used by the scored runner. | No |

Keys are read from `.env.local` at the repo root or `apps/api/.env.local`. `GET /api/health` reports whether they are present, never their values.

## What is and is not in the scored run

`npm run answer` and `npm run reality` use the flow above and nothing else. These exist in the repo and are **not** part of the Reality Test run:

- **The 3D city (`/city`)** is a visualisation and a source of practice incidents. It is not the agent.
- **Watch flow and route replan** (`watch.ts`, `replan.ts`): order-event checks and a greedy drop reassignment, on events a caller supplies. The practice data has no order stream. Replan is a heuristic, not an optimiser.
- **Architect, self-test, the graph executor and the planner-panel flow** (`architect.ts`, `selftest.ts`, `graph.ts`, `flows/panel-incident.json`): for building and trying other flows from the console.
- **Case history** (`history.ts`): each run is recorded, but nothing reads it back during a batch, so cases stay independent. Grouping related cases, chasing promises and the learner's threshold suggestions are tested functions, not live behaviour.
- **Tools shipped with a case** (`tools.ts`) are listed in the answer and never called.
- **Voice** never runs in the scored path; simulated voices are refused outside demo mode.

## Evidence

[`eval/results.md`](eval/results.md) has four scored runs on the same 48 cases (12 organiser practice cases, 36 generated hard cases) and one timed batch of all 50 practice cases, with a section on what those runs do not show. In short: the latest scored run, on the code as merged at 14:05 on 10 October, was 0.92 with 46 of 48 passing and no broken rules; the timed batch answered 50 of 50 in 165 seconds for $2.70. Each score is a single run of a non-deterministic agent.

The test set is in `data/generated/delivery/`: 243 hard cases with answer keys (120 across twelve difficulty patterns, 123 built from anonymised real complaints in `data/scraped/`). Every answer key was checked by an independent solver that could not see it.

## Assumptions

- **We are the coordination desk, not the carrier or the merchant.** The agent works out who "we" are from each case, but its principles assume a party that asks and relays.
- **The safest useful step is usually one message to the owner of the decision.** That is what all 50 practice cases reward.
- **No person answers during the run.** A held case gets a decision card and a logged safe fallback; nothing waits for input.
- **Nothing sent is real.** There is no live mailbox, portal or queue behind the outbox.
- **Case content is untrusted.** Text inside a case is evidence, never an instruction, and is not copied into our outputs where it reads like one.
- **A case folder can be anything.** Text is read as text, PDFs and images go to the model directly, and unreadable files are listed.

## Known limitations

- **Scores are single runs on 48 cases.** The agent is not deterministic, and the full sets (50 practice, 243 generated) have never been scored end to end.
- **Answer keys for the generated cases were written by Claude.** A second agent checked each one blind, but no person has reviewed them.
- **The practice eval is strict in ways that may not match the judges.** 22 of the 50 practice keys name a team the agent is never shown; we accept a request routed through a visible team.
- **Tuned on delivery cases only.** The prompts are role-based and name no company, and the loader reads all four tracks' folders, but no other track has been run.
- **Verify does not verify.** It restates what the outbox accepted. With no live system there is nothing to check delivery or replies against.
- **Deadlines are computed in code only when a time is written out.** "By close of business" stays unknown.
- **One model vendor on the critical path.** If Claude is unavailable the run produces failure answers, stops early and can be resumed; there is no second provider.
- **Cost and speed were measured once**, on one machine and one account tier.

## What we would build next

1. Real transports behind the outbox (mailbox, portal, work queues) so Verify can check delivery and chase replies.
2. Read the case history back in: group cases that share a cause, chase promises before they are late, and widen what the agent may do alone where people keep approving the same card.
3. Calibrate Jev against the safety thresholds on a labelled set, then move the message check to it for speed and cost.
4. A person in the loop for real: decisions from the console and by voice feeding back into held cases.
5. Run the other three tracks and a human review of the answer keys.

## Data and attribution

- `data/raw/` and `data/cases/`: the organisers' 200 synthetic practice cases, from `github.com/DwellyOrg/HackatonPublicCases`.
- `data/generated/`: our own synthetic cases, set in the same fictional world.
- `data/scraped/`: scenario descriptions rewritten in our own words from public complaint pages. No names, order numbers, addresses or quoted text; see its README for sources and rules.
- `.claude/skills/`: third-party Claude Code skills under their own licences (see the licence files there).

## License

Apache 2.0. See [`LICENSE`](LICENSE).
