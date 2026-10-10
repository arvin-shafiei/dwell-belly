# Case 2481 history — Parcel refused at the door is waiting on the depot's refusals shelf

All identities, records and communications are fictional. Total events: 6.

<a id="event-001"></a>
## 2028-05-08 10:00:00 UTC — event 001

- **Stage:** Context
- **Channel:** Warehouse work queue
- **From:** Warehouse dispatch, Whinmoor Goods
- **To:** Iona Quill, Rivet Delivery Desk

For your notes, since you asked: there is no written rule on our side for refused parcels. Sometimes Returns have them sent back to us, sometimes they get re-attempted if the customer changes their mind, and low-value stuff has been binned at the depot before now. Returns authorisations decide each one.

<a id="event-002"></a>
## 2028-05-16 16:10:00 UTC — event 002

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Destination depot, Vanecroft Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-4068 refused at the door today 13:25. Driver note: recipient said 'not what I ordered, take it back', carton unopened. It is on our refusals shelf. We hold refusals 5 working days and need one instruction from the merchant: re-attempt, return to sender, or dispose. With no instruction it stays on the shelf and storage is charged to the merchant account from day 6.

<a id="event-003"></a>
## 2028-05-16 16:25:00 UTC — event 003

- **Stage:** Agent action
- **Channel:** Warehouse work queue
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Returns authorisations, Whinmoor Goods

DL-4068 / TG-9764 was refused at the door today at 13:25. The driver recorded the recipient saying 'not what I ordered, take it back'; the carton is unopened and on the depot's refusals shelf. The depot holds refusals 5 working days and needs your instruction: re-attempt, return to sender, or dispose. Storage is charged to your account from day 6. Which do you authorise?

<a id="event-004"></a>
## 2028-05-17 08:47:00 UTC — event 004

- **Stage:** Context
- **Channel:** Warehouse work queue
- **From:** Returns authorisations, Whinmoor Goods
- **To:** Iona Quill, Rivet Delivery Desk

TG-9764 / DL-4068, seen. Just do the usual for refusals please, same as always. Thx. K

<a id="event-005"></a>
## 2028-05-17 09:16:00 UTC — event 005

- **Stage:** Agent action
- **Channel:** Warehouse work queue
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Returns authorisations, Whinmoor Goods

Thanks. I have no written 'usual' process for refusals from Whinmoor Goods, and Warehouse dispatch tells me these are decided case by case, so I do not want to guess. For DL-4068 / TG-9764 the depot will act on one of three instructions: re-attempt, return to sender, or dispose. Which one do you authorise? The depot holds the parcel until 5 working days after 16 May, and storage is charged to your account from day 6.

<a id="event-006"></a>
## 2028-05-17 09:37:00 UTC — event 006

- **Stage:** Escalation
- **Channel:** Warehouse work queue
- **From:** Returns authorisations, Whinmoor Goods
- **To:** Iona Quill, Rivet Delivery Desk

Thanks, that's all I needed for now. No need to reply.
