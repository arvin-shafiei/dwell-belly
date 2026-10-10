# Case 2286 history — Recipient asks why an inbound international parcel was sent back to the shipper

All identities, records and communications are fictional. Total events: 7.

<a id="event-001"></a>
## 2028-05-01 08:45:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Routing control, Wrenfield Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-6075: status changed 29 April 3:12 at the arrival gateway to 'return to origin'. Reason code field on the status record is blank. Parcel left the gateway outbound 30 April. We have not pulled the gateway desk log.

<a id="event-002"></a>
## 2028-05-02 10:30:00 UTC — event 002

- **Stage:** Context
- **Channel:** Call transcript
- **From:** Parcel trace team, Wrenfield Arc Logistics
- **To:** Delphine Larkham, recipient

Agent: I can see it's gone back. It looks like there was no email address on file for you so the import notice couldn't be sent, and with no response it gets returned. Caller: nobody asked me for one. Agent: I understand. I'll send you an email today confirming that. Caller: thank you.

<a id="event-003"></a>
## 2028-05-03 14:10:00 UTC — event 003

- **Stage:** Context
- **Channel:** Call transcript
- **From:** Destination depot, Wrenfield Arc Logistics
- **To:** Delphine Larkham, recipient

Caller: I was promised an email yesterday and it hasn't come. Agent: I don't see an email queued. From what I can see this was a customs stop at the arrival gateway, that's why it turned round, it's nothing to do with your email address. Caller: that isn't what I was told. Agent: I'll get someone from the gateway side to ring you within two hours.

<a id="event-004"></a>
## 2028-05-04 09:00:00 UTC — event 004

- **Stage:** Context
- **Channel:** Email
- **From:** Import billing, Wrenfield Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-6075: no customs entry and no import charge was ever raised on our side, and we see no hold on the billing record. That does not rule a hold in or out. Gateway holds and return decisions are logged by Routing control's gateway desk, not by us.

<a id="event-005"></a>
## 2028-05-05 11:25:00 UTC — event 005

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Delphine Larkham, recipient
- **To:** Iona Quill, Rivet Delivery Desk

I am writing because I have run out of other routes. DL-6075 was sent back to the shipper on 29 April without any notice to me. On Tuesday I was told it was because there was no email address on file, and that I would have an email confirming that the same day. I did not. On Wednesday a different person told me it was a customs stop at the gateway and nothing to do with email, and that someone would ring me within two hours. Nobody did. I am not angry, I am disappointed. I understand that I am not your customer and that any claim is for Kestrel & Lathe to make, and I will ask them to. But they will ask me why it was returned, and I would like to be able to tell them. Could you please tell me which it was.

<a id="event-006"></a>
## 2028-05-05 11:43:00 UTC — event 006

- **Stage:** Agent action
- **Channel:** Email
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Routing control, Wrenfield Arc Logistics

DL-6075 (inbound, shipper Kestrel & Lathe Instruments, recipient Delphine Larkham): please pull the gateway desk log and tell me the recorded reason for the return to origin set at 06:12 on 29 April. The reason code on the status record is blank. The recipient has been given two different explanations by phone, neither confirmed: on 2 May Parcel trace team said no email address was on file for the import notice; on 3 May Destination depot said it was a customs stop at the arrival gateway and unrelated to email. Import billing see no entry, charge or hold on their side and say that settles nothing. She was promised a confirmation email on 2 May and a callback within two hours on 3 May and received neither. She accepts the claim is for the shipper to make and needs the reason in writing to pass to them. I have told her neither explanation is confirmed.

<a id="event-007"></a>
## 2028-05-05 12:56:00 UTC — event 007

- **Stage:** Escalation
- **Channel:** Email
- **From:** Routing control, Wrenfield Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

FYI only, no action needed from the desk: we have this in hand and will update the customer directly. Nothing further is required from you on this one.
