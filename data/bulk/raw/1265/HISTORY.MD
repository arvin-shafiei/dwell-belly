# Case 1265 history — Overdue walking boots show as delivered to a pickup point the recipient says he never chose

All identities, records and communications are fictional. Total events: 7.

<a id="event-001"></a>
## 2026-07-09 10:12:00 UTC — event 001

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Oswin Ashdown, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Order TG-1746, walking boots, due 29 June to MY HOUSE. Tracker has said 'Delivered - pickup point' since 6 July. I never chose a pickup point. I have never used one in my life. No code, no email, no text, no card. I have written to Brindleworth Arc four times and four times got the same pasted paragraph telling me it has been delivered, and then they closed the case. No refund. Somebody somewhere has scanned my boots as delivered to a place I didn't pick and that is fraud as far as I'm concerned.

<a id="event-002"></a>
## 2026-07-09 10:30:00 UTC — event 002

- **Stage:** Agent action
- **Channel:** Depot work queue
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Parcel trace team, Brindleworth Arc Logistics

DL-9242 (Yarrowdale TG-1746): status shows delivered to a pickup point on 6 July. The recipient, Oswin Ashdown, says he did not select a pickup point and has received no collection code. Please confirm which pickup point holds the scan, whether a collection code was issued and to what contact, and whether the parcel has been collected.

<a id="event-003"></a>
## 2026-07-09 10:36:00 UTC — event 003

- **Stage:** Agent action
- **Channel:** Customer portal
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Oswin Ashdown, recipient

I've asked the Parcel trace team at Brindleworth Arc to find out which pickup point DL-9242 was scanned into, whether a collection code was ever sent, and whether the parcel is still there. I can't see that myself and I can't tell you yet where it is. I haven't closed anything.

<a id="event-004"></a>
## 2026-07-10 02:00:00 UTC — event 004

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Depot work queue, Brindleworth Arc Logistics (automated)
- **To:** Iona Quill, Rivet Delivery Desk

Ticket DWQ-7684 (DL-9242) closed automatically. Reason: shipment status is Delivered. Trace tickets cannot be opened on delivered shipments through this queue. The ticket was not seen by a member of staff. Disputed pickup-point deliveries are handled by the Parcel trace team by Email only, quoting the shipment reference and the recipient's statement.

<a id="event-005"></a>
## 2026-07-10 08:10:00 UTC — event 005

- **Stage:** Context
- **Channel:** Email
- **From:** Ebony Underhill, sender not on record
- **To:** Iona Quill, Rivet Delivery Desk

Hello, I'm not on the order but I live nearby. Just so you know, the driver told me DL-9242 was handed to someone at the door, so it's been delivered.

<a id="event-006"></a>
## 2026-07-10 14:20:00 UTC — event 006

- **Stage:** Context
- **Channel:** Email
- **From:** Refunds team, Yarrowdale Goods
- **To:** Iona Quill, Rivet Delivery Desk

TG-1746: Mr Ashdown has asked us for a refund. We can't consider a refund or a replacement while the carrier status is Delivered and there is no trace outcome. Please send us the carrier's trace outcome when there is one.

<a id="event-007"></a>
## 2026-07-11 08:40:00 UTC — event 007

- **Stage:** Escalation
- **Channel:** Email
- **From:** Oswin Ashdown, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Two days. You said you'd asked the trace people. Nothing from them, nothing from you. This morning I get a text from Brindleworth Arc: 'Your parcel is waiting for you. Uncollected parcels are returned to the sender after 7 days.' Waiting WHERE? It doesn't say. No code in it either. By my arithmetic 7 days from the 6th is the 13th, so in two days it either goes back or it's already walked. Yarrowdale won't refund me because it 'says delivered'. So tell me where my boots are, or admit they've been nicked. And do not tell me it says delivered. I can read.
