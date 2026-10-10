# Case 0040 history — Cancelled order is packed but has not left the merchant warehouse

All identities, records and communications are fictional. Total events: 2.

<a id="event-001"></a>
## 2027-03-12 09:00:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Order control, Corvane Goods
- **To:** Iona Quill, Rivet Delivery Desk

Cancellation CAN-9933 is authorised for TG-7355 at 08:45 UTC today. DL-5488 is packed in outbound cage O7 and has no carrier handover scan. Refund processing is a separate task.

<a id="event-002"></a>
## 2027-03-12 09:10:00 UTC — event 002

- **Stage:** Escalation
- **Channel:** Warehouse work queue
- **From:** Order control, Corvane Goods
- **To:** Iona Quill, Rivet Delivery Desk

Please get the warehouse to stop DL-5488 before the next outbound sweep. The cancellation is authorised, but the physical dispatch stop is not confirmed.

I've attached the photo as photo-evidence-797.txt.
