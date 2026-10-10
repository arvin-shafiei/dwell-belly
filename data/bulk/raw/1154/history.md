# Case 1154 history — Caller has lost the missed-delivery card and wants to collect the parcel today

All identities, records and communications are fictional. Total events: 4.

<a id="event-001"></a>
## 2028-03-27 17:10:00 UTC — event 001

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Destination depot, Heronwick Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-6145 (TG-6689, sewing machine): attempted 27 March 8:48, no answer, card left. Second attempt auto-booked for Wednesday 29 March to the order address. Recipient on the order: Jory Quarrie. Depot collection needs the card number plus photo ID in the order name. Redelivery changes are taken from the recipient's order-linked portal session.

<a id="event-002"></a>
## 2028-03-27 18:20:00 UTC — event 002

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Jory Quarrie, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Card says you tried today. I was in all morning?? Anyway Wednesday is fine, I'll be here.

<a id="event-003"></a>
## 2028-03-28 09:48:00 UTC — event 003

- **Stage:** Context
- **Channel:** Call transcript
- **From:** Caller giving the name Jory Quarrie
- **To:** Iona Quill, Rivet Delivery Desk

Hiya, calling about DL-6145. I've lost the card thing your driver left. Can you tell me which depot it's at and what the card number was so I can go and get it today, I need it for a job tomorrow. [Asked for the delivery postcode, the caller said 'PN4 7 something', then 'no hang on, we've only been there a month, PN6?'. Neither matches the order.] Look, I've given you the reference and my name, I don't go round memorising postcodes. Either tell me where it is or send it to my work, Unit 2 Tanners Yard, I'm there all day.

<a id="event-004"></a>
## 2028-03-28 10:05:00 UTC — event 004

- **Stage:** Escalation
- **Channel:** Call transcript
- **From:** Caller giving the name Jory Quarrie
- **To:** Iona Quill, Rivet Delivery Desk

Hiya, calling about DL-6145. I've lost the card thing your driver left. Can you tell me which depot it's at and what the card number was so I can go and get it today, I need it for a job tomorrow. [Asked for the delivery postcode, the caller said 'PN4 7 something', then 'no hang on, we've only been there a month, PN6?'. Neither matches the order.] Look, I've given you the reference and my name, I don't go round memorising postcodes. Either tell me where it is or send it to my work, Unit 2 Tanners Yard, I'm there all day.
