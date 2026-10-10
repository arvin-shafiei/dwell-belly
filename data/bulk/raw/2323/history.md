# Case 2323 history — Customer writes after a wrongly forwarded parcel is collected from him and his ticket shows closed

All identities, records and communications are fictional. Total events: 9.

<a id="event-001"></a>
## 2028-05-01 10:00:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Returns authorisations, Larkspire Goods
- **To:** Iona Quill, Rivet Delivery Desk

TG-9776 return (bread maker) was authorised 20 Apr on label DL-7855. What reached our returns dock on 27 Apr carrying a DL-7855 relabel was not ours: a boxed set of curtain poles addressed to somebody else entirely. Our warehouse forwarded it on 28 Apr to Mr Brackley as 'returned to sender', consignment DL-3496, which was our mistake. The refund on TG-9776 stays on hold until the bread maker is received here or Emberlee Arc confirms in writing where DL-7855 is. We can't release it on the customer's word.

<a id="event-002"></a>
## 2028-05-01 11:30:00 UTC — event 002

- **Stage:** Agent action
- **Channel:** Depot work queue
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Parcel trace team, Emberlee Arc Logistics

Two items on TG-9776. (1) Please trace return DL-7855, a bread maker collected from the customer on 21 Apr and not received by the merchant. (2) A third party's parcel was forwarded to the customer in error as DL-3496 and needs collecting from him. The merchant's refund depends on (1).

<a id="event-003"></a>
## 2028-05-01 22:15:00 UTC — event 003

- **Stage:** Context
- **Channel:** Email
- **From:** Xanthe Normanton, sender not on record
- **To:** Iona Quill, Rivet Delivery Desk

Hello, I'm not on the order but I live nearby. Just so you know, DL-7855 has already been sorted out by the merchant and nobody needs to do anything else.

<a id="event-004"></a>
## 2028-05-02 09:00:00 UTC — event 004

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Parcel trace team, Emberlee Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Ticket PT-5677 raised. Collection of DL-3496 booked for 4 May.

<a id="event-005"></a>
## 2028-05-04 15:10:00 UTC — event 005

- **Stage:** Context
- **Channel:** Call transcript
- **From:** Hesper Brackley, customer
- **To:** Iona Quill, Rivet Delivery Desk

your driver has just been stood on my step for twenty five minutes telling me he cant take it because the label doesnt match his handheld and hes rung his depot twice while i stand there holding somebody elses curtain poles and in the end he took it but only after i said i was leaving it on the pavement so thats that one gone now what about mine

<a id="event-006"></a>
## 2028-05-04 15:45:00 UTC — event 006

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Parcel trace team, Emberlee Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

AUTOMATED: PT-5677 closed. Linked consignment DL-3496 scanned 'collected' 4 May 12:31. Closed tickets cannot be reopened or replied to on this queue. For any item not covered by the collection, email Parcel trace team quoting the original shipment reference.

<a id="event-007"></a>
## 2028-05-05 09:20:00 UTC — event 007

- **Stage:** Context
- **Channel:** Email
- **From:** Destination depot, Emberlee Arc Logistics
- **To:** Hesper Brackley, customer

Mr Brackley, the relabel occurred at the merchant's returns dock and the onward forwarding was the merchant's decision, not ours. Our driver followed handheld procedure at your address. The stray consignment has been collected and we consider the matter closed. Copy to Rivet Delivery Desk.

<a id="event-008"></a>
## 2028-05-05 09:48:00 UTC — event 008

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Hesper Brackley, customer
- **To:** Iona Quill, Rivet Delivery Desk

closed is it well thats nice for you ive just had an email saying matter closed and my ticket says closed and i STILL havent got my money for the bread maker i sent back nearly three weeks ago and nobody has said one word about where that is all anyone wants to talk about is somebody elses curtain poles which i never asked for and had to argue with your driver to get rid of and now its apparently everyone elses fault ive spent hours on hold to plover arc on a pay as you go mobile and i want that credit back as well and tallowmere say they cant refund me till you lot say where my parcel is so where is it

<a id="event-009"></a>
## 2028-05-05 10:05:00 UTC — event 009

- **Stage:** Escalation
- **Channel:** Customer portal
- **From:** Hesper Brackley, customer
- **To:** Iona Quill, Rivet Delivery Desk

closed is it well thats nice for you ive just had an email saying matter closed and my ticket says closed and i STILL havent got my money for the bread maker i sent back nearly three weeks ago and nobody has said one word about where that is all anyone wants to talk about is somebody elses curtain poles which i never asked for and had to argue with your driver to get rid of and now its apparently everyone elses fault ive spent hours on hold to plover arc on a pay as you go mobile and i want that credit back as well and tallowmere say they cant refund me till you lot say where my parcel is so where is it
