# Case 1470 history — Customer plans to drop off a return for a kettle and toaster order

All identities, records and communications are fictional. Total events: 14.

<a id="event-001"></a>
## 2027-05-04 07:30:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** IT service desk, Rivet Delivery Desk
- **To:** Iona Quill, Rivet Delivery Desk

Planned maintenance: the work queue will be read-only on Sunday between 02:00 and 04:00 UTC. Messages sent in that window are queued and delivered afterwards.

<a id="event-002"></a>
## 2027-05-04 09:00:00 UTC — event 002

- **Stage:** Context
- **Channel:** Email
- **From:** Returns authorisations, Wrenfield Goods
- **To:** Iona Quill, Rivet Delivery Desk

Return RTN-7197 authorised for TG-4318, both lines: kettle (line 1) and four-slice toaster (line 2), reason 'changed mind', inside the 30-day window. Return label team will issue one label for one carton. Refunds team refunds per line on the returns warehouse's receipt scan, not before.

<a id="event-003"></a>
## 2027-05-04 09:06:40 UTC — event 003

- **Stage:** Context
- **Channel:** Email
- **From:** Jory Cresswell, Carrier operations
- **To:** Iona Quill, Rivet Delivery Desk

Thanks,
Jory
--
Sent from my phone. This email and any attachments are confidential and intended solely for the addressee.

<a id="event-004"></a>
## 2027-05-04 09:13:20 UTC — event 004

- **Stage:** Context
- **Channel:** Email
- **From:** IT service desk, Rivet Delivery Desk
- **To:** Iona Quill, Rivet Delivery Desk

Planned maintenance: the work queue will be read-only on Sunday between 02:00 and 04:00 UTC. Messages sent in that window are queued and delivered afterwards.

<a id="event-005"></a>
## 2027-05-04 09:20:00 UTC — event 005

- **Stage:** Context
- **Channel:** Email
- **From:** Return label team, Wrenfield Goods
- **To:** Iona Quill, Rivet Delivery Desk

Label issued for RTN-7197 and emailed to the customer. One carton, both items. Valid 14 days. Return shipment reference DL-6712.

<a id="event-006"></a>
## 2027-05-04 09:23:40 UTC — event 006

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Dervla Cresswell, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Hi, any update on DL-27055? It was meant to come Thursday. Thanks.

<a id="event-007"></a>
## 2027-05-04 09:27:20 UTC — event 007

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Marisol Gallimore, customer
- **To:** Iona Quill, Rivet Delivery Desk

My parcel DL-29232 arrived with the box crushed on one corner. Contents look fine though, just letting you know for your records.

<a id="event-008"></a>
## 2027-05-04 09:31:00 UTC — event 008

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Niamh Fortescue, customer
- **To:** Iona Quill, Rivet Delivery Desk

got the label thanks. Dropping both off at the weekend.

<a id="event-009"></a>
## 2027-05-05 19:12:00 UTC — event 009

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Niamh Fortescue, customer
- **To:** Iona Quill, Rivet Delivery Desk

Had a rethink. Forget the return, I'll keep them.

<a id="event-010"></a>
## 2027-05-05 19:40:00 UTC — event 010

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Niamh Fortescue, customer
- **To:** Iona Quill, Rivet Delivery Desk

Sorry ignore that last one, typed it too fast. I mean I'm keeping the KETTLE (mum's has just died so she's having this one). Toaster is still going back, it's too wide for the shelf. So just the toaster in the box.

<a id="event-011"></a>
## 2027-05-06 08:10:00 UTC — event 011

- **Stage:** Agent action
- **Channel:** Customer portal
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Niamh Fortescue, customer

To check I have this right: you are keeping the kettle and returning only the toaster? Please don't hand the carton over until Wrenfield confirms the return has been changed to match.

<a id="event-012"></a>
## 2027-05-06 08:30:00 UTC — event 012

- **Stage:** Context
- **Channel:** Email
- **From:** Returns authorisations, Wrenfield Goods
- **To:** Iona Quill, Rivet Delivery Desk

Morning. Our portal log shows the customer opened and abandoned a 'cancel return' form on RTN-7197 last night. Nothing was submitted, so RTN-7197 stands as authorised, both lines. Tell us if anything needs changing; amendments have to reach us before the carton gets its first carrier scan.

<a id="event-013"></a>
## 2027-05-06 08:50:00 UTC — event 013

- **Stage:** Context
- **Channel:** Email
- **From:** Refunds team, Wrenfield Goods
- **To:** Iona Quill, Rivet Delivery Desk

For information on TG-4318: the refund is calculated on what the returns warehouse scans in against the authorised lines. A carton that does not match the authorisation goes to the manual discrepancy queue, typically 10 or more working days.

<a id="event-014"></a>
## 2027-05-06 12:15:00 UTC — event 014

- **Stage:** Escalation
- **Channel:** Customer portal
- **From:** Niamh Fortescue, customer
- **To:** Iona Quill, Rivet Delivery Desk

Yes. Kettle stays, toaster goes back. Was going to drop it at the parcel shop after work, about half 5. Will wait if I have to but is the same label ok?

I've attached the photo as photo-evidence-767.txt.
