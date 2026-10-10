# Case 1515 history — A chilled box arrives late with a logger reading and the customer has guests tonight

All identities, records and communications are fictional. Total events: 5.

<a id="event-001"></a>
## 2027-04-21 15:30:00 UTC — event 001

- **Stage:** Context
- **Channel:** Email
- **From:** Marrowby Pantry food-safety intake
- **To:** Iona Quill, Rivet Delivery Desk

BP-4323 / DL-5907: chilled box, smoked trout, soft cheese, two ready meals. Our documented chilled-delivery range for this order is 0–5 °C at handover. Logger BL-61: handover capture 15:12 UTC, 7.8 °C; above 5 °C continuously since 13:40 UTC. That is outside our range. Disposition is for the food-safety lead only. Report to Marrowby Pantry food-safety lead by Email, with the order number and the customer's own statement of what has been opened or eaten.

<a id="event-002"></a>
## 2027-04-21 15:41:00 UTC — event 002

- **Stage:** Context
- **Channel:** Email
- **From:** Refunds team, Marrowby Pantry
- **To:** Iona Quill, Rivet Delivery Desk

FYI we have a refund request form from the customer on BP-4323, timed 15:35. We can't start a refund on a chilled order until food-safety has recorded a disposition. Nothing is approved.

<a id="event-003"></a>
## 2027-04-21 15:58:00 UTC — event 003

- **Stage:** Context
- **Channel:** Customer portal
- **From:** Niamh Elsworth, recipient
- **To:** Iona Quill, Rivet Delivery Desk

Box turned up 2 hours late and the app says 7.8 degrees. Packs still feel cold to the touch tbh. I've got six people coming at 7 and the trout is the starter. Is it safe to eat or not?? It's only a couple of degrees over. Haven't opened anything yet. Either way I want my £46.20 back for the lateness, I've put the form in already.

<a id="event-004"></a>
## 2027-04-21 16:38:00 UTC — event 004

- **Stage:** Agent action
- **Channel:** Email
- **From:** Iona Quill, Rivet Delivery Desk
- **To:** Marrowby Pantry food-safety lead

Please assess BP-4323 / DL-5907 (smoked trout, soft cheese, two ready meals). Logger BL-61 recorded 7.8 °C at handover, 15:12 UTC today, against your documented 0–5 °C range, and was above 5 °C continuously from 13:40 UTC. The customer, Niamh Elsworth, states that nothing has been opened or eaten. She intends to serve the trout to guests at 19:00 today and is asking whether it is safe; I have not advised her either way. Please issue your disposition and contact her before then. She has also filed a refund request for £46.20, which your Refunds team is holding until your disposition is recorded.

<a id="event-005"></a>
## 2027-04-21 17:04:00 UTC — event 005

- **Stage:** Escalation
- **Channel:** Email
- **From:** Marrowby Pantry food-safety lead
- **To:** Iona Quill, Rivet Delivery Desk

FYI only, no action needed from the desk: we have this in hand and will update the customer directly. Nothing further is required from you on this one.
