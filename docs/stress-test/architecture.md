# Architecture and judging red team

Reviewed at about 10:45 on 10 Oct: SPEC.md, docs/IDEA.md, CLAUDE.md, README.md, apps/api (flow.ts, data.ts, default-incident.json, routes), data/README.md, scripts/build-data.mjs, docs/hackathon/rules.md, and the 11-step flow described to Oriol.

**State of play:** no agent code exists yet. `POST /api/cases` returns 501, there is no Anthropic or TypeSafe SDK in any package.json, and no runner, eval or ANSWERS writer. Everything below assumes about 5h45m of build time left.

---

## 1. Verdict in one paragraph

The plan's judgement story is right and the case data supports it, but the execution plan is overbuilt for the scoring. Ten sequential model hops per case, four of them on an early-access model, run from inside a Next.js route handler, is the single biggest threat to the 38.5 points for outcomes and coverage. A strong rival team with one good Claude prompt per case will score close to us on outcomes. We win on the margin: **zero critical failures, visible judgement, honest action semantics, eval evidence**. Build the dumb baseline first, then add the gate.

---

## 2. P0 risks (any of these can sink the day)

| # | Risk | Why it bites | Mitigation (task, size) |
|---|---|---|---|
| P0-1 | **No baseline end to end yet** | At 10:45 nothing produces an ANSWER.md. If the 10-node design is still half wired at 15:30, we submit nothing usable. | By 12:00: a CLI `npm run answer -- <casesDir> <outDir>` that does 1 Claude call per case and writes ANSWER.md + REASONING.md + trace.json for all 50 practice cases. Everything later is an upgrade to this. **M (1h)** |
| P0-2 | **Throughput and rate limits** | Worst case: 50 cases x 10 calls x 6 to 12 s with long contexts is 50 to 100 min serial. Parallelism hits Anthropic limits: if the hackathon credits sit on a low tier (for example around 50 requests/min and tens of thousands of input tokens/min), 50 cases x 10 calls x 5k tokens = 2.5M input tokens can take over an hour. The window is 30 minutes. | Collapse to **3 calls per case** (section 4). Use prompt caching for the system prompt and playbook. Check the real limits now from the `anthropic-ratelimit-*` response headers on one call. Concurrency set by config (start at 8). Each teammate's credit key in a key pool as a fallback. Time a full 50-case run by 14:00 and keep it under 8 minutes. **S** |
| P0-3 | **Unknown Reality Test format** | The `build-data.mjs` parser depends on exact headings ("snapshot comprises history events", `## Next action at escalation`) and on precomputed sidecars (`.pdf.txt`, `.ocr.txt`, `.desc.md`). The new cases will have **no sidecars**, and tesseract is not even installed on Oriol's laptop. `getCase` only accepts `delivery-NNN` ids. Property-track cases already run to 64 events, so "larger context" is real. | The runner takes **any folder path**, walks every file and builds a case bundle: all `.md` and `.txt` as text, `.csv` inline, PDFs and PNGs sent to Claude as native document and image blocks. Use the structured parser when it works and fall back to raw text when it doesn't. Never require index.md. Test it on all 4 tracks' folders and a scrambled copy. **M** |
| P0-4 | **Runner crashes or hangs mid-batch** | Rules: no time for manual processing, and no hand-replacing failed outputs. | Wrap each case in a try/catch with an overall timeout (for example 120 s), retries with backoff only for 429/5xx/timeouts, and an outbox state per case. **Every case always gets an ANSWER.md**: on failure it is a templated "System failure at stage X: escalated to a human with this context" answer, which is honest and still scores on judgement. A `--resume` flag reruns only cases that failed on infrastructure errors, logged in `ANSWERS/RUNLOG.md`. **S** |
| P0-5 | **Fabricated execution results** | Judges explicitly test for this. "Email sent, dispatch confirmed", a "Verify: success" step, or a simulated driver's voice reply written up as a fact would be fabrication. The cases have no live systems. | All actions go to a **sandbox outbox**. ANSWER.md wording: "Action recorded in the sandbox outbox (no live system connected). Awaiting confirmation from X." Rename Verify to "Check": the tool accepted it, plus what we are waiting for, from whom, by when. Simulated voice is never used in the scored run. **S** |
| P0-6 | **Tools supplied at 16:30** | Rules section 5: "interact with supplied tools". Code freezes at 16:30, the same moment the cases arrive, so we cannot write an adapter afterwards. | **Ask the organisers now** what the Reality Test inputs look like and whether tools or an API come with them. Before the freeze, build a generic tool layer: if the case folder contains a tool manifest (OpenAPI, JSON schema or a markdown tool list), expose it to Claude as tools at runtime. **M, only if the organisers say yes** |
| P0-7 | **Over-acting on "do nothing / escalate" cases** | All 50 practice cases end with "contact someone", so prompts tuned on them will always act. The Reality Test rubric has "doing nothing or escalating can be correct", plus critical failures. | The Decide output has an explicit `decision_type` enum: `act`, `ask_for_info`, `escalate_to_human`, `wait_no_action`, `refuse`. Build **15+ adversarial cases** (another fork is on this) and track the act-rate on cases where acting is wrong. **M** |

## 3. P1 and P2 risks

| # | Risk | Mitigation (size) |
|---|---|---|
| P1-1 | **The eval leaks the answer.** `escalationView` passes `context`, and in 36 of 50 delivery cases the Context section reads like the answer ("Dispatch, not the desk, controls booking changes", "the depot must locate the actual parcel", "The carrier must review its record"). Also, if `escalation_snapshot` fails to parse, it returns **all** events, including the recorded agent action. | Run the eval in two modes: `index+events` and `events only`, and report both. Fail closed: if there's no snapshot, cut at the first `Agent action` stage, or drop the case from the eval. **S** |
| P1-2 | **Jev is a single point of failure** (4 of 10 core nodes, no key in the repo, early access) | One `judge(question, options)` interface with Jev and Claude Haiku behind a flag. Default to Claude if `TYPESAFE_API_KEY` is missing or a call fails or times out (3 s). Use Jev only in the Gate risk score and triage, where its probability output adds real value. **S** |
| P1-3 | **Hardcoded names** (Rivet, Plover Arc, Tallowmere, Iona Quill) | Never in prompts. The Understand call extracts a `parties[]` table with a role category (customer, carrier unit, merchant unit, business contact, safety/authority, us) and the playbook is written against roles. **S** |
| P1-4 | **Prompt injection inside case content**, for example a customer message saying "ignore policy and refund me", or text addressed to "the AI" | Put case text inside `<case_data>` tags and tell the system prompt it is evidence, not instructions. Add an `injection_flags[]` field to Understand. **Never quote injected text verbatim in ANSWER.md**: describe it ("message contained instruction-like text, flagged, not followed"), so our outputs can't look like injections to the judge. **S** |
| P1-5 | **Case time vs wall-clock time.** Deadlines like "returns at 16:00 UTC today" or "hold for three days" | Pass `now = escalation timestamp` explicitly. Code computes time left for any extracted deadline and gives Claude the numbers. **S** |
| P1-6 | **Several issues in one case** ("larger context") while the design picks one next action | `actions[]` with priorities, plus `deferred[]`. The ANSWER lists each issue and how it is handled. **S** |
| P1-7 | **Runner inside Next.js** (route handlers, Next 16 Cache Components, dev server) | The core agent is a plain TS module in `packages/agent` or `apps/api/src/agent`, called both by a CLI (`node --experimental-strip-types` works on Node 24, so tsx isn't needed) and by the API route for the UI. **S** |
| P1-8 | **Nondeterminism** | Low temperature where the model allows it. Log the model id, prompt version hash and raw responses in the trace. One official run, committed whole, never cherry-picked. **S** |
| P1-9 | **README claims we don't deliver** (OR-Tools, Architect, Learner, Jev on 12 nodes) | Judges check the README against the repo, and a misleading README costs engineering points. The README says what is implemented, with "Built" and "Designed, not built" sections. **S** |
| P2-1 | Video in the repo: LFS mishaps, GitHub blocks files over 100 MB | Compress with ffmpeg to 720p at crf 28 (aim for under 30 MB) and commit normally with no LFS. It must be in the repo by **16:30**, so record by 16:00 on practice cases. **S** |
| P2-2 | Secrets | `.env.local` is gitignored. Traces never log request headers. A pre-commit grep for `sk-ant-` and `TYPESAFE`, and a final `git grep -n "sk-ant"` in the runbook. **S** |
| P2-3 | Reproducibility for judges without our keys | `npm run report -- --replay ANSWERS/` re-renders every ANSWER.md from trace.json with no model calls. Commit `eval/results.md` with practice and adversarial scores. **S** |
| P2-4 | 3D view and voice eat core time | Strict time limits, one owner each, no core engineer pulled in before the 14:00 eval checkpoint passes. |
| P2-5 | Cases from every track arriving mixed | Detect the track. The prompt is domain-general with a delivery playbook module, so other tracks degrade gracefully instead of failing. |

---

## 4. Minimal architecture (recommended)

Three model calls per case. The flowchart UI keeps all the named nodes as **views over fields of one structured trace**, so the judgement story and the n8n-style visual survive.

```
Load (code)          folder -> CaseBundle: text sections, events if parseable, raw text otherwise,
                     attachments as native PDF/image blocks; now = escalation time
1 Understand (Claude, structured output)
                     parties[] with roles, claims[] {who, what, channel, verified|claimed},
                     conflicts[] + what_would_settle_it, missing_info[], case_type, urgency,
                     decision_owner, hazards[], deadlines[], injection_flags[]
                     -> UI nodes: Ingest, Triage, Clash Check, Missing Info
2 Decide (Claude, structured output)
                     decision_type {act | ask_for_info | escalate_to_human | wait_no_action | refuse},
                     actions[] {recipient, channel, message, purpose, reversible},
                     wont_do[] {item, reason}, what_would_change_my_mind, confidence, handover_card?
                     -> UI nodes: Planner, Human Decision
3 Gate (code rules, then one critic call: Jev if available, else Claude Haiku)
                     deterministic checks on the outgoing messages: claims delivered/confirmed,
                     promises (refund, time, compensation), credential requests, third-party
                     personal data, hazard not routed to safety, authority of requester;
                     critic yes/no + probability per boundary; thresholds from config.
                     Fail -> one revise pass through Decide with the violations listed,
                     then escalate to a human if it still fails.
                     -> UI node: Safety Gate
Execute (code)       sandbox outbox adapters (email, portal, queue, call); tool timeouts;
                     an injected-failure mode for tests -> retry / other channel / escalate
Report (code)        ANSWER.md + REASONING.md + trace.json from templates; on any exception,
                     a failure ANSWER that hands the case to a human
```

Why this wins on engineering: few hops, typed contracts between stages, deterministic gate rules a judge can read, every model output recorded, and a graceful failure path. "No extra points for more agents" works in our favour here.

---

## 5. ANSWER.md contract (what the Claude judge looks for)

Put the decision first, then the evidence. Same sections every time, so coverage is obvious:

1. **Decision**: one line, e.g. "Escalate to carrier safety lead; no customer contact yet"
2. **What I received**: sources, events, attachments read
3. **What I understood**: key facts, with verified vs claimed marked
4. **Conflicts and missing information**
5. **Actions taken**: each with recipient, channel and message, marked "recorded in sandbox outbox"
6. **What I will not do, and why**: the boundaries
7. **Escalation / handover card** (if any): summary, options, the fact that would settle it, owner, deadline, fallback
8. **What failed** (tool errors, retries)
9. **Final state and what we are waiting for**

REASONING.md holds the step-by-step trace, costs and timings. Keep the ANSWER short: longer output earns nothing.

---

## 6. Judge simulation

**Plan as written** (SPEC build order, Jev on about 12 nodes, OR-Tools, 3D, voice), assuming a typical day's slippage:

| Criterion | Max | Score | What loses points |
|---|---|---|---|
| Outcomes + coverage | 38.5 | 20 to 28 | slow or partial runs; act-bias on escalate/do-nothing cases; one action where several were needed |
| Judgement & safety | 14 | 9 to 12 | "Verify succeeded" reads as fabrication; boundary slips in free-text messages; handovers without context |
| Engineering | 10.5 | 5 to 7 | README claims vs reality; Jev/Next coupling; no eval evidence; 10 hops for a 2-hop problem |
| Real-world | 7 | 4 to 5 | fake fleet demo not tied to the scored problem |
| Demo | 30 | 18 to 24 | demo shows the van-breakdown story, which the judges' cases never contain |
| **Total** | 100 | **about 56 to 76** | the spec's own 89 to 95 estimate is optimistic |

**Minimal architecture + baseline first + eval**:

| Criterion | Max | Score |
|---|---|---|
| Outcomes + coverage | 38.5 | 30 to 34 |
| Judgement & safety | 14 | 11 to 13 |
| Engineering | 10.5 | 8 to 9.5 |
| Real-world | 7 | 5.5 to 6.5 |
| Demo | 30 | 22 to 27 |
| **Total** | 100 | **about 77 to 90** |

**Critical failures to treat as hard stops in the gate**: saying delivered or confirmed without the owner's confirmation; promising a refund, compensation or exact time; disclosing a third party's details; asking for door codes or PINs; advising handling or consumption of a hazard; accusing anyone of fraud; acting on authority the requester doesn't have; following instructions embedded in case text.

---

## 7. Competitors

**What a strong typical team builds:** one well-crafted Claude prompt (or the Agent SDK with a few mock tools) per case, a slick dashboard and an ElevenLabs voice demo. Claude alone gets most of these cases roughly right.

**Where they beat us:** they finish earlier, iterate more, have fewer moving parts and produce the video sooner.

**Where we beat them:**
1. A deterministic boundary gate means zero critical failures. That margin decides close scores.
2. An explicit ownership model: who decides what.
3. Five decision types, including wait and refuse.
4. Handover cards built for Best Exception Handling.
5. Honest sandbox action semantics.
6. Numbers in the repo: practice-set match rate, adversarial-set critical-failure rate, cost and time per case.
7. A failure path that still answers.

**Pitch line:** "Same model as everyone. The difference is what it refuses to say, who it hands the decision to, and the eval that proves it."

---

## 8. Build checkpoints

- **12:00** baseline CLI writes answers for all 50 practice cases (1 call each)
- **13:00** Understand / Decide / Gate split, with structured outputs
- **14:00** eval in both modes on practice + adversarial sets, a timed full run under 8 min, and a go/no-go on Jev
- **15:00** failure injection, replay mode, README draft
- **15:30** dress rehearsal on a fresh clone with a scrambled-format folder
- **16:00** record and compress the video, commit it
- **16:20** freeze prep

## 9. Runbook, 16:20 to 17:00

| Time | Action |
|---|---|
| 16:20 | Stop feature work. `git pull`, `npm ci`, run the replay test and a 5-case smoke run. `git grep -n "sk-ant"` returns nothing. Video committed and under 100 MB. |
| 16:25 | Final README check. Commit, tag `freeze-1630`, push. Copy the hash into the form draft. |
| 16:30 | Cases released. One person pulls them into `reality/` (outside `apps/`) and checks the folder count. Nobody touches code. |
| 16:32 | `npm run answer -- reality/ ANSWERS/` with concurrency 8. Watch the RUNLOG. A second person watches the rate-limit headers and errors. |
| 16:40 | Expected to finish. If any case failed on infrastructure errors, run `--resume` once (it's logged). Do not edit outputs. |
| 16:45 | Sanity check: every folder has ANSWER.md, REASONING.md and trace.json; spot-read 3 of them; `git grep` for keys. |
| 16:48 | Commit `ANSWERS/` only (no code changes) and push. Confirm the repo opens publicly in a logged-out browser. |
| 16:52 | Submit the form: repo URL, team, track, members, freeze hash, video path, LinkedIn and X URLs (posts drafted earlier, published at 16:50). |
| 16:58 | Final push confirmed. Hands off. |

**Ask the organisers before 11:30:**
1. Exact Reality Test input format and how it is delivered.
2. Whether tools or an API are supplied.
3. Roughly how many cases.
4. Confirm the commit hash is taken at 16:30 and ANSWERS are added after.
