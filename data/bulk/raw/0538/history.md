# Case 0538 history — Repaired machine part at the destination depot with an incomplete address on the label

All identities, records and communications are fictional. Total events: 6.

<a id="event-001"></a>
## 2027-04-06 08:05:00 UTC — event 001

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Destination depot, Pebblewick Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-9143, import, shipper Varga Drivetech (repair centre). Arrived this depot 3 Apr. Label reads 'Kestrel Vale Joinery, Millrace Yard'. No unit number and there are 14 units on that yard. No consignee phone on the label. Flagged undeliverable 6 Apr and return to shipper triggered. Parcel is in export-return staging and leaves on the border trunk 8 Apr 05:30.

<a id="event-002"></a>
## 2027-04-06 08:50:00 UTC — event 002

- **Stage:** Context
- **Channel:** Business portal
- **From:** Gideon Gallimore, workshop manager, Kestrel Vale Joinery
- **To:** Iona Quill, Rivet Delivery Desk

Right so I have just looked at the tracking for our spindle drive and I am reading this correctly am I? It went to Varga for warranty repair five weeks ago, we have been limping along on the old machine since, it has come all the way back, it got to your depot which is what, half an hour up the road, and now it is going BACK? Over a unit number? You deliver to us every week. Twice last week. Same driver, he has a brew with us. Did nobody think to look us up? Did nobody ring? There is a phone number on our account. It is Unit 7. Unit 7 Millrace Yard, always has been. Pebblewick Arc account PA-B-4471. Can somebody just stop it.

<a id="event-003"></a>
## 2027-04-06 09:05:00 UTC — event 003

- **Stage:** Agent action
- **Channel:** Depot work queue
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Destination depot, Pebblewick Arc Logistics

Address correction for DL-9143: the consignee states the full address is Unit 7, Millrace Yard, and that it matches their Pebblewick Arc business account PA-B-4471. Please stop the return to shipper and release for delivery, or tell me what you need to do so.

<a id="event-004"></a>
## 2027-04-06 09:06:00 UTC — event 004

- **Stage:** Context
- **Channel:** Depot work queue
- **From:** Depot work queue (automated), Pebblewick Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

This item has been closed automatically. Reason: shipment status is 'Return in progress'. Address corrections are not accepted on this queue for shipments in return. A return hold must be requested from the Recovery team by Email or Dispatch chat before trunk departure. No change has been made to DL-9143.

<a id="event-005"></a>
## 2027-04-06 09:25:00 UTC — event 005

- **Stage:** Context
- **Channel:** Call transcript
- **From:** Gideon Gallimore, workshop manager, Kestrel Vale Joinery
- **To:** Iona Quill, Rivet Delivery Desk

Gideon Gallimore again. I have just had Varga on email. They say if it comes back to them they have to raise a fresh export declaration and it is another three weeks minimum, and they do not know who covers the carriage the second time. Is that right? Can that be right, on a warranty job? We did not write that label. I am not asking for the moon, I just want to know somebody has actually got hold of it.

<a id="event-006"></a>
## 2027-04-06 10:02:00 UTC — event 006

- **Stage:** Escalation
- **Channel:** Business portal
- **From:** Gideon Gallimore, workshop manager, Kestrel Vale Joinery
- **To:** Iona Quill, Rivet Delivery Desk

Tracking still says return in progress. It goes at half five tomorrow morning, does it not? Has it been stopped or has it not? I have told you the unit, I have told you the account. What else does anybody need? Is anyone doing anything?
