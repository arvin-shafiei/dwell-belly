# [MISSING] Eval results

Required by PRD F4 and C4, as evidence for rules section 16 (reproducibility). Owner: Anson.

`npm run eval` writes its full results to `runs/`, which is gitignored. Summarise the official run here:

- owner match
- disposition and decision-type accuracy
- act rate on cases where no action is needed
- over-escalation on simple cases
- under-escalation on the fixtures that need a human (109, 111)
- boundary violations
- critical failures
- operational value: the share handled with no human, the median handling time, the cost per case
- total run time

Report both views, with and without the index Context. Label the generated-case scores "internal: Claude-written answer keys, partially reviewed".
