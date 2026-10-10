# Case 0502 history — Approved return of a food processor where the customer never received a label

All identities, records and communications are fictional. Total events: 6.

<a id="event-001"></a>
## 2026-04-07 10:15:00 UTC — event 001

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Kestra Stanbridge, customer
- **To:** Iona Quill, Rivet Delivery Desk

I need to send back the food processor from TG-1984, it's the wrong model. The return was approved last week, they gave me RA-4270, but I never got a label. Can you get one sent please.

<a id="event-002"></a>
## 2026-04-07 10:20:00 UTC — event 002

- **Stage:** Context
- **Channel:** Email
- **From:** Orla Rowntree, sender not on record
- **To:** Iona Quill, Rivet Delivery Desk

Hello, I'm not on the order but I live nearby. Just so you know, the parcel for DL-9868 was actually left in the bin store yesterday, so you can mark this closed.

<a id="event-003"></a>
## 2026-04-07 10:25:00 UTC — event 003

- **Stage:** Agent action
- **Channel:** Email
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Return label team, Yarrowdale Goods

The customer on order TG-1984, Kestra Stanbridge, says return RA-4270 was approved last week but no label has reached her. Please issue the label and confirm how and by when she should hand the parcel over.

<a id="event-004"></a>
## 2026-04-07 11:40:00 UTC — event 004

- **Stage:** Context
- **Channel:** Email
- **From:** Return label team, Yarrowdale Goods
- **To:** Iona Quill, Rivet Delivery Desk

Label RL-4330 issued and emailed to the customer at 11:32 as a QR code. Drop-off at any Plover Arc pickup point; nearest to her is Harrowgate Counter. Label valid until 2026-04-21. Return shipment DL-9868 will show on tracking once the counter scans it. Refund is assessed by the Refunds team after the warehouse receives and inspects the item, not before.

<a id="event-005"></a>
## 2026-04-07 11:50:00 UTC — event 005

- **Stage:** Agent action
- **Channel:** Customer portal
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Kestra Stanbridge, customer

The Return label team issued label RL-4330 and emailed it to you at 11:32 as a QR code. You can drop the parcel at any Plover Arc pickup point; they say the nearest to you is Harrowgate Counter. The label is valid until 2026-04-21. Tracking will show DL-9868 once the counter scans it. The refund is decided by Yarrowdale's Refunds team after the warehouse has received and inspected the item, so I can't confirm it or its timing.

<a id="event-006"></a>
## 2026-04-07 12:34:00 UTC — event 006

- **Stage:** Escalation
- **Channel:** Customer portal
- **From:** Kestra Stanbridge, customer
- **To:** Iona Quill, Rivet Delivery Desk

Yep got the QR code, RL-4330. So Harrowgate Counter, any time before the 21st, and the refund comes after they've checked it over. Understood. I'll drop it in on Saturday.
