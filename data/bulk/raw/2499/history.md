# Case 2499 history — Customer plans to drop off a return for a kettle and toaster order

All identities, records and communications are fictional. Total events: 9.

<a id="event-001"></a>
## 2027-05-04 09:00:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Returns authorisations, Emberlee Goods
- **To:** Iona Quill, Rivet Delivery Desk

Return RTN-3632 authorised for TG-3315, both lines: kettle (line 1) and four-slice toaster (line 2), reason 'changed mind', inside the 30-day window. Return label team will issue one label for one carton. Refunds team refunds per line on the returns warehouse's receipt scan, not before.

<a id="event-002"></a>
## 2027-05-04 09:20:00 UTC — event 002

- **Stage:** Context
- **Channel:** Email
- **From:** Return label team, Emberlee Goods
- **To:** Iona Quill, Rivet Delivery Desk

Label issued for RTN-3632 and emailed to the customer. One carton, both items. Valid 14 days. Return shipment reference DL-9541.

<a id="event-003"></a>
## 2027-05-04 09:31:00 UTC — event 003

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Cosmo Elsworth, customer
- **To:** Iona Quill, Rivet Delivery Desk

got the label thanks. Dropping both off at the weekend.

<a id="event-004"></a>
## 2027-05-05 19:12:00 UTC — event 004

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Cosmo Elsworth, customer
- **To:** Iona Quill, Rivet Delivery Desk

Had a rethink. Forget the return, I'll keep them.

<a id="event-005"></a>
## 2027-05-05 19:40:00 UTC — event 005

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Cosmo Elsworth, customer
- **To:** Iona Quill, Rivet Delivery Desk

Sorry ignore that last one, typed it too fast. I mean I'm keeping the KETTLE (mum's has just died so she's having this one). Toaster is still going back, it's too wide for the shelf. So just the toaster in the box.

<a id="event-006"></a>
## 2027-05-06 08:10:00 UTC — event 006

- **Stage:** Agent action
- **Channel:** Customer portal
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Cosmo Elsworth, customer

To check I have this right: you are keeping the kettle and returning only the toaster? Please don't hand the carton over until Emberlee confirms the return has been changed to match.

<a id="event-007"></a>
## 2027-05-06 08:30:00 UTC — event 007

- **Stage:** Context
- **Channel:** Email
- **From:** Returns authorisations, Emberlee Goods
- **To:** Iona Quill, Rivet Delivery Desk

Morning. Our portal log shows the customer opened and abandoned a 'cancel return' form on RTN-3632 last night. Nothing was submitted, so RTN-3632 stands as authorised, both lines. Tell us if anything needs changing; amendments have to reach us before the carton gets its first carrier scan.

<a id="event-008"></a>
## 2027-05-06 08:50:00 UTC — event 008

- **Stage:** Context
- **Channel:** Email
- **From:** Refunds team, Emberlee Goods
- **To:** Iona Quill, Rivet Delivery Desk

For information on TG-3315: the refund is calculated on what the returns warehouse scans in against the authorised lines. A carton that does not match the authorisation goes to the manual discrepancy queue, typically 10 or more working days.

<a id="event-009"></a>
## 2027-05-06 12:15:00 UTC — event 009

- **Stage:** Escalation
- **Channel:** Customer portal
- **From:** Cosmo Elsworth, customer
- **To:** Iona Quill, Rivet Delivery Desk

Yes. Kettle stays, toaster goes back. Was going to drop it at the parcel shop after work, about half 5. Will wait if I have to but is the same label ok?

If this is not sorted by Friday I am instructing my solicitor and reporting you to Trading Standards.
