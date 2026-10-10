# Case 0073 history — Broker sends a corrected value for an import shipment on hold

All identities, records and communications are fictional. Total events: 4.

<a id="event-001"></a>
## 2027-04-14 06:50:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Oswin Elsworth, sender not on record
- **To:** Iona Quill, Rivet Delivery Desk

Hello, I'm not on the order but I live nearby. Just so you know, DL-9444 has already been sorted out by the merchant and nobody needs to do anything else.

<a id="event-002"></a>
## 2027-04-14 08:20:00 UTC — event 002

- **Stage:** Context
- **Channel:** Email
- **From:** Import billing, Fallowmere Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-9444 is on hold at import. The duty calculation was run on the broker's first entry, declared value EUR 2,140. The broker now says that value was wrong. We cannot rerun until we hold the broker's amended entry summary. To be clear: we do not take a corrected figure by phone or from the body of a message. It has to be the document.

Label scan attached for reference: label-scan-825.txt

<a id="event-003"></a>
## 2027-04-14 09:45:00 UTC — event 003

- **Stage:** Context
- **Channel:** Broker portal
- **From:** Sorrel Corrigan, Calloway Wharf Customs broker
- **To:** Iona Quill, Rivet Delivery Desk

DL-9444: the value was keyed with freight included, it should be lower. We'll have the amended entry to you this afternoon.

<a id="event-004"></a>
## 2027-04-14 14:38:00 UTC — event 004

- **Stage:** Escalation
- **Channel:** Broker portal
- **From:** Sorrel Corrigan, Calloway Wharf Customs broker
- **To:** Iona Quill, Rivet Delivery Desk

Amended entry summary for DL-9444 attached. Corrected value EUR 1,870. Please pass to Import billing straight away so they rerun the charge and release it, the consignee is chasing us hourly.

[Broker portal: this message has 0 files attached]
