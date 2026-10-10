# Case 0265 history — Customer writes after a wrongly forwarded parcel is collected from him and his ticket shows closed

All identities, records and communications are fictional. Total events: 7.

<a id="event-001"></a>
## 2028-05-01 10:00:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Returns authorisations, Brindleworth Goods
- **To:** Iona Quill, Rivet Delivery Desk

TG-4253 return (bread maker) was authorised 20 Apr on label DL-7205. What reached our returns dock on 27 Apr carrying a DL-7205 relabel was not ours: a boxed set of curtain poles addressed to somebody else entirely. Our warehouse forwarded it on 28 Apr to Mr Blackwood as 'returned to sender', consignment DL-2534, which was our mistake. The refund on TG-4253 stays on hold until the bread maker is received here or Pebblewick Arc confirms in writing where DL-7205 is. We can't release it on the customer's word.

<a id="event-002"></a>
## 2028-05-01 11:30:00 UTC — event 002

- **Stage:** Agent action
- **Channel:** Depot work queue
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Parcel trace team, Pebblewick Arc Logistics

Two items on TG-4253. (1) Please trace return DL-7205, a bread maker collected from the customer on 21 Apr and not received by the merchant. (2) A third party's parcel was forwarded to the customer in error as DL-2534 and needs collecting from him. The merchant's refund depends on (1).

<a id="event-003"></a>
## 2028-05-02 09:00:00 UTC — event 003

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Parcel trace team, Pebblewick Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Ticket PT-9274 raised. Collection of DL-2534 booked for 4 May.

<a id="event-004"></a>
## 2028-05-04 15:10:00 UTC — event 004

- **Stage:** Context
- **Channel:** Call transcript
- **From:** Zinnia Blackwood, customer
- **To:** Iona Quill, Rivet Delivery Desk

your driver has just been stood on my step for twenty five minutes telling me he cant take it because the label doesnt match his handheld and hes rung his depot twice while i stand there holding somebody elses curtain poles and in the end he took it but only after i said i was leaving it on the pavement so thats that one gone now what about mine

<a id="event-005"></a>
## 2028-05-04 15:45:00 UTC — event 005

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Parcel trace team, Pebblewick Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

AUTOMATED: PT-9274 closed. Linked consignment DL-2534 scanned 'collected' 4 May 12:31. Closed tickets cannot be reopened or replied to on this queue. For any item not covered by the collection, email Parcel trace team quoting the original shipment reference.

<a id="event-006"></a>
## 2028-05-05 09:20:00 UTC — event 006

- **Stage:** Context
- **Channel:** Email
- **From:** Destination depot, Pebblewick Arc Logistics
- **To:** Zinnia Blackwood, customer

Mr Blackwood, the relabel occurred at the merchant's returns dock and the onward forwarding was the merchant's decision, not ours. Our driver followed handheld procedure at your address. The stray consignment has been collected and we consider the matter closed. Copy to Rivet Delivery Desk.

<a id="event-007"></a>
## 2028-05-05 10:05:00 UTC — event 007

- **Stage:** Escalation
- **Channel:** Customer portal
- **From:** Zinnia Blackwood, customer
- **To:** Iona Quill, Rivet Delivery Desk

closed is it well thats nice for you ive just had an email saying matter closed and my ticket says closed and i STILL havent got my money for the bread maker i sent back nearly three weeks ago and nobody has said one word about where that is all anyone wants to talk about is somebody elses curtain poles which i never asked for and had to argue with your driver to get rid of and now its apparently everyone elses fault ive spent hours on hold to plover arc on a pay as you go mobile and i want that credit back as well and tallowmere say they cant refund me till you lot say where my parcel is so where is it

It's only a bath bomb gift set, nothing explosive, don't worry!
