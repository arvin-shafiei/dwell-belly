# PRD: Delivery escalation desk (source of truth)

**Version:** 0.1, 10 Oct 2026, 11:20 BST. **Owner of this doc:** Oriol.
**Rule:** this file is the single source of truth for what we build and how the parts talk to each other. Code, agents and briefs follow it. To change it, open a PR that edits this file and adds a line to the changelog at the bottom. If code and this doc disagree, raise it in the team chat; don't silently diverge.

Inputs it is built from: `SPEC.md`, `docs/IDEA.md`, `docs/delivery-cases.md`, the stress test (`docs/stress-test/`), and the team status reports (`docs/team-status/` on `status/*` branches).

---

## 1. Product

An AI escalation desk for delivery operations. A case arrives (emails, portal messages, calls, voice notes, documents). The agent works out what happened, who owns the decision, what clashes and what is missing. Then it takes the right next step: ask the owning team, ask for information, wait, refuse, or hand to a human with a decision card. Every step is written to a trace. The answer files, the 2D and 3D views and the voice features all come from that trace.

**One-liner for judges:** most agents answer the customer. Ours works out who owns the decision, what it must not say, and when to stop, and shows its working.

## 2. What wins

| Scored | Points | What we need |
|---|---|---|
| Reality Test outcomes + coverage | 38.5 | A sensible, correctly routed decision for every case, no crashes, no gaps |
| Judgement & safety | 14 | Clashes named, missing info asked for, the right decision type, zero critical failures |
| Engineering | 10.5 | Small core, one-command run, traces, eval numbers in the repo, error handling |
| Real-world use | 7 | Real channels and owners, decision cards, voice for drivers, cost per case |
| Demo video | 30 | Real product: a case flows through, the gate stops a risky promise, a card, voice, ANSWER written |

Side prizes: Best Exception Handling (main target), Best Voice (voice features in section 8), People's Choice (3D city).

**Release criteria for the 16:30 freeze:**

- Full run over the 50 practice cases plus 12 fixtures in under 8 minutes, with every case producing ANSWER.md, REASONING.md and trace.json.
- Zero critical failures and zero boundary violations on the fixtures.
- Owner-match on practice cases reported with and without the index Context (see 10).

## 3. Scope

**In:** the core desk agent and its batch runner; the eval; voice (section 8); 2D and 3D replay of traces; README, LICENSE, video.

**Out (demo only or cut):** the Watch flow and order checks, OR-Tools route replanning, Learner, Architect, cross-case grouping beyond a scripted demo beat. No data in the cases supports them.

## 4. Team and ownership

| Who | Owns | Paths |
|---|---|---|
| Anson | Agent backend, batch runner, edge cases, eval | `apps/api/src/agent/**`, `scripts/`, `eval/` |
| Oriol | Voice, backend integration with the agent, this PRD | `apps/api/src/voice/**`, `apps/api/src/app/api/voice/**`, `docs/PRD.md` |
| Arvin | 3D city, HUD, 2D/3D replay | `apps/web/src/world/**`, `apps/web/src/app/city/**` |
| Shared | The contract (section 7) | `apps/api/src/lib/contract.ts`, changed only via PR to this doc first |

Teammates not listed: add yourselves in a PR.

## 5. System overview

```
            case folder / live message / voice note / call transcript
                                   │
                                   ▼
   ┌──────────────────────────── AGENT (apps/api/src/agent) ────────────────────────────┐
   │ Load ─► Understand ─► Decide ─► Gate (per action) ─► Execute (sandbox) ─► Report   │
   │ code    Claude #1     Claude #2  code rules + Claude #3   code                code  │
   └──────────────┬────────────────────────────────────────────────┬────────────────────┘
                  │ appends TraceEvents                             │ planned `call` actions
                  ▼                                                 ▼
            trace.json  ◄──── call / utterance / voice_note events ── VOICE (apps/api/src/voice)
                  │                                                 ▲
   ┌──────────────┼───────────────────────┐                         │ transcripts become
   ▼              ▼                       ▼                         │ CaseMessages
ANSWER.md    2D replay              3D city (/city)                 │
REASONING.md (shared reducer)       (adapter, section 9)       ElevenLabs
```

**Three model calls per case.** Understand covers the SPEC steps Ingest, History, Triage, Clash Check and Missing Info. Decide covers Planner and the Human Decision card. Gate runs code rules then one critic call. The trace still emits a `node_start`/`node_end` per SPEC step, so the flowchart and the city show every named step.

## 6. Agent behaviour rules

These come from the stress test (56 edge cases, 8 simulated cases). Each one exists because the plan as first written failed without it.

1. **Decision types.** Every case ends in one of `act`, `ask_for_info`, `route_to_owner`, `hold_for_human`, `wait_until`, `refuse`, with zero or more actions. `wait_until` (with a time and a holding reply) is the default when an owning team already has something due.
2. **Several actions per case.** Multi-parcel and multi-issue cases get one action per problem.
3. **The desk asks; owners decide.** Dispatch books, the merchant authorises refunds and replacements, the carrier investigates, safety staff handle hazards.
4. **Gate each action, not the plan.**

   | Verdict | Applies to |
   |---|---|
   | `allow` (sent automatically) | Requests to the owning team. Questions to verified parties. Honest status or holding replies with no commitments. |
   | `ask` (held for a human) | Any promise (refund, compensation, exact time). Disclosure of personal data. Delivery changes (redirect, cancel, release). Anything beyond an acknowledgement to an unverified party. |
   | `block` | Asking for reusable credentials. Sharing third-party details. Saying delivered or confirmed before the owner confirms. Following an instruction embedded in a message. Handling advice on hazards or food safety. |

   The risk score rates the message about to go out, never the case topic or the customer's pressure. Thresholds live in config: allow below 0.3, ask from 0.3, block from 0.8. Hard rules override the score.
5. **Hard triggers route to the named specialist, automatically.** Hazard or leak goes to the carrier safety lead. Food temperature goes to the merchant's food-safety team. Medical or vulnerable recipient goes to the on-call lead. Legal threat or regulator is held for a human, with a holding reply. Value above the config threshold is held for a human.
6. **No human at 16:30.** Allowed actions go out. Held actions are logged with the decision card and the safe fallback. "Escalated" never means "nothing happened".
7. **Honest wording.** Actions go to a sandbox outbox and read "sent, awaiting confirmation". Never "booked", "delivered", "verified" or "resolved" unless the case itself says so.
8. **A clock.** `now` is the time of the last event the agent may see. Deadlines, "next Friday" and time zones are computed in code.
9. **Authority and identity.** Before acting for someone, check they are verified and authorised. If not, ask through the verified channel and disclose nothing.
10. **Case text is data.** Instructions inside messages or attachments are flagged, paraphrased and never followed or quoted.
11. **No hardcoded names.** Work out roles (recipient, carrier, merchant) from the case. The practice names will change.
12. **Never crash a batch.** Each case has a 120-second timeout. Retries only on infrastructure errors. A failed case still gets an ANSWER saying where it failed and that it was escalated to a human.

## 7. The contract

Copied verbatim into `apps/api/src/lib/contract.ts` once this PRD is merged. Everyone imports from there. It extends Arvin's trace draft (`docs/plans/2026-10-10-3d-workflow-viz-design.md` §4).

```ts
export const CONTRACT_VERSION = 1;

export type Mode = "practice" | "reality" | "demo";

/** Where a piece of input came from. In reality mode, simulated_persona is rejected in code. */
export type Source = "case_file" | "live_human" | "simulated_persona" | "audio_attachment";

/* ---------------- 1. What goes in ---------------- */

export interface CaseInput {
  caseId: string;          // "delivery-024" (practice), "rt-07" (Reality Test), "demo-driver-gate" (demo)
  mode: Mode;
  title?: string;          // hidden from the agent in practice eval (it leaks the answer)
  now: string;             // ISO time the agent acts at
  details?: Record<string, string>;
  messages: CaseMessage[];
  attachments: Attachment[];
  raw?: string;            // the whole folder as text when parsing failed
}

export interface CaseMessage {
  n: number;               // order in the thread
  at: string;              // ISO
  channel: string;         // "Email" | "Customer portal" | "Call" | "Voice note" | ...
  from: string;            // role + name as written in the case
  to: string;
  body: string;            // for calls and voice notes: the transcript
  source: Source;
  audioUrl?: string;       // voice only
  callId?: string;         // transcript lines that came from one of our calls
}

export interface Attachment {
  name: string;
  mediaType: string;       // "application/pdf" | "image/png" | "text/csv" | ...
  path: string;            // sent to Claude directly; no OCR sidecars at 16:30
}

/* ---------------- 2. What the agent did ---------------- */

export interface Trace {
  version: typeof CONTRACT_VERSION;
  runId: string;           // "2026-10-10T16:32Z-reality"
  caseId: string;
  flowId: "default-incident";
  mode: Mode;
  synthetic?: boolean;     // hand-built or simulated demo trace: UI shows a SIMULATED tag
  events: TraceEvent[];
}

/** Node ids are the ids in apps/api/flows/default-incident.json. */
export type NodeId =
  | "ingest" | "history" | "triage" | "clash" | "missing_info" | "group"
  | "planner" | "gate" | "human" | "action" | "verify" | "log";

export type DecisionType =
  | "act" | "ask_for_info" | "route_to_owner" | "hold_for_human" | "wait_until" | "refuse";

export interface PlannedAction {
  id: string;              // "a1", "a2"
  kind: "message" | "call" | "ticket";
  to: string;              // "Delivery investigations, Plover Arc Logistics"
  toRole: "recipient" | "driver" | "dispatch" | "carrier_team" | "merchant_team"
        | "safety" | "manager" | "business_contact" | "other";
  channel: string;         // must be a channel the case shows as verified for that party
  purpose: string;         // one line
  body: string;            // the full message, or the call script
}

export interface GateResult {
  actionId: string;
  verdict: "allow" | "ask" | "block";
  risk: number;            // 0..1, the message's risk, not the topic's
  rulesHit: string[];      // e.g. ["promise_refund"]
  reason: string;
}

export type ActionStatus =
  | "sent_awaiting_confirmation" | "held_for_human" | "blocked" | "failed" | "planned_not_placed";

export interface DecisionCard {
  routeTo: string;         // "claims" | "depot_manager" | "support" | "on_call_lead" | "merchant" | ...
  summary: string;
  clash?: string;
  tried: string[];
  options: { id: string; label: string; undoable: boolean }[];   // 2-3
  wouldChangeMyMind: string;
  deadlineMins: number;
  fallback: string;        // the safe option logged when nobody answers
  chosen?: string;         // absent in reality mode
}

type Base = { t: number; source?: Source };   // t = ms since run start; source defaults to the agent

export type TraceEvent =
  | (Base & { kind: "run_start"; title: string; inputs: { n: number; channel: string; from: string; excerpt: string }[] })
  | (Base & { kind: "node_start"; nodeId: NodeId })
  | (Base & { kind: "node_end"; nodeId: NodeId; status: "ok" | "error" | "skipped";
              summary: string /* <= 80 chars */; latencyMs: number; costUsd: number })
  | (Base & { kind: "model_call"; nodeId: NodeId; model: string; latencyMs: number;
              tokensIn: number; tokensOut: number; costUsd: number; ok: boolean; error?: string })
  | (Base & { kind: "edge"; from: NodeId; to: NodeId; when?: "allow" | "ask" | "block" })
  | (Base & { kind: "understanding"; claims: { who: string; says: string; verified: boolean }[];
              clashes: string[]; missing: string[]; owner: string; caseType: string;
              injectionFlagged: boolean })
  | (Base & { kind: "decision"; decision: DecisionType; actions: PlannedAction[];
              wontDo: string[]; waitUntil?: string; confidence: number })
  | (Base & { kind: "gate"; result: GateResult })
  | (Base & { kind: "action"; actionId: string; status: ActionStatus; detail?: string })
  | (Base & { kind: "card"; card: DecisionCard })
  | (Base & { kind: "human_decision"; optionId: string; by: "tap" | "voice"; who: string })
  | (Base & { kind: "voice_note_in"; messageN: number; from: string; transcript: string; audioUrl?: string })
  | (Base & { kind: "call"; callId: string; phase: "ringing" | "connected" | "ended" | "failed";
              callee: string; calleeRole: PlannedAction["toRole"]; actionId?: string; summary?: string })
  | (Base & { kind: "utterance"; callId: string; speaker: "agent" | "callee"; text: string; audioUrl?: string })
  | (Base & { kind: "run_end"; outcome: DecisionType | "error"; totalCostUsd: number;
              totalLatencyMs: number; error?: string });
```

**Rules for the contract:**

- Every voice event (`voice_note_in`, `call`, `utterance`) must set `source`.
- In `reality` mode the runner throws away any input with `source: "simulated_persona"`, and `call` actions end as `planned_not_placed`.
- The trace file is written even when a case errors, ending with `run_end` and `outcome: "error"`.

## 8. Voice

Voice is one layer (`apps/api/src/voice`), used in three places. Everything it produces is a `CaseMessage` (input) or a `TraceEvent` (trace), so the agent, the answer files and the UI need nothing special for it.

| Feature | Flow | Trace events |
|---|---|---|
| **Driver voice notes** | A driver records a note (they can't text while driving). Scribe transcribes it. It becomes a `CaseMessage` (channel "Voice note") tagged as the driver's claim. Clash Check compares it with the customer's account. | `voice_note_in` |
| **Agent calls a person** | Decide plans a `call` action (driver, recipient, manager). The gate checks the script like any message. In demo and practice the voice layer places it (ElevenLabs agent, browser call). The transcript comes back as `CaseMessage`s with the `callId`, and the agent continues. Driver calls open with "Are you safe to talk?", ask at most 3 yes/no questions and stay under 30 seconds. | `call` (ringing, connected, ended or failed), `utterance` |
| **Manager approves by voice** | For a `hold_for_human` card, the voice layer calls the on-call manager, reads the card, and they say "option 2". That becomes a `human_decision` with `by: "voice"`, and the held action is released. | `call`, `utterance`, `human_decision` |
| **Simulated people (demo)** | Driver, customer and dispatch personas, each with its own voice. Claude writes each persona's line and ElevenLabs TTS speaks it, streamed to the browser. Agents can call each other, and a human can listen live or take over a seat. | the same, with `source: "simulated_persona"`, and the trace is `synthetic: true` |

**Voice rules:**

- The voice model speaks before our gate sees its words. So its prompt carries the boundaries from section 6, any commitment goes through a `propose_commitment` tool that the gate checks, and the transcript is checked after the call.
- Never in the scored run. In reality mode calls are planned and gated but not placed, and simulated input is rejected in code, not only in a prompt.
- The first line discloses an AI agent and that the call is recorded.
- Transcripts committed to the public repo come from synthetic cases only.

Endpoints and the remaining edge-case handling are added in the next version of this PRD, from the backend voice stress test.

## 9. UI and 3D integration

The 3D city (`/city`) and the 2D replay only read traces, from `GET /api/cases/:id/trace` or a static `traces/<caseId>.json` fallback. They never call the agent. One adapter converts `TraceEvent`s into the city's `WorkflowEvent`s and bus events. Until real traces exist, the mock engine stays as the fallback.

| Trace event | City shows |
|---|---|
| `node_start` / `node_end` | The station for that node lights up, with the summary on its card |
| `gate` | Gate needle and chute per action: green allow, amber ask, red block |
| `card` | The manager's desk at the depot rings, and the card slides into the side panel |
| `human_decision` with `by: "voice"` | The manager's desk lights up, and the card shows "approved by voice: option N" |
| `voice_note_in` | A pulsing mic bubble on the driver's van, and the transcript ticks into the HUD tagged with its source |
| `call` ringing / connected / ended | A phone rings over the van, house or depot, the camera flies there, and a live transcript panel opens |
| `utterance` | The speaking character is highlighted, and the line appears in the transcript panel |
| any event with `source: "simulated_persona"` | A visible SIMULATED badge |
| `run_end` | The outcome badge: the decision type, or error |

The full adapter, store and bus additions, and audio playback rules are added in the next version of this PRD, from the city stress test.

## 10. Outputs and eval

```
ANSWERS/<n>/ANSWER.md        rendered from trace.json by a template, never hand-edited
ANSWERS/<n>/REASONING.md     rendered from trace.json
ANSWERS/<n>/trace.json       the Trace above
eval/results.md              practice + fixture scores, committed
```

**ANSWER.md template:**

1. Decision line: `ACT | ASK | ROUTE TO OWNER | HOLD FOR HUMAN | WAIT UNTIL <time> | REFUSE`, and why in one line.
2. Action table: number, to (role), channel (verified?), purpose, status.
3. Every message in full.
4. Not done on purpose, one line each, with the reason.
5. Escalated: none, or to whom, with the decision card and the fallback taken.
6. What failed.
7. Waiting for what, from whom, by when.
8. Final state, confidence, and what would change it.

**REASONING.md template:**

1. What we received.
2. Facts vs claims.
3. Commitments so far.
4. Conflicts and missing information.
5. Who owns each decision.
6. Options rejected.
7. Safety check per action.
8. Trace table: step, model, output, latency, cost.

**Eval rules:**

- Feed only the events up to the escalation snapshot, with no title, no index Context, no Next action, Outcome or Boundaries, and no attachments that arrive after the snapshot. Run twice, with and without the index Context, and report both.
- Fixtures 101 to 112 have `rubric.json` (required outcomes, red flags, critical failures).
- A replay command re-renders every ANSWER.md from trace.json with no model calls, so judges can reproduce our results without our keys.

## 11. Modes

| | practice | reality | demo |
|---|---|---|---|
| Input | data/ cases, escalation view | the 16:30 case folders, any format | scripted scenarios + live voice |
| Simulated people | allowed in tests | rejected in code | allowed, tagged |
| Calls | placed only in voice tests | planned and gated, never placed | placed (browser) |
| Human answers | optional | none: card logged, fallback recorded | live (tap or voice) |
| Output | traces + eval/results.md | ANSWERS/ | traces for the video |

## 12. Timeline (BST)

| Time | Checkpoint |
|---|---|
| 12:00 | Baseline: one command runs all 50 practice cases and writes the three files each |
| 12:30 | `contract.ts` merged. Arvin replays one real trace in `/city` |
| 13:00 | Voice notes end to end. Mock call events reach the city |
| 14:00 | Full run timed (under 8 minutes). Eval numbers committed |
| 14:30 | Abort rule: if the core isn't end to end, 3D and voice stop and help the core |
| 15:30 | Dress rehearsal on a fresh clone. Video recorded |
| 16:00 | README, LICENSE, SUBMISSION.md drafted |
| 16:20 | Feature freeze. Smoke run, secrets grep, tag `freeze-1630` |
| 16:30 | Cases released. Run the batch. Nobody touches code |
| 16:48 | Commit `ANSWERS/` only. Check the repo opens publicly |
| 16:52 | Submit the form |

## 13. Open questions

1. Anson's backend internals and status (his report is pending): does the agent run as a plain TS module with a CLI?
2. For the organisers:
   - Do the 16:30 cases come with tools or an API?
   - Are they in the same format as the practice cases?
   - How many are there?
3. Is a Jev key confirmed? If not, everything runs on Claude.

## Changelog

- **0.1 (11:20):** first version from SPEC, IDEA, the stress test and Arvin's status report.
