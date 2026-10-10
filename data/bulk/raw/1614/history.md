# Case 1614 history — Pallet of kiln shelves returned to depot after the carrier reported the destination address could not be found

All identities, records and communications are fictional. Total events: 7.

<a id="event-001"></a>
## 2026-11-04 16:30:00 UTC — event 001

- **Stage:** Context
- **Channel:** Freight portal
- **From:** Freight planner, Ashgrove Arc Logistics
- **To:** Eamon Pendlebury, shipper; Iona Quill, Rivet Delivery Desk

DL-6914: the carrier reports the destination address could not be located on 4 November. The pallet is back at the Destination depot. If a valid address is not supplied within 2 working days the consignment is returned to the sender at the sender's cost.

<a id="event-002"></a>
## 2026-11-05 09:10:00 UTC — event 002

- **Stage:** Context
- **Channel:** Freight portal
- **From:** Eamon Pendlebury, shipper
- **To:** Iona Quill, Rivet Delivery Desk

Unit 6, Hartwell Kiln Yard, Quarry Lane, Osmoor. That is the address on the docket and it is the address now. It is the only Kiln Yard in the county. Type it into any maps app on any phone and it drops a pin on the gate before you've finished typing. Your driver 'could not locate' it. Did he try? Did he get out of the cab? Entrance is next to the weighbridge, green gate, sign the size of a door. The customer is on site 7 till 5 and his number is on the docket. And I'm to pay to have it brought back, am I?

<a id="event-003"></a>
## 2026-11-05 09:35:00 UTC — event 003

- **Stage:** Agent action
- **Channel:** Email
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Routing control, Ashgrove Arc Logistics

DL-6914, logged address not located on 4 November and now at the Destination depot. The shipper, Eamon Pendlebury, confirms the docket address is correct and complete: Unit 6, Hartwell Kiln Yard, Quarry Lane, Osmoor; entrance beside the weighbridge, green gate, signed; consignee on site 07:00-17:00 with a contact number on the docket. He says it resolves immediately on public maps and questions whether the driver attempted the stop. Please check the address against your routing file and the driver's stop record, tell us which it is, and pause the return-to-sender clock while you do.

<a id="event-004"></a>
## 2026-11-05 09:40:00 UTC — event 004

- **Stage:** Agent action
- **Channel:** Freight portal
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Eamon Pendlebury, shipper

I've sent the address exactly as you gave it, with the weighbridge and green gate detail and the site hours, to Routing control at Ashgrove Arc. I've asked them to check their routing data against it, to pull the driver's stop record, and to pause the return clock while they do. They own the address record and the return decision; I can't change either. I'll tell you what they say.

<a id="event-005"></a>
## 2026-11-05 10:25:00 UTC — event 005

- **Stage:** Context
- **Channel:** Email
- **From:** Routing control, Ashgrove Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk; Eamon Pendlebury, shipper

RC-9572 logged for DL-6914. The return-to-sender clock is paused while we check. We are comparing the address with our routing file and pulling the driver's stop record, and will give an answer to both of you by 15:00 UTC today. We don't need anything further from the sender.

<a id="event-006"></a>
## 2026-11-05 12:03:00 UTC — event 006

- **Stage:** Context
- **Channel:** Freight portal
- **From:** Eamon Pendlebury, shipper
- **To:** Iona Quill, Rivet Delivery Desk

For the record, since I gather these threads get read back when things go wrong. I have seen Routing control's note. A logistics company is taking five hours to 'compare' an address that a twelve-year-old with a phone finds in one second. Remarkable. I am not asking you for anything and I don't want a reply to this; I have had enough 'we've passed it on' for one week. I will wait for 15:00 as stated. If it then turns out nobody went anywhere near the place I shall have a good deal more to say. That is all.

<a id="event-007"></a>
## 2026-11-05 12:10:00 UTC — event 007

- **Stage:** Escalation
- **Channel:** Freight portal
- **From:** Eamon Pendlebury, shipper
- **To:** Iona Quill, Rivet Delivery Desk

For the record, since I gather these threads get read back when things go wrong. I have seen Routing control's note. A logistics company is taking five hours to 'compare' an address that a twelve-year-old with a phone finds in one second. Remarkable. I am not asking you for anything and I don't want a reply to this; I have had enough 'we've passed it on' for one week. I will wait for 15:00 as stated. If it then turns out nobody went anywhere near the place I shall have a good deal more to say. That is all.

I've attached the photo as photo-evidence-747.txt.
