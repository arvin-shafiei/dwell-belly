# Haiku-made delivery cases

`data/haiku/delivery/haiku-NNNN.json`: a large, cheap, broad batch of synthetic delivery escalation cases written by Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) with `scripts/eval/gen-haiku.mjs`.

**The answer keys are model-written and nobody has reviewed them.** Haiku wrote both the case and its `expected` block. Treat a failure on one of these cases as something to look at, not as proof the agent is wrong. For scoring that counts, use the public, fixture, adversarial and city sets.

## How they were made

- The prompt is the one `gen-cases.mjs` uses (shared through `scripts/eval/gen-prompt.mjs`), with one public practice case as the format example.
- Each slot crosses one difficulty pattern from `scripts/eval/mutations.mjs` (all 28, cycled evenly) with one scene theme: weather disruption, customs holds, parcel lockers, neighbour deliveries, age-restricted goods, medication, pets and perishables, phishing and fraud, data-protection requests, multilingual messages, carrier strikes, wrong-address loops, high-value electronics, B2B pallets, returns disputes, or none. The pattern decides the right answer, and the theme only sets the scene. Each file records both, as `mutation` and `theme`.
- Every draft goes through the same structural checks as the other generated sets (`scripts/eval/checks.mjs`: event numbering, known channels, increasing timestamps, an escalation addressed to the desk, dispositions allowed for the pattern, actions consistent with dispositions, at least one `must_not`), plus the validator's check against public shipment references. A draft that fails is dropped and never written. Its slot number stays empty, so the ids have gaps.
- Slots are deterministic. Re-running the generator fills only the empty slots.

## Run

```bash
npm run gen:haiku                                   # defaults: --target 600 --concurrency 2 --budget 2 --stop 15:50
npm run gen:haiku -- --target 800 --budget 1 --stop 23:00
node scripts/eval/validate-cases.mjs data/haiku/delivery/*.json
npm run eval -- --agent flow --set haiku --limit 20  # "--set all" leaves haiku out on purpose
```

The generator shares an API key with the live agent, so it is rate-limit guarded. It runs at most 4 calls at once (2 by default). On a 429 or 529, every worker backs off together, with an exponential delay. It stops hard at the `--stop` time (Europe/London) and at the `--budget` dollar cap. The cap counts spend from earlier runs, which is recorded in the `--state` file.

In the console these cases appear as the **Haiku-made** scenario set.

## This batch

Generated on 2026-10-10 from 14:25 to 15:18 BST, then stopped early by the coordinator to protect the shared API budget. The cap had been lowered from $8 to $2, with 2 calls at a time.

- **210 cases written** (`haiku-0001` to `haiku-0239`, with gaps), and all 210 pass `validate-cases.mjs`.
- **31 drafts rejected** by the structural checks and not written. The most common reasons were an escalation not addressed to the desk, and a reused public shipment reference. There were 0 API errors and 0 rate-limit backoffs.
- **Spend: about $1.86.** That is 243 calls, 553,643 input and 250,907 output tokens ($1.85), plus a small allowance for calls still in flight when the run was stopped. It works out to about $0.009 per kept case.
- **By pattern:** all 28 patterns, with 5 to 9 cases each. The fewest are multi_issue and hidden_injection (5 each) and long_context, embedded_instructions and format_trap (6 each).
- **By theme:** every theme has 10 to 15 cases, and 14 cases have no theme.
- **By accepted answer:** contact or escalate 79, contact 60, escalate 50, contact or no action 11, no action 10.
- Mean of 4.6 events per case, and at most 28. The cases are shorter than the Sonnet-made `generated` set. Haiku also reuses some first names ("Marcus" turns up often), and a few answer keys look debatable on a spot check. For example, haiku-0011 says not to reply to a recipient who asked for a confirmation.
