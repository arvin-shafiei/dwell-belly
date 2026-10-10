# Case 0402 history — Broker says import duty was paid while the carrier's ledger shows a balance and storage has started

All identities, records and communications are fictional. Total events: 9.

<a id="event-001"></a>
## 2028-05-01 09:00:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Import billing, Ashgrove Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-4833: import duty and tax of £248.40 outstanding on entry IE-6024. Held at Destination depot under payment hold. Storage of £6.50 per day accrues from 3 May. The hold lifts automatically when the entry balance is nil.

Attached: driver-log-768.txt

<a id="event-002"></a>
## 2028-05-02 10:15:00 UTC — event 002

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Wystan Underhill, recipient
- **To:** Iona Quill, Rivet Delivery Desk

My broker dealt with the duty on this. Why does tracking say awaiting payment

<a id="event-003"></a>
## 2028-05-02 10:30:00 UTC — event 003

- **Stage:** Agent action
- **Channel:** Broker portal
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Greer Fortescue, Copperhythe Customs Brokers

Import billing shows £248.40 outstanding on entry IE-6024 for DL-4833. Can you confirm whether payment has been made, and with what reference?

<a id="event-004"></a>
## 2028-05-02 14:02:00 UTC — event 004

- **Stage:** Context
- **Channel:** Broker portal
- **From:** Greer Fortescue, Copperhythe Customs Brokers
- **To:** Iona Quill, Rivet Delivery Desk

Paid 27 April. £212.40 by deferment account, our ref QCB-8354. That is the assessed amount on our entry copy.

<a id="event-005"></a>
## 2028-05-02 14:20:00 UTC — event 005

- **Stage:** Agent action
- **Channel:** Email
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Import billing, Ashgrove Arc Logistics

The broker for DL-4833 reports a payment of £212.40 on 30 Apr by deferment account, reference QCB-8354. Please check it against entry IE-6024.

<a id="event-006"></a>
## 2028-05-03 08:45:00 UTC — event 006

- **Stage:** Context
- **Channel:** Email
- **From:** Import billing, Ashgrove Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Checked the entry ledger: nothing posted to IE-6024, balance still £248.40. QCB-8354 doesn't appear on this entry. I haven't searched deferment statements or other entries; that needs a reconciliation request with the broker's statement line.

<a id="event-007"></a>
## 2028-05-03 09:30:00 UTC — event 007

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Destination depot, Ashgrove Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-4833 still on payment hold, bay H-4. Storage started today. We can't release against a hold, only Import billing lifts it.

<a id="event-008"></a>
## 2028-05-03 11:10:00 UTC — event 008

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Wystan Underhill, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Depot told me on the phone I can just pay the 248 by card and collect today. Should I do that? I need the inks this week.

<a id="event-009"></a>
## 2028-05-03 11:40:00 UTC — event 009

- **Stage:** Escalation
- **Channel:** Broker portal
- **From:** Greer Fortescue, Copperhythe Customs Brokers
- **To:** Iona Quill, Rivet Delivery Desk

Duty on DL-4833 was paid a week ago. I have already sent you the reference. Your carrier is now charging my client storage on goods that are cleared and paid. Release it today and cancel the storage. Statement line: 30/04 DEF QCB-8354 £212.40 PLOVER ARC IMPORT.
