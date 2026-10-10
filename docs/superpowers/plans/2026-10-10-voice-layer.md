# Voice Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voice that changes real cases through the existing agent, shown live in the desk console:
- a driver's voice note becomes case evidence
- the agent calls a recipient, with every spoken promise checked by the real gate and Jev
- the desk manager approves a decision card by voice

A real phone call for approval (Twilio) is a stretch goal after a 15:00 checkpoint.

**Architecture:**
- `apps/api/src/voice/` is plain TypeScript with no Next imports, plus thin route handlers.
- Every voice moment becomes either a case event (the `fromView` sources `live_human`, `simulated_persona`, `audio_attachment`) or a trusted human decision. The case then re-runs through `POST /api/cases`, with the desk's earlier messages included and voice events stamped on the case's own timeline.
- Calls run in the browser over WebRTC with a server-issued token. The agent's tools are browser-side handlers that call our API. The in-call promise check reuses `gate()` with Jev's `messageRisk`.
- The scored runner (`cli.ts`) is unchanged, apart from bounded audio transcription.

**Tech Stack:** Node 24 (`node --test`, native TypeScript stripping), Next.js 16 route handlers, ElevenLabs Speech-to-Text (`scribe_v2`) and Agents (WebRTC), `@elevenlabs/react` 1.15.2 (verified types), React 19, vitest.

**Spec:** `docs/PRD.md` Part I (v1.5), plus the three voice stress-test reports in the session scratchpad (`pipeline.md`, `tech.md`, `console.md`), whose findings are folded in below.

## Global Constraints

- **Reality mode never places a call and never admits simulated input.** `cli.ts` keeps the sandbox transport only.
- Keys live only in `apps/api/.env.local`: `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID` (and later `TWILIO_*`). The browser never sees `xi-api-key`.
- **ElevenLabs endpoints**, all with the `xi-api-key` header:
  - `POST /v1/speech-to-text`: multipart, `model_id=scribe_v2`, `file`. Response `{ text, language_code, language_probability, words }`.
  - `GET /v1/convai/conversation/token?agent_id=`: response `{ token }`.
  - `POST /v1/convai/tools`: body `{ tool_config: { type: "client", name, description, parameters, expects_response: true, response_timeout_secs: 10 } }`. Response `{ id }`.
  - `POST /v1/convai/agents/create`: response `{ agent_id }`.
- **Every dynamic variable gets a default on the agent** (`dynamic_variable_placeholders`). A missing one kills the call. All values are strings.
- **The agent's model:** `claude-haiku-4-5` by default (call latency), overridable with `ELEVENLABS_AGENT_LLM`.
- **The React SDK (1.15.2, verified from its types):**
  - `useConversation` must sit inside `<ConversationProvider>`.
  - `startSession({ conversationToken, connectionType: "webrtc", dynamicVariables })` returns nothing; read `getId()` after `onConnect`.
  - `onMessage` gives `{ message, role: "user" | "agent" }`, final lines only.
  - Mute is `setMuted` / `micMuted`.
  - Client tool handlers return **strings**.
- **Tool handlers always answer within 2.5 s.** On timeout or error they answer with the denial wording, never silence.
- First message, exact: `Hi, this is the delivery desk assistant, an AI. This call is recorded for the case log. Are you safe to talk?`
- Denial wording, exact: `I can't promise that. The team that owns this decides, and I'll pass your request on.`
- **Voice events are stamped on the case's timeline:** the last case event's time plus the real time elapsed, never the wall clock. Otherwise `caseNow` jumps eight months.
- **A re-run's input always includes the desk's earlier messages** (from the previous run's outbox) as events, so nothing is sent twice.
- **Voice is always a claim.** Its event label says `voice (unverified claim)`.
- Voice functions never throw; they return `{ ok: false, error }`. Below 0.6 confidence, the body is prefixed `[unclear transcription] `.
- The microphone only works on `localhost` or https. Demo from `localhost`.
- **No mid-call pipeline updates:** a re-run takes 30 to 150 s, so calls use what was known before the call, and re-run after hang-up.
- Imports in `apps/api/src` use `.ts` extensions. Docs and copy have no em dashes. Commit messages are one sentence with no AI trailer.
- **Work only in the worktree** `~/Developer/personal/dwell-belly-voice`.

## Dependencies on teammates (send now)

- **Anson** (`apps/api/src/agent`):
  - (a) `load.ts`: voice label `voice (unverified claim)`, plus one Understand-prompt sentence saying voice is a claim even from carrier staff.
  - (b) `run.ts`: optional `RunOptions.humanDecision?: { optionId: string; label: string; by: "tap" | "voice"; who: string; confirmation?: string }`. It is a trusted section. It skips the panel's force-human hold for that decision, and releases only `ask`-class messages that implement it, never blocked ones. Tests prove no change when absent.
  - (c) Sign-off on Task 3.
- **Arvin** (`apps/web/src/console`):
  - `types.ts`: `ExecutionRecord.origin` gains `"voice"`; add `parentExecutionId`, `outbox` and `card` (from the `POST /api/cases` response), and `voice?: { trigger: "note" | "call" | "approval"; callId?: string }`.
  - The execute endpoint accepts `extraEvents` and `humanDecision`.
  - Mount slots in the Executions tab: a case header (note button), outbox rows with a Call or Phone channel (call button), and the decision card (approve by voice).

## Review Focus

1. Microphone blocked or missing: the note button shows "Microphone blocked: type the note instead" and a text box (Task 6 test).
2. Silent or empty audio: no event, and the response is 422 "nothing heard" (Task 1 test).
3. ElevenLabs 401, 402 (no credits) or 429: `{ ok: false }` with a readable reason; the UI falls back to a typed note or a tap (Task 1 test).
4. An approval naming an option not on the card, or a card already decided: refused with a read-back request (Task 5 test).
5. Duplicate tool calls: `submit_decision` is idempotent per `callId` + `optionId` (Task 5 test).

---

### Task 1: Voice core: mode policy, ElevenLabs client, voice note events

**Files:** create `apps/api/src/voice/{policy,elevenlabs,notes}.ts` and the test `apps/api/src/voice/voice.test.ts`. Root `package.json`: add `"test:voice": "node --test apps/api/src/voice/*.test.ts"`. Export `ViewEvent` from `apps/api/src/agent/load.ts` (type export only).

**Interfaces (produces):**
- `type VoiceMode = "practice" | "reality" | "demo"`
- `type VoiceOp = "transcribe_attachment" | "transcribe_note" | "start_call" | "simulate"`
- `voiceAllowed(mode, op, source?): { ok: true } | { ok: false; reason: string }`
  - Reality and practice allow only `transcribe_attachment`; demo allows all.
  - `simulated_persona` is refused outside demo.
- `transcribe(audio: Uint8Array, opts: { filename: string; apiKey?: string; fetchImpl?: typeof fetch; timeoutMs?: number }): Promise<{ ok: true; text: string; language: string; confidence: number } | { ok: false; error: string }>`, with a default timeout of 30 000 ms
- `conversationToken(agentId: string, opts: { apiKey?; fetchImpl?; timeoutMs? }): Promise<{ ok: true; token: string } | { ok: false; error: string }>`, with a default timeout of 10 000 ms
- `noteToEvent(note: { n: number; at: string; from: string; transcript: string; source: VoiceSource; confidence: number }): ViewEvent`, with `channel: "Voice note"`, `to: "Desk"` and `stage: null`

- [ ] **Step 1: Write failing tests**
  - `policy: reality refuses start_call and simulate, allows transcribe_attachment`
  - `policy: simulated_persona refused outside demo`
  - `transcribe posts multipart to /v1/speech-to-text with xi-api-key and model_id scribe_v2`: the fake `fetchImpl` asserts the URL, the header and `form.get("model_id")`, and maps `{ text, language_code, language_probability }`
  - `transcribe: empty text → ok:false "nothing heard"`
  - `transcribe: 401, 402, 429 → ok:false naming the status, never throws`
  - `transcribe: timeout → ok:false` (with `timeoutMs: 20`)
  - `transcribe: no key → ok:false`
  - `conversationToken: GET /v1/convai/conversation/token?agent_id=… → token`
  - `noteToEvent: [unclear transcription] prefix below 0.6, keeps source`
- [ ] **Step 2:** Run `npm run test:voice`. Expected: FAIL.
- [ ] **Step 3:** Implement. Use `AbortSignal.timeout`. Build error strings from the status and our own words, never from the response body.
- [ ] **Step 4:** Run `npm run test:voice`. Expected: PASS. Run `npm run test:agent`. Expected: unchanged count, all pass.
- [ ] **Step 5:** Commit `Add the voice core with mode policy, ElevenLabs speech-to-text and voice note events.`

### Task 2: The re-run builder

**Files:** create `apps/api/src/voice/rerun.ts`; test `apps/api/src/voice/rerun.test.ts`.

**Interfaces (produces):**
- `caseTime(view: CaseView, elapsedMs: number): string`: the ISO time of the last event with a parsable timestamp, plus `elapsedMs`. With no parsable timestamp, return `""` (no clock claim).
- `priorDeskEvents(outbox: { action: { recipient: string; channel: string; message: string }; status: string }[], startN: number, at: string): ViewEvent[]`: one event per `recorded` entry, from `Desk`, with the body `Already sent by the desk: <message>`
- `buildRerun(input: { view: CaseView; previousOutbox?: OutboxLike[]; newEvents: ViewEvent[]; elapsedMs: number; mode: VoiceMode }): { view: CaseView; synthetic: boolean }`. It renumbers `n`, stamps any event missing an `at` with `caseTime`, and sets `synthetic` when any event is `simulated_persona`.
- `route.ts` change (tiny): if any event is `simulated_persona`, set `trace.synthetic = true` in the response.

- [ ] **Step 1: Write failing tests**
  - `caseTime adds elapsed time to the last case event, never the wall clock`
  - `priorDeskEvents turns recorded outbox entries into desk events and skips held and blocked ones`
  - `buildRerun appends prior desk events then new voice events, numbered after the last event`
  - `buildRerun marks synthetic when a simulated_persona event is present`
- [ ] **Step 2:** Run `npm run test:voice`. Expected: FAIL.
- [ ] **Step 3:** Implement `rerun.ts`, and the `synthetic` line in `apps/api/src/app/api/cases/route.ts`.
- [ ] **Step 4:** Run `npm run test:voice`. Expected: PASS.
- [ ] **Step 5:** Commit `Add the re-run builder that keeps voice on the case's timeline and stops the desk repeating itself.`

### Task 3: Audio attachments in the loader (scored path; Anson's sign-off)

**Files:** modify `apps/api/src/agent/load.ts` and `cli.ts`; test `apps/api/src/agent/load-audio.test.ts`.

**Interfaces:**
- `loadFolder(dir, options?: { transcribe?: (audio: Uint8Array, filename: string) => Promise<TranscribeResult> })`
- Audio extensions: `.mp3 .wav .m4a .ogg .webm .flac`
- **On success:** the document `<file> (audio transcript)`, with the text `Audio attachment transcribed automatically. What follows is a claim by the speaker, not a record.\n\n<text>`
- **No transcriber:** `unreadable` gets `<file> (audio, not transcribed: no speech-to-text key)`
- **On failure:** `<file> (audio, transcription failed)`
- Each call is bounded at 30 s by `transcribe`, and the loader never throws.
- `cli.ts` passes the transcriber only when `ELEVENLABS_API_KEY` is set.

- [ ] **Step 1: Write failing tests**
  - `audio is transcribed into a claim document when a transcriber is given`
  - `no transcriber: listed as not transcribed, loading still succeeds`
  - `failing transcriber: listed as failed, never throws`
- [ ] **Step 2:** Run `node --test apps/api/src/agent/load-audio.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm run test:agent`. Expected: all pass.
- [ ] **Step 5:** Commit `Transcribe audio attachments into claim documents when a speech-to-text key is set.`

### Task 4: Voice note endpoint, the Desk Caller agent, and the session endpoint

**Files:**
- Create:
  - `apps/api/src/app/api/voice/note/route.ts`
  - `apps/api/src/voice/session.ts`
  - `apps/api/src/app/api/voice/session/route.ts`
  - `scripts/voice/create-agent.mjs`
- Test: `apps/api/src/voice/session.test.ts`, plus `handleNote` tests in `voice.test.ts`

**Interfaces (produces):**
- `handleNote(input: { mode; source; from; n; at; audio?: Uint8Array; filename?: string; transcript?: string }, deps: { transcribe }): Promise<{ ok: true; event: ViewEvent } | { ok: false; status: 400 | 403 | 422 | 502; error: string }>`
- `buildSession(req: { mode; purpose: "approval" | "call"; caseId; calleeRole; calleeName; brief; goal; questions?: string[]; card?: DecisionCard; boundaries?: string[] }): { ok: true; callId: string; dynamicVariables: Record<string, string> } | { ok: false; status: 400 | 403; error: string }`
  - The variables are exactly: `call_purpose`, `case_id`, `call_id`, `callee_role`, `callee_name`, `case_brief`, `goal`, `questions`, `options`, `boundaries`.
  - `case_brief` is at most 600 characters.
  - `questions` is a numbered list, at most 3.
  - For approval, `options` is `option-1: <label> (does: <effect>); option-2: …`, and `case_brief` leads with `card.whyStopped.line`, then `card.evidence`, then `card.alreadyDone`.
- **Routes** (both have CORS through `json()` and an `OPTIONS` handler):
  - `POST /api/voice/note` (multipart or JSON) → `{ event }`
  - `POST /api/voice/session` → `{ callId, token, dynamicVariables }`
- **`create-agent.mjs`:** creates the four client tools, then the agent, with:
  - the first message above
  - a system prompt that uses every variable and states the boundaries
  - `dynamic_variable_placeholders` for all ten variables
  - the model from `ELEVENLABS_AGENT_LLM` or `claude-haiku-4-5`

  It prints `ELEVENLABS_AGENT_ID=<id>`.

- [ ] **Step 1: Write failing tests**
  - `handleNote: 403 outside demo`
  - `handleNote: a transcript skips transcription`
  - `handleNote: empty transcription → 422`
  - `handleNote: provider failure → 502`
  - `buildSession: 403 outside demo`
  - `buildSession: brief ≤ 600 chars and questions ≤ 3`
  - `buildSession approval: options carry each effect and the brief leads with whyStopped`
  - `buildSession approval without a card → 400`
  - `every dynamic variable is a string and all ten are present`
- [ ] **Step 2:** Run `npm run test:voice`. Expected: FAIL.
- [ ] **Step 3:** Implement the routes, `session.ts` and the script.
- [ ] **Step 4:** Run `npm run test:voice`. Expected: PASS. Run `node --env-file=apps/api/.env.local scripts/voice/create-agent.mjs`. Expected: an agent id, which goes into `.env.local`.
- [ ] **Step 5:** Commit `Add the voice note endpoint, the Desk Caller agent setup and the call session endpoint.`

### Task 5: In-call tools

**Files:** create `apps/api/src/voice/tools.ts` and `apps/api/src/app/api/voice/tools/[tool]/route.ts`; test `apps/api/src/voice/tools.test.ts`.

**Interfaces (produces):**
- `interface CallState { callId; caseId; mode; source; caseText: string; calleeName: string; card?: DecisionCard; decided?: string; startN: number; at: string }`
- `checkCommitment(text: string, state: CallState, deps: { messageRisk?: typeof messageRisk; gateConfig: GateConfig }): Promise<{ allowed: boolean; reply: string; rule?: string }>`
  - It runs `gate([{ recipient: state.calleeName, channel: "Call", kind: "status_update", purpose: "spoken commitment", message: text }], { parties: [] } as Understanding, critique, gateConfig, state.caseText)`, where `critique` comes from `messageRisk` with `{ timeoutMs: 1000 }`.
  - The whole check is capped at 2500 ms.
  - Allowed only on `allow`. A null critique, `ask` or `block` means deny, with the exact wording.
- `submitDecision(state, args: { option_id: string; spoken_confirmation: string }): { ok: true; reply: string; decision: { optionId: string; label: string; by: "voice"; who: string; confirmation: string } } | { ok: false; reply: string }`
  - It refuses unknown options and already-decided cards.
  - It is idempotent per `callId` + `option_id`.
- `recordFact(state, args: { field; value; speaker_role }): ViewEvent`: a claim, with the call's source
- `requestHuman(state, args: { reason }): ViewEvent`
- `transcriptToEvents(lines: { role: "user" | "agent"; message: string }[], state): ViewEvent[]`: user lines are the callee's claims, agent lines are desk statements
- **Route:** `POST /api/voice/tools/:tool` takes `{ state, args }` and responds `{ result: string, event?, decision? }`. It always answers within 2500 ms, and on any error answers with the denial wording.

- [ ] **Step 1: Write failing tests**
  - `checkCommitment denies "you'll get a full refund today" with the exact wording`
  - `checkCommitment allows "I'll ask dispatch to check the booking" when the critic scores low`
  - `checkCommitment denies when messageRisk returns null or exceeds the budget`
  - `submitDecision rejects an unknown option and a decided card`
  - `submitDecision is idempotent for the same callId and option`
  - `transcriptToEvents marks user lines as claims with the call's source`
- [ ] **Step 2:** Run `npm run test:voice`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm run test:voice`. Expected: PASS.
- [ ] **Step 5:** Commit `Add in-call tools that check spoken promises with the real gate and Jev, and turn calls into case input.`

### Task 6: Console voice components

**Files:**
- Modify: `apps/web/package.json` (`"@elevenlabs/react": "1.15.2"`)
- Create:
  - `apps/web/src/voice/api.ts`
  - `apps/web/src/voice/transcript.ts`
  - `apps/web/src/voice/VoiceNoteButton.tsx`
  - `apps/web/src/voice/CallDrawer.tsx`
  - `apps/web/src/voice/ApproveByVoice.tsx`
  - `apps/web/src/app/voice-bench/page.tsx` (an unlinked dev bench)
- Test: `apps/web/src/voice/transcript.test.ts`

**Interfaces (produces), for Arvin's mount slots:**
- `<VoiceNoteButton caseId from onEvent={(e: ViewEvent) => void} />`
  - Records with `MediaRecorder`, posts to `/api/voice/note`.
  - On a permission error, shows "Microphone blocked: type the note instead" and a text box.
- `<CallDrawer request={SessionRequest} state={CallState} simulated={boolean} onDone={(r: { events: ViewEvent[]; decision?: HumanDecision }) => void} />`
  - Inside `<ConversationProvider>`, with a "Start call" button (the user gesture browsers require).
  - `clientTools` POST to `/api/voice/tools/:tool` and return strings.
  - Shows the live transcript from `onMessage`, each promise's verdict, and a SIMULATED badge when `simulated`.
- `<ApproveByVoice card={DecisionCard} caseId onDecision={(d: HumanDecision) => void} />`: a `CallDrawer` with `purpose: "approval"`
- `transcriptReducer(lines: Line[], msg: { message: string; role: "user" | "agent" }): Line[]`: keeps final lines in order and ignores empty ones

- [ ] **Step 1: Write failing vitest tests**
  - `transcriptReducer appends lines in order with their role`
  - `transcriptReducer ignores empty or malformed messages`
- [ ] **Step 2:** Run `npm test -w web -- src/voice`. Expected: FAIL.
- [ ] **Step 3:** Implement. Read `node_modules/next/dist/docs/` for the Suspense rule. The bench page is `"use client"` inside `<Suspense>`.
- [ ] **Step 4:** Run `npm test -w web -- src/voice` (expected: PASS) and `npm run build -w web` (expected: success).
- [ ] **Step 5:** Commit `Add voice note, call and approve-by-voice components for the desk console, with a dev bench.`

### Task 7: Real-key check, rehearsal, docs

- [ ] **Step 1:** Write `scripts/voice/smoke.mjs`: transcribe a short recording made on the bench, and fetch a conversation token. It prints PASS or FAIL per check.
- [ ] **Step 2:** Run `node --env-file=apps/api/.env.local scripts/voice/smoke.mjs`. Expected: two PASS lines.
- [ ] **Step 3: Rehearse case 003 on the bench**
  1. Driver note, then re-run: the claim shows in the trace.
  2. Call the recipient. The agent refuses the gate code and denies "compensation?" with the exact wording.
  3. Approve a card by voice, with the read-back. The decision goes to a re-run through `humanDecision` (once Anson's change lands).
- [ ] **Step 4:** Update the README voice section, `.env.example` (`ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`), the tracker rows and the PRD changelog.
- [ ] **Step 5:** Run `npm run test:voice`, `npm run test:agent` and `npm test -w web`. Expected: all pass. Commit `Document the voice layer and add a smoke test against the real ElevenLabs API.`

### Task 8 (stretch, only if Tasks 1 to 7 are green by 15:00): ring the manager's phone

Twilio number imported into ElevenLabs, then `POST /v1/convai/twilio/outbound-call` with `conversation_initiation_client_data.dynamic_variables`. After hang-up, fetch the transcript from ElevenLabs. Jev answers one typed `choice` question: "Which option did the manager confirm?" Below the threshold, or with no read-back confirmation, nothing is approved. No tunnel is needed. Planned in detail only if the checkpoint passes.

### Task 9 (stretch, off stage): simulated personas as a voice test tool

Planned only if time is left. Unverified dependency: `sendUserMessage` with the mic muted during a WebRTC call. Test that first, with the text-only fallback.
