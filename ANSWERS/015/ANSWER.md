# 015

**Decision:** ACT. Ask Marshglass intake for a carton-level check of C01–C24 on H1–H4; tell Yara Pell nothing is decided yet.
**Why:** Marshglass intake holds the only missing evidence. Its signature covers handling units, not cartons, so full receipt cannot be confirmed yet.

**Situation:** Ternwood Supplies shipped 24 cartons on 3 pallets, and Marshglass intake signed for 4 handling units; Yara Pell claims a pallet is missing. The depot repacked into H1-H4 on 2026-10-13, and no carton-level receiving scan exists, so the desk is asked to decide whether the order fully arrived or not.

## Actions
| # | To | Channel | Status |
|---|---|---|---|
| 1 | Marshglass intake | Marshglass intake work queue | Recorded in sandbox outbox, awaiting reply |
| 2 | Yara Pell | email | Recorded in sandbox outbox, awaiting reply |

## Messages
**1. To Marshglass intake via Marshglass intake work queue** (recorded in sandbox outbox, awaiting reply)

> For VEL-015-26 (receiving sheet RC-015, signed IR-15), please confirm which carton IDs C01–C24 you received across handling units H1–H4, or list any that are absent. The shipper reports a missing pallet, but the depot repacked 3 pallets into these 4 units. Your sheet records units only. The customer's requested decision time of 09:00 has passed.

**2. To Yara Pell via email** (recorded in sandbox outbox, awaiting reply)

> On VEL-015-26: the transit depot repacked your three pallets into four handling units on 13 October, which is why four units were signed for. Whether all 24 cartons arrived is not yet confirmed. We have asked Marshglass intake to check each carton ID, and we will update you when they reply.

## Not done, on purpose
- Declare the whole order arrived: No carton-level receiving scan exists, and the signature attests only to 4 handling units.
- Record or reject a missing-pallet claim: Reconciliation depends on the carton check, and the claim outcome is not the desk's decision.
- Tell Yara which version is true: The conflict must be settled by carton evidence from the owner.

## Escalated
Nothing.

## What failed
Nothing.

## Waiting for
- Carton-level confirmation of C01–C24 across H1–H4, or a list of absent cartons, from Marshglass intake
- Reconciliation outcome once the carton check is in, from Vellora reconciliation desk

**Confidence:** high
