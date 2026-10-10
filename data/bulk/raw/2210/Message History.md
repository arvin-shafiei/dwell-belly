# Case 2210 history — Recipient reports a wrong house number on a kettle parcel due out tomorrow

All identities, records and communications are fictional. Total events: 5.

<a id="event-001"></a>
## 2028-04-11 10:02:00 UTC — event 001

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Marisol Brackley, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Order TG-6976, the house number on the label is wrong, it says 8 Dunmere Close and it should be 18. same postcode. its going out for delivery tmrw so pls get it changed before then. Emailing this as well in case the portal doesnt go through, its been playing up all week

<a id="event-002"></a>
## 2028-04-11 10:06:00 UTC — event 002

- **Stage:** Agent action
- **Channel:** Email
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Routing control, Emberlee Arc Logistics

Address correction request for DL-4462 (order TG-6976), booked for delivery 2028-04-12. The recipient, Marisol Brackley, says the label reads 8 Dunmere Close and should read 18 Dunmere Close, same postcode. Please check against the order record, confirm whether the label can be corrected before route load, and confirm the outcome to him.

<a id="event-003"></a>
## 2028-04-11 10:09:00 UTC — event 003

- **Stage:** Agent action
- **Channel:** Customer portal
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Marisol Brackley, recipient

Your portal message came through. I have passed the house-number correction for DL-4462 to Routing control at Emberlee Arc, who own address changes. I can't make or confirm the change myself; they will tell you whether it has been made.

<a id="event-004"></a>
## 2028-04-11 10:13:00 UTC — event 004

- **Stage:** Context
- **Channel:** Email
- **From:** Routing control, Emberlee Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk; Marisol Brackley, recipient

Received. Logged as ADR-9472 for DL-4462 (8 to 18 Dunmere Close, postcode unchanged). We check it against the merchant order record and will confirm either way to both of you by 15:00 UTC today, ahead of the 18:00 route load. One request is enough, please don't resend.

<a id="event-005"></a>
## 2028-04-11 10:16:00 UTC — event 005

- **Stage:** Escalation
- **Channel:** Email
- **From:** Marisol Brackley, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Copy of what I put on the portal just now: Order TG-6976, the house number on the label is wrong, it says 8 Dunmere Close and it should be 18. same postcode. its going out for delivery tmrw so pls get it changed before then. Emailing this as well in case the portal doesnt go through, its been playing up all week
