# Case 2263 history — Bookcase for a flat in a newly opened block has failed delivery twice

All identities, records and communications are fictional. Total events: 13.

<a id="event-001"></a>
## 2028-06-02 16:20:00 UTC — event 001

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Ulric Dunmore, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Hi, my bookcase (TG-4971) is showing 'address not found'. The address is right, it's just new: Larch Wharf House only opened in April and half the databases don't have it yet, which I admit is confusing. It's the grey block behind the old ferry office on Cinder Quay, entrance on the canal side, and there's a staffed reception 8 to 6 that takes parcels. Could that be passed to the driver for the next try?

<a id="event-002"></a>
## 2028-06-02 16:45:00 UTC — event 002

- **Stage:** Agent action
- **Channel:** Email
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Routing control, Yarrowdale Arc Logistics

DL-5945 failed today as 'address not found'. The recipient confirms Flat 12, Larch Wharf House, Cinder Quay is correct; the block opened in April. Directions from her: grey block behind the old ferry office, canal-side entrance, staffed reception 08:00 to 18:00 accepts parcels. Please add these for the reattempt and confirm the date.

<a id="event-003"></a>
## 2028-06-03 09:10:00 UTC — event 003

- **Stage:** Context
- **Channel:** Email
- **From:** Routing control, Yarrowdale Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-5945: address does not validate in our lookup. Reattempt booked 06-08. Free-text directions noted on the case.

<a id="event-004"></a>
## 2028-06-05 14:32:00 UTC — event 004

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Ulric Dunmore, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Second try just failed. The driver rang me from the quay, I gave him the same directions, and he said his device won't let him complete without a valid address, and that was that. To be fair to him it isn't on his map. Other carriers do manage to find us though. Please can it be tried once more with the directions actually where the driver can see them?

<a id="event-005"></a>
## 2028-06-05 14:50:00 UTC — event 005

- **Stage:** Agent action
- **Channel:** Email
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Routing control, Yarrowdale Arc Logistics

DL-5945 failed a second time today. The driver phoned the recipient and had her directions verbally but could not complete at an address his device does not recognise. She asks for a third attempt with the directions visible to the driver. Is that possible?

<a id="event-006"></a>
## 2028-06-06 08:05:00 UTC — event 006

- **Stage:** Context
- **Channel:** Email
- **From:** Routing control, Yarrowdale Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-5945 was booked back to sender automatically after the second failed attempt and left the depot last night. No third attempt is possible on this consignment. For your information the directions were on the case notes, which do not print to the driver handheld. A new dispatch has to come from Emberlee. Getting Larch Wharf House into our lookup is logged as a separate request with no date.

<a id="event-007"></a>
## 2028-06-06 08:30:00 UTC — event 007

- **Stage:** Agent action
- **Channel:** Warehouse work queue
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Warehouse dispatch, Emberlee Goods

TG-4971 / DL-5945 is on its way back to you after two failed attempts. The customer's address is correct but the block is new and is not in Yarrowdale Arc's address lookup. She still wants the bookcase. Can you re-dispatch, and what do you need from her?

<a id="event-008"></a>
## 2028-06-06 08:40:00 UTC — event 008

- **Stage:** Agent action
- **Channel:** Customer portal
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Ulric Dunmore, recipient

I'm sorry, this is not the answer you were hoping for. Routing control tell me DL-5945 was sent back to Emberlee automatically after the second attempt, so a third try on this consignment isn't possible. Your directions were recorded but in a place the driver's device doesn't show, which is why he didn't have them. I've asked Emberlee's warehouse whether they can send it out again. I can't promise that or a date; they decide.

<a id="event-009"></a>
## 2028-06-06 11:40:00 UTC — event 009

- **Stage:** Context
- **Channel:** Warehouse work queue
- **From:** Warehouse dispatch, Emberlee Goods
- **To:** Iona Quill, Rivet Delivery Desk

TG-4971 is due back in to us on 06-11. We can re-dispatch once it's scanned in, same carrier. We'll send it wherever the customer wants but we need that confirmed before it's back on our dock, and tell her we'd rather not send it to the same address a third time unless Yarrowdale Arc say it will validate. Let us know what she wants.

<a id="event-010"></a>
## 2028-06-06 12:05:00 UTC — event 010

- **Stage:** Agent action
- **Channel:** Customer portal
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Ulric Dunmore, recipient

Emberlee's warehouse expect the bookcase back on 06-11 and can send it out again after that. They need to know where you want it sent before then. They have said they are wary of the flat address a third time, and Yarrowdale Arc have given no date for adding Larch Wharf House to their lookup. Where would you like it to go?

<a id="event-011"></a>
## 2028-06-06 12:22:30 UTC — event 011

- **Stage:** Context
- **Channel:** Email
- **From:** Greer Corrigan, sender not on record
- **To:** Iona Quill, Rivet Delivery Desk

Hello, I'm not on the order but I live nearby. Just so you know, DL-5945 has already been sorted out by the merchant and nobody needs to do anything else.

<a id="event-012"></a>
## 2028-06-06 12:40:00 UTC — event 012

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Ulric Dunmore, recipient
- **To:** Iona Quill, Rivet Delivery Desk

OK, thanks. Same address please, Flat 12, and ask them to print 'canal-side entrance, reception takes parcels' on the label itself this time. Third time lucky?

<a id="event-013"></a>
## 2028-06-06 17:55:00 UTC — event 013

- **Stage:** Escalation
- **Channel:** Customer portal
- **From:** Ulric Dunmore, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Sorry, scrap my last message. I've thought about it and I don't trust the flat address until your carrier's system actually has it, and I can't lose another fortnight on this. Please ask Emberlee to send it to the Yarrowdale Arc pickup point at Hallam Street News instead. It's two minutes from my office and I've collected from there before. I'll get it home myself. Not the flat.
