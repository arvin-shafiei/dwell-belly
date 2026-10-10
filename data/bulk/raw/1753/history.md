# Case 1753 history — Failed delivery has returned to sender and the customer still wants the order

All identities, records and communications are fictional. Total events: 3.

<a id="event-001"></a>
## 2028-03-08 09:00:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Warehouse returns, Pebblewick Goods
- **To:** Iona Quill, Rivet Delivery Desk

DL-6957 for TG-2564 is physically back in our stock after failed delivery and return-to-sender. Item accepted as reshippable. Our account team has authenticated Ansel’s order-portal session; stored destination is Apartment 2, 31 Rillstone Walk, Merrow Quay. A new dispatch requires merchant approval.

<a id="event-002"></a>
## 2028-03-08 09:05:00 UTC — event 002

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Ansel Gallimore, customer
- **To:** Iona Quill, Rivet Delivery Desk

I still want the order. I checked my authenticated order details: Apartment 2, 31 Rillstone Walk, Merrow Quay is correct. Please ask for reshipment there.

<a id="event-003"></a>
## 2028-03-08 09:10:00 UTC — event 003

- **Stage:** Escalation
- **Channel:** Customer portal
- **From:** Ansel Gallimore, customer
- **To:** Iona Quill, Rivet Delivery Desk

I still want the order. I checked my authenticated order details: Apartment 2, 31 Rillstone Walk, Merrow Quay is correct. Please ask for reshipment there.
