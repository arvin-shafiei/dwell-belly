# 012

**Decision:** ACT. Send Selin Brook's dispute of INV-012 to Vellora billing for review, and tell her billing decides.
**Why:** Vellora billing owns invoice adjustments; the account desk confirmed no adjustment is authorised and that billing reviews measurement disputes.

**Situation:** Selin Brook (Petalworks) disputes invoice INV-012 (GBP 48, unpaid) for VEL-012-26 and asks for it to be corrected to GBP 20 based on 10 kg total actual weight. The agreed DW12 tariff bills each carton at dimensional weight, which reproduces GBP 48; the desk is asked how to respond, and any adjustment sits with Vellora billing.

## Actions
| # | To | Channel | Status |
|---|---|---|---|
| 1 | Vellora billing | email: billing@vellora.example | Recorded in sandbox outbox, awaiting reply |
| 2 | Selin Brook | email | Recorded in sandbox outbox, awaiting reply |

## Messages
**1. To Vellora billing via email: billing@vellora.example** (recorded in sandbox outbox, awaiting reply)

> Please review Selin Brook's (Petalworks) dispute of INV-012 (GBP 48, unpaid) for VEL-012-26 and confirm your outcome to the desk. She asks for a recalculation to GBP 20 on 10 kg total actual weight and a credit of the difference. Our records show two cartons, each 50x40x30 cm and 5 kg, and the account desk says DW12 was accepted at booking.

**2. To Selin Brook via email** (recorded in sandbox outbox, awaiting reply)

> The desk can't change INV-012 itself, so we have sent your request to recalculate on 10 kg total actual weight to Vellora billing, who decide invoice disputes. No change has been made yet. We will pass on billing's decision as soon as we have it.

## Not done, on purpose
- Correct or credit the invoice: Only Vellora billing can adjust INV-012; no adjustment is authorised.
- Tell the customer GBP 48 is final: The charge matches DW12, but ruling on the dispute belongs to billing.
- Promise a credit or timeline: The desk controls neither.

## Escalated
Nothing.

## What failed
Nothing.

## Waiting for
- Review outcome on the INV-012 dispute, from Vellora billing

**Confidence:** high
