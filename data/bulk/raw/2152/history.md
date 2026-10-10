# Case 2152 history — Recipient wants to collect a parcel from the depot after a missed delivery

All identities, records and communications are fictional. Total events: 14.

<a id="event-001"></a>
## 2028-03-21 08:15:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Dispatch, Vanecroft Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-2168 was attempted 2028-03-20 at 15:42, no answer, card left. Redelivery inventory: 2028-03-22 or 2028-03-24, both 12:00–18:00 UTC. No charge for one redelivery.

<a id="event-002"></a>
## 2028-03-21 08:22:30 UTC — event 002

- **Stage:** Context
- **Channel:** Dispatch chat
- **From:** Dispatch, Vanecroft Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-80206 rebooked for Monday AM at the customer's request, confirmation sent to them directly. FYI only.

<a id="event-003"></a>
## 2028-03-21 08:30:00 UTC — event 003

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Dervla Normanton, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Missed the driver yesterday by about ten minutes. Friday please.

<a id="event-004"></a>
## 2028-03-21 08:36:00 UTC — event 004

- **Stage:** Agent action
- **Channel:** Email
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Dispatch, Vanecroft Arc Logistics

Dervla has chosen redelivery on 2028-03-24, 12:00–18:00 for DL-2168. Please book and confirm.

<a id="event-005"></a>
## 2028-03-21 08:50:30 UTC — event 005

- **Stage:** Context
- **Channel:** Email
- **From:** IT service desk, Rivet Delivery Desk
- **To:** Iona Quill, Rivet Delivery Desk

Planned maintenance: the work queue will be read-only on Sunday between 02:00 and 04:00 UTC. Messages sent in that window are queued and delivered afterwards.

<a id="event-006"></a>
## 2028-03-21 09:05:00 UTC — event 006

- **Stage:** Context
- **Channel:** Email
- **From:** Dispatch, Vanecroft Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-2168 is booked for redelivery 2028-03-24, 12:00–18:00 and allocated to Friday run R-27C. Booking confirmation, not a delivery.

<a id="event-007"></a>
## 2028-03-21 09:06:40 UTC — event 007

- **Stage:** Context
- **Channel:** Email
- **From:** IT service desk, Rivet Delivery Desk
- **To:** Iona Quill, Rivet Delivery Desk

Planned maintenance: the work queue will be read-only on Sunday between 02:00 and 04:00 UTC. Messages sent in that window are queued and delivered afterwards.

<a id="event-008"></a>
## 2028-03-21 09:08:20 UTC — event 008

- **Stage:** Context
- **Channel:** Email
- **From:** Quillon Kittering, Vanecroft Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Automatic reply: I am out of the office until Thursday with limited access to email. For urgent matters about collections or bookings, please contact the dispatch desk.

<a id="event-009"></a>
## 2028-03-21 09:10:00 UTC — event 009

- **Stage:** Agent action
- **Channel:** Customer portal
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Dervla Normanton, recipient

Dispatch confirms DL-2168 is booked for redelivery on Friday 2028-03-24 between 12:00 and 18:00.

<a id="event-010"></a>
## 2028-03-21 10:50:00 UTC — event 010

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Dervla Normanton, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Change of plan, work want me in on Friday now. I drive past your depot on the way home, can I just pick it up from there instead? Thursday after 5 would suit. Cancel the Friday one.

<a id="event-011"></a>
## 2028-03-21 10:58:00 UTC — event 011

- **Stage:** Agent action
- **Channel:** Depot work queue
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Destination depot, Vanecroft Arc Logistics

Recipient of DL-2168 asks to collect from your counter instead of Friday redelivery, ideally Thursday 2028-03-23 after 17:00. Can you hold it for collection, and what does he need to bring?

<a id="event-012"></a>
## 2028-03-21 11:40:00 UTC — event 012

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Destination depot, Vanecroft Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Counter is open to 19:00 weekdays and we hold for 5 working days. But DL-2168 is allocated to run R-27C and sits in the Friday cage. We cannot move it to the collection shelf until Dispatch releases it from the run. Once it is released and shelved we issue a collection reference; nobody collects without that reference. Photo ID matching the order name at the counter.

<a id="event-013"></a>
## 2028-03-21 11:46:00 UTC — event 013

- **Stage:** Agent action
- **Channel:** Customer portal
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Dervla Normanton, recipient

Collection from the depot counter is possible but not arranged yet. The parcel is still allocated to Friday's delivery run and Dispatch has to release it first; the depot then issues a collection reference, and nobody can collect without one. Please don't travel until I send you that reference. Shall I go ahead, knowing the Friday redelivery will be removed?

<a id="event-014"></a>
## 2028-03-21 12:30:00 UTC — event 014

- **Stage:** Escalation
- **Channel:** Customer portal
- **From:** Dervla Normanton, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Yes go ahead. Definitely not Friday, nobody will be in. Thursday after 5 if they can.

I've attached the photo as photo-evidence-993.txt.
