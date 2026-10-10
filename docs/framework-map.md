# Hamyway City Framework Map (team source of truth, 14:10)
Legend: JEV fast judgement · CLAUDE reads/writes · CODE rules. In the scored run / built, outside it / not done.

## Where it stands (14:10)
- 0.92 latest score, 48 cases, 46 pass, one run
- 0 rules broken (was 2 the run before)
- 165 s for 50 cases, 50 of 50 answered
- 5¢ per case ($2.70 for 50)
- 288 agent tests pass, no key needed

## 1 · One case through the flow
Load (CODE: any folder, PDFs, images) → Understand (SONNET: records vs claims) → 3 checks at once (JEV ×3: kind, 5 seats, clash) → Plan the reply (OPUS: act, ask, hand over, wait) → Safety check (CODE + SONNET: per message, 1 rewrite)
- risk < 0.3 CLEAR → recorded in sandbox outbox
- 0.3–0.8 UNSURE → held, decision card for a person
- ≥ 0.8 UNSAFE → stopped, text withheld
Outputs: ANSWER.md (decision in one sentence), REASONING.md (facts, conflicts, gate), trace.json (every step, cost, time), result.json (replay with no key).
Thresholds live in the flow file, not in prompts. A case that fails anywhere still gets an answer handing it to a person.

## 2 · Second opinions: five seats, one call, under half a second
- Customer advocate: How upset? Vulnerable person? Already failed once?
- Rule keeper: Asking for what the desk can't grant? Formal legal / regulator / police / press?
- Safety officer: Person at risk? Asking for safety advice?
- Sceptic: Stories contradict? Message giving orders to the bot? Requester not on record?
- Ops pragmatist: Deadline within a day? Nothing owed right now?
12 scores → thresholds in config → notes for the planner, or for the red one a person decides, enforced in code.

## 3 · When it stops: the decision card (from a real run)
Why a person is needed: two owners gave incompatible instructions on the same parcel, the shipper threatens liability, the depot wants release-or-hold by 09:00.
What it turns on: Carrier billing (hold stands), Merchant (sold duties paid, told depot to release), Depot (conflicting notes, needs one instruction by 09:00).
Options, each marked can / cannot be undone. Already done safely: holding update recorded for the customer, no promise in it.
A person decides in one read without opening the case.
Triggers: rule requires a person (e.g. solicitor's letter); agent judged it unsafe (e.g. theft allegation); message too risky / delivery failed / nothing safe to send.

## 4 · Fifteen synthetic cases run as a Reality Test drop
11 sent, 2 to a person, others: ombudsman complaint → person; theft allegation vs named driver → person; duplicate request → nothing sent; pallet shifted → safety lead alerted; ex-partner asks where a parcel went → nothing disclosed; 10 hard-but-ordinary → all to a party the key accepts.
15 of 15 answered in 1 min 42 s. Checked in code for kind of response and recipient; content not judged in this run.

## 5 · How we know: test set and score
50 organiser practice cases · 120 generated (12 hard patterns) · 123 built from real complaints · 243 answer keys checked blind (221 agreed, 22 adjusted).
Weights: right outcome 30, right party 20, channel 10, right content 40. Any message breaking a "must never" rule → case scores 0.
Run 1 all Opus 0.87 · 42/48 · 1 broken; Run 2 two models tuned 0.89 · 45/48 · 1 broken; Run 3 every message judged 0.90 · 45/48 · 2 broken; Run 4 current code 0.92 · 46/48 · 0 broken.
Same 48 cases each time, one run each, so a case or two either way is noise. Runs 1–2 only judged the first message. Our eval against our keys, not the judges' score.

## 6 · What is and isn't in the scored run
- Flow, case clock, delivery with retry: in
- Jev second opinions (kind, clash): in, skipped without a key
- One-command run + results index + replay: in, rehearsed
- Playbook editor, graph runner, planner panel: console only
- 3D city, watch flow, route replan: demo only
- Voice notes, calls, approve by voice: never in the scored path
- Case history (grouping, promises, learner): recorded, not read back
- Tools shipped with a case: listed, never called

## 7 · Before 16:30
- At 16:30: `npm run reality -- <their folder>` ready
- Ask the organisers (tools? format? how many? which commit hash?): not asked
- Demo video (in repo by 16:30, 30% of score): not done
- Submission (team, members, hashes, LinkedIn + X posts): not done
Freeze 16:30, results 17:00. The API key has already hit its limit once today.
