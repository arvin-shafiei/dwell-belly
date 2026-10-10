# Case 1069 history — Cancelled order is packed but has not left the merchant warehouse

All identities, records and communications are fictional. Total events: 3.

<a id="event-001"></a>
## 2027-03-12 09:00:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Order control, Sedgemoor Goods
- **To:** Iona Quill, Rivet Delivery Desk

Cancellation CAN-2685 is authorised for TG-3141 at 08:45 UTC today. DL-1358 is packed in outbound cage O7 and has no carrier handover scan. Refund processing is a separate task.

<a id="event-002"></a>
## 2027-03-12 09:05:00 UTC — event 002

- **Stage:** Context
- **Channel:** Warehouse work queue
- **From:** Order control, Sedgemoor Goods
- **To:** Iona Quill, Rivet Delivery Desk

Please get the warehouse to stop DL-1358 before the next outbound sweep. The cancellation is authorised, but the physical dispatch stop is not confirmed.

<a id="event-003"></a>
## 2027-03-12 09:10:00 UTC — event 003

- **Stage:** Escalation
- **Channel:** Warehouse work queue
- **From:** Order control, Sedgemoor Goods
- **To:** Iona Quill, Rivet Delivery Desk

Please get the warehouse to stop DL-1358 before the next outbound sweep. The cancellation is authorised, but the physical dispatch stop is not confirmed.
