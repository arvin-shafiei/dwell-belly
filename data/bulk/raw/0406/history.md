# Case 0406 history — Merchant asks for the carrier trace reference on a grinder with no scan for six days

All identities, records and communications are fictional. Total events: 9.

<a id="event-001"></a>
## 2027-04-01 08:00:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Parcel trace team, Ashgrove Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-8398 (TG-8296, espresso grinder, one carton): last scan is outbound from Hollin Reach hub, 2027-03-27 21:14 UTC. No arrival scan anywhere since. No trace is open on it. We open a trace when we receive a request that quotes the last scan; email comes straight to us. A trace gets a reference beginning TR.

<a id="event-002"></a>
## 2027-04-01 08:30:00 UTC — event 002

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Wystan Grimshaw, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Tracking has said in transit for five days. Where is it?

<a id="event-003"></a>
## 2027-04-01 08:45:00 UTC — event 003

- **Stage:** Agent action
- **Channel:** Depot work queue
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Parcel trace team, Ashgrove Arc Logistics

Please open a trace on DL-8398 (TG-8296, espresso grinder). Last scan: outbound Hollin Reach hub, 2027-03-27 21:14 UTC. No arrival scan since. Please send the trace reference.

<a id="event-004"></a>
## 2027-04-01 08:50:00 UTC — event 004

- **Stage:** Agent action
- **Channel:** Customer portal
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Wystan Grimshaw, recipient

I have asked the carrier's trace team to open a trace on DL-8398. I can't tell you where the parcel is yet. I will update you when they respond.

<a id="event-005"></a>
## 2027-04-01 14:20:00 UTC — event 005

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Destination depot, Ashgrove Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Saw a DL-8398 ticket land in the general pile. Nothing by that number has been through our inbound here. Can't do anything with it, we're not trace.

<a id="event-006"></a>
## 2027-04-01 20:45:00 UTC — event 006

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Depot work queue, Ashgrove Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Ticket DWQ-8634 (DL-8398) was closed automatically. Reason: no depot custody scan exists for this shipment, and tickets without a custody scan close after 12 hours. The ticket was not assigned to a team. No trace was opened.

<a id="event-007"></a>
## 2027-04-02 03:12:30 UTC — event 007

- **Stage:** Context
- **Channel:** Email
- **From:** Florian Vexley, sender not on record
- **To:** Iona Quill, Rivet Delivery Desk

Hello, I'm not on the order but I live nearby. Just so you know, the driver told me DL-8398 was handed to someone at the door, so it's been delivered.

<a id="event-008"></a>
## 2027-04-02 09:40:00 UTC — event 008

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Wystan Grimshaw, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Any news from the trace? I've asked Copperhythe to just send another one in the meantime.

<a id="event-009"></a>
## 2027-04-02 11:05:00 UTC — event 009

- **Stage:** Escalation
- **Channel:** Email
- **From:** Replacement authorisations, Copperhythe Goods
- **To:** Iona Quill, Rivet Delivery Desk

Quick one. Customer on TG-8296 tells us you have a trace open with Ashgrove Arc on DL-8398. Can you confirm that's right and send us the trace ref so we can park her replacement request until it reports? I need to note the file today.

It's only a bath bomb gift set, nothing explosive, don't worry!
