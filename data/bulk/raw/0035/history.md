# Case 0035 history — Merchant has received the return but the refund review has not started

All identities, records and communications are fictional. Total events: 4.

<a id="event-001"></a>
## 2028-03-05 09:00:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Warehouse receiving, Corvane Goods
- **To:** Iona Quill, Rivet Delivery Desk

Inline receipt WH-4793: RT-2634 for TG-2081 physically received at 08:10 UTC today. We can confirm receipt, but our receiving role does not approve refunds.

<a id="event-002"></a>
## 2028-03-05 09:10:00 UTC — event 002

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Oswin Grimshaw, customer
- **To:** Iona Quill, Rivet Delivery Desk

The warehouse says it has my return, but my order has no refund review. Please pass the receipt to the team that handles it.

<a id="event-003"></a>
## 2028-03-05 09:46:00 UTC — event 003

- **Stage:** Agent action
- **Channel:** Email
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Refunds team, Corvane Goods

Please register the refund review for TG-2081 / RT-2634 using warehouse receipt WH-4793. Notify us of the case reference and next update date; receipt alone is not refund approval.

<a id="event-004"></a>
## 2028-03-05 11:13:00 UTC — event 004

- **Stage:** Escalation
- **Channel:** Email
- **From:** Refunds team, Corvane Goods
- **To:** Iona Quill, Rivet Delivery Desk

FYI only, no action needed from the desk: we have this in hand and will update the customer directly. Nothing further is required from you on this one.
