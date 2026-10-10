# What the delivery cases actually ask for

Notes from reading all 50 `delivery` practice cases (`data/cases/delivery/`). Use this to check the spec against the data.

## The shape of every case

- Each case is a short thread: 4 or 5 events. The escalation snapshot is always events 1 to 2 (one `Context` event, one `Escalation` message).
- We are the delivery desk (Iona Quill, Rivet Delivery Desk), sitting between three parties:
  - the **recipient** or business customer
  - the **carrier**, Plover Arc Logistics: dispatch, scheduling, routing, depots, investigations, billing, safety lead
  - the **merchant**, Tallowmere Goods (plus Brineleaf Pantry for food): returns, refunds, replacement and reshipment authorisations
- The answer is one next action: **who to contact, on which channel, saying what**. Then later events show the follow-through.

Who the recorded next action goes to:

| Recipient of the next action | Cases |
|---|---|
| Carrier team (Plover Arc) | 25 |
| Merchant team | 11 |
| Recipient / customer | 7 |
| Business contact (receiving coordinator, shipper, broker, pickup point) | 7 |

Channel: Email 35, Customer portal 5, Business portal 4, Call 2, and one each for dispatch chat, depot work queue, safety incident queue and warehouse work queue.

## Boundaries that keep coming up

These are the likely red flags and prohibited actions in the Reality Test:

- Never say a parcel is delivered, or a booking confirmed, until the owning team confirms it
- Never promise an exact arrival time, a refund, a replacement or compensation the desk does not control
- Never share a third party's contact details (misdelivery cases)
- Never ask for reusable security credentials such as door codes or PINs
- Never treat a tracking conflict as proof of loss or fraud. Open an investigation instead
- Send safety hazards (leaks, temperature breaches) to the safety or food-safety lead. Never give handling advice or say food is safe to eat
- The team that owns the decision makes it: dispatch books, the merchant authorises, the carrier investigates. The desk asks, it does not decide

## Gaps against the spec

- **No case is "do nothing" or "stop and hand to a human".** All 50 are `Completed, specific coordination task only`, and the right move is always to contact someone. The Reality Test says doing nothing or escalating can be correct, so we need our own harder variants (conflicting stories, missing info, failed actions, out-of-policy demands) to test that path.
- **No order event stream, GPS, fleet, van capacity or driver-hours data.** The Watch flow, Replan Route (OR-Tools), van-breakdown grouping and the Learner have nothing in the practice data to run on or be tested against.
- **The incident flow fits the cases well**: Ingest, Triage, Clash Check, Missing Info, Planner, Safety Gate, Human Decision, Action, Verify, Case Log.
