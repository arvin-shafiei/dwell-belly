# Case 0606 history — A crated van engine has not arrived two days after its delivery date

All identities, records and communications are fictional. Total events: 14.

<a id="event-001"></a>
## 2027-11-01 09:00:00 UTC — event 001

- **Stage:** Context
- **Channel:** Freight portal
- **From:** Freight planner, Emberlee Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-8518 (TG-7200): one crated reconditioned van engine, 240 kg. Shipper Copperhythe Goods trade parts warehouse. Collection booked Thursday 5 Nov, delivery to consignee G. Stanbridge Monday 9 Nov, tail-lift vehicle.

<a id="event-002"></a>
## 2027-11-03 14:10:00 UTC — event 002

- **Stage:** Context
- **Channel:** Email
- **From:** Business billing, Emberlee Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Statement reminder: invoice BB-4688 for DL-8188 falls due on 12 Nov. Please disregard if already paid. Emberlee Arc Logistics, moving what matters.

<a id="event-003"></a>
## 2027-11-05 08:30:00 UTC — event 003

- **Stage:** Context
- **Channel:** Freight portal
- **From:** Collections control, Emberlee Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-8518: collection on 5 Nov not completed. Vehicle attended 15:20; the shipper's warehouse had no crate staged and no forklift operator on site. Nothing was loaded and the consignment has never been in our network. Rebook notice sent to the shipper 5 Nov 16:05, no answer. We can only rebook on the shipper's request. That is Warehouse dispatch, Copperhythe Goods, through their Warehouse work queue.

<a id="event-004"></a>
## 2027-11-05 08:31:00 UTC — event 004

- **Stage:** Context
- **Channel:** Freight portal
- **From:** Freight portal notifications, Emberlee Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Automated status: DL-8518 - Booked, in progress. Estimated delivery 9 Nov. This is an automated message; replies are not read.

<a id="event-005"></a>
## 2027-11-08 16:45:00 UTC — event 005

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Orla Stanbridge, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Engine was meant to be here today. Where is it.

<a id="event-006"></a>
## 2027-11-08 16:46:00 UTC — event 006

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Customer portal auto-acknowledgement
- **To:** Orla Stanbridge, recipient

Thanks for your message. We aim to reply within one working day. Did you know you can follow your delivery live in the app?

<a id="event-007"></a>
## 2027-11-09 09:20:00 UTC — event 007

- **Stage:** Context
- **Channel:** Email
- **From:** Copperhythe Goods trade newsletter
- **To:** Iona Quill, Rivet Delivery Desk

WINTER TRADE EVENT. 15% off brake kits, batteries and workshop consumables until Sunday. Free carriage on orders over 150. Unsubscribe at any time.

<a id="event-008"></a>
## 2027-11-09 10:05:00 UTC — event 008

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Orla Stanbridge, recipient
- **To:** Iona Quill, Rivet Delivery Desk

And while you're at it DL-7710, the wiper motor, has said out for delivery since Friday. That's not here either.

<a id="event-009"></a>
## 2027-11-09 11:30:00 UTC — event 009

- **Stage:** Context
- **Channel:** Email
- **From:** Dispatch, Emberlee Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-7710 delivered 10 Nov 11:12, signed G. Stanbridge.

<a id="event-010"></a>
## 2027-11-09 12:00:00 UTC — event 010

- **Stage:** Context
- **Channel:** Call transcript
- **From:** Freight planner, Emberlee Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Freight planner: DL-8518, yeah, I've got it as booked, in progress, ETA the ninth. I can't see where it physically is from this screen. If the customer's chasing I'd just put a trace in with the Parcel trace team and let them find it.

<a id="event-011"></a>
## 2027-11-09 15:40:00 UTC — event 011

- **Stage:** Context
- **Channel:** Email
- **From:** Returns authorisations, Copperhythe Goods
- **To:** Iona Quill, Rivet Delivery Desk

Return RA-2522 for order TG-3597 is approved. A label will follow from the Return label team.

<a id="event-012"></a>
## 2027-11-10 08:15:00 UTC — event 012

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Orla Stanbridge, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Right. Engine. DL-8518. Two days late and nobody at Copperhythe or Emberlee bloody Arc can tell me where it is. Rang both yesterday, both said 'in progress', which is bollocks. My van's been up on Kell's lift at Minnow Lane Motors since last Thursday with the old lump out of it. He's got a bay blocked, he's turning jobs away, and he's told me straight it comes off the lift Friday, engine or no engine. Get a trace on it NOW and get it on a van tomorrow. Wiper motor turned up, ta.

<a id="event-013"></a>
## 2027-11-10 08:48:00 UTC — event 013

- **Stage:** Agent action
- **Channel:** Warehouse work queue
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Warehouse dispatch, Copperhythe Goods

Urgent, DL-8518 / TG-7200, crated reconditioned van engine for G. Stanbridge. Emberlee Arc's Collections control reports that the collection booked for 5 Nov was not completed: their vehicle attended at 15:20, no crate was staged and there was no forklift operator on site, so nothing was loaded. The engine has never been in the carrier's network. They sent your team a rebook notice on 5 Nov at 16:05 and have had no answer, and they can only rebook at the shipper's request. Please stage the crate, request a new collection from Collections control, and tell me the date they give you. This cannot wait: the consignee's van has been on a workshop lift at an independent garage with the old engine removed since 5 Nov, the garage has a bay blocked and says the van comes off the lift on Friday 13 Nov whether the engine has arrived or not, and he has twice been told 'in progress' when it had not moved. I have promised him no date.

<a id="event-014"></a>
## 2027-11-10 09:49:00 UTC — event 014

- **Stage:** Escalation
- **Channel:** Warehouse work queue
- **From:** Warehouse dispatch, Copperhythe Goods
- **To:** Iona Quill, Rivet Delivery Desk

FYI only, no action needed from the desk: we have this in hand and will update the customer directly. Nothing further is required from you on this one.
