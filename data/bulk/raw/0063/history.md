# Case 0063 history — Merchant asks for the carrier trace reference on a grinder with no scan for six days

All identities, records and communications are fictional. Total events: 14.

<a id="event-001"></a>
## 2028-03-30 08:00:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Parcel trace team, Thistlecombe Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-5867 (TG-3382, espresso grinder, one carton): last scan is outbound from Hollin Reach hub, 2028-03-25 21:14 UTC. No arrival scan anywhere since. No trace is open on it. We open a trace when we receive a request that quotes the last scan; email comes straight to us. A trace gets a reference beginning TR.

<a id="event-002"></a>
## 2028-03-30 08:15:00 UTC — event 002

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Route planning, Thistlecombe Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Route plan for depot WX-9 published for Wednesday. 28 stops, no exceptions raised. No action needed.

<a id="event-003"></a>
## 2028-03-30 08:30:00 UTC — event 003

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Caspar Kinsella, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Tracking has said in transit for five days. Where is it?

<a id="event-004"></a>
## 2028-03-30 08:35:00 UTC — event 004

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Sorrel Ormsby, customer
- **To:** Iona Quill, Rivet Delivery Desk

My parcel DL-57761 arrived with the box crushed on one corner. Contents look fine though, just letting you know for your records.

<a id="event-005"></a>
## 2028-03-30 08:40:00 UTC — event 005

- **Stage:** Context
- **Channel:** Dispatch chat
- **From:** Dispatch, Thistlecombe Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-29429 rebooked for Monday AM at the customer's request, confirmation sent to them directly. FYI only.

<a id="event-006"></a>
## 2028-03-30 08:45:00 UTC — event 006

- **Stage:** Agent action
- **Channel:** Depot work queue
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Parcel trace team, Thistlecombe Arc Logistics

Please open a trace on DL-5867 (TG-3382, espresso grinder). Last scan: outbound Hollin Reach hub, 2028-03-25 21:14 UTC. No arrival scan since. Please send the trace reference.

<a id="event-007"></a>
## 2028-03-30 08:47:30 UTC — event 007

- **Stage:** Context
- **Channel:** Email
- **From:** Greer Abernathy, Thistlecombe Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Thanks,
Greer
--
Sent from my phone. This email and any attachments are confidential and intended solely for the addressee.

<a id="event-008"></a>
## 2028-03-30 08:50:00 UTC — event 008

- **Stage:** Agent action
- **Channel:** Customer portal
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Caspar Kinsella, recipient

I have asked the carrier's trace team to open a trace on DL-5867. I can't tell you where the parcel is yet. I will update you when they respond.

<a id="event-009"></a>
## 2028-03-30 14:20:00 UTC — event 009

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Destination depot, Thistlecombe Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Saw a DL-5867 ticket land in the general pile. Nothing by that number has been through our inbound here. Can't do anything with it, we're not trace.

<a id="event-010"></a>
## 2028-03-30 20:45:00 UTC — event 010

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Depot work queue, Thistlecombe Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Ticket DWQ-6545 (DL-5867) was closed automatically. Reason: no depot custody scan exists for this shipment, and tickets without a custody scan close after 12 hours. The ticket was not assigned to a team. No trace was opened.

<a id="event-011"></a>
## 2028-03-31 09:40:00 UTC — event 011

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Caspar Kinsella, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Any news from the trace? I've asked Heronwick to just send another one in the meantime.

<a id="event-012"></a>
## 2028-03-31 10:08:20 UTC — event 012

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Ulric Pendlebury, customer
- **To:** Iona Quill, Rivet Delivery Desk

My parcel DL-24343 arrived with the box crushed on one corner. Contents look fine though, just letting you know for your records.

<a id="event-013"></a>
## 2028-03-31 10:36:40 UTC — event 013

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Ebony Netherwood, customer
- **To:** Iona Quill, Rivet Delivery Desk

My parcel DL-99385 arrived with the box crushed on one corner. Contents look fine though, just letting you know for your records.

<a id="event-014"></a>
## 2028-03-31 11:05:00 UTC — event 014

- **Stage:** Escalation
- **Channel:** Email
- **From:** Replacement authorisations, Heronwick Goods
- **To:** Iona Quill, Rivet Delivery Desk

Quick one. Customer on TG-3382 tells us you have a trace open with Thistlecombe Arc on DL-5867. Can you confirm that's right and send us the trace ref so we can park her replacement request until it reports? I need to note the file today.
