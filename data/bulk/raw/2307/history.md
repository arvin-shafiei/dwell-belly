# Case 2307 history — A tractor moved by a subcontracted haulier was offloaded at a services yard and shows as delivered

All identities, records and communications are fictional. Total events: 6.

<a id="event-001"></a>
## 2027-05-10 16:10:00 UTC — event 001

- **Stage:** Context
- **Channel:** Freight portal
- **From:** Freight planner, Calloway Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

DL-7927: one compact tractor, self-propelled. Collected running 10 May 14:40 at Harl Bridge by our subcontract haulier. Deliver to Stonewick Farm, Aldery, same owner. ETA 21:00.

<a id="event-002"></a>
## 2027-05-11 02:05:00 UTC — event 002

- **Stage:** Context
- **Channel:** Freight portal
- **From:** Freight planner, Calloway Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Automated status. DL-7927: Delivered. POD signed 01:48, G. Larkham. Drop location recorded: Carrow Cross services yard. Job closed.

Label scan attached for reference: label-scan-780.txt

<a id="event-003"></a>
## 2027-05-11 08:30:00 UTC — event 003

- **Stage:** Context
- **Channel:** Email
- **From:** Juno Larkham, shipper
- **To:** Iona Quill, Rivet Delivery Desk

Your driver rang me at 11 at night to say he was stopping at Carrow Cross and I'd have to come to him. That's 140 km from my farm. Tractor wouldn't start coming off the bed. It drove on fine at Harl Bridge, I've a video of that. He couldn't tell me what had happened to it. I signed his sheet because he wouldn't unstrap it otherwise. Got a recovery truck out at 2 am. It's at Pellow's garage in Aldery now.

<a id="event-004"></a>
## 2027-05-11 09:15:00 UTC — event 004

- **Stage:** Agent action
- **Channel:** Freight portal
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Freight planner, Calloway Arc Logistics

The shipper reports DL-7927 was offloaded at Carrow Cross, not the consignment address, and would not run when offloaded. Can you confirm the drop location and what the haulier has reported?

<a id="event-005"></a>
## 2027-05-11 11:40:00 UTC — event 005

- **Stage:** Context
- **Channel:** Freight portal
- **From:** Freight planner, Calloway Arc Logistics
- **To:** Iona Quill, Rivet Delivery Desk

Haulier confirms the drop at Carrow Cross and says the driver ran out of hours. Nothing from them about the engine. The POD is signed by the consignee, so the system closed the job, and I can't reopen a closed job from planning. I've never had one dropped at the wrong place and signed for. I don't know whose this is; there's no claims route on a closed freight job that I can find. Can you just confirm with the shipper so I can leave it closed?

<a id="event-006"></a>
## 2027-05-11 13:20:00 UTC — event 006

- **Stage:** Escalation
- **Channel:** Email
- **From:** Juno Larkham, shipper
- **To:** Iona Quill, Rivet Delivery Desk

Portal says delivered. It isn't. It's in a garage I'm paying for by the day, not running, after I paid a recovery firm in the middle of the night to do your job. Reopen it. Then tell me who pays for the recovery, the storage and the repair.
