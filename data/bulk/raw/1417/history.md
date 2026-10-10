# Case 1417 history — Import shipment is waiting for the shipper's commercial invoice

All identities, records and communications are fictional. Total events: 2.

<a id="event-001"></a>
## 2027-03-17 09:00:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Quillmoor Trade Desk, appointed customs broker
- **To:** Iona Quill, Rivet Delivery Desk

For DL-3435 / order OS-6271 we need the shipper’s commercial invoice showing seller, buyer, invoice date and reference, goods description, quantity, unit value, currency, total and origin declaration. These are the missing fields in this file; no clearance decision has been made.

Attached: driver-log-764.txt

<a id="event-002"></a>
## 2027-03-17 09:10:00 UTC — event 002

- **Stage:** Escalation
- **Channel:** Broker portal
- **From:** Quillmoor Trade Desk, appointed customs broker
- **To:** Iona Quill, Rivet Delivery Desk

Please request the complete invoice from authorised shipper Marrowby Export Studio. Do not fill in values or origin on their behalf.
