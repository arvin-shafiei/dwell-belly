# Voice stress test and ideas (Delivery & Logistics)

Written 2026-10-10 ~10:45 by the voice fork. Research from ElevenLabs docs fetched today. Items marked (unverified) come from third-party pages or general knowledge.

## 1. What ElevenLabs gives us (verified unless marked)

| Need | Product / endpoint | Notes |
|---|---|---|
| A voice agent the desk can run per case | ElevenLabs Agents (ElevenAgents) | LLM can be Claude (Haiku 4.5, Sonnet 4.5 to 5.5, Opus) or a custom LLM endpoint. https://elevenlabs.io/docs/eleven-agents/customization/llm.md |
| Per-call prompt, first message, voice | `startSession({ agentId or signedUrl or conversationToken, overrides: { agent: { prompt, firstMessage, language }, tts: { voiceId } } })` in `@elevenlabs/react` | WebRTC by default, websocket for text-only. `textOnly` override exists (saves voice minutes in dev). https://elevenlabs.io/docs/eleven-agents/libraries/react.md |
| Live transcript in our UI | `onMessage` callback (user transcriptions tentative + final, agent replies), `onModeChange`, `sendContextualUpdate()` (inject context without a reply), `sendUserMessage()` | same page |
| Agent calls back into our system | Client tools (run in browser, "wait for response" returns value to agent) and webhook/server tools (hit our API) | No timeout behaviour documented, so add our own. https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools.md |
| Transcript and audio after a call | Post-call webhooks: `post_call_transcription` (transcript with tool calls, analysis, cost), `post_call_audio` (base64 MP3), `call_initiation_failure` (declined, unanswered). HMAC via `ElevenLabs-Signature`. Also `GET /v1/convai/conversations/{conversation_id}/audio` | https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks.md |
| Real phone calls | `POST /v1/convai/twilio/outbound-call` with `agent_id`, `agent_phone_number_id`, `to_number`, `conversation_initiation_client_data.dynamic_variables` and `conversation_config_override`. Answering-machine detection, ringing timeout | Needs a Twilio account plus a purchased number or a verified caller ID (outbound only). https://elevenlabs.io/docs/api-reference/twilio/outbound-call |
| Handing a live call to another agent | `transfer_to_agent` system tool. Full transcript preserved, child has its own voice and prompt | One-way handoff. **There is no "agent calls agent" feature.** https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools/agent-transfer.md |
| Several voices in one agent | Multi-voice: up to 10 voices, switched with `<Label>text</Label>` tags | https://elevenlabs.io/docs/eleven-agents/customization/voice/multi-voice-support.md |
| Fast TTS for our own simulated turns | `POST /v1/text-to-speech/{voice_id}/stream`, model `eleven_flash_v2_5` (~75 ms inference, excluding network) | https://elevenlabs.io/docs/overview/models |
| Whole simulated dialogue in one go | `POST /v1/text-to-dialogue`, `inputs: [{text, voice_id}]`, default `eleven_v3`, max 10 voices, 2,000 chars per request | Not real time. https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert |
| Voice notes and audio attachments to text | Scribe v2 (`scribe_v2`, batch), Scribe v2 Realtime (`scribe_v2_realtime`, ~150 ms partials), 90+ languages, diarization up to 32 speakers | Batch endpoint is the Speech to Text convert endpoint (`POST /v1/speech-to-text`, path not shown on the overview page). https://elevenlabs.io/docs/overview/capabilities/speech-to-text.md |
| Language switching | `language_detection` system tool | https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools/language-detection.md |

**Credits (Creator plan, the free month every participant gets):** official agents pricing page shows Creator = 275 agent call minutes, 10 concurrent calls, $0.08/min after that; LLM and telephony billed on top. https://elevenlabs.io/pricing/agents (via search snippet, page not fetched directly). TTS credits: about 100,000 credits, roughly 100 minutes of TTS (unverified, third-party: https://bigvu.tv/blog/elevenlabs-pricing-2026-plans-credits-commercial-rights-api-costs/). Agent minutes and TTS may draw from the same pool (unverified).

## 2. Stress test of the plan

| Risk | What breaks | Mitigation |
|---|---|---|
| **Fabrication in the scored run** | A simulated driver says "I left it with the neighbour", it enters the case, and ANSWER.md presents it as fact. Judges penalise fabricated results; cases say later facts must not be used at escalation | Every voice event carries `source: live_human | simulated_persona | audio_attachment`. The Reality Test runner rejects `simulated_persona` events in code, not in a prompt. In the scored run a call is a *planned, gated action* ("call recipient with this script, awaiting answer"), never a simulated reply |
| **The Safety Gate is bypassed on live calls** | The voice LLM speaks before our gate sees anything, so it can promise a refund mid-sentence | Put the boundaries into the voice agent's prompt via dynamic variables, and make every commitment a server tool (`propose_commitment` goes to our gate and returns allowed or denied with approved wording). Post-call audit of the transcript through the same gate; violations get flagged in the case log |
| **No agent-to-agent calling** | Two ElevenLabs agents cannot talk to each other natively. Bridging two WebRTC sessions is fragile | Run simulated calls ourselves: Claude writes each persona turn, `text-to-speech/{voice}/stream` with `eleven_flash_v2_5` speaks it, SSE pushes audio and text to the browser. Exact transcript, no drift, cheap. Use the real Agents SDK only when a human is on one side |
| **Latency and turn-taking** | Sonnet or Opus as the voice LLM adds seconds of silence | Use Claude Haiku 4.5 for the live voice agent, keep prompts short, let the heavy pipeline run before and after the call, not during it |
| **Venue Wi-Fi** | WebRTC needs UDP; conference Wi-Fi often blocks it or is congested | Test at the venue by 14:30. Fallback `connectionType: "websocket"`. Phone hotspot. Record the voice segment of the demo video early (by 15:30) |
| **Credits run out** | 275 agent minutes shared by a whole team in development | Develop with `textOnly: true`, switch voice on only for real tests. Each teammate claims their own Creator coupon so there are spare keys. Log cost per conversation (it is in the webhook payload) |
| **Twilio setup time** | Trial accounts can only call verified numbers and play a trial notice; UK numbers need a regulatory bundle (unverified, general knowledge) | Skip the phone network. Browser WebRTC is real voice and fully demoable. Use Twilio only if someone already has an upgraded account and a number |
| **Interruptions (barge-in)** | Our own simulated turns cannot be interrupted | Fine for agent-to-agent simulation. Live human calls go through the Agents SDK, which handles barge-in |
| **Concurrency** | 10 concurrent calls on Creator | Plenty for a demo. Do not place voice calls during the Reality Test batch at all |
| **UK driving law** | Hand-held use while driving is illegal even at traffic lights (£200, 6 points); hands-free is legal but police can still charge for lack of proper control if distracted (https://assets.publishing.service.gov.uk/media/62053d3cd3bf7f3148fe3ecc/explanatory-memorandum-to-the-revision-of-the-highway-code-rule-149-about-using-mobile-phones-while-driving.pdf) | Default to **async voice notes** for drivers. Live calls only hands-free, opening with "Are you safe to talk?", max 3 yes/no questions, under 30 seconds, and the agent ends the call if the driver says they are driving in traffic. This is a real-world selling point, say it in the demo |
| **Recording consent, UK GDPR** | Recording people without telling them; AI not disclosed | First message: "This is the Rivet delivery assistant, an AI. This call is recorded for the case log." Synthetic personas only in the demo. Note retention settings in the README (general knowledge, not legal advice) |
| **Judges see a gimmick** | Best Voice requires voice "part of a functioning operational system rather than simply a standalone voice demo" | Every call must change case state: transcript becomes an event, the pipeline re-runs, Clash Check or the decision card reacts, and the trace shows the voice-originated event. Never show voice that does not move a case forward |
| **Demo failure** | Live voice fails on stage | Pre-recorded fallback clip in the repo video; the video is the scored artefact anyway |

## 3. Ideas, ranked

Score = Best Voice win chance x feasibility for one person in ~3 h x help to the main (Reality Test) score, each 1 to 5.

| # | Idea | Win | Feas | Main | Notes |
|---|---|---|---|---|---|
| 1 | **Voice approval of decision cards.** The on-call manager gets a call (browser) that reads the decision card: summary, the clash, 2 or 3 options, the fact that would settle it. They say "option 2", a `submit_decision(option_id)` tool fires, the pipeline continues to Action. They can ask "why?" and the agent answers from the trace | 5 | 4 | 3 | Hits Best Voice and Best Exception Handling at once (human handover with full context). Human in the loop by voice is the clearest "functioning operational system" story |
| 2 | **Driver voice notes into case updates, plus audio ingestion.** Driver records a note hands-free, Scribe transcribes it, Ingest tags it as a *claim* from the driver, Clash Check compares it with the customer. The same code transcribes any audio attachment in a Reality Test case | 4 | 5 | 4 | Cheapest (under 1 h). Defensive for the scored run: the organisers said "it must work with emails, maybe calls", so a 16:30 case may contain a voicemail or call recording |
| 3 | **Agent calls a person for the missing fact, gated.** Case 003: call the recipient to let the driver in by intercom, never ask for the code. Case 018: call before the return-to-sender cutoff with only the dispatcher-confirmed options. Commitments go through `propose_commitment` to the Safety Gate | 5 | 3 | 3 | The boss to driver call is a variant. Use a simulated persona or a teammate on the other end, labelled |
| 4 | Supervisor live listen-in with take-over. Live transcript plus a "Take over" button: the AI session ends, the human continues with `sendContextualUpdate` briefing and the full transcript on screen | 4 | 2 | 2 | Real take-over of a phone call needs Twilio conferencing. In browser simulation it is doable but fiddly |
| 5 | Multilingual calls via `language_detection` (e.g. a Polish-speaking driver) | 3 | 5 | 1 | 15 minutes of config. Good flair, add it to idea 2 or 3 |
| 6 | Voice-based Verify: call back after the action ("did the driver get in?") | 3 | 3 | 1 | Risky in the scored run (fabrication). Demo only |
| 7 | Inbound customer call handled by the desk agent | 3 | 3 | 2 | Same gate problem as idea 3, and less novel; every team will think of it |
| 8 | Agent-to-agent simulated calls with live listening (our own Claude + TTS loop) | 3 | 4 | 0 | Use it as the engine behind ideas 3 and 6 in the demo, and as a Self-Test generator (a simulated driver who contradicts the customer). Must never feed the scored run |

## 4. Recommended scope

Build ideas 1, 2 and 3 on one shared voice layer. Skip Twilio. Total about 3 h for one person, starting once the core pipeline runs end to end.

**Build plan**

1. **0:00 to 0:30.** Claim Creator coupons. Create one ElevenLabs agent "Desk Caller": LLM Claude Haiku 4.5, TTS `eleven_flash_v2_5`, first message with AI and recording disclosure, dynamic variables `{{case_brief}}`, `{{goal}}`, `{{boundaries}}`, `{{options}}`. Server tools pointing at `apps/api`: `submit_decision`, `propose_commitment`, `record_fact`, `request_human`. Enable the `post_call_transcription` webhook.
2. **0:30 to 1:30. Backend.** `POST /api/voice/session` returns a signed URL or conversation token (API key stays server-side) plus overrides built from the case trace. Webhook handler verifies `ElevenLabs-Signature`, appends an event `{stage: "Voice", channel: "Call", source, transcript}`, re-runs the pipeline from Ingest. Tool handlers time out after 5 s and return an explicit error.
3. **1:30 to 2:15. Frontend.** `@elevenlabs/react` `useConversation`: live transcript panel from `onMessage`, "Approve by voice" on the decision card, "Call driver / recipient" buttons, a SIMULATED badge whenever a persona is on the line.
4. **2:15 to 2:45. Simulated personas.** Backend loop: Claude persona with a private fact sheet, each turn spoken via `POST /v1/text-to-speech/{voice_id}/stream`, pushed over SSE. Events tagged `simulated_persona`.
5. **2:45 to 3:00. Voice notes.** Browser recording to `POST /v1/speech-to-text` (`scribe_v2`), event tagged `live_human`. Add audio transcription to the Reality Test loader for any `.mp3/.wav/.m4a` attachment, with a timeout and a "could not transcribe" fallback that escalates.

**Not verified today:** exact Creator TTS credit count, whether agent minutes and TTS share one pool, the signed URL / conversation token endpoint paths (`GET /v1/convai/conversation/get-signed-url`, `GET /v1/convai/conversation/token`), Twilio trial and UK number rules, tool timeout behaviour inside ElevenLabs.
