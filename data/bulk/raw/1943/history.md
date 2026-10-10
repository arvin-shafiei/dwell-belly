# Case 1943 history — Recipient asks why an inbound international parcel was sent back to the shipper

All identities, records and communications are fictional. Total events: 6.

<a id="event-001"></a>
## 2028-05-01 08:45:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Routing control, Wrenfield Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-2474: status changed 29 April 3:12 at the arrival gateway to 'return to origin'. Reason code field on the status record is blank. Parcel left the gateway outbound 30 April. We have not pulled the gateway desk log.

<a id="event-002"></a>
## 2028-05-02 10:30:00 UTC — event 002

- **Stage:** Context
- **Channel:** Call transcript
- **From:** Parcel trace team, Wrenfield Arc Logistics
- **To:** Verity Pilkington, recipient

Agent: I can see it's gone back. It looks like there was no email address on file for you so the import notice couldn't be sent, and with no response it gets returned. Caller: nobody asked me for one. Agent: I understand. I'll send you an email today confirming that. Caller: thank you.

<a id="event-003"></a>
## 2028-05-03 00:20:00 UTC — event 003

- **Stage:** Context
- **Channel:** Email
- **From:** Isolde Gallimore, sender not on record
- **To:** Iona Quill, Rivet Delivery Desk

Hello, I'm not on the order but I live nearby. Just so you know, the driver told me DL-2474 was handed to someone at the door, so it's been delivered.

<a id="event-004"></a>
## 2028-05-03 14:10:00 UTC — event 004

- **Stage:** Context
- **Channel:** Call transcript
- **From:** Destination depot, Wrenfield Arc Logistics
- **To:** Verity Pilkington, recipient

Caller: I was promised an email yesterday and it hasn't come. Agent: I don't see an email queued. From what I can see this was a customs stop at the arrival gateway, that's why it turned round, it's nothing to do with your email address. Caller: that isn't what I was told. Agent: I'll get someone from the gateway side to ring you within two hours.

<a id="event-005"></a>
## 2028-05-04 09:00:00 UTC — event 005

- **Stage:** Context
- **Channel:** Email
- **From:** Import billing, Wrenfield Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-2474: no customs entry and no import charge was ever raised on our side, and we see no hold on the billing record. That does not rule a hold in or out. Gateway holds and return decisions are logged by Routing control's gateway desk, not by us.

<a id="event-006"></a>
## 2028-05-05 11:25:00 UTC — event 006

- **Stage:** Escalation
- **Channel:** Customer portal
- **From:** Verity Pilkington, recipient
- **To:** Iona Quill, Rivet Delivery Desk

I am writing because I have run out of other routes. DL-2474 was sent back to the shipper on 29 April without any notice to me. On Tuesday I was told it was because there was no email address on file, and that I would have an email confirming that the same day. I did not. On Wednesday a different person told me it was a customs stop at the gateway and nothing to do with email, and that someone would ring me within two hours. Nobody did. I am not angry, I am disappointed. I understand that I am not your customer and that any claim is for Kestrel & Lathe to make, and I will ask them to. But they will ask me why it was returned, and I would like to be able to tell them. Could you please tell me which it was.
