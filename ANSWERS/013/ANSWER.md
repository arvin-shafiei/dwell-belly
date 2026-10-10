# 013

**Decision:** ACT. Ask Billing to decide Bren Vale's GBP 350 claim for VEL-013-26; tell her Billing decides and nothing is promised.
**Why:** Billing approves any G13 credit and receives claims; the desk has no authority to promise or pay the GBP 350 requested.

**Situation:** Bren Vale (Oriel Studio) asks the desk to promise and process GBP 350 for late shipment VEL-013-26: a GBP 100 refund of freight plus surcharge, and GBP 250 for lost studio time. Records show a confirmed 70-minute late handover with no excluded cause, so only a surcharge credit capped at GBP 15 may be eligible, and Billing must approve posting.

## Actions
| # | To | Channel | Status |
|---|---|---|---|
| 1 | Billing | email: billing@vellora.example | Recorded in sandbox outbox, awaiting reply |
| 2 | Bren Vale | webchat | Recorded in sandbox outbox, awaiting reply |

## Messages
**1. To Billing via email: billing@vellora.example** (recorded in sandbox outbox, awaiting reply)

> Please decide Bren Vale's (Oriel Studio) claim on VEL-013-26: GBP 100 refund plus GBP 250 lost studio time, and she has asked for an answer today. Operations records the handover 70 minutes past the guaranteed deadline (carrier_sort_delay, no excluded cause), and G13 provides a surcharge-only credit capped at GBP 15. The ledger shows no credit posted, and the GBP 250 is logged as disputed with no assessment decision.

**2. To Bren Vale via webchat** (recorded in sandbox outbox, awaiting reply)

> I've sent your claim on VEL-013-26 (GBP 100 refund plus GBP 250 for lost studio time) to our Billing team, who decide what can be credited or paid. I can't promise an amount or a payment today myself. I'll pass on their decision as soon as they reply.

## Not done, on purpose
- Promise or process the GBP 350: Billing owns credits and the loss claim; nothing is approved and the desk cannot commit money.
- Tell the customer she gets GBP 15: Billing has not approved posting; stating an outcome would present an unconfirmed decision as fact.
- Escalate to a desk supervisor: A compensation request with a known owner is routine coordination, not a human-only decision.

## Escalated
Nothing.

## What failed
Nothing.

## Waiting for
- Decision on G13 surcharge credit and assessment of the GBP 250 loss claim, from Billing

**Confidence:** high
