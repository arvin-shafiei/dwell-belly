# Case 2294: Overdue walking boots show as delivered to a pickup point the recipient says he never chose

## Case details

- **Source role:** Parcel trace team, Fallowmere Arc Logistics
- **Status:** Escalated — awaiting the desk's decision
- **Created:** 2026-07-09 10:12:00 UTC
- **Escalated:** 2026-07-11 10:10:00 UTC
- **Primary shipment:** DL-3834
- **Coordinator:** Iona Quill, Rivet Delivery Desk
- **Data:** Entirely synthetic; fictional geography; all times UTC

## Context

A Copperhythe Goods order due at a home address shows a pickup-point delivery scan. The recipient has had several replies from the carrier's customer service before coming to the desk. The Parcel trace team at Fallowmere Arc traces parcels; the desk cannot see which pickup point a parcel was scanned into.

## Initial request

Two days. You said you'd asked the trace people. Nothing from them, nothing from you. This morning I get a text from Fallowmere Arc: 'Your parcel is waiting for you. Uncollected parcels are returned to the sender after 7 days.' Waiting WHERE? It doesn't say. No code in it either. By my arithmetic 7 days from the 6th is the 13th, so in two days it either goes back or it's already walked. Copperhythe won't refund me because it 'says delivered'. So tell me where my boots are, or admit they've been nicked. And do not tell me it says delivered. I can read.

## Attachments

None.

## History

<a id="event-001"></a>
## 2026-07-09 10:12:00 UTC — event 001

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Hesper Thackery, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Order TG-8802, walking boots, due 29 June to MY HOUSE. Tracker has said 'Delivered - pickup point' since 6 July. I never chose a pickup point. I have never used one in my life. No code, no email, no text, no card. I have written to Fallowmere Arc four times and four times got the same pasted paragraph telling me it has been delivered, and then they closed the case. No refund. Somebody somewhere has scanned my boots as delivered to a place I didn't pick and that is fraud as far as I'm concerned.

<a id="event-002"></a>
## 2026-07-09 10:30:00 UTC — event 002

- **Stage:** Agent action
- **Channel:** Depot work queue
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Parcel trace team, Fallowmere Arc Logistics

DL-3834 (Copperhythe TG-8802): status shows delivered to a pickup point on 6 July. The recipient, Hesper Thackery, says he did not select a pickup point and has received no collection code. Please confirm which pickup point holds the scan, whether a collection code was issued and to what contact, and whether the parcel has been collected.

<a id="event-003"></a>
## 2026-07-09 10:36:00 UTC — event 003

- **Stage:** Agent action
- **Channel:** Customer portal
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Hesper Thackery, recipient

I've asked the Parcel trace team at Fallowmere Arc to find out which pickup point DL-3834 was scanned into, whether a collection code was ever sent, and whether the parcel is still there. I can't see that myself and I can't tell you yet where it is. I haven't closed anything.

<a id="event-004"></a>
## 2026-07-10 02:00:00 UTC — event 004

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Depot work queue, Fallowmere Arc Logistics (automated)
- **To:** Iona Quill, Rivet Delivery Desk

Ticket DWQ-2039 (DL-3834) closed automatically. Reason: shipment status is Delivered. Trace tickets cannot be opened on delivered shipments through this queue. The ticket was not seen by a member of staff. Disputed pickup-point deliveries are handled by the Parcel trace team by Email only, quoting the shipment reference and the recipient's statement.

<a id="event-005"></a>
## 2026-07-10 14:20:00 UTC — event 005

- **Stage:** Context
- **Channel:** Email
- **From:** Refunds team, Copperhythe Goods
- **To:** Iona Quill, Rivet Delivery Desk

TG-8802: Mr Thackery has asked us for a refund. We can't consider a refund or a replacement while the carrier status is Delivered and there is no trace outcome. Please send us the carrier's trace outcome when there is one.

<a id="event-006"></a>
## 2026-07-11 08:40:00 UTC — event 006

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Hesper Thackery, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Two days. You said you'd asked the trace people. Nothing from them, nothing from you. This morning I get a text from Fallowmere Arc: 'Your parcel is waiting for you. Uncollected parcels are returned to the sender after 7 days.' Waiting WHERE? It doesn't say. No code in it either. By my arithmetic 7 days from the 6th is the 13th, so in two days it either goes back or it's already walked. Copperhythe won't refund me because it 'says delivered'. So tell me where my boots are, or admit they've been nicked. And do not tell me it says delivered. I can read.

<a id="event-007"></a>
## 2026-07-11 09:16:00 UTC — event 007

- **Stage:** Agent action
- **Channel:** Email
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Parcel trace team, Fallowmere Arc Logistics

Disputed pickup-point delivery, DL-3834 (Copperhythe TG-8802). The shipment was due to the recipient's home address on 29 June and shows 'Delivered - pickup point' on 6 July. The recipient, Hesper Thackery, states that he did not select a pickup point, has never used one, and has received no collection code by email, text or card. Today he received a carrier text saying the parcel is waiting and will be returned after 7 days, with no location and no code; on that basis it may go back on or about 13 July. Please confirm which pickup point holds the scan, whether a collection code was issued and to what contact, whether the parcel is still on the shelf, and whether it can be held from return while you check. I raised this on 9 July through the Depot work queue (DWQ-2039), which closed it automatically without anyone seeing it, so nothing has been looked at yet. Before that he had four identical replies from customer service and a closed case. Copperhythe's Refunds team is waiting on your outcome. I have not told him where the parcel is.

<a id="event-008"></a>
## 2026-07-11 10:10:00 UTC — event 008

- **Stage:** Escalation
- **Channel:** Email
- **From:** Parcel trace team, Fallowmere Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

FYI only, no action needed from the desk: we have this in hand and will update the customer directly. Nothing further is required from you on this one.
