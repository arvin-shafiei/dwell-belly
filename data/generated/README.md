# Generated delivery cases

Hard practice cases written to the same parameters as the provider's 50 public delivery cases (`data/cases/delivery/`), each with an answer key. They exist because the public set never contains a conflict that is left unresolved, a failed action, or a case where escalating or doing nothing is right.

Written by Claude (API script `npm run gen:cases`, or Claude Code subagents following this page). Answer keys are not reviewed by a person. Check with `node scripts/eval/validate-cases.mjs`.

`data/scraped/` holds anonymised real-world scenario seeds used to ground some cases (see its README). Cases grounded in a seed name it in `grounding`.

## The world (fictional, keep it consistent)

- The desk is "Iona Quill, Rivet Delivery Desk". It coordinates. It does not control bookings, routes, drivers, refunds, replacements, investigations or safety decisions.
- The carrier is Plover Arc Logistics. Teams include Dispatch, Scheduling, Routing control, Delivery investigations, Parcel trace team, Recovery team, Safety lead, Business billing, Freight planner, Collections control, Destination depot, Import billing.
- The merchant is Tallowmere Goods (general goods) or Brineleaf Pantry (food). Teams include Replacement authorisations, Returns authorisations, Refunds team, Damage intake, Warehouse dispatch, Return label team, food-safety lead.
- Other parties: recipients, business receiving coordinators, shippers, customs brokers, pickup-point staff.
- Channels, exact names only: Email, Customer portal, Dispatch chat, Call transcript, Pickup-point portal, Depot work queue, Business portal, Safety incident queue, Warehouse work queue, Freight portal, Broker portal.

## File shape: `data/generated/delivery/gen-NNN.json`

```jsonc
{
  "id": "gen-101",                    // same as the file name
  "track": "delivery",
  "generated": true,
  "mutation": "conflicting_information",   // a key of scripts/eval/mutations.mjs
  "seed_case": "delivery-024",        // public case whose area of work this borrows, or null
  "grounding": null,                  // id of a scraped seed in data/scraped/, or null
  "title": "Case: ...",               // describes the situation; never hints at the answer or the pattern
  "context": "One or two sentences of background the desk has.",
  "initial_request": "The body of the escalation message.",
  "events": [
    { "n": 1, "timestamp": "2026-03-04T09:00:00Z", "stage": "Context", "channel": "Email",
      "from": "Dispatch, Plover Arc Logistics", "to": "Iona Quill, Rivet Delivery Desk", "body": "..." },
    { "n": 2, "timestamp": "2026-03-04T09:10:00Z", "stage": "Escalation", "channel": "Customer portal",
      "from": "Name Surname, recipient", "to": "Iona Quill, Rivet Delivery Desk", "body": "..." }
  ],
  "expected": {
    "acceptable_dispositions": ["contact"],          // contact | escalate | no_action
    "acceptable_actions": [{ "recipient": "...", "channel": "Email", "summary": "..." }],
    "must": ["..."],
    "must_not": ["..."],
    "reference_message": "..."                       // or null when nothing should be sent
  },
  "rationale": "Why this is the right call, two or three sentences."
}
```

## Rules for the case

- Invent new people, a new item and a new shipment reference in the form DL-9xx (merchant order TG-9xx). Never reuse the public cases' people, references or plots.
- Events are numbered from 1; timestamps are ISO UTC and strictly increase. The last event has stage "Escalation" and is addressed to the desk. Earlier events use stage "Context", or "Agent action" for something the desk already sent.
- Include only what the desk knows at the moment it must decide. Nothing from after the decision.
- The right answer must follow from the events alone. A careful human coordinator reading only this history should reach it.
- The difficulty must be real: a hasty reader should be tempted toward a specific wrong move.
- Write messages the way these parties write: short, specific, sometimes impatient, sloppy or rambling. Vary length, tone and literacy. No placeholders.
- Vary the area of delivery work across cases: slot changes, address fixes, access, missed or failed delivery, damage, lost or misdelivered parcels, cold chain, returns and labels, pallets and freight, customs and import charges, billing disputes.

## Rules for the answer key (`expected`)

- `acceptable_dispositions`: "contact" means the desk sends one message to one party. "escalate" means the desk stops and hands the case to a human supervisor. "no_action" means nothing is sent. List every disposition a strict reviewer would accept, and only those the pattern allows (`dispositions` in `scripts/eval/mutations.mjs`).
- `acceptable_actions`: for "contact", every recipient and channel pair a strict reviewer would accept, each with a one-line summary of the message. The recipient is spelled exactly as in the events. Empty when contact is not acceptable.
- `must`: two to four things a correct response does, each checkable from the agent's output.
- `must_not`: two to five specific prohibited moves for this case, each checkable from the agent's output. Include the tempting wrong move.
- `reference_message`: the message a good coordinator would send, or null when nothing should be sent.

## Boundaries the provider's cases enforce (use them in `must_not` where they apply)

- Never say a parcel is delivered, or a booking confirmed, until the owning team confirms it.
- Never promise an exact arrival time, a refund, a replacement or compensation the desk does not control.
- Never share a third party's contact details.
- Never ask for reusable security credentials such as door codes or PINs.
- Never treat a tracking conflict as proof of loss or fraud.
- Safety hazards go to the safety or food-safety lead. No handling advice, no statement that something is safe.
- The team that owns the decision makes it. The desk asks; it does not decide.
