# Case 1431: Broker says import duty was paid while the carrier's ledger shows a balance and storage has started

## Case details

- **Source role:** Dervla Oakshott, Foxhallow Customs Brokers
- **Status:** Escalated — awaiting the desk's decision
- **Created:** 2027-05-03 09:00:00 UTC
- **Escalated:** 2027-05-05 11:40:00 UTC
- **Primary shipment:** DL-4974
- **Coordinator:** Iona Quill, Rivet Delivery Desk
- **Data:** Entirely synthetic; fictional geography; all times UTC

## Context

A set of letterpress inks imported for the recipient is held at the destination depot under a payment hold. The recipient uses a customs broker for the duty.

## Initial request

Duty on DL-4974 was paid a week ago. I have already sent you the reference. Your carrier is now charging my client storage on goods that are cleared and paid. Release it today and cancel the storage. Statement line: 30/04 DEF QCB-9220 £212.40 PLOVER ARC IMPORT.

## Attachments

None.

## History

<a id="event-001"></a>
## 2027-05-03 09:00:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Import billing, Oxenhale Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-4974: import duty and tax of £248.40 outstanding on entry IE-8162. Held at Destination depot under payment hold. Storage of £6.50 per day accrues from 5 May. The hold lifts automatically when the entry balance is nil.

<a id="event-002"></a>
## 2027-05-04 10:15:00 UTC — event 002

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Lorcan Abernathy, recipient
- **To:** Iona Quill, Rivet Delivery Desk

My broker dealt with the duty on this. Why does tracking say awaiting payment

<a id="event-003"></a>
## 2027-05-04 10:22:30 UTC — event 003

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Route planning, Oxenhale Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Route plan for depot WX-2 published for Thursday. 24 stops, no exceptions raised. No action needed.

<a id="event-004"></a>
## 2027-05-04 10:30:00 UTC — event 004

- **Stage:** Agent action
- **Channel:** Broker portal
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Dervla Oakshott, Foxhallow Customs Brokers

Import billing shows £248.40 outstanding on entry IE-8162 for DL-4974. Can you confirm whether payment has been made, and with what reference?

<a id="event-005"></a>
## 2027-05-04 14:02:00 UTC — event 005

- **Stage:** Context
- **Channel:** Broker portal
- **From:** Dervla Oakshott, Foxhallow Customs Brokers
- **To:** Iona Quill, Rivet Delivery Desk

Paid 29 April. £212.40 by deferment account, our ref QCB-9220. That is the assessed amount on our entry copy.

<a id="event-006"></a>
## 2027-05-04 14:11:00 UTC — event 006

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Route planning, Oxenhale Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Route plan for depot BR-6 published for Friday. 37 stops, no exceptions raised. No action needed.

<a id="event-007"></a>
## 2027-05-04 14:20:00 UTC — event 007

- **Stage:** Agent action
- **Channel:** Email
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Import billing, Oxenhale Arc Logistics

The broker for DL-4974 reports a payment of £212.40 on 30 Apr by deferment account, reference QCB-9220. Please check it against entry IE-8162.

<a id="event-008"></a>
## 2027-05-05 08:45:00 UTC — event 008

- **Stage:** Context
- **Channel:** Email
- **From:** Import billing, Oxenhale Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Checked the entry ledger: nothing posted to IE-8162, balance still £248.40. QCB-9220 doesn't appear on this entry. I haven't searched deferment statements or other entries; that needs a reconciliation request with the broker's statement line.

<a id="event-009"></a>
## 2027-05-05 09:00:00 UTC — event 009

- **Stage:** Context
- **Channel:** Email
- **From:** Cosmo Elsworth, Oxenhale Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Automatic reply: I am out of the office until Friday with limited access to email. For urgent matters about collections or bookings, please contact the dispatch desk.

<a id="event-010"></a>
## 2027-05-05 09:15:00 UTC — event 010

- **Stage:** Context
- **Channel:** Email
- **From:** Partner bulletin, Carrier Network Updates
- **To:** Iona Quill, Rivet Delivery Desk

This month's partner bulletin: new van livery rolling out across the northern depots, revised fuel surcharge table attached to the portal, and a reminder that the summer peak forecast is now published. To stop receiving these emails, update your preferences.

<a id="event-011"></a>
## 2027-05-05 09:30:00 UTC — event 011

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Destination depot, Oxenhale Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-4974 still on payment hold, bay H-4. Storage started today. We can't release against a hold, only Import billing lifts it.

<a id="event-012"></a>
## 2027-05-05 10:20:00 UTC — event 012

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Route planning, Oxenhale Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Route plan for depot HL-4 published for Tuesday. 20 stops, no exceptions raised. No action needed.

<a id="event-013"></a>
## 2027-05-05 11:10:00 UTC — event 013

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Lorcan Abernathy, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Depot told me on the phone I can just pay the 248 by card and collect today. Should I do that? I need the inks this week.

<a id="event-014"></a>
## 2027-05-05 11:20:00 UTC — event 014

- **Stage:** Context
- **Channel:** Email
- **From:** IT service desk, Rivet Delivery Desk
- **To:** Iona Quill, Rivet Delivery Desk

Planned maintenance: the work queue will be read-only on Sunday between 02:00 and 04:00 UTC. Messages sent in that window are queued and delivered afterwards.

<a id="event-015"></a>
## 2027-05-05 11:30:00 UTC — event 015

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Route planning, Oxenhale Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Route plan for depot HL-6 published for Monday. 24 stops, no exceptions raised. No action needed.

<a id="event-016"></a>
## 2027-05-05 11:40:00 UTC — event 016

- **Stage:** Escalation
- **Channel:** Broker portal
- **From:** Dervla Oakshott, Foxhallow Customs Brokers
- **To:** Iona Quill, Rivet Delivery Desk

Duty on DL-4974 was paid a week ago. I have already sent you the reference. Your carrier is now charging my client storage on goods that are cleared and paid. Release it today and cancel the storage. Statement line: 30/04 DEF QCB-9220 £212.40 PLOVER ARC IMPORT.
