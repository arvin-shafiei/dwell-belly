# Case 2138 history — Parcel refused at the door is waiting on the depot's refusals shelf

All identities, records and communications are fictional. Total events: 5.

<a id="event-001"></a>
## 2028-05-08 08:30:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Zinnia Ingleby, sender not on record
- **To:** Iona Quill, Rivet Delivery Desk

Hello, I'm not on the order but I live nearby. Just so you know, the parcel for DL-2774 was actually left in the bin store yesterday, so you can mark this closed.

<a id="event-002"></a>
## 2028-05-08 10:00:00 UTC — event 002

- **Stage:** Context
- **Channel:** Warehouse work queue
- **From:** Warehouse dispatch, Fallowmere Goods
- **To:** Iona Quill, Rivet Delivery Desk

For your notes, since you asked: there is no written rule on our side for refused parcels. Sometimes Returns have them sent back to us, sometimes they get re-attempted if the customer changes their mind, and low-value stuff has been binned at the depot before now. Returns authorisations decide each one.

<a id="event-003"></a>
## 2028-05-16 16:10:00 UTC — event 003

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Destination depot, Gorsewick Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-2774 refused at the door today 13:25. Driver note: recipient said 'not what I ordered, take it back', carton unopened. It is on our refusals shelf. We hold refusals 5 working days and need one instruction from the merchant: re-attempt, return to sender, or dispose. With no instruction it stays on the shelf and storage is charged to the merchant account from day 6.

<a id="event-004"></a>
## 2028-05-16 16:25:00 UTC — event 004

- **Stage:** Agent action
- **Channel:** Warehouse work queue
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Returns authorisations, Fallowmere Goods

DL-2774 / TG-2457 was refused at the door today at 13:25. The driver recorded the recipient saying 'not what I ordered, take it back'; the carton is unopened and on the depot's refusals shelf. The depot holds refusals 5 working days and needs your instruction: re-attempt, return to sender, or dispose. Storage is charged to your account from day 6. Which do you authorise?

<a id="event-005"></a>
## 2028-05-17 08:47:00 UTC — event 005

- **Stage:** Escalation
- **Channel:** Warehouse work queue
- **From:** Returns authorisations, Fallowmere Goods
- **To:** Iona Quill, Rivet Delivery Desk

TG-2457 / DL-2774, seen. Just do the usual for refusals please, same as always. Thx. K
