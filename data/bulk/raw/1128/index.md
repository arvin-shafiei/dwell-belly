# Case 1128: Freight planner needs final receiving details for two tile pallets

## Case details

- **Source role:** Freight planner, Tumblewell Arc Logistics
- **Status:** Escalated — awaiting the desk's decision
- **Created:** 2028-05-05 10:00:00 UTC
- **Escalated:** 2028-05-08 14:20:00 UTC
- **Primary shipment:** DL-4701
- **Coordinator:** Iona Quill, Rivet Delivery Desk
- **Data:** Entirely synthetic; fictional geography; all times UTC

## Context

Two pallets of floor tiles are planned for an appointment-only business consignee. Carrier and consignee must hold the same appointment details; the driver sheet prints at 16:00 UTC.

## Initial request

Driver sheet for DL-4701 prints at 16:00. We still hold HY-3849, 14:00–15:00, Dock 2, main gate Quarry Road. Saw a note on the portal about 12:00. Send the final time, dock, gate and reference, once.

## Attachments

- [photo-evidence-496.txt](attachments/photo-evidence-496.txt)

## History

<a id="event-001"></a>
## 2028-05-05 10:00:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Freight planner, Tumblewell Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-4701, two pallets of floor tiles for Copperhythe Yard Supplies, planned for 2028-05-09 on an 18t curtain-sider with tail-lift. Copperhythe Yard is appointment-only. Their authorised receiving coordinator is Lorcan Drummond; we only accept appointment details or changes that come from her. Driver sheet prints 16:00 UTC the working day before.

<a id="event-002"></a>
## 2028-05-05 10:20:00 UTC — event 002

- **Stage:** Agent action
- **Channel:** Business portal
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Lorcan Drummond, Copperhythe Yard receiving coordinator

Please offer a receiving appointment for DL-4701, two pallets of floor tiles, on 2028-05-09, with the reference, dock and entrance for the driver. The vehicle is an 18t curtain-sider with tail-lift.

<a id="event-003"></a>
## 2028-05-05 11:45:00 UTC — event 003

- **Stage:** Context
- **Channel:** Business portal
- **From:** Lorcan Drummond, Copperhythe Yard receiving coordinator
- **To:** Iona Quill, Rivet Delivery Desk

Booked: HY-3849, Tuesday 2028-05-09, 14:00–15:00, Dock 2, main gate on Quarry Road.

<a id="event-004"></a>
## 2028-05-05 11:52:00 UTC — event 004

- **Stage:** Agent action
- **Channel:** Freight portal
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Freight planner, Tumblewell Arc Logistics

Copperhythe Yard appointment for DL-4701 from Lorcan Drummond: HY-3849, 2028-05-09, 14:00–15:00, Dock 2, main gate on Quarry Road. Please confirm you accept.

<a id="event-005"></a>
## 2028-05-05 13:10:00 UTC — event 005

- **Stage:** Context
- **Channel:** Freight portal
- **From:** Freight planner, Tumblewell Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Accepted: HY-3849, 2028-05-09 14:00–15:00, Dock 2, main gate Quarry Road. On the plan.

<a id="event-006"></a>
## 2028-05-08 09:30:00 UTC — event 006

- **Stage:** Context
- **Channel:** Business portal
- **From:** Lorcan Drummond, Copperhythe Yard receiving coordinator
- **To:** Iona Quill, Rivet Delivery Desk

Change for HY-3849 tomorrow. Dock 2 is out, racking contractors have it all day. I've moved you to Dock 6. Dock 6 can't be reached from the main gate, the driver has to use Gate B on Foundry Lane. Same reference. Nothing else changes.

<a id="event-007"></a>
## 2028-05-08 11:15:00 UTC — event 007

- **Stage:** Context
- **Channel:** Freight portal
- **From:** Juno Brackley, Copperhythe Yard goods-in operative
- **To:** Iona Quill, Rivet Delivery Desk

re the tile pallets tmrw, tell your driver come for 12 not 2, were dead at dinner time and itll get tipped quicker. just pull up at dock 6 and give us a shout

<a id="event-008"></a>
## 2028-05-08 14:20:00 UTC — event 008

- **Stage:** Escalation
- **Channel:** Freight portal
- **From:** Freight planner, Tumblewell Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Driver sheet for DL-4701 prints at 16:00. We still hold HY-3849, 14:00–15:00, Dock 2, main gate Quarry Road. Saw a note on the portal about 12:00. Send the final time, dock, gate and reference, once.

I've attached the photo as photo-evidence-496.txt.
