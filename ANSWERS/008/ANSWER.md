# 008

**Decision:** ASK FOR INFORMATION. Tell Riven Shaw the return isn't received yet and ask whether the parcel has been dropped off.
**Why:** Briar Cabinet decides refunds only after its warehouse receives the item; records show only the label exists and no hand-over.

**Situation:** Riven Shaw has a return label for order VEL-008-26 (RMA-808) and asks us to mark it received and approve a GBP 64 refund. The records show only that the label was created; there is no carrier scan and no merchant intake record.

## Actions
| # | To | Channel | Status |
|---|---|---|---|
| 1 | Riven Shaw | dispatch message (reply to E06) | Recorded in sandbox outbox, awaiting reply |

## Messages
**1. To Riven Shaw via dispatch message (reply to E06)** (recorded in sandbox outbox, awaiting reply)

> For RMA-808 (order VEL-008-26), 'return created' means the label has been issued. It doesn't yet show the parcel with the carrier or at Briar Cabinet. Briar Cabinet assesses the GBP 64 refund only after its warehouse receives the item, and that decision is theirs, not ours. Have you dropped the parcel off yet? If so, please send the drop-off receipt so we can trace it.

## Not done, on purpose
- Mark the return received or approve the refund: Receipt is Briar Cabinet's intake scan and the refund is their decision. Their desk reported no intake record at 08:40.
- Ask Briar Cabinet to refund on the label alone: Under terms RT8, assessment starts only after warehouse receipt, and a label only means one was allocated.
- Open a carrier trace now: Nothing shows the parcel was handed over. Without a drop-off receipt or date, there is nothing for returns-trace to check yet.

## Escalated
Nothing.

## What failed
- Earlier in the case: Mark the return received (owed by Vellora (requested by customer)) failed or was rejected.

## Waiting for
- Whether the parcel was dropped off, when, and any drop-off receipt, from Riven Shaw
- If a receipt is supplied: confirmation of the carrier accepted scan for RET-808, from returns-trace@vellora.example
- After receipt: intake scan and refund assessment for RMA-808, from returns@briarcabinet.example

**Confidence:** high
