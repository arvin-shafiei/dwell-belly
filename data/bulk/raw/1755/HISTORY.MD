# Case 1755 history — Cancelled order is packed but has not left the merchant warehouse

All identities, records and communications are fictional. Total events: 2.

<a id="event-001"></a>
## 2028-03-10 09:00:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Order control, Larkspire Goods
- **To:** Iona Quill, Rivet Delivery Desk

Cancellation CAN-7400 is authorised for TG-4456 at 08:45 UTC today. DL-1900 is packed in outbound cage O7 and has no carrier handover scan. Refund processing is a separate task.

<a id="event-002"></a>
## 2028-03-10 09:10:00 UTC — event 002

- **Stage:** Escalation
- **Channel:** Warehouse work queue
- **From:** Order control, Larkspire Goods
- **To:** Iona Quill, Rivet Delivery Desk

Please get the warehouse to stop DL-1900 before the next outbound sweep. The cancellation is authorised, but the physical dispatch stop is not confirmed.

Label scan attached for reference: label-scan-715.txt
