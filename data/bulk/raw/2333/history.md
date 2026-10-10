# Case 2333 history — Parcel for collection at a corner shop has shown the same status for ten days

All identities, records and communications are fictional. Total events: 11.

<a id="event-001"></a>
## 2028-03-06 08:40:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Tracking support, Gorsewick Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-3492 arrived at the destination depot on 25 February for collection at Nettlebank Corner Stores. Tracking has shown 'on its way to your pickup point' since then. We have not checked with the depot why.

<a id="event-002"></a>
## 2028-03-06 09:05:00 UTC — event 002

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Kestra Haverly, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Ten days it has said on its way to your pickup point. The shop is four minutes from my front door. Where is it? I asked the chat on your website last week and was told to wait for the collection text.

<a id="event-003"></a>
## 2028-03-06 09:30:00 UTC — event 003

- **Stage:** Agent action
- **Channel:** Pickup-point portal
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Nettlebank Corner Stores, pickup point

Please confirm whether DL-3492 has reached you and is ready for collection. The recipient has been waiting since 25 February.

<a id="event-004"></a>
## 2028-03-06 09:30:20 UTC — event 004

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Juno Kittering, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Hi, any update on DL-34965? It was meant to come Monday. Thanks.

<a id="event-005"></a>
## 2028-03-06 09:30:40 UTC — event 005

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Juno Whitlock, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Hi, any update on DL-79490? It was meant to come Wednesday. Thanks.

<a id="event-006"></a>
## 2028-03-06 09:31:00 UTC — event 006

- **Stage:** Context
- **Channel:** Pickup-point portal
- **From:** Pickup-point portal, automated notice
- **To:** Iona Quill, Rivet Delivery Desk

Your message was not delivered. This location has been suspended for parcel intake and messaging since 24 February. Reason given: storage capacity. Messages to a suspended location are not held or forwarded.

<a id="event-007"></a>
## 2028-03-06 10:10:00 UTC — event 007

- **Stage:** Agent action
- **Channel:** Depot work queue
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Destination depot, Gorsewick Arc Logistics

DL-3492 has not reached Nettlebank Corner Stores and the location shows as suspended. Please re-attempt handover to the pickup point or advise what is holding it.

<a id="event-008"></a>
## 2028-03-07 07:55:00 UTC — event 008

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Destination depot, Gorsewick Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Ticket closed, wrong queue. DL-3492 was refused at Nettlebank Corner Stores on 26 February and again on 29 February, reason 'no space'. It was returned to sender on 3 March and is in transit to the Pebblewick warehouse. It is out of our network and we cannot re-attempt it. Our return notice goes to the shipper only, so the recipient will not have been told. Sending a returned order out again, and where to, is for Warehouse dispatch, Pebblewick Goods, through the Warehouse work queue.

<a id="event-009"></a>
## 2028-03-07 09:03:20 UTC — event 009

- **Stage:** Context
- **Channel:** Email
- **From:** Partner bulletin, Carrier Network Updates
- **To:** Iona Quill, Rivet Delivery Desk

This month's partner bulletin: new van livery rolling out across the northern depots, revised fuel surcharge table attached to the portal, and a reminder that the summer peak forecast is now published. To stop receiving these emails, update your preferences.

<a id="event-010"></a>
## 2028-03-07 10:11:40 UTC — event 010

- **Stage:** Context
- **Channel:** Email
- **From:** Jory Lumley, Gorsewick Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Automatic reply: I am out of the office until Tuesday with limited access to email. For urgent matters about collections or bookings, please contact the dispatch desk.

<a id="event-011"></a>
## 2028-03-07 11:20:00 UTC — event 011

- **Stage:** Escalation
- **Channel:** Customer portal
- **From:** Kestra Haverly, recipient
- **To:** Iona Quill, Rivet Delivery Desk

I went into the shop myself this morning. They told me they have been turning parcels away for a fortnight because the back room is full. Mine went BACK. Back to the sender. Nobody told me. Nobody told me it was refused, nobody told me it was sent back, nobody asked me whether I wanted it somewhere else. Ten days of 'on its way to your pickup point' and it was never going to get there. I don't want it at that shop. I am not having it sent to that shop again. Send it to my house, the address is on my account, or tell me who can. Not the shop. I have said this three times to three people now.
