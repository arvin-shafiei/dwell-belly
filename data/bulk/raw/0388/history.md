# Case 0388 history — Import shipment is waiting for the shipper's commercial invoice

All identities, records and communications are fictional. Total events: 5.

<a id="event-001"></a>
## 2027-03-17 07:30:00 UTC — event 001

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Route planning, Carrier operations
- **To:** Iona Quill, Rivet Delivery Desk

Route plan for depot CT-5 published for Tuesday. 37 stops, no exceptions raised. No action needed.

<a id="event-002"></a>
## 2027-03-17 09:00:00 UTC — event 002

- **Stage:** Context
- **Channel:** Email
- **From:** Nettlebank Trade Desk, appointed customs broker
- **To:** Iona Quill, Rivet Delivery Desk

For DL-7392 / order OS-6793 we need the shipper’s commercial invoice showing seller, buyer, invoice date and reference, goods description, quantity, unit value, currency, total and origin declaration. These are the missing fields in this file; no clearance decision has been made.

<a id="event-003"></a>
## 2027-03-17 09:03:20 UTC — event 003

- **Stage:** Context
- **Channel:** Email
- **From:** Aurelio Yardley, Carrier operations
- **To:** Iona Quill, Rivet Delivery Desk

Automatic reply: I am out of the office until Wednesday with limited access to email. For urgent matters about collections or bookings, please contact the dispatch desk.

<a id="event-004"></a>
## 2027-03-17 09:06:40 UTC — event 004

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Wystan Dunmore, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Hi, any update on DL-66264? It was meant to come Monday. Thanks.

<a id="event-005"></a>
## 2027-03-17 09:10:00 UTC — event 005

- **Stage:** Escalation
- **Channel:** Broker portal
- **From:** Nettlebank Trade Desk, appointed customs broker
- **To:** Iona Quill, Rivet Delivery Desk

Please request the complete invoice from authorised shipper Larkspire Export Studio. Do not fill in values or origin on their behalf.

I've attached the photo as photo-evidence-795.txt.
