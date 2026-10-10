# Case 2108 history — Customer requests reimbursement of a guaranteed-delivery surcharge after confirmed delay

All identities, records and communications are fictional. Total events: 4.

<a id="event-001"></a>
## 2028-03-20 09:00:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Service guarantees, Copperhythe Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-4623 booking terms excerpt: guaranteed by 2028-03-20 08:00 UTC; surcharge GBP 7.50. If carrier-caused delay is confirmed, the surcharge may be credited after billing review. Route record: carrier sorting delay, actual recipient handover 2028-03-20 08:40 UTC. No exclusion is recorded.

<a id="event-002"></a>
## 2028-03-20 09:10:00 UTC — event 002

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Yorick Ashdown, customer
- **To:** Iona Quill, Rivet Delivery Desk

My parcel arrived at 08:40, later than the guaranteed 08:00 deadline. Please submit a request for the GBP 7.50 service surcharge under these booking terms.

<a id="event-003"></a>
## 2028-03-20 09:32:00 UTC — event 003

- **Stage:** Agent action
- **Channel:** Email
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Guarantee billing, Copperhythe Arc Logistics

Please review a service-guarantee credit request for DL-4623: guaranteed 2028-03-20 08:00 UTC, actual handover 08:40, confirmed carrier sorting delay, surcharge GBP 7.50. Customer seeks only the surcharge under this booking’s terms.

<a id="event-004"></a>
## 2028-03-20 10:58:00 UTC — event 004

- **Stage:** Escalation
- **Channel:** Email
- **From:** Guarantee billing, Copperhythe Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

FYI only, no action needed from the desk: we have this in hand and will update the customer directly. Nothing further is required from you on this one.
