# Case 1389 history — Delivery notification contains an unusable tracking link

All identities, records and communications are fictional. Total events: 6.

<a id="event-001"></a>
## 2027-02-17 07:30:00 UTC — event 001

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Route planning, Dappleford Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Route plan for depot HL-8 published for Tuesday. 20 stops, no exceptions raised. No action needed.

<a id="event-002"></a>
## 2027-02-17 09:00:00 UTC — event 002

- **Stage:** Context
- **Channel:** Email
- **From:** Notification support, Dappleford Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-8707 notification path was truncated by our template. The account-linked notification belongs to this recipient; the shipment reference itself is intact in our order record.

<a id="event-003"></a>
## 2027-02-17 09:02:30 UTC — event 003

- **Stage:** Context
- **Channel:** Email
- **From:** IT service desk, Rivet Delivery Desk
- **To:** Iona Quill, Rivet Delivery Desk

Planned maintenance: the work queue will be read-only on Sunday between 02:00 and 04:00 UTC. Messages sent in that window are queued and delivered afterwards.

<a id="event-004"></a>
## 2027-02-17 09:05:00 UTC — event 004

- **Stage:** Context
- **Channel:** Email
- **From:** Rosalind Underhill, Dappleford Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Automatic reply: I am out of the office until Friday with limited access to email. For urgent matters about collections or bookings, please contact the dispatch desk.

<a id="event-005"></a>
## 2027-02-17 09:07:30 UTC — event 005

- **Stage:** Context
- **Channel:** Email
- **From:** IT service desk, Rivet Delivery Desk
- **To:** Iona Quill, Rivet Delivery Desk

Planned maintenance: the work queue will be read-only on Sunday between 02:00 and 04:00 UTC. Messages sent in that window are queued and delivered afterwards.

<a id="event-006"></a>
## 2027-02-17 09:10:00 UTC — event 006

- **Stage:** Escalation
- **Channel:** Customer portal
- **From:** Ulric Eckersall, recipient
- **To:** Iona Quill, Rivet Delivery Desk

The tracking link in my notification does not open. Please give me the correct way to find this parcel in the order portal.
