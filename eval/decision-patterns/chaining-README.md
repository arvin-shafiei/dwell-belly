# Sequential constraint validation

[chaining-validation.json](chaining-validation.json) contains four actual default-agent Claude executions on one accumulated history. Every stage passed the internal model grader with score 1.0 and no prohibited-action violations. The traces preserve model calls, sandbox messages, intake constraints, pending decisions, exact inputs, synthetic keys and source hashes. These are authored calibration cases with unreviewed keys, not official Reality Test results or an independent generalisation test.

| New evidence | Actual next step |
|---|---|
| Van unavailable; Sunday morning fallback conflicts with verified recipient availability | Ask Dispatch for Sunday afternoon or Monday morning capacity; no default booking |
| Customer changes to Monday only; clinic receives only 11:00–12:00 | Ask Dispatch for Monday 11:00–12:00; retain the narrower access requirement |
| Capacity offered, but chilled meals have a recorded temperature excursion and no release decision | Ask the Food-safety lead for clearance; hold booking, retain conditional customer acceptance |
| Food-safety lead authorises this shipment's release | Ask Dispatch to confirm Monday 11:00–12:00; do not claim it is already booked |

The model did not introduce goods clearance in the first two stages of the corrected run. The goods restriction arrived in a later incoming message, and its owner's confirmation unlocked the subsequent request. All messages remain sandbox records; no actual booking or delivery took place.

[chaining-initial.json](chaining-initial.json) preserves the initial real probe and original fixture sources. Its context named future owners prematurely, which introduced unnecessary clearance requirements; its first key expected a chat route before that route appeared, while the agent correctly used Email. The fixtures were corrected and the whole sequence re-executed. No initial output or score was replaced with an invented result.

Reproduce with `npm ci`, `ANTHROPIC_API_KEY` configured, and `npm run eval:chain`. It makes paid model calls and writes a fresh `runs/chain-*.json`; outputs may vary. Jev is disabled for this validation. The agent sees only the cumulative evidence view; the grader receives the keys after execution. `npm run learn:cases` rebuilds the separate 2,962-case catalogue.

The default pipeline is tested here; this is not a fresh Architect graph evaluation. SQLite integration tests separately exercise three console runs, retained customer changes and prior recorded requests, rejection of mixed case/dataset histories, and non-reuse of earlier human approval. Console follow-ups save evidence inputs going forward; older imported runs without inputs cannot recover lost replies. An automatic external-reply listener, dependency scheduler, concurrent branch reconciliation and real delivery completion are not established by these checks.

Local validation: 348 agent/evaluation tests and 118 console/workflow tests passed; API and web typechecks and lint on changed TypeScript files passed.
