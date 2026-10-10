# Case 2250 history — Recliner ordered on 21 December with tracking that has not moved since the label was created

All identities, records and communications are fictional. Total events: 4.

<a id="event-001"></a>
## 2028-12-21 23:50:00 UTC — event 001

- **Stage:** Context
- **Channel:** Warehouse work queue
- **From:** Warehouse dispatch, Rookhaven Goods
- **To:** Iona Quill, Rivet Delivery Desk

AUTOMATED: TG-4537 / DL-5595 shipping label generated 24 Dec 23:47. Status: awaiting pick.

<a id="event-002"></a>
## 2029-01-01 11:20:00 UTC — event 002

- **Stage:** Context
- **Channel:** Email
- **From:** Refunds team, Rookhaven Goods
- **To:** Iona Quill, Rivet Delivery Desk

TG-4537: customer has asked us for a refund or a replacement. For your file, on 31 Dec one of our phone agents told him 'I can see the carrier has collected it'. That agent was reading the label-created line. Our order screen shows nothing after 'label generated'. We can't authorise anything until we know whether it left the building, and that is Warehouse dispatch's record, not ours.

<a id="event-003"></a>
## 2029-01-02 09:00:00 UTC — event 003

- **Stage:** Context
- **Channel:** Email
- **From:** Parcel trace team, Brackenford Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-5595: we hold label data received 24 Dec 23:47 and no physical scan of any kind. No collection scan, no hub scan. We gather a merchant agent has told the customer a ten-day carrier investigation is needed. Nobody has opened one with us, and we would not open a trace on a parcel with no acceptance scan unless the merchant's warehouse confirms it was handed to our driver and gives the collection manifest number.

<a id="event-004"></a>
## 2029-01-03 08:40:00 UTC — event 004

- **Stage:** Escalation
- **Channel:** Customer portal
- **From:** Florian Kittering, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Ordered a recliner on 21 December. Label 'created' that night and the tracking has not moved ONE line in thirteen days. Agent one, 29 Dec: put me on hold and hung up. Agent two, 31 Dec: 'I can see the carrier has collected it.' Collected it to where? Agent three, 2 Jan: 'that will need a ten day investigation with the carrier.' Then a supervisor, same day, says actually she'll 'ask the warehouse if it even shipped' and ring me back. That was Saturday. Nothing. Four people, four different stories, and my dad is sleeping propped up on the sofa after his operation because the chair he's meant to be recovering in is God knows where. You're the delivery desk. Open the trace with Brackenford Arc today and find it.

Label scan attached for reference: label-scan-754.txt
