# 014

**Decision:** ACT. Ask Vellora billing to rule on Sian Rook's INV-014 line dispute; tell her billing decides, nothing promised.
**Why:** Vellora billing owns invoice adjustments under B14; the records show two distinct references (OUT-141, RET-142), so the desk cannot treat this as a duplicate.

**Situation:** Sian Rook of Alder Atelier asks to reverse one of two GBP 32 'Parcel transport' lines on invoice INV-014, calling the second a duplicate. Records show two distinct services (outbound OUT-141, return RET-142), so the desk must not treat this as a duplicate and must route any adjustment to billing.

## Actions
| # | To | Channel | Status |
|---|---|---|---|
| 1 | Vellora billing | billing@vellora.example | Recorded in sandbox outbox, awaiting reply |
| 2 | Sian Rook | dispatch message | Recorded in sandbox outbox, awaiting reply |

## Messages
**1. To Vellora billing via billing@vellora.example** (recorded in sandbox outbox, awaiting reply)

> Please review and decide on Sian Rook's (Alder Atelier) request to reverse one GBP 32 line on INV-014 (VEL-014-26), which she says is a duplicate. Operations records show the lines as OUT-141 (outbound, 2026-10-10) and RET-142 (return, 2026-10-13), and the account desk reports a collection scan for each. She wants this settled before paying.

**2. To Sian Rook via dispatch message** (recorded in sandbox outbox, awaiting reply)

> I've passed your request about INV-014 to Vellora billing, who decide any invoice adjustment; the desk can't reverse a line itself. For reference, the two lines carry different service references, OUT-141 (10 Oct) and RET-142 (13 Oct). I'll let you know billing's decision when they reply.

## Not done, on purpose
- Reverse or promise removal of the second line: Adjustments need billing approval; the desk has no authority to change the invoice.
- Tell the customer the charge is valid: The conflict goes to billing to settle; the desk does not rule on which account is right.
- Treat the lines as duplicates: B14: similar descriptions alone do not establish duplication; references, dates and directions differ.

## Escalated
Nothing.

## What failed
Nothing.

## Waiting for
- Decision on whether any adjustment to INV-014 applies, from Vellora billing

**Confidence:** high
