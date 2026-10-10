# Case 1285 history — A signature parcel is marked missed on the day the recipient paid to move it to

All identities, records and communications are fictional. Total events: 18.

<a id="event-001"></a>
## 2027-05-03 07:40:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Kestra Abernathy, Tumblewell Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Automatic reply: I am out of the office until Thursday with limited access to email. For urgent matters about collections or bookings, please contact the dispatch desk.

<a id="event-002"></a>
## 2027-05-03 09:10:00 UTC — event 002

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Delphine Ashdown, recipient
- **To:** Iona Quill, Rivet Delivery Desk

DL-5956 is scheduled for Thursday 6 May and needs a signature. I will be away that day. Could it be moved to Friday 7 May, when I will be at home all day?

<a id="event-003"></a>
## 2027-05-03 09:38:00 UTC — event 003

- **Stage:** Context
- **Channel:** Email
- **From:** IT service desk, Rivet Delivery Desk
- **To:** Iona Quill, Rivet Delivery Desk

Planned maintenance: the work queue will be read-only on Sunday between 02:00 and 04:00 UTC. Messages sent in that window are queued and delivered afterwards.

<a id="event-004"></a>
## 2027-05-03 10:06:00 UTC — event 004

- **Stage:** Context
- **Channel:** Email
- **From:** Quillon Underhill, Tumblewell Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Thanks,
Quillon
--
Sent from my phone. This email and any attachments are confidential and intended solely for the addressee.

<a id="event-005"></a>
## 2027-05-03 10:34:00 UTC — event 005

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Sorrel Thackery, customer
- **To:** Iona Quill, Rivet Delivery Desk

My parcel DL-44925 arrived with the box crushed on one corner. Contents look fine though, just letting you know for your records.

<a id="event-006"></a>
## 2027-05-03 11:02:00 UTC — event 006

- **Stage:** Context
- **Channel:** Dispatch chat
- **From:** Dispatch, Tumblewell Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-45549 rebooked for Tuesday AM at the customer's request, confirmation sent to them directly. FYI only.

<a id="event-007"></a>
## 2027-05-03 11:30:00 UTC — event 007

- **Stage:** Context
- **Channel:** Email
- **From:** Sedgemoor, Tumblewell Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-5956: a change to 7 May is possible on payment of the date-change fee of 6.50 through the portal. Attempts on 30 Apr and 1 May failed, no one in. 7 May will therefore be the third and final attempt. After a third failed attempt the parcel returns to the sender on the next working day's trunk.

<a id="event-008"></a>
## 2027-05-03 11:52:30 UTC — event 008

- **Stage:** Context
- **Channel:** Email
- **From:** IT service desk, Rivet Delivery Desk
- **To:** Iona Quill, Rivet Delivery Desk

Planned maintenance: the work queue will be read-only on Sunday between 02:00 and 04:00 UTC. Messages sent in that window are queued and delivered afterwards.

<a id="event-009"></a>
## 2027-05-03 12:15:00 UTC — event 009

- **Stage:** Agent action
- **Channel:** Customer portal
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Delphine Ashdown, recipient

Sedgemoor can move DL-5956 to Friday 7 May once the 6.50 date-change fee is paid through the portal. They have told me this will be the third and final attempt, and that after a third failed attempt the parcel goes back to the sender on the next working day. I will pass on the booking once Sedgemoor confirms it.

<a id="event-010"></a>
## 2027-05-03 12:40:00 UTC — event 010

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Delphine Ashdown, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Paid at 12:31, receipt PF-2183. I will be in from 07:00 on Friday.

<a id="event-011"></a>
## 2027-05-03 14:00:00 UTC — event 011

- **Stage:** Context
- **Channel:** Email
- **From:** Sedgemoor, Tumblewell Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-5956 booked for 7 May, window 10:00 to 12:00. Fee PF-2183 received.

<a id="event-012"></a>
## 2027-05-07 11:50:00 UTC — event 012

- **Stage:** Context
- **Channel:** Email
- **From:** Dispatch, Tumblewell Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-5956 window revised to 'by 21:00' today. Route overrun on van 22.

<a id="event-013"></a>
## 2027-05-07 18:06:00 UTC — event 013

- **Stage:** Context
- **Channel:** Email
- **From:** Dispatch, Tumblewell Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-5956 status 18:02: 'attempt 3 - missed, customer not available'. Under the attempt rule DL-5956 is now set to return to sender on the trunk leaving Destination depot at 06:30 on Monday 10 May.

<a id="event-014"></a>
## 2027-05-07 18:13:00 UTC — event 014

- **Stage:** Context
- **Channel:** Email
- **From:** IT service desk, Rivet Delivery Desk
- **To:** Iona Quill, Rivet Delivery Desk

Planned maintenance: the work queue will be read-only on Sunday between 02:00 and 04:00 UTC. Messages sent in that window are queued and delivered afterwards.

<a id="event-015"></a>
## 2027-05-07 18:20:00 UTC — event 015

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Delphine Ashdown, recipient
- **To:** Iona Quill, Rivet Delivery Desk

The tracker changed to 'missed' at 18:02. I have been in the house since before 07:00 and have not left it. No van came into Larch Row and no card was left.

<a id="event-016"></a>
## 2027-05-07 18:45:00 UTC — event 016

- **Stage:** Agent action
- **Channel:** Dispatch chat
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Dispatch, Tumblewell Arc Logistics

DL-5956: the recipient reports he was home all day on 7 May and that no vehicle attended. He paid the date-change fee (PF-2183) for this date. Please review the 18:02 attempt record before the return to sender proceeds.

<a id="event-017"></a>
## 2027-05-08 13:15:00 UTC — event 017

- **Stage:** Context
- **Channel:** Email
- **From:** Briony Jessop, Dispatch supervisor, Tumblewell Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Reviewed, ref DR-3285. Van 22 did not reach Larch Row on 7 May; the 18:02 status was applied in bulk when the route was closed. That is not an attempt and does not count. This corrects our 18:06 message of yesterday: DL-5956 should not go back. I cannot stop it from here. The return order is already in the depot system and only Destination depot can pull it off Monday's 06:30 trunk. They need a hold request in the Depot work queue quoting DR-3285 before the trunk is loaded. Rebooking is for Sedgemoor once the hold is on. I rang Mr Ashdown at 12:50 and got no answer.

<a id="event-018"></a>
## 2027-05-08 13:40:00 UTC — event 018

- **Stage:** Escalation
- **Channel:** Customer portal
- **From:** Delphine Ashdown, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Setting this out in order so nothing is missed. Monday: I asked to move the delivery, was told the fee and that Friday would be the final attempt, and paid. Friday: window 10:00 to 12:00, then changed to by 21:00, then at 18:02 marked missed, though I was at home throughout. Today: a supervisor rang at 12:50 while I was driving. The voicemail said to call back before 13:00. I called at 13:10 and the line was closed for the weekend. The tracker still says 'returning to sender'. Could you tell me whether anything can still be done, or whether it has gone?
