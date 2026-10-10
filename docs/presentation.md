# Judging presentation (17:00 to 17:30)

The demo's 30 points cover the video **and** this presentation (rules sections 8 and 10).

- **Presenter:** the lead names them by 16:00 (Arvin unless the team decides otherwise).
- **Length:** 2 minutes spoken, about 280 words. The times below are cumulative.
- **On screen:** the desk console at http://localhost:3000, with the tabs pre-opened as in `docs/demo-script.md` (pre-flight step 4).
- **Backup:** if the laptop or the Wi-Fi fails, play `demo/demo.mp4` and speak over it using the same script.
- **Number rule:** every number below comes from `eval/results.md` or from a saved run in `runs/console.db`. Say none that isn't on this page.

---

## The 2-minute script

**0:00 to 0:15: the problem.** *(Screen: Home)*

> A delivery desk sits between the customer, the carrier and the merchant, and it controls almost nothing itself. It fails when someone picks a side, promises a refund they can't give, or auto-replies when a person should decide.

**0:15 to 0:25: what we built.** *(Screen: Case runs)*

> Rivet reads the case, works out who owns the decision, and takes one step: message the right team, ask for the missing fact, do nothing, or hand a person a decision card.

**0:25 to 0:55: one case, two looks.** *(Screen: `delivery-013`, then `gen-1201`)*

> Here the scan says "failed attempt" and the recipient says she was home. Rivet flags the clash, picks no side, and asks the carrier's tracking team for their finding.
>
> Harder: the recipient has died, and his daughter wants a redirect and a refund. Only the verified recipient may choose. Rivet sends one kind reply that promises nothing, and gives the supervisor a card with three options, the deadline, and what happens if nobody answers.

**0:55 to 1:20: why it's safe.** *(Screen: the gen-1201 card, then Results)*

> Every outgoing message is checked on its own. Code rules come first, then a risk score: below 0.3 it's sent, from 0.3 a person decides, from 0.8 it's stopped. It never says "delivered" or "refunded" unless the owner confirmed it. Case text is evidence, never an instruction. Voice never touches the scored run.

**1:20 to 1:45: the numbers.** *(Screen: `eval/results.md`, Run 3)*

> On 48 test cases, the last scored run passed 45, with a mean of 0.90. It messaged nobody when a person had to decide (0 of 5) or when nothing was owed (0 of 3). Fifty practice cases took 165 seconds, at about 5 cents each.

**1:45 to 2:00: the honest limit, and what's next.**

> That run broke two must-never rules. Both are fixed and re-checked one by one, but not yet re-scored as a set. Next: real mailboxes behind the outbox, and people's decisions feeding back in.

*(If asked, or if there's time: **▶ Watch it think** on `delivery-013` replays the saved trace step by step with no model call.)*

---

## The architecture in three lines

1. **Read:** Load (code, any folder) → Understand (`claude-sonnet-5-5`: claims versus records, what was already asked, who owns what), plus optional quick reads from TypeSafe Jev (problem type, five "second opinion" seats, a clash score).
2. **Decide:** Plan (`claude-opus-5-5`) picks act, ask for info, wait, hand to a person or do nothing → Safety check per message (code rules, then a Sonnet score against thresholds in config) → allowed messages go to a sandbox outbox as "recorded", held ones become a decision card.
3. **Prove:** every step is written to `trace.json`. `ANSWER.md` and `REASONING.md` are rendered from the trace, `npm run replay` re-renders them with no model call, and the console and the 3D city only read traces.

---

## Numbers we may quote (and where they come from)

| Claim | Source |
|---|---|
| 45 of 48 passing, mean 0.90 (Run 3) | `eval/results.md`, All cases |
| 12 of 12 organiser practice cases passing (Runs 2 and 3) | `eval/results.md`, Organiser practice cases |
| 100% completed, 100% right kind of response, 100% right party (Run 3) | `eval/results.md` |
| Messaged when nothing was owed: 0 of 3. Messaged when a person had to decide: 0 of 5. In all three runs. | `eval/results.md` |
| Broke a must-never rule: 2 of 48 in Run 3 (`gen-801`, `gen-1004`), fixed and re-checked one by one, not re-scored as a set | `eval/results.md` |
| 50 of 50 practice cases answered, no failures, 165 s total, 17 to 32 s per case, $2.70 (about $0.054 per case); not scored | `eval/results.md` |
| Test material: 50 organiser practice cases, 243 generated hard cases with answer keys, 100 adversarial cases, 50 city cases | `data/` folder counts, README |
| `delivery-013`: right, 1.0; 37 s; $0.056; safety check cleared 2 of 2 (risk 0.10) | `runs/console.db`, execution `5881d315-39d4-4d5a-a627-0bd23f8a9d0d` |
| `gen-1201`: handed to the supervisor with 3 options; 88 s; $0.095 | `runs/console.db`, execution `e4c60526-7c28-448b-bc56-85bb606b3d18` |
| Safety thresholds: send below 0.3, a person decides from 0.3, stop from 0.8 | the flow config, also recorded in every trace's safety check |

**Don't say:** "zero rule breaks", "100% safe", "tested on the adversarial set" (it's built but not scored), "tested on the stress-test fixtures" (not run through the eval), "works on all four tracks" (only delivery has been run), or any Reality Test score before it exists.

---

## Likely judge questions

**"How do you know it doesn't just escalate everything?"**
In the last scored run it escalated when a message was the answer 0 times out of 38. It picked the right kind of response (contact, escalate or nothing) in all 48 cases.

**"What stops it from promising a refund?"**
Each outgoing message goes through the safety check, not the plan as a whole. Promises, refunds, exact times and changes to a delivery are scored as risky and held for a person. It may not say "booked", "delivered" or "resolved" unless the owner confirmed it on its own channel. The outbox itself only ever reports "recorded", because no live system is connected.

**"What about prompt injection in the case files?"**
Case text is data. Instructions inside a message or an attachment are flagged and paraphrased, never followed, and never quoted where they would read like an instruction. "Follows instructions planted in the case" is one of the boundaries the safety check scores on every message. We wrote 100 adversarial cases for this, including hidden injections, but haven't scored them yet, so we don't claim a number.

**"Is the 3D city the product?"**
No. It's a visualisation that replays agent traces, and a source of practice incidents. The scored runner (`npm run reality`) never touches it. Anything from a simulated persona is labelled SIMULATED, and city-made cases never count in the console's numbers.

**"Is voice in the scored results?"**
No. Voice is a channel for demo mode only. The scored runner doesn't use it, and simulated voices are refused outside demo mode.

**"Your generated cases: didn't you just write tests you knew you'd pass?"**
Claude wrote the answer keys, and a second agent checked each one blind. We label those scores internal and lead with the organiser practice cases (12 of 12 passing). No person has reviewed the generated keys yet; that's in our known limitations.

**"What does it cost, and how fast is it?"**
About $0.054 a case and 17 to 32 s each, 8 at a time: 50 practice cases in 165 s for $2.70. That was measured once, on one machine and account tier.

**"What happens if Claude is down mid-run?"**
Every case has a timeout and retries only on infrastructure errors. A failed case still gets an answer saying where it failed and that it was handed to a person, and a batch can be resumed. There's no second model vendor, which is a known limitation.

**"Can we reproduce your results without your keys?"**
Yes, for the answers. `npm run replay` re-renders every `ANSWER.md` and `REASONING.md` from the saved `trace.json` files with no model call, and the Reality Test answers are committed with their traces. The eval summary is committed in `eval/results.md`. The raw per-case eval files live in `runs/`, which is not in git.

**"Which models, and why two?"**
`claude-opus-5-5` makes the decision. `claude-sonnet-5-5` reads the case and checks the drafts, which is faster and cheaper. Model ids are pinned and can be overridden with `AGENT_MODEL` and `AGENT_FAST_MODEL`. TypeSafe Jev is optional: without a key those steps are skipped.

**"What's the biggest weakness?"**
The current code hasn't been scored as a whole since the last fixes; nothing it sends is real yet, so "verify" can't check replies; and only the delivery track has been run.

**"What would you build next?"**
Real mailboxes, portals and queues behind the outbox. Reading case history back in, to group related cases and chase promises before they're late. A real person in the loop, so decisions from the console and by voice flow back into held cases.
