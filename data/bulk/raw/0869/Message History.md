# Case 0869 history — Armchair held at a pickup point after two logged attempts the recipient disputes

All identities, records and communications are fictional. Total events: 6.

<a id="event-001"></a>
## 2027-05-12 16:30:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Dispatch, Brackenford Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-8699: second attempt failed today 15:47, code 'no answer'. First was 10 May 13:12, same code. After two failed attempts the system diverts to the nearest pickup point, so it is going to Larkspire Lantern News tomorrow. One carton, 23 kg, 110 cm long. For info, once a parcel sits at a pickup point the depot queue treats it as finished with. Only Marrowby can order a retrieval and a new home booking, and they take those by Email.

<a id="event-002"></a>
## 2027-05-13 10:09:00 UTC — event 002

- **Stage:** Context
- **Channel:** Call transcript
- **From:** Ebony Brackley, recipient
- **To:** Marrowby, Brackenford Arc Logistics

Summary of call 10:02 to 10:09. Caller says she uses a wheelchair, was at home on both days and her door camera shows no van in the road at either logged time. Says she cannot collect a 23 kg chair from a shop. Agent: 'I'll get someone from the depot to ring you back today about bringing it to the house.' No callback task was created on the shipment.

<a id="event-003"></a>
## 2027-05-14 09:15:00 UTC — event 003

- **Stage:** Context
- **Channel:** Pickup-point portal
- **From:** Larkspire Lantern News, pickup-point staff
- **To:** Iona Quill, Rivet Delivery Desk

DL-8699 been here since yesterday afternoon, its a massive box and its half blocking our stockroom door. We hold 7 days then it goes back on the van. Lady hasnt been in.

<a id="event-004"></a>
## 2027-05-14 09:40:00 UTC — event 004

- **Stage:** Agent action
- **Channel:** Depot work queue
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Destination depot, Brackenford Arc Logistics

DL-8699: the recipient cannot collect from the pickup point. Please arrange retrieval from Larkspire Lantern News and a home delivery, and the callback she was promised on 13 May.

<a id="event-005"></a>
## 2027-05-14 09:41:00 UTC — event 005

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Destination depot, Brackenford Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

AUTOMATED: ticket DQ-5690 closed. Reason: shipment status is 'Available for collection', no depot action outstanding. This queue is not monitored for replies to closed tickets.

<a id="event-006"></a>
## 2027-05-15 08:50:00 UTC — event 006

- **Stage:** Escalation
- **Channel:** Customer portal
- **From:** Ebony Brackley, recipient
- **To:** Iona Quill, Rivet Delivery Desk

I have now waited in on two separate days for this chair and both times your driver says nobody answered when my camera shows no van on my road at all either day and then instead of anyone asking me you send it to a newsagent half a mile away and I rang on Thursday and explained I am disabled I use a wheelchair I cannot carry a chair that weighs more than my dog home from a shop and the man said someone would ring me back that day and nobody has and it is now Saturday and I am still sitting on a dining chair with a cushion on it and the shop says it goes back in a week so what exactly am I supposed to do

Attached: customer-letter-833.txt
