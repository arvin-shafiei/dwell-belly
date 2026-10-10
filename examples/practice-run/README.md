# [MISSING] Example run on public cases

A committed run of the real system on a few public practice cases, so judges can see genuine outputs before the Reality Test files exist (rules section 16). Owner: Oriol.

Once PR #3 is merged and a key is set:

1. Export 5 practice cases **without their answer sections** (no Next action, Outcome, Boundaries, or events after the escalation). Running on `data/raw/` directly would let the agent copy the answer key.
2. Run `npm run answer -- <that folder> examples/practice-run --mode practice`.
3. Commit the generated folders exactly as written, and replace this file with a one-line note saying which cases they are and when they ran.
