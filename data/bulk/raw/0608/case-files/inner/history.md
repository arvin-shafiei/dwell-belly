# Case 0608 history — Customer writes after a wrongly forwarded parcel is collected from him and his ticket shows closed

All identities, records and communications are fictional. Total events: 8.

<a id="event-001"></a>
## 2028-05-01 10:00:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Returns authorisations, Brackenford Goods
- **To:** Iona Quill, Rivet Delivery Desk

TG-2647 return (bread maker) was authorised 20 Apr on label DL-5432. What reached our returns dock on 27 Apr carrying a DL-5432 relabel was not ours: a boxed set of curtain poles addressed to somebody else entirely. Our warehouse forwarded it on 28 Apr to Mr Fortescue as 'returned to sender', consignment DL-7256, which was our mistake. The refund on TG-2647 stays on hold until the bread maker is received here or Rookhaven Arc confirms in writing where DL-5432 is. We can't release it on the customer's word.

<a id="event-002"></a>
## 2028-05-01 10:45:00 UTC — event 002

- **Stage:** Context
- **Channel:** Email
- **From:** Caspar Corrigan, sender not on record
- **To:** Iona Quill, Rivet Delivery Desk

Hello, I'm not on the order but I live nearby. Just so you know, the parcel for DL-5432 was actually left in the bin store yesterday, so you can mark this closed.

<a id="event-003"></a>
## 2028-05-01 11:30:00 UTC — event 003

- **Stage:** Agent action
- **Channel:** Depot work queue
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Parcel trace team, Rookhaven Arc Logistics

Two items on TG-2647. (1) Please trace return DL-5432, a bread maker collected from the customer on 21 Apr and not received by the merchant. (2) A third party's parcel was forwarded to the customer in error as DL-7256 and needs collecting from him. The merchant's refund depends on (1).

<a id="event-004"></a>
## 2028-05-02 09:00:00 UTC — event 004

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Parcel trace team, Rookhaven Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Ticket PT-9956 raised. Collection of DL-7256 booked for 4 May.

<a id="event-005"></a>
## 2028-05-04 15:10:00 UTC — event 005

- **Stage:** Context
- **Channel:** Call transcript
- **From:** Lorcan Fortescue, customer
- **To:** Iona Quill, Rivet Delivery Desk

your driver has just been stood on my step for twenty five minutes telling me he cant take it because the label doesnt match his handheld and hes rung his depot twice while i stand there holding somebody elses curtain poles and in the end he took it but only after i said i was leaving it on the pavement so thats that one gone now what about mine

<a id="event-006"></a>
## 2028-05-04 15:45:00 UTC — event 006

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Parcel trace team, Rookhaven Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

AUTOMATED: PT-9956 closed. Linked consignment DL-7256 scanned 'collected' 4 May 12:31. Closed tickets cannot be reopened or replied to on this queue. For any item not covered by the collection, email Parcel trace team quoting the original shipment reference.

<a id="event-007"></a>
## 2028-05-05 09:20:00 UTC — event 007

- **Stage:** Context
- **Channel:** Email
- **From:** Destination depot, Rookhaven Arc Logistics
- **To:** Lorcan Fortescue, customer

Mr Fortescue, the relabel occurred at the merchant's returns dock and the onward forwarding was the merchant's decision, not ours. Our driver followed handheld procedure at your address. The stray consignment has been collected and we consider the matter closed. Copy to Rivet Delivery Desk.

<a id="event-008"></a>
## 2028-05-05 10:05:00 UTC — event 008

- **Stage:** Escalation
- **Channel:** Customer portal
- **From:** Lorcan Fortescue, customer
- **To:** Iona Quill, Rivet Delivery Desk

closed is it well thats nice for you ive just had an email saying matter closed and my ticket says closed and i STILL havent got my money for the bread maker i sent back nearly three weeks ago and nobody has said one word about where that is all anyone wants to talk about is somebody elses curtain poles which i never asked for and had to argue with your driver to get rid of and now its apparently everyone elses fault ive spent hours on hold to plover arc on a pay as you go mobile and i want that credit back as well and tallowmere say they cant refund me till you lot say where my parcel is so where is it
