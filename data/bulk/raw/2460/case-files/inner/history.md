# Case 2460 history — Broker says import duty was paid while the carrier's ledger shows a balance and storage has started

All identities, records and communications are fictional. Total events: 15.

<a id="event-001"></a>
## 2028-05-01 07:30:00 UTC — event 001

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Route planning, Glimmerton Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Route plan for depot CT-4 published for Wednesday. 30 stops, no exceptions raised. No action needed.

<a id="event-002"></a>
## 2028-05-01 09:00:00 UTC — event 002

- **Stage:** Context
- **Channel:** Email
- **From:** Import billing, Glimmerton Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-8125: import duty and tax of £248.40 outstanding on entry IE-7107. Held at Destination depot under payment hold. Storage of £6.50 per day accrues from 3 May. The hold lifts automatically when the entry balance is nil.

<a id="event-003"></a>
## 2028-05-02 10:15:00 UTC — event 003

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Eamon Rowntree, recipient
- **To:** Iona Quill, Rivet Delivery Desk

My broker dealt with the duty on this. Why does tracking say awaiting payment

<a id="event-004"></a>
## 2028-05-02 10:30:00 UTC — event 004

- **Stage:** Agent action
- **Channel:** Broker portal
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Marisol Moorcroft, Oxenhale Customs Brokers

Import billing shows £248.40 outstanding on entry IE-7107 for DL-8125. Can you confirm whether payment has been made, and with what reference?

<a id="event-005"></a>
## 2028-05-02 14:02:00 UTC — event 005

- **Stage:** Context
- **Channel:** Broker portal
- **From:** Marisol Moorcroft, Oxenhale Customs Brokers
- **To:** Iona Quill, Rivet Delivery Desk

Paid 27 April. £212.40 by deferment account, our ref QCB-6320. That is the assessed amount on our entry copy.

<a id="event-006"></a>
## 2028-05-02 14:08:00 UTC — event 006

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Route planning, Glimmerton Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Route plan for depot WX-5 published for Thursday. 41 stops, no exceptions raised. No action needed.

<a id="event-007"></a>
## 2028-05-02 14:14:00 UTC — event 007

- **Stage:** Context
- **Channel:** Email
- **From:** Ebony Blackwood, Glimmerton Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Thanks,
Ebony
--
Sent from my phone. This email and any attachments are confidential and intended solely for the addressee.

<a id="event-008"></a>
## 2028-05-02 14:20:00 UTC — event 008

- **Stage:** Agent action
- **Channel:** Email
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Import billing, Glimmerton Arc Logistics

The broker for DL-8125 reports a payment of £212.40 on 30 Apr by deferment account, reference QCB-6320. Please check it against entry IE-7107.

<a id="event-009"></a>
## 2028-05-02 23:32:30 UTC — event 009

- **Stage:** Context
- **Channel:** Email
- **From:** Quillon Ashdown, Glimmerton Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Automatic reply: I am out of the office until Thursday with limited access to email. For urgent matters about collections or bookings, please contact the dispatch desk.

<a id="event-010"></a>
## 2028-05-03 08:45:00 UTC — event 010

- **Stage:** Context
- **Channel:** Email
- **From:** Import billing, Glimmerton Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Checked the entry ledger: nothing posted to IE-7107, balance still £248.40. QCB-6320 doesn't appear on this entry. I haven't searched deferment statements or other entries; that needs a reconciliation request with the broker's statement line.

<a id="event-011"></a>
## 2028-05-03 09:00:00 UTC — event 011

- **Stage:** Context
- **Channel:** Dispatch chat
- **From:** Dispatch, Glimmerton Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-95970 rebooked for Wednesday AM at the customer's request, confirmation sent to them directly. FYI only.

<a id="event-012"></a>
## 2028-05-03 09:15:00 UTC — event 012

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Tamsin Quarrie, customer
- **To:** Iona Quill, Rivet Delivery Desk

My parcel DL-31785 arrived with the box crushed on one corner. Contents look fine though, just letting you know for your records.

<a id="event-013"></a>
## 2028-05-03 09:30:00 UTC — event 013

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Destination depot, Glimmerton Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-8125 still on payment hold, bay H-4. Storage started today. We can't release against a hold, only Import billing lifts it.

<a id="event-014"></a>
## 2028-05-03 11:10:00 UTC — event 014

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Eamon Rowntree, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Depot told me on the phone I can just pay the 248 by card and collect today. Should I do that? I need the inks this week.

<a id="event-015"></a>
## 2028-05-03 11:40:00 UTC — event 015

- **Stage:** Escalation
- **Channel:** Broker portal
- **From:** Marisol Moorcroft, Oxenhale Customs Brokers
- **To:** Iona Quill, Rivet Delivery Desk

Duty on DL-8125 was paid a week ago. I have already sent you the reference. Your carrier is now charging my client storage on goods that are cleared and paid. Release it today and cancel the storage. Statement line: 30/04 DEF QCB-6320 £212.40 PLOVER ARC IMPORT.
