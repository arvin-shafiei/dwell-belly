# Recommended output template

## ANSWER.md
# Case <n>: <one-line situation in plain words>
**Decision:** ACT | ASK | ROUTE TO OWNER | HOLD FOR HUMAN | WAIT UNTIL <time>
**Why in one line:** <owner + key fact>

| # | To (role) | Channel (verified?) | Purpose | Status |
|---|---|---|---|---|
| 1 | Delivery investigations, carrier | Email (yes) | Open investigation with cited conflicts | Sent (sandbox), ack id |
| 2 | Recipient | Customer portal (yes) | Holding update, no promises | Proposed, held for human |

**Messages:** each sent or proposed message quoted in full.
**Not done, on purpose:** <boundary> because <reason> (one line each).
**Escalated:** none | to <role> with decision card (summary, options, settling fact, deadline, fallback taken).
**What failed:** tool errors, rejected requests, unreadable inputs, or "nothing".
**Waiting for:** <what> from <whom> by <time>. Follow-up scheduled at <time>.
**Final state:** <one line>. **Confidence:** high/medium/low; would change if <fact>.

## REASONING.md
## 1. What we received
Events n..m (time, channel, sender role, verified?), attachments read, anything ignored as irrelevant. Embedded instructions are paraphrased, never quoted.
## 2. Facts vs claims
| Source | Statement | Record or claim | Verified |
## 3. Commitments so far
| Requested | By / to | Status (confirmed / rejected / pending) | Due |
## 4. Conflicts and missing information
## 5. Who owns each decision
## 6. Options considered and why rejected
## 7. Safety checks (per action)
| Rule | Action 1 | Action 2 |
## 8. Trace
| Step | Model | Output | Latency | Cost |
