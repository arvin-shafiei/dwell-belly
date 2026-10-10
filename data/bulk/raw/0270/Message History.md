# Case 0270 history — Customer who paid for express chilled delivery on 23 December learns the booking shows a different date

All identities, records and communications are fictional. Total events: 6.

<a id="event-001"></a>
## 2026-12-18 15:00:00 UTC — event 001

- **Stage:** Context
- **Channel:** Warehouse work queue
- **From:** Warehouse dispatch, Tumblewell Pantry
- **To:** Iona Quill, Rivet Delivery Desk

BP-2510 (glazed ham joint, two desserts, chilled) is picked and will be packed for dispatch 22 Dec for express delivery 23 Dec, as paid. Chilled boxes are packed to the delivery date. This one cannot go out for a later date as packed, and after the holiday we would need the customer's say-so to send it at all.

<a id="event-002"></a>
## 2026-12-20 06:10:00 UTC — event 002

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Calloway, Gorsewick Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Holiday capacity rebalance. The following express chilled bookings for 23 Dec have been moved to 30 Dec: DL-6285, DL-6239, DL-7988, DL-7379, DL-9324. Customer notification: not yet sent, template pending.

<a id="event-003"></a>
## 2026-12-20 06:12:00 UTC — event 003

- **Stage:** Context
- **Channel:** Email
- **From:** Marisol Haverly, sender not on record
- **To:** Iona Quill, Rivet Delivery Desk

Hello, I'm not on the order but I live nearby. Just so you know, the parcel for DL-7988 was actually left in the bin store yesterday, so you can mark this closed.

<a id="event-004"></a>
## 2026-12-20 06:14:00 UTC — event 004

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Calloway, Gorsewick Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Further to the rebalance notice. A moved 23 Dec booking can be reinstated only while 23 Dec van space remains, and only if the request reaches Calloway on Dispatch chat marked HOLIDAY REINSTATE before 12:00 on 22 Dec. Requests sent to the email queue are worked in two working days and will miss it. Calloway decides each request. No desk may confirm a date or a time of day to a customer.

<a id="event-005"></a>
## 2026-12-21 09:30:00 UTC — event 005

- **Stage:** Context
- **Channel:** Call transcript
- **From:** Tumblewell Pantry customer line
- **To:** Tamsin Jessop, recipient

Call note. Customer rang to confirm her 23 Dec delivery for BP-2510. Advised the booking now shows 30 Dec. Customer had not been told. Customer asked for the express charge back. Advised that refunds are decided by Refunds team once the delivery outcome is known.

<a id="event-006"></a>
## 2026-12-21 09:50:00 UTC — event 006

- **Stage:** Escalation
- **Channel:** Email
- **From:** Tamsin Jessop, recipient
- **To:** Iona Quill, Rivet Delivery Desk

The THIRTIETH. I have just been told, because I rang, because I happened to check, that the ham and the puddings I paid EXTRA to have here on the 23rd are now coming on the 30th. Six days after the dinner they are for. Eleven people at my table. Nobody emailed. Nobody texted. Nothing. I'd have been stood at the window on Wednesday like a fool. I want it in writing within the hour that it arrives on the 23rd before noon, and I want the express charge refunded whatever happens. And do NOT send me 'we apologise for any inconvenience, your new delivery date is 30 December'. I mean it.
