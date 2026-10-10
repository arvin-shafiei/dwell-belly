# Case 0258 history — An imported order is held and the recipient keeps getting payment texts

All identities, records and communications are fictional. Total events: 7.

<a id="event-001"></a>
## 2027-08-31 09:30:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Import billing, Sedgemoor Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-1905 held at import since 28 Aug. Import charge of 41.80 outstanding. Notice sent to the recipient on 28 Aug asking for payment or proof of prepayment. Nothing received on our side. If unpaid by 8 Sep the parcel returns to sender.

<a id="event-002"></a>
## 2027-08-31 10:10:00 UTC — event 002

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Caspar Ormsby, recipient
- **To:** Iona Quill, Rivet Delivery Desk

i ALREADY SENT IT. friday. screenshot of the order from tallowmere. it says taxes and duties included. now a text with a link wanting 41.80?? i dont click links. who is this really. is it even plover arc

<a id="event-003"></a>
## 2027-08-31 10:40:00 UTC — event 003

- **Stage:** Agent action
- **Channel:** Warehouse work queue
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Warehouse dispatch, Heronwick Goods

TG-5550 / DL-1905 is held at import and the carrier's import billing shows 41.80 outstanding. The recipient says duties and taxes were included at checkout. Please confirm how this order was shipped: duties prepaid or payable on arrival, and any prepayment reference.

<a id="event-004"></a>
## 2027-08-31 13:15:00 UTC — event 004

- **Stage:** Context
- **Channel:** Warehouse work queue
- **From:** Warehouse dispatch, Heronwick Goods
- **To:** Iona Quill, Rivet Delivery Desk

TG-5550: checkout total included 'import duties and taxes 41.80', collected by us. Shipped on our duty-prepaid account with Sedgemoor Arc, prepay ref TGP-9515. Commercial invoice went in the pouch on the carton. No idea why import is asking the customer.

<a id="event-005"></a>
## 2027-09-01 08:50:00 UTC — event 005

- **Stage:** Context
- **Channel:** Broker portal
- **From:** Juno Grimshaw, customs broker
- **To:** Iona Quill, Rivet Delivery Desk

DL-1905: the entry is on hold pending evidence of value. We have no commercial invoice on file, the pouch was empty at arrival scan. From our side this is not a duty non-payment hold. I can't see what import billing has posted against it.

<a id="event-006"></a>
## 2027-09-01 09:05:00 UTC — event 006

- **Stage:** Context
- **Channel:** Email
- **From:** Import billing, Sedgemoor Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Automated reminder: 41.80 remains outstanding on DL-1905. The fastest way to release the parcel is for the recipient to pay using the link in the notice.

<a id="event-007"></a>
## 2027-09-01 09:40:00 UTC — event 007

- **Stage:** Escalation
- **Channel:** Customer portal
- **From:** Caspar Ormsby, recipient
- **To:** Iona Quill, Rivet Delivery Desk

second text this morning. PAY TO RELEASE. thats a ransom. i paid tallowmere everything, its on the order. sent proof, they 'havent got it', very convenient. customs has it or plover has it, which, nobody says. im not paying one more penny and im not sending my card or anything else to anybody. tell me straight is this even real
