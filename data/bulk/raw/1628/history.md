# Case 1628 history — A signature parcel is marked missed on the day the recipient paid to move it to

All identities, records and communications are fictional. Total events: 12.

<a id="event-001"></a>
## 2028-05-01 09:10:00 UTC — event 001

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Aurelio Ormsby, recipient
- **To:** Iona Quill, Rivet Delivery Desk

DL-1542 is scheduled for Thursday 4 May and needs a signature. I will be away that day. Could it be moved to Friday 5 May, when I will be at home all day?

<a id="event-002"></a>
## 2028-05-01 11:30:00 UTC — event 002

- **Stage:** Context
- **Channel:** Email
- **From:** Quillmoor, Glimmerton Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-1542: a change to 5 May is possible on payment of the date-change fee of 6.50 through the portal. Attempts on 30 Apr and 29 April failed, no one in. 5 May will therefore be the third and final attempt. After a third failed attempt the parcel returns to the sender on the next working day's trunk.

<a id="event-003"></a>
## 2028-05-01 11:52:30 UTC — event 003

- **Stage:** Context
- **Channel:** Email
- **From:** Florian Fortescue, sender not on record
- **To:** Iona Quill, Rivet Delivery Desk

Hello, I'm not on the order but I live nearby. Just so you know, the driver told me DL-1542 was handed to someone at the door, so it's been delivered.

<a id="event-004"></a>
## 2028-05-01 12:15:00 UTC — event 004

- **Stage:** Agent action
- **Channel:** Customer portal
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Aurelio Ormsby, recipient

Quillmoor can move DL-1542 to Friday 5 May once the 6.50 date-change fee is paid through the portal. They have told me this will be the third and final attempt, and that after a third failed attempt the parcel goes back to the sender on the next working day. I will pass on the booking once Quillmoor confirms it.

<a id="event-005"></a>
## 2028-05-01 12:40:00 UTC — event 005

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Aurelio Ormsby, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Paid at 12:31, receipt PF-9750. I will be in from 07:00 on Friday.

<a id="event-006"></a>
## 2028-05-01 14:00:00 UTC — event 006

- **Stage:** Context
- **Channel:** Email
- **From:** Quillmoor, Glimmerton Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-1542 booked for 5 May, window 10:00 to 12:00. Fee PF-9750 received.

<a id="event-007"></a>
## 2028-05-05 11:50:00 UTC — event 007

- **Stage:** Context
- **Channel:** Email
- **From:** Dispatch, Glimmerton Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-1542 window revised to 'by 21:00' today. Route overrun on van 22.

<a id="event-008"></a>
## 2028-05-05 18:06:00 UTC — event 008

- **Stage:** Context
- **Channel:** Email
- **From:** Dispatch, Glimmerton Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-1542 status 18:02: 'attempt 3 - missed, customer not available'. Under the attempt rule DL-1542 is now set to return to sender on the trunk leaving Destination depot at 06:30 on Monday 8 May.

<a id="event-009"></a>
## 2028-05-05 18:20:00 UTC — event 009

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Aurelio Ormsby, recipient
- **To:** Iona Quill, Rivet Delivery Desk

The tracker changed to 'missed' at 18:02. I have been in the house since before 07:00 and have not left it. No van came into Larch Row and no card was left.

<a id="event-010"></a>
## 2028-05-05 18:45:00 UTC — event 010

- **Stage:** Agent action
- **Channel:** Dispatch chat
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Dispatch, Glimmerton Arc Logistics

DL-1542: the recipient reports he was home all day on 5 May and that no vehicle attended. He paid the date-change fee (PF-9750) for this date. Please review the 18:02 attempt record before the return to sender proceeds.

<a id="event-011"></a>
## 2028-05-06 13:15:00 UTC — event 011

- **Stage:** Context
- **Channel:** Email
- **From:** Oswin Underhill, Dispatch supervisor, Glimmerton Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Reviewed, ref DR-7394. Van 22 did not reach Larch Row on 5 May; the 18:02 status was applied in bulk when the route was closed. That is not an attempt and does not count. This corrects our 18:06 message of yesterday: DL-1542 should not go back. I cannot stop it from here. The return order is already in the depot system and only Destination depot can pull it off Monday's 06:30 trunk. They need a hold request in the Depot work queue quoting DR-7394 before the trunk is loaded. Rebooking is for Quillmoor once the hold is on. I rang Mr Ormsby at 12:50 and got no answer.

<a id="event-012"></a>
## 2028-05-06 13:40:00 UTC — event 012

- **Stage:** Escalation
- **Channel:** Customer portal
- **From:** Aurelio Ormsby, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Setting this out in order so nothing is missed. Monday: I asked to move the delivery, was told the fee and that Friday would be the final attempt, and paid. Friday: window 10:00 to 12:00, then changed to by 21:00, then at 18:02 marked missed, though I was at home throughout. Today: a supervisor rang at 12:50 while I was driving. The voicemail said to call back before 13:00. I called at 13:10 and the line was closed for the weekend. The tracker still says 'returning to sender'. Could you tell me whether anything can still be done, or whether it has gone?

I've attached the photo as photo-evidence-779.txt.
