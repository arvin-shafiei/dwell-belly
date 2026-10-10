# Decision-pattern validation

The later [sequential chaining check](chaining-README.md) records four actual default-agent runs with accumulated replies, current customer and site requirements, and a goods-release dependency. The results below remain the earlier, separately pinned six-case check.

Actual Claude executions on 10 October 2026, using sandbox messages. These are internal development checks against synthetic keys, not official Reality Test answers or proof of unseen-case generalisation.

The agent now identifies overlapping decision groups from case evidence and receives general guidance for the relevant groups. It never reads the offline learning catalogue or case-specific answer keys. The three new keys are explicitly unreviewed synthetic material; the internal grader is a model, not a human review.

## Targeted results

[validation.json](validation.json) records six real agent outputs, their selected groups, pending replies, answer keys and model judgements. All six passed the existing 0.7 threshold, with no prohibited-action violations or execution errors. Mean score: 0.93.

| Case | Decision | Score | What the check established |
|---|---|---:|---|
| gen-3301 | Act | 1.0 | Crash and failed spare capacity: alert Safety, retain delivery recovery, do not promise tomorrow |
| gen-3302 | Act | 1.0 | Traffic and invalidated slots: request fresh owner-approved options, do not book a rejected or withdrawn slot |
| gen-3303 | Act | 1.0 | Replacement vehicle available but goods-safety clearance missing: request clearance, do not release goods |
| adv-081 | Act | 1.0 | A damaged bath-bomb gift set remains an ordinary damage claim, without a safety escalation |
| gen-1101 | No action | 0.8 | Resolved case: no message; the evaluated representation lacked the requested detailed rationale |
| gen-901 | Hold for a human | 0.8 | Formal legal restriction: no outbound messages; the evaluated handoff missed some requested evidence detail |

[chained-initial.json](chained-initial.json) preserves the first three-case run: all passed, but gen-3303 received partial credit for omitting the customer's conditional slot acceptance. The later representation includes pending replies, and the later execution included the condition in its safety-owner message. Do not attribute the score difference to one change: model outputs vary.

## Reproduce

After `npm ci`, configure `ANTHROPIC_API_KEY` and run:

```sh
npm run eval -- --agent flow --set all --ids gen-3301,gen-3302,gen-3303,adv-081,gen-1101,gen-901 --concurrency 2
```

[manifest.json](manifest.json) pins the execution module and input hashes. The recorded base commit alone does not represent the modified source used for these runs. Grader spend is reported separately and excludes agent model cost. Re-running will make fresh model calls and may produce different outputs and scores.

The later pull of main through `e100b5e8` changed execution modules and added 2,500 bulk cases. The manifest retains the historical hashes used for the recorded executions; these results do not establish the merged code's live model behaviour or scores on the new bulk set. Offline categorisation now indexes all 2,958 cases, including each bulk case's secondary transforms and rule-derived provenance.

These checks exercise decisions from histories supplied at escalation. A persistent order state, dependency scheduler and automatic resumption after later replies are not established by these results. The full catalogue has not been re-evaluated.

The workflow-generation check also caught a failure: a larger draft returned malformed JSON ([architect-failed.json](architect-failed.json)). The worked example was compacted, the prompt now groups disruption causes into broad recovery paths, and a malformed or truncated reply gets one bounded compact retry. No failed draft is accepted as runnable.

The final live generation returned a valid 67-node graph on Sonnet 5.5 ([architect-flow.json](architect-flow.json)). Executing that graph through `POST /api/cases` on gen-3303 recorded a Food-safety lead request and a Warehouse update, with no Dispatch release instruction and no desk human card ([architect-run.json](architect-run.json)). The trace records the overlapping disruption, dependency, conflict and hazard groups. This graph execution was checked for those behaviours but was not model-scored. Its exact description and source hashes are in the manifest.
