<div align="center">

# Rivet

### A delivery escalation desk that knows when to stop.

Rivet reads a delivery problem the way a coordinator would, works out who owns the decision, and takes **one well-aimed next step**, or hands it to a person with everything they need to decide in one read.

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![Claude](https://img.shields.io/badge/Claude-Opus%205.5%20%C2%B7%20Sonnet%205.5-D97757?logo=anthropic&logoColor=white)](https://www.anthropic.com)
[![TypeSafe Jev](https://img.shields.io/badge/TypeSafe-Jev-6E56CF)](#models-and-external-services)
[![ElevenLabs](https://img.shields.io/badge/ElevenLabs-voice-000000?logo=elevenlabs&logoColor=white)](https://elevenlabs.io)
[![three.js](https://img.shields.io/badge/three.js-3D%20city-049EF4?logo=threedotjs&logoColor=white)](https://threejs.org)
[![Node 22.18+](https://img.shields.io/badge/node-%E2%89%A522.18-339933?logo=nodedotjs&logoColor=white)](#quickstart)

<img src="docs/media/hero.gif" alt="Rivet: a case comes in, the agent decides, the safety check clears the message, and the decision appears in the console" width="900">

**[▶ Watch the 60-second demo](demo/rivet-demo.mp4)** · [full 2-minute cut](demo/rivet-demo-full.mp4) · [Quickstart](#quickstart) · [Architecture](#architecture) · [Evidence](#evidence) · [Limitations](#known-limitations)

<sub>Built for the Real-World Agents Hackathon, 10 October 2026 · Delivery & Logistics track</sub>

</div>

---

## At a glance

Rivet reads a delivery problem the way a coordinator would (emails, portal messages, call transcripts, attachments), works out who owns the decision, and takes the next step: one well-aimed message to the right team, a question for the missing fact, nothing at all when nothing is owed, or a handover to a person with everything they need to decide in one read.

| | |
|---|---|
| **Latest scored run** | **0.92** mean score, **46 of 48** passing, **0** must-never rules broken ([eval/results.md](eval/results.md), run 4, one run) |
| **Timed batch** | **50 of 50** practice cases answered in **165 s** for **$2.70** (about 5¢ per case) |
| **Console runs** | $0.049 to $0.095 per case across 5 real (non-simulated) runs recorded in the console database |
| **Wrong kind of action** | 0 messages sent when nothing was owed (0 of 3), 0 messages sent when a person had to decide (0 of 5), in run 4 |
| **Test cases** | 50 public · 243 generated with answer keys (120 by difficulty pattern + 123 grounded in real complaints) · 100 adversarial · 50 city · 12 stress-test fixtures · 2,500 rule-made bulk |
| **Offline tests** | 288 agent · 19 eval · 44 voice, all passing with no key (`node --test`, 10 Oct) |
| **Voice accuracy** | Reference-heavy word errors **22.0% → 5.1%**, mis-heard reference codes **3 → 0** |

---

## Contents

- [The problem](#the-problem)
- [Features](#features): desk console · playbooks · voice · human in the loop · safety · the 3D city
- [Architecture](#architecture) and [how a case runs](#how-it-works)
- [Quickstart](#quickstart) and [the Reality Test run](#the-reality-test-run)
- [Models and external services](#models-and-external-services)
- [What is and is not in the scored run](#what-is-and-is-not-in-the-scored-run)
- [Evidence](#evidence) · [Who this is for and what a pilot looks like](#who-this-is-for-and-what-a-pilot-looks-like)
- [Assumptions](#assumptions) · [Known limitations](#known-limitations) · [What's next](#what-we-would-build-next)
- [Data, licences and credits](#data-and-attribution)

---

## The problem

A delivery desk sits between customers, a carrier and a merchant, and controls almost nothing itself: dispatch books, the merchant refunds, the carrier investigates, safety staff rule on hazards. The work is coordination, and the failures are familiar:

| | Failure | What Rivet does instead |
|---|---|---|
| ⚖️ | Stories clash (the scan says delivered, the customer says nothing came) and someone picks a side. | Names the clash and asks the owner of the record to check it. |
| 📭 | A request bounces or lands in the wrong queue, and is reported as done. | Reports messages as *recorded*, never as delivered or confirmed. |
| 🤐 | A helpful reply promises a time, a refund or a safety answer the desk has no right to give. | A safety check scores every outgoing message for promises and advice. |
| 🪪 | A change request comes from someone whose link to the order was never checked. | Separates what a record says from what someone merely claims. |
| 🧑‍⚖️ | The hard cases (a legal threat, a welfare concern, two owners giving opposite instructions) get an automatic reply when a person should have decided. | Hands over with a decision card; legal, regulator, police or press action forces it in code. |

> **An agent that always acts is dangerous here, and one that always escalates is useless.** The job is telling the two apart, case by case.

---

## Features

### 🖥️ The desk console

The product an ops team would use, at `http://localhost:3000`. Every page runs on the real agent and real results; city-made practice cases are labelled and never count in the numbers. Press **⌘K** anywhere for the command palette.

| Page | What it is for |
|---|---|
| 🏠 **Home** | The live desk: real numbers, what needs you now, live activity and shortcuts |
| ✍️ **New case** | The real-world way in: paste an email thread, add messages one by one, or drop text files and call recordings (transcribed), check the preview, and run the agent |
| ▶️ **Case runs** | Each run in plain language with a one-line why, filter chips, a download button and **Watch it think**: a step-by-step replay from the real trace |
| 🧑‍💼 **Decisions** | The inbox of cases the agent stopped on: urgency, countdown, why it stopped, and option cards (opens as a drawer) |
| 🧩 **Playbooks** | The flow editor, Make a playbook, Practice and Improve (below) |
| 📊 **Results** | A scorecard: coverage per case set, a by-difficulty grid and every case with why; downloads `results.csv` and an evidence pack |
| 🧪 **Reality Test** | The unseen cases from `ANSWERS/`, a live grid with each `ANSWER.md` and `REASONING.md`, read-only |
| 💡 **How it works** | The flow, the risk bands, the five second opinions, a decision card, how we know, and what is in the scored run |
| 🌆 **City** | Controls for the 3D city next to what is happening in it (a visualisation; see below) |
| ⚙️ **Settings** | "How careful is the agent?" (one dial for the active playbook's safety checks, saved as a new version), spending, connections (present or not, never the keys) and data |

<table>
<tr>
<td width="50%"><img src="docs/media/console-home.png" alt="Console home"><br><sub><b>Home.</b> Big plain numbers from real results, the latest cases and one button: Run a case. City-made cases never count in the numbers.</sub></td>
<td width="50%"><img src="docs/media/case-run-detail.png" alt="A case run in plain language"><br><sub><b>Case runs.</b> Each run in plain language: what was sent, to whom and how, whether it was right, and each step the agent took (read, found open promises, second opinions, clash, plan, safety check), with the details one click away.</sub></td>
</tr>
<tr>
<td><img src="docs/media/results.png" alt="Results grid"><br><sub><b>Results.</b> The evidence grid: every tested case with its decision and pass or fail.</sub></td>
<td><img src="docs/media/decisions.png" alt="Decisions desk"><br><sub><b>Decisions.</b> Cases the agent handed to a person, with what it proposes and why, decided with one click.</sub></td>
</tr>
</table>

### 🧩 Playbooks: an n8n-style editor for the agent's flow

The flow the agent runs is a graph you can see and edit (React Flow). Thresholds live in the flow, not in prompts.

<table>
<tr>
<td width="33%"><img src="docs/media/playbooks-tree.png" alt="Playbook editor"><br><sub><b>Edit.</b> Steps, branches and gate thresholds as nodes and edges, with versions.</sub></td>
<td width="33%"><img src="docs/media/playbooks-ai-builder.png" alt="Make a playbook"><br><sub><b>Make a playbook.</b> Describe the business in plain words (here: frozen food, cold-chain vans) and the Architect lays out a branching decision tree, safety-checked before you choose to use it.</sub></td>
<td width="33%"><img src="docs/media/playbooks-practice.png" alt="Practice and learning curve"><br><sub><b>Practice, then Improve.</b> Run the playbook on real test cases with the real agent and real scoring ("4 of 5 right"), see the learning curve, and let <b>Improve</b> propose a revised flow from the misses. You see the diff and accept it as a new version. A case already run and judged on the exact same playbook is reused (0¢, instant); <b>Run fresh</b> bypasses that.</sub></td>
</tr>
</table>

<img src="docs/media/feature-playbook.gif" alt="Making and practising a playbook" width="100%">

- **Run overlay.** "Show a run" picks one of this playbook's recent case runs and lights up the path it took on the canvas, with how many recent runs passed through each step.
- **Step inspector.** Click a step to see what it does, its settings and what it did in the last run, in plain words.
- **Show on playbook.** From Case runs or Decisions, one click opens the run on its playbook and replays its path.

> Playbooks other than the default, the Architect and Improve are console tools for building and trying flows. The scored run uses `apps/api/flows/default-incident.json` only.

### 🎙️ Voice mode

Voice is a channel the agent chooses, not a separate app. Everything said by voice becomes case input and goes through **the same pipeline and the same safety gate** as written messages.

<table>
<tr>
<td width="55%"><img src="docs/media/feature-voice.gif" alt="Voice note, call and approve by voice" width="100%"></td>
<td>

- **🚚 Voice note.** A driver who can't type speaks; ElevenLabs Scribe transcribes it into a case event marked as the speaker's *claim*, and the case re-runs.
- **📞 The agent calls.** A browser call to the "Desk Caller" agent. Every promise it wants to make is checked by the gate and Jev **within 2.5 s**, or denied with a fixed sentence.
- **✅ Approve by voice.** The agent reads a decision card to the desk manager, reads their choice back, and records it.
- **🎧 Audio in a case.** Transcribed into claim documents, at most 3 per case.

</td>
</tr>
</table>

<img src="docs/media/case-run-voice.png" alt="The Voice strip on a case run" width="100%">

<details>
<summary><b>Voice in detail: flows, guarantees, accuracy and setup</b></summary>

<br>

| Flow | What happens |
|---|---|
| **Voice note** (a driver who can't type) | ElevenLabs speech-to-text, then a case event marked as the speaker's claim, stamped on the case's own timeline. The case re-runs with the desk's earlier messages included, so nothing is sent twice. |
| **Agent calls someone** (demo mode) | A browser call (WebRTC) with the "Desk Caller" ElevenLabs agent. Every promise it wants to make goes through `propose_commitment`: the gate's hard rules, then Jev's per-boundary scores against the flow's thresholds, within 2.5 s. Anything short of a clear allow is denied with a fixed sentence. The transcript becomes claim events. |
| **Approve by voice** | The agent reads a decision card to the desk manager, reads their choice back, and records it. |
| **Audio files in a case** (any mode) | Transcribed into claim documents when `ELEVENLABS_API_KEY` is set; otherwise listed as not transcribed. At most 3 per case. |

The Desk Caller opens every call with: *"Hi, this is the delivery desk assistant, an AI. This call is recorded for the case log. Are you safe to talk?"* When a promise is denied it says: *"I can't promise that. The team that owns this decides, and I'll pass your request on."* A transcription below 0.6 confidence is prefixed `[unclear transcription]`. Calls use what was known before the call and the case re-runs after hang-up (a re-run takes 30 to 150 s).

**Modes:**

| | reality (scored batch) | practice | demo |
|---|---|---|---|
| Audio files in a case | transcribed into claim documents | yes | yes |
| Voice notes, calls | refused | refused | yes |
| Simulated personas | refused in code | refused | allowed; the run is marked `synthetic` |

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
5. A driver can speak any language: pick "Speaks: Any language" on the voice note. The language is detected, the note keeps their words, says which language it was and carries an English machine translation (dropped if it loses any reference, time or number), and the desk works on it in English.
6. After every call, each line the voice agent said is checked by the safety gate with the whole call as context. Anything it should not have said (a refund promise, say) is flagged in the call box and added to the case, so the next run corrects it.
7. **Take calls.** Tick "📞 Take calls" (next to Run the agent on New case, or Run again on a run). When a run decides a phone call is the right move, the call pops up as soon as it finishes ("Rivet is calling Elva Kesh, the recipient", with the agent's reason) and the run reads "Calling Elva Kesh…". **Take call** and you answer as that person; what was said goes back into the case, which runs again. **Don't take it** and the case runs again knowing nobody answered, so the agent picks a fallback. Unticked (and always in the batch runner and the Reality Test), the run is fully automatic and a call is only recorded in the outbox like any other message. Runs that need no call show no voice at all. Driver voice notes and voicemails come in on New case as attached recordings, in any language.

Code: `apps/api/src/voice/`, `apps/api/src/app/api/voice/` and `apps/web/src/voice/`. Tests: `npm run test:voice`, `npm run test:agent` and `npm test -w web`.

</details>

### 🧑‍💼 Human in the loop

When the agent stops, it produces a **decision card** that leads with why it stopped, carries only the two or three statements the decision turns on, and says what each option would send.

<table>
<tr>
<td width="55%"><img src="docs/media/feature-decisions.gif" alt="Deciding a held case and re-running it" width="100%"></td>
<td>

1. The case lands in **Decisions** (the console drawer, or `/review`), with its deadline.
2. A person picks an option, by click or by voice.
3. The case **re-runs with that choice** as a trusted `humanDecision`: held messages that implement it are released, a rejected option's messages are never sent, and blocked messages stay blocked.
4. The new run is linked to the one it answers.

</td>
</tr>
</table>

> In the scored run no person answers: a held case gets its decision card and a logged safe fallback, and nothing waits for input.

### 🛡️ Safety, by construction

| Guard | How |
|---|---|
| **Hard rules in code** | No requests for door codes or PINs, and no recipient the case never names, checked before any model sees the draft. |
| **Per-message scoring** | Each outgoing message is judged on its own, not the case topic: claims something is done, promises an outcome, shares someone's details, gives safety advice, follows instructions planted in the case, treats a claim as fact. Below 0.3 it is sent, 0.3 to 0.8 it is held for a person, 0.8 or more it is stopped (thresholds from the flow file). One rewrite, then the verdict stands. |
| **Never promise** | No times, refunds, replacements or safety rulings the desk does not own. The owning team is asked; the outcome is not promised. On calls, a fixed denial sentence. |
| **Prompt-injection resistance** | Case content is evidence, never an instruction. Instruction-like text is flagged when the case is read, scored again at the gate, and not copied into outputs where it reads like one. 100 adversarial cases include hidden injections. |
| **Forced handover** | Formal legal, regulator, police or press action forces a person, in code. |
| **No fake confirmations** | Messages go to a sandbox outbox and are reported as recorded, never as delivered. |
| **Simulated voice never scored** | Events voiced by a simulated persona are dropped from the evidence unless a request sets `mode: "demo"`. |
| **Fail closed** | A case that fails at any step still gets an answer saying where it failed and that it was handed to a person. |

### 🌆 The live 3D city (a visualisation, not the scored agent)

> [!IMPORTANT]
> **`/city` is not part of the scored agent.** It is a visualisation and a source of practice incidents. It replays real agent traces from the console in 3D; staged scenes use public case messages, and any extra messages it invents are marked `simulated_persona` and shown as simulated.

<table>
<tr>
<td width="33%"><img src="docs/media/city-aerial.png" alt="City from above"><br><sub>From above: downtown, the river, docks and delivery traffic.</sub></td>
<td width="33%"><img src="docs/media/city-crash.png" alt="A crash with responders"><br><sub>A truck crash injected from the console: the road closes and responders arrive.</sub></td>
<td width="33%"><img src="docs/media/city-motorcade.png" alt="A motorcade"><br><sub>A motorcade crossing the city under a rolling road closure.</sub></td>
</tr>
<tr>
<td><img src="docs/media/city-port.png" alt="Port and ships"><br><sub>The container port: ships berthing with cranes, tugs and trucks.</sub></td>
<td><img src="docs/media/city-night.png" alt="City at night"><br><sub>Night: street lights and lit windows, set from the console's time control.</sub></td>
<td><img src="docs/media/city-control.png" alt="City controls in the console"><br><sub>The console's City tab: weather, time and incidents next to what is happening and the cases it raised.</sub></td>
</tr>
</table>

<img src="docs/media/feature-city.gif" alt="The 3D city replaying a case" width="100%">

---

## Architecture

```mermaid
flowchart LR
    subgraph IN["📥 Case in"]
        A["Case folder<br/>emails · portal · calls<br/>PDFs · images · audio"]
    end

    subgraph AGENT["🤖 The agent · apps/api/src/agent (the only scored path)"]
        direction LR
        L["Load<br/>load.ts"] --> U["Understand<br/>Claude Sonnet 5.5<br/>records vs claims"]
        U --> J["Judge<br/>Jev panel: 5 seats,<br/>12 yes/no questions<br/>+ triage + clash score"]
        U --> P
        J --> P["Plan<br/>Claude Opus 5.5<br/>act · ask · hand over · wait"]
        P --> G{"Safety gate<br/>hard rules in code<br/>+ per-message score"}
        G -- "stopped: one rewrite" --> P
        G -- "clear: below 0.3" --> S["Send<br/>sandbox outbox"]
        G -- "unsure: 0.3 to 0.8" --> H["Ask a person<br/>decision card"]
        G -- "unsafe: 0.8 or more" --> X["Stop"]
        S --> V["Verify<br/>what was accepted"]
        H --> V
        X --> V
        V --> R["Log<br/>ANSWER.md · REASONING.md<br/>trace.json · result.json"]
    end

    A --> L

    subgraph AROUND["Around it (not in the scored run)"]
        C["🖥️ Desk console<br/>Playbooks · Case runs<br/>Results · Decisions"]
        VO["🎙️ Voice<br/>ElevenLabs Scribe + Desk Caller"]
        CI["🌆 3D city<br/>replays real traces"]
        E["📊 Eval<br/>answer keys + judge"]
    end

    C -- "run / re-run with humanDecision" --> L
    H -. "card" .-> C
    VO -- "claim events · voice approval" --> L
    R -. "traces" .-> CI
    R -. "results" .-> E
    E -. "Practice · Improve" .-> C

    FLOW[["flows/default-incident.json<br/>thresholds, not prompts"]] -.-> G
```

### How it works

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

**Every outgoing message lands in one of three risk bands** (`allow_below: 0.3`, `block_above: 0.8` in the flow file):

| Risk score | Verdict | What happens |
|---|---|---|
| below 0.3 | 🟢 **Clear** | Recorded in the sandbox outbox |
| 0.3 to 0.8 | 🟡 **Unsure** | Held, with a decision card for a person |
| 0.8 or more | 🔴 **Unsafe** | Stopped, text withheld |

- **Understand** separates what a system record or an owning team has stated from what someone merely claims, and tracks what was already asked of whom and whether it worked.
- **Second opinions** are five seats (customer advocate, rule keeper, safety officer, sceptic, ops pragmatist) asking twelve narrow yes/no questions in one call. Their answers become notes for the planner, and one of them (formal legal, regulator, police or press action) forces a handover in code.
<details>
<summary><b>The five seats and their twelve questions (one Jev call)</b></summary>

<br>

| Seat | Asks |
|---|---|
| 🧡 Customer advocate | How upset is the person? Is someone vulnerable? Did an earlier fix already fail? |
| 📜 Rule keeper | Is the desk being asked for what only the carrier or merchant can grant? Has formal legal, regulator, police or press action started? |
| 🦺 Safety officer | Is a person at risk of harm? Is someone asking for safety advice? |
| 🔍 Sceptic | Do the stories contradict? Is a message giving orders to the bot? Is the requester not on record? |
| ⏱️ Ops pragmatist | Is a deadline within a day? Is nothing owed right now? |

Twelve scores go through thresholds in the flow config and become notes for the planner. The legal-or-public question is the red one: at 0.8 or more, a person decides, enforced in code.

</details>

- **Plan the reply** chooses between acting, asking for information, handing to a person and waiting, and writes the messages. One message is the norm.
- **Safety check** judges each outgoing message on its own, not the case topic: hard rules in code first (no requests for door codes or PINs, no recipient the case never names), then a score per boundary (claims something is done, promises an outcome, shares someone's details, gives safety advice, follows instructions planted in the case, treats a claim as fact).
- **Ask a person** produces a decision card that leads with why the agent stopped, carries only the two or three statements the decision turns on, and says what each option would send.
> **A decision card, from a real run.** *Why a person is needed:* two owners gave incompatible instructions on the same parcel, the shipper threatens liability, and the depot wants release-or-hold by 09:00. *What it turns on:* carrier billing (the hold stands), the merchant (sold duties paid, told the depot to release), the depot (conflicting notes, needs one instruction by 09:00). *Options*, each marked as can or cannot be undone. *Already done safely:* a holding update recorded for the customer, with no promise in it. A person decides in one read without opening the case.

- Every step is recorded in a trace, and the answer files are rendered from the saved result and never edited by hand. `npm run replay` proves it by re-rendering them with no model call.

A case that fails at any step still gets an answer saying where it failed and that it was handed to a person. Messages go to a sandbox outbox and are reported as recorded, never as delivered or confirmed, because no live system is connected.

<details>
<summary><b>The agent, file by file</b></summary>

<br>

The agent lives in `apps/api/src/agent/` as a plain module (no Next.js needed to run it):

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

Voice: an event may carry `source` (`live_human`, `simulated_persona`, `audio_attachment`). Events voiced by a simulated persona are dropped from the evidence unless a request sets `mode: "demo"`, so they cannot enter a scored run.

</details>

---

## Quickstart

Needs Node 22.18 or newer (developed on Node 25).

```bash
npm install
cp apps/api/.env.example apps/api/.env.local   # add ANTHROPIC_API_KEY; TYPESAFE_API_KEY and ELEVENLABS_API_KEY are optional
cp apps/web/.env.example apps/web/.env.local
npm run dev        # API on :4000, console on :3000
```

Then open **http://localhost:3000** for the console, **/review** for the Decisions desk and **/city** for the 3D city.

| Variable | Where | Needed for |
|---|---|---|
| `ANTHROPIC_API_KEY` | `apps/api/.env.local` | The agent (required) |
| `TYPESAFE_API_KEY` | `apps/api/.env.local` | The Jev panel, triage and clash score (optional; skipped without it) |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID` | `apps/api/.env.local` | Voice (optional; see Voice) |
| `AGENT_MODEL`, `AGENT_FAST_MODEL` | `apps/api/.env.local` | Overriding the deciding and the reading/checking models |

Keys are read from `.env.local` at the repo root or `apps/api/.env.local`. `GET /api/health` reports whether the agent has its keys (`agent.ready`), never their values.

### The Reality Test run

The Reality Test run is one command:

```bash
npm run reality -- <folder of case folders>
```

It answers every case into `ANSWERS/`, reruns any that are incomplete or ended in a system failure, checks every answer file against its saved result, writes `ANSWERS/INDEX.md`, and prints the git commands left to run. It does not commit or push.

On the day, with a deadline and a spending cap:

```bash
# small drop (up to ~300 cases): default models
REALITY_DEADLINE=16:54 npm run reality -- <cases> ANSWERS --budget-usd 18
# large drop: Sonnet decides, Haiku reads and checks (not evaluated on the practice cases)
REALITY_DEADLINE=16:54 npm run reality -- <cases> ANSWERS --budget-usd 18 --profile cheap
```

- `--deadline HH:MM` (or `REALITY_DEADLINE`, local time): from 75 s before it, no case starts a model call; each remaining case still gets its four files, with an ANSWER.md handing it to a person, at no cost. Cases still running at the deadline are cut off the same way. No retries after it.
- `--budget-usd N` (or `REALITY_BUDGET_USD`, default 18, `none` for no cap): spend is tracked from every response; a case starts only if spend plus the running cases at the average cost stays under N. The rest are handed to a person at no cost, and `RUNLOG.md` says when the budget was reached.
- `--profile cheap` (or `REALITY_PROFILE=cheap`): Sonnet decides, Haiku reads and checks. Much cheaper per case, and not evaluated on the practice cases.
- `--concurrency N` (default 24): cases at a time. Model calls in flight are throttled separately: 16 at first, growing on success, cut by 30% on a 429/529, never below 4.
- `RUNLOG.md` and `INDEX.md` are rewritten as the run goes and at the deadline, so a run stopped by hand still has them. A progress line with done/total, rate, ETA and spend prints every 25 cases.

<details>
<summary><b>Run the agent on any folder of cases</b></summary>

<br>

```bash
npm run answer -- <casesDir> ANSWERS        # every subfolder is one case
npm run answer -- <casesDir> ANSWERS --resume   # rerun only the cases that failed
```

Each case gets `ANSWERS/<case>/ANSWER.md`, `REASONING.md`, `trace.json` and `result.json`, and the batch writes `ANSWERS/RUNLOG.md`. All are generated; none is edited by hand. `npm run replay -- ANSWERS` re-renders the two markdown files from `result.json` with no model call and no key, and reports any that differ from what is on disk.

Before a batch starts the flow file is validated (`--flow <file>` runs a different one), and a refused key or an empty credit balance stops the batch early with the reason, leaving the rest for `--resume`.

</details>

<details>
<summary><b>Tests (no key needed)</b></summary>

<br>

| Command | What it covers | Last run (10 Oct) |
|---|---|---|
| `npm run test:agent` | The flow and every module against scripted fakes | 288 of 288 pass |
| `npm run test:eval` | The eval scoring and case validation | 19 of 19 pass |
| `npm run test:voice` | Voice policy, notes, references, re-runs, sessions and tools | 44 of 44 pass |
| `npm test -w web` | The console, voice components and the city (vitest) | |

</details>

<details>
<summary><b>Other scripts</b></summary>

<br>

`npm run build`, `npm run lint`, `npm run data` (rebuild parsed cases), `npm run eval` (run and score a case set), `npm run validate:cases`, `npm run render:adversarial`, `npm run gen:bulk` and `npm run test:bulk` (the bulk generator), `npm run load:check` (loader check, no key).

</details>

---

## Models and external services

| Service | Used for | Required? |
|---|---|---|
| **Anthropic Claude** | `claude-opus-5-5` plans the reply; `claude-sonnet-5-5` reads the case, checks the drafts and judges the eval, at half the price. Override with `AGENT_MODEL` and `AGENT_FAST_MODEL`. The Architect and Improve also run on Claude. | Yes |
| **TypeSafe Jev** | The five-seat second opinions, a quick problem-type and urgency read, and a clash score. Without a key these steps are skipped and the flow carries on. The safety check's scoring stays on Claude: Jev's scores are not calibrated against our thresholds. On voice calls, Jev's per-boundary scores check each promise in real time. | No |
| **ElevenLabs** | Speech-to-text (Scribe), text-to-speech and the "Desk Caller" voice agent (see Voice; the call agent runs `claude-haiku-4-5` by default, overridable with `ELEVENLABS_AGENT_LLM`). Never used by the scored runner. | No |

Keys are read from `.env.local` at the repo root or `apps/api/.env.local`. `GET /api/health` reports whether they are present, never their values.

---

## What is and is not in the scored run

| Part | Status |
|---|---|
| The flow, the case clock, delivery with retry (sandbox outbox) | ✅ **In the scored run** |
| Jev second opinions (problem type, five seats, clash) | ✅ **In**, skipped without a key |
| One-command run, results index, replay with no key | ✅ **In**, rehearsed |
| Playbook editor, graph runner, planner-panel flow, Architect, Improve | 🖥️ Console only |
| 3D city, watch flow, route replan | 🎬 Demo only |
| Voice notes, calls, approve by voice | 🚫 Never in the scored path |
| Case history (grouping, promises, learner) | 📝 Recorded, not read back |
| Tools shipped with a case | 📋 Listed, never called |

`npm run answer` and `npm run reality` use the flow above and nothing else. These exist in the repo and are **not** part of the Reality Test run:

- **The 3D city (`/city`)** is a visualisation and a source of practice incidents. It is not the agent.
- **Watch flow and route replan** (`watch.ts`, `replan.ts`): order-event checks and a greedy drop reassignment, on events a caller supplies. The practice data has no order stream. Replan is a heuristic, not an optimiser.
- **Architect, self-test, the graph executor and the planner-panel flow** (`architect.ts`, `selftest.ts`, `graph.ts`, `flows/panel-incident.json`): for building and trying other flows from the console.
- **Case history** (`history.ts`): each run is recorded, but nothing reads it back during a batch, so cases stay independent. Grouping related cases, chasing promises and the learner's threshold suggestions are tested functions, not live behaviour.
- **Tools shipped with a case** (`tools.ts`) are listed in the answer and never called.
- **Voice** never runs in the scored path; simulated voices are refused outside demo mode.

---

## Evidence

[`eval/results.md`](eval/results.md) has four scored runs on the same 48 cases (12 organiser practice cases, 36 generated hard cases) and one timed batch of all 50 practice cases, with a section on what those runs do not show. In short: the latest scored run, on the code as merged at 14:05 on 10 October, was 0.92 with 46 of 48 passing and no broken rules; the timed batch answered 50 of 50 in 165 seconds for $2.70. Each score is a single run of a non-deterministic agent.

| Run | Setup | Mean score | Passing | Must-never rules broken |
|---|---|---|---|---|
| 1 | All on Opus 5.5 | 0.87 | 42 of 48 | 1 |
| 2 | Opus decides, Sonnet reads and checks; tuned guidance | 0.89 | 45 of 48 | 1 |
| 3 | Later code; every message judged | 0.90 | 45 of 48 | 2 |
| **4** | **Current code (merged 14:05, 10 Oct)** | **0.92** | **46 of 48** | **0** |

Run 4 in detail: practice cases 0.98 (12 of 12), generated cases 0.90; right kind of response 48 of 48; right party addressed 48 of 48; 0 of 3 messages sent when nothing was owed; 0 of 38 escalations when a message was the answer; 0 of 5 messages sent when a person had to decide. Its two failures (`gen-1201`, `gen-904`) are escalations where the judge scored the one message the agent also sent; whether those are agent faults or the eval judging the wrong thing has not been settled.

**How a case is scored:** right kind of response 30%, right party 20%, channel 10%, right content 40% (`scripts/eval/score.mjs`). Any message that breaks a must-never rule makes the case fail. Runs 1 and 2 judged only the first message. This is our eval against our keys, not the judges' score.

**Test data**

| Set | Cases | Where | Notes |
|---|---|---|---|
| Public practice (delivery) | 50 | `data/cases/delivery/` | The organisers' cases |
| Generated by difficulty pattern | 120 | `data/generated/delivery/` | Twelve patterns, answer keys checked blind |
| Grounded in real complaints | 123 | `data/generated/delivery/` | Built from anonymised complaints in `data/scraped/` |
| Adversarial | 100 | `data/adversarial/` | Injection, regulated goods, safeguarding, calendar traps; also as raw folders |
| City | 50 | `data/city/delivery/` | Motorcade closures, road incidents with vans and cyclists, big events, secure deliveries, cascades and adversarial cases |
| Stress-test fixtures | 12 | `docs/stress-test/fixtures/` | With rubrics; not yet run through the eval |
| Bulk (rule-made) | 2,500 | `data/bulk/` | Seeded from the sets above, with renamed parties, shifted dates and transforms (noise, long threads, duplicates, injections, missing attachments, legal threats, welfare remarks). Raw folders in eleven layouts. Keys derived by rule, so for load and regression, not the score |

**Loader check, no key:** `npm run load:check` runs every raw case folder (50 practice, 100 adversarial, 2,500 bulk: 2,650 in all) through the same loading steps the Reality runner takes before its first model call, plus 16 deliberately broken folders (empty, unreadable, symlink loops, binary text, odd names). Last run: none of the 2,650 folders made the loader throw, and none of the broken probes threw.

The test set is in `data/generated/delivery/`: 243 hard cases with answer keys (120 across twelve difficulty patterns, 123 built from anonymised real complaints in `data/scraped/`). Every answer key was checked by an independent solver that could not see it.

---

## Who this is for, and what a pilot looks like

**Who.** The person who runs a delivery desk at a retailer, a third-party logistics firm or a carrier: a team that sits between customers, a carrier and a merchant, answers escalations all day, and owns none of the decisions it is asked about.

**The job they would hire it for.** Take the first step on every escalation correctly and at once, and bring a person in only where a person is needed, with the case already read for them.

**Why this desk could run it, on what we measured today:**

| A desk lead asks | What we can show |
|---|---|
| Will it promise things we can't deliver? | Every outgoing message is checked on its own before it goes. In the latest scored run, 0 of 48 cases broke a must-never rule. |
| Does it know when to stop? | It sent no message when a person had to decide (0 of 5) and none when nothing was owed (0 of 3). A stopped case arrives as a decision card: why it stopped, the two or three statements it turns on, and what each option would send. |
| Does it just escalate everything? | It escalated 0 of 38 cases where a message was the answer. |
| Can I see why it did what it did? | Each step records how it decided, shown block by block on the playbook canvas and in every case's `REASONING.md`. Answers re-render from saved results with no model call. |
| Can I change how careful it is without an engineer? | Thresholds are numbers in the playbook, not wording in a prompt. |
| What does it cost and how fast is it? | About 5 cents and 17 to 32 seconds a case: 50 cases in 165 seconds for $2.70. |

**The arithmetic, for a desk to fill in.** At the measured $0.054 a case, 10,000 escalations a month is about $540 of model spend. What that replaces depends on what a coordinator's first touch costs the desk today, which we have not measured and do not assume.

**What a pilot would be.** Two weeks in shadow mode on one desk's escalation inbox: Rivet drafts the next step for every case into its outbox, and coordinators send, edit or reject each draft. Nothing goes out without a person. Measures: the share of drafts sent unchanged, the number of drafts a coordinator had to stop for a prohibited promise (target zero), and time from escalation to first action. Steps people approve every time become the first candidates to run without review.

**What stands between today and that pilot.** No real mailbox, portal or queue is behind the outbox yet. Decisions people make are recorded but do not yet feed back into how careful the agent is. Only delivery cases have been run. The scores above are single runs on 48 cases against answer keys we wrote. Each of these is in [Known limitations](#known-limitations) or [What we would build next](#what-we-would-build-next).

---

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
- **The 3D city is a demo.** It replays traces and stages practice incidents; it is not evidence of the agent's quality.

## What we would build next

1. Real transports behind the outbox (mailbox, portal, work queues) so Verify can check delivery and chase replies.
2. Read the case history back in: group cases that share a cause, chase promises before they are late, and widen what the agent may do alone where people keep approving the same card.
3. Calibrate Jev against the safety thresholds on a labelled set, then move the message check to it for speed and cost.
4. A person in the loop for real: decisions from the console and by voice feeding back into held cases. (In the console a decision now re-runs the case with that choice; a scored batch still never waits for one.)
5. Run the other three tracks and a human review of the answer keys.

---

## Data and attribution

- `data/raw/` and `data/cases/`: the organisers' 200 synthetic practice cases, from `github.com/DwellyOrg/HackatonPublicCases`.
- `data/generated/`: our own synthetic cases, set in the same fictional world.
- `data/adversarial/` and `data/city/`: our own synthetic cases (adversarial traps, and incidents set in the 3D city's world).
- `data/scraped/`: scenario descriptions rewritten in our own words from public complaint pages. No names, order numbers, addresses or quoted text; see its README for sources and rules.
- `.claude/skills/`: third-party Claude Code skills under their own licences (see the licence files there).

<details>
<summary><b>Dependencies and their licences</b></summary>

<br>

| Package | Version | Licence | Used for |
|---|---|---|---|
| `next` | 16.4.0 | MIT | The API and the console |
| `react`, `react-dom` | 19.3.0 | MIT | The console |
| `@anthropic-ai/sdk` | 0.133.0 | MIT | Claude calls |
| `zod` | 4.6.5 | MIT | Schemas for model output |
| `@xyflow/react` | 12.12.0 | MIT | The playbook editor |
| `@elevenlabs/react` | 1.15.2 | MIT | Voice calls in the browser |
| `three` | 0.186.1 | MIT | The 3D city |
| `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing` | 9.8.1, 10.7.9, 3.1.3 | MIT | The 3D city |
| `zustand` | 5.0.15 | MIT | City state |
| `tailwindcss` | 4.3.3 | MIT | Styling |
| `vitest` | 5.0.3 | MIT | Web tests |
| `concurrently` | 9.2.5 | MIT | `npm run dev` |
| `remotion`, `@remotion/*` | 4.0.534 | Remotion License | Rendering the demo video (`apps/video/`) |
| `playwright` | | Apache-2.0 | Capturing demo footage |
| `@fontsource/instrument-sans`, `@fontsource/spline-sans-mono` | | OFL-1.1 | Fonts in the demo video |

External services (Anthropic, TypeSafe, ElevenLabs) are used under their own terms; no keys are committed.

**Remotion licence note.** Remotion is not open source: it is free for individuals, non-profits and companies of up to three people, and larger companies need a company licence (see [remotion.dev/license](https://www.remotion.dev/license)). It is used only to render the demo video under the free tier; it is not part of the agent or the console, and the Apache 2.0 licence below does not cover Remotion itself.

</details>

## License

Apache 2.0. See [`LICENSE`](LICENSE).
