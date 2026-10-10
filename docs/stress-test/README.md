# Stress test of the agent design (10 Oct, 10:40 to 11:00)

Four red-team passes on the design in `SPEC.md` and `docs/IDEA.md`, done before any agent code existed. Written for Anson (backend and edge cases) and anyone building the agent. Nothing here is a decision yet: it is evidence to decide with.

## Headline

- Simulated by hand on 8 hard cases and graded as a strict judge, the designed flow averaged **5.1/10 with 2 critical failures** (see `simulation/grades.md`).
- Of **56 catalogued edge cases**, the design handles 6, partly handles 33 and misses 17 (see `edge-case-catalogue.md`).
- Estimated score: 56 to 76 as planned, 77 to 90 with the changes below (see `architecture.md`).

The two critical failures:

- **029, chilled food out of temperature:** the Safety Gate scored the topic as risky (0.58) and held everything for our own human. With nobody answering at 16:30, the merchant's food-safety team was never told.
- **Variant A, driver, customer and photo disagree:** the customer's refund pressure held the whole plan, so the safe investigation request never went out, and the draft reply revealed a neighbour's door number.

## P0: do these or lose the Reality Test

1. **Baseline first.** One command runs every case folder and writes `ANSWERS/<n>/ANSWER.md`, `REASONING.md` and `trace.json`. Everything else is an upgrade on top.
2. **Decision types, not a single action.** `act`, `ask_for_info`, `route_to_owner`, `hold_for_human`, `wait_until`, `refuse`, with several actions allowed per case (multi-parcel, multi-issue). When an owner already has something due, the default is to wait with a holding reply. All 50 practice cases end in "contact someone", so nothing in the data teaches waiting.
3. **Gate each action, not the whole plan.**
   - **Auto-send:** requests to the owning team, questions to verified parties, honest status updates.
   - **Need a human:** promises, disclosure of personal data, delivery changes (redirects, refunds).
   - **Hard triggers in code:** hazard, medical, legal threat and value threshold go to the named specialist, never to a generic human.
   - **What gets scored:** the risk of the message about to go out, not the case topic or the customer's pressure.
4. **With no human at 16:30, send the safe actions and log the decision card for the rest.** "Escalate" must never end as "nothing happened".
5. **A loader that never fails.**
   - Accept any folder and fall back to raw text. `scripts/build-data.mjs:68-70` silently drops any event without the exact `<a id="event-N">` anchor and an "event N" heading written with an em dash.
   - Send PDFs and images to Claude directly. The text sidecars won't exist for the 16:30 cases, and tesseract is not installed on our laptops.
6. **Throughput.** About 3 model calls per case (Understand, Decide, Gate critic), cases in parallel, a per-case timeout, retries only on infrastructure errors, and an ANSWER written even when a case fails ("failed at step X, escalated to a human"). Time a full run by 14:00, with a target of under 8 minutes.
7. **Honest wording.** Actions go to a sandbox outbox and read as "sent, awaiting confirmation", never "booked", "delivered" or "verified". Anything else reads as a fabricated result.
8. **Ask the organisers now:** do the 16:30 cases come with tools or an API? Same format as the practice cases? How many?

## P1

- **Ingest outputs tables, not prose:**
  - claims (who, what, verified or not)
  - commitments (requested, confirmed, rejected or withdrawn, and when due)
  - open references (e.g. `INV-024`)
  - identities and authority
  - embedded instructions, paraphrased and never quoted
- **A clock.** Pass "now" (the escalation event time) explicitly, and compute deadlines and time zones in code. Jev cannot do arithmetic.
- **Verify in code.** Check the tool status with a 20-second timeout, guard against duplicates, retry once, then try the next channel or record the failure. Never re-plan just because a case is still pending.
- **Jev behind a switch** that falls back to Claude Haiku.
- **No hardcoded names** (Rivet, Plover Arc, Tallowmere). Work out each party's role from the case.
- **Never paste raw incoming text into outputs**, because it can carry prompt injection.
- **The agent as a plain TypeScript module with a command-line runner**, not inside Next.js route handlers, so it runs without the app.

## Fix the eval before trusting its numbers

`escalationView` (`apps/api/src/lib/data.ts:73`) leaks the answer in four ways:

- the index Context section, which often states it (case 023: "The desk must escalate to qualified carrier safety staff")
- the case title
- every attachment: in all 5 delivery cases with attachments, the attachment first appears at event 4, after the escalation at event 2
- every event, when a case has no snapshot line

Strip these, and report scores both with and without the Context section.

## Minimal architecture

Load → Understand (one structured Claude call: ingest, triage, clash, missing info, authority) → Decide (structured: decision type, actions, what we won't do, handover card) → Gate (code rules plus one critic call, at most one revision) → Sandbox execute → Report (templated ANSWER and REASONING).

The 2D and 3D views can still show every named step from `SPEC.md`, drawn from the one trace. Rules: "no extra points for more agents".

## ANSWER.md template

See `simulation/template.md`. In short:

- one decision line
- an action table: who, channel, verified, purpose, status
- the full messages
- what was not done on purpose, and why
- what was escalated
- what failed
- what we're waiting for, from whom, by when
- final state and confidence

## Voice (one person, about 3 hours, after the core runs end to end)

See `voice.md`. One browser voice layer (ElevenLabs Agents plus TTS and Scribe, no Twilio) serving:

1. **Voice approval of decision cards.** The on-call manager hears the card and says "option 2".
2. **Driver voice notes become case updates,** tagged as the driver's claim so Clash Check uses them.
3. **A gated call to get a missing fact,** as in case 003 (the intercom, never the code) and case 018 (the return cutoff).

**Rule enforced in code:** simulated persona audio never enters the scored run.

## Files

- `edge-case-catalogue.md`: 56 edge cases, each with correct behaviour, red flags, critical failures, the step that must catch it, current status and fix.
- `fixtures/101` to `112`: the 12 hardest, in practice-case format (no answer sections, history cut at the escalation) with `rubric.json`. Use them as a held-out eval next to the 50 practice cases. They complement the 12 scenario modifiers in `apps/web/src/world/scenarios.ts`.
- `simulation/`: rubrics written before simulating, the 5 variant cases, hand traces with ANSWER and REASONING per case, grades and the template.
- `architecture.md`: P0 to P2 risks, the 16:20 to 17:00 runbook and questions for the organisers.
- `voice.md`: verified ElevenLabs capabilities, risks and a build plan.
