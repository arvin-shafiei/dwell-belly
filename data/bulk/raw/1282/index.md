# Case 1282: A crated workbench past its delivery date keeps going out on a vehicle and coming back

## Case details

- **Source role:** Cosmo Thackery, business receiving coordinator
- **Status:** Escalated — awaiting the desk's decision
- **Created:** 2028-05-03 16:30:00 UTC
- **Escalated:** 2028-05-04 11:15:00 UTC
- **Primary shipment:** DL-9310
- **Coordinator:** Iona Quill, Rivet Delivery Desk
- **Data:** Entirely synthetic; fictional geography; all times UTC

## Context

DL-9310 is a crated workbench with a delivery commitment of 2 May. It reached the Destination depot on 28 April and has been loaded and returned on three consecutive days.

## Initial request

Noted. 'By 14:00.' I'll add it to the collection, next to 'monitoring' and 'we'll try to get it out today'. No, I don't need anything else from you right now, and please don't send me a message to say you're still waiting, I can work that out for myself. Just come back at two with the real reason.

## Attachments

- [driver-log-248.txt](attachments/driver-log-248.txt)

## History

<a id="event-001"></a>
## 2028-05-03 16:30:00 UTC — event 001

- **Stage:** Context
- **Channel:** Freight portal
- **From:** Freight planner, Emberlee Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-9310, one crated workbench, 3.1 m, 180 kg. Collected 18 April, delivery commitment 2 May. Arrived Destination depot 28 April. Loaded to a driver and returned to depot on 4, 5 and 3 May, no reason code. We're monitoring. I can't direct the depot's loads.

Attached: driver-log-248.txt

<a id="event-002"></a>
## 2028-05-04 00:20:00 UTC — event 002

- **Stage:** Context
- **Channel:** Email
- **From:** Maelis Dunmore, Emberlee Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Thanks,
Maelis
--
Sent from my phone. This email and any attachments are confidential and intended solely for the addressee.

<a id="event-003"></a>
## 2028-05-04 08:10:00 UTC — event 003

- **Stage:** Context
- **Channel:** Business portal
- **From:** Cosmo Thackery, business receiving coordinator
- **To:** Iona Quill, Rivet Delivery Desk

Day sixteen of a fourteen-day service. Tracker: 'out for delivery', 'returned to depot', three days running. Your freight people are 'monitoring the situation'. The depot 'will try to get it out today', as it tried yesterday and the day before. What is actually wrong with it?

<a id="event-004"></a>
## 2028-05-04 08:25:00 UTC — event 004

- **Stage:** Agent action
- **Channel:** Depot work queue
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Destination depot, Emberlee Arc Logistics

DL-9310 (3.1 m crate, 180 kg) has been loaded and returned on 4, 5 and 3 May with no reason code and is past its 2 May commitment. Please say why it keeps coming back: vehicle size, tail-lift, a missing booking-in with the consignee, or something else, and what has to happen for it to go out. The consignee has been told 'we'll try today' three days running.

<a id="event-005"></a>
## 2028-05-04 09:05:00 UTC — event 005

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Destination depot, Emberlee Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Fair question, nobody has written a reason on it. The shift supervisor is going through the load sheets and looking at the crate this morning and will answer you by 14:00 UTC today with the cause and whether it needs a booked slot. Please don't chase before then, there is one of her. It is not on a vehicle this morning.

<a id="event-006"></a>
## 2028-05-04 09:12:30 UTC — event 006

- **Stage:** Context
- **Channel:** Email
- **From:** IT service desk, Rivet Delivery Desk
- **To:** Iona Quill, Rivet Delivery Desk

Planned maintenance: the work queue will be read-only on Sunday between 02:00 and 04:00 UTC. Messages sent in that window are queued and delivered afterwards.

<a id="event-007"></a>
## 2028-05-04 09:20:00 UTC — event 007

- **Stage:** Agent action
- **Channel:** Business portal
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Cosmo Thackery, business receiving coordinator

You're right that 'trying today' three days running is not an answer, and it is now two days past the date you were given. I've asked the depot the specific question: why the crate keeps coming back and what it needs in order to go out. Their shift supervisor is checking the load sheets and the crate itself and has committed to answer me by 14:00 UTC today. It is not on a vehicle this morning, so please don't keep anyone waiting for it. I'll write as soon as I have their answer. I can't give you a delivery day until then.

<a id="event-008"></a>
## 2028-05-04 10:17:30 UTC — event 008

- **Stage:** Context
- **Channel:** Email
- **From:** Ulric Blackwood, Emberlee Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Automatic reply: I am out of the office until Friday with limited access to email. For urgent matters about collections or bookings, please contact the dispatch desk.

<a id="event-009"></a>
## 2028-05-04 11:15:00 UTC — event 009

- **Stage:** Escalation
- **Channel:** Business portal
- **From:** Cosmo Thackery, business receiving coordinator
- **To:** Iona Quill, Rivet Delivery Desk

Noted. 'By 14:00.' I'll add it to the collection, next to 'monitoring' and 'we'll try to get it out today'. No, I don't need anything else from you right now, and please don't send me a message to say you're still waiting, I can work that out for myself. Just come back at two with the real reason.
