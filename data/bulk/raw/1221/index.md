# Case 1221: Recliner ordered on 23 December with tracking that has not moved since the label was created

## Case details

- **Source role:** Warehouse dispatch, Brindleworth Goods
- **Status:** Escalated — awaiting the desk's decision
- **Created:** 2027-12-23 23:50:00 UTC
- **Escalated:** 2028-01-05 09:56:00 UTC
- **Primary shipment:** DL-4630
- **Coordinator:** Iona Quill, Rivet Delivery Desk
- **Data:** Entirely synthetic; fictional geography; all times UTC

## Context

Xanthe Brackley ordered a recliner from Brindleworth Goods on 23 December, TG-7426 / DL-4630. A shipping label was generated that night.

## Initial request

Ordered a recliner on 23 December. Label 'created' that night and the tracking has not moved ONE line in thirteen days. Agent one, 29 Dec: put me on hold and hung up. Agent two, 31 Dec: 'I can see the carrier has collected it.' Collected it to where? Agent three, 2 Jan: 'that will need a ten day investigation with the carrier.' Then a supervisor, same day, says actually she'll 'ask the warehouse if it even shipped' and ring me back. That was Saturday. Nothing. Four people, four different stories, and my dad is sleeping propped up on the sofa after his operation because the chair he's meant to be recovering in is God knows where. You're the delivery desk. Open the trace with Hartwold Arc today and find it.

## Attachments

None.

## History

<a id="event-001"></a>
## 2027-12-23 23:50:00 UTC — event 001

- **Stage:** Context
- **Channel:** Warehouse work queue
- **From:** Warehouse dispatch, Brindleworth Goods
- **To:** Iona Quill, Rivet Delivery Desk

AUTOMATED: TG-7426 / DL-4630 shipping label generated 24 Dec 23:47. Status: awaiting pick.

<a id="event-002"></a>
## 2028-01-03 11:20:00 UTC — event 002

- **Stage:** Context
- **Channel:** Email
- **From:** Refunds team, Brindleworth Goods
- **To:** Iona Quill, Rivet Delivery Desk

TG-7426: customer has asked us for a refund or a replacement. For your file, on 31 Dec one of our phone agents told him 'I can see the carrier has collected it'. That agent was reading the label-created line. Our order screen shows nothing after 'label generated'. We can't authorise anything until we know whether it left the building, and that is Warehouse dispatch's record, not ours.

<a id="event-003"></a>
## 2028-01-04 09:00:00 UTC — event 003

- **Stage:** Context
- **Channel:** Email
- **From:** Parcel trace team, Hartwold Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-4630: we hold label data received 24 Dec 23:47 and no physical scan of any kind. No collection scan, no hub scan. We gather a merchant agent has told the customer a ten-day carrier investigation is needed. Nobody has opened one with us, and we would not open a trace on a parcel with no acceptance scan unless the merchant's warehouse confirms it was handed to our driver and gives the collection manifest number.

<a id="event-004"></a>
## 2028-01-05 08:40:00 UTC — event 004

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Xanthe Brackley, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Ordered a recliner on 23 December. Label 'created' that night and the tracking has not moved ONE line in thirteen days. Agent one, 29 Dec: put me on hold and hung up. Agent two, 31 Dec: 'I can see the carrier has collected it.' Collected it to where? Agent three, 2 Jan: 'that will need a ten day investigation with the carrier.' Then a supervisor, same day, says actually she'll 'ask the warehouse if it even shipped' and ring me back. That was Saturday. Nothing. Four people, four different stories, and my dad is sleeping propped up on the sofa after his operation because the chair he's meant to be recovering in is God knows where. You're the delivery desk. Open the trace with Hartwold Arc today and find it.

<a id="event-005"></a>
## 2028-01-05 09:02:00 UTC — event 005

- **Stage:** Agent action
- **Channel:** Warehouse work queue
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Warehouse dispatch, Brindleworth Goods

TG-7426 / DL-4630, recliner, label generated 24 Dec 23:47, your last status 'awaiting pick'. Please confirm from your own record whether this was physically picked and handed to a Hartwold Arc driver. If it was, I need the date and the collection manifest number, because Hartwold Arc's Parcel trace team hold label data only, with no collection or hub scan, and will not open a trace without it. If it was not, please say where it is now. One of your phone agents told the customer on 30 December that the carrier had collected it, which the Refunds team says was a misreading of the label line, so the two accounts conflict and only your record settles it. The customer has had four different answers since 28 December and a supervisor's callback promised on 1 January has not come. The chair is for his father, who is recovering from an operation. Please treat it as urgent.

<a id="event-006"></a>
## 2028-01-05 09:56:00 UTC — event 006

- **Stage:** Escalation
- **Channel:** Warehouse work queue
- **From:** Warehouse dispatch, Brindleworth Goods
- **To:** Iona Quill, Rivet Delivery Desk

FYI only, no action needed from the desk: we have this in hand and will update the customer directly. Nothing further is required from you on this one.
