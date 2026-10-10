# The idea, in plain words

> Full spec: [`../SPEC.md`](../SPEC.md). This page is the short version.

## What it is

An AI control room for delivery companies. It follows every order from checkout to doorstep. When something goes wrong it:

1. **works out what happened** (and notices when the driver's story and the customer's story don't match),
2. **fixes it alone** if the fix can be undone (reschedule, notify, small credit),
3. **hands it to the right person** with a one-tap decision card if the fix is risky,
4. **checks the fix actually worked**,
5. **remembers** everything, so it can group related cases, chase promises, and learn what managers always approve.

You set it up by describing your business in plain English ("pharmacy courier, 40 drivers"). It builds a flowchart, n8n-style, that you can see and edit, and the nodes light up as a case moves through.

## Why it's different

- **Watches the whole journey**, not just complaints, so it catches problems before the customer does.
- **Trusts nobody**: logs who said what, flags clashes, verifies every action.
- **Safety by default**: a risk score from Jev plus thresholds in config decide *do it alone / ask a human / block*.
- **Sees across cases**: 40 complaints about one broken van become one case.
- **Gets more trusted over time**: the Learner suggests widening the agent's freedom based on what humans approve.
- **Cheap enough to run on every order**: fast yes/no/score calls go to Jev; Claude only writes and plans.

> "n8n is the toolbox. We're the ops expert who knows what to build and when to stop."

## How it fits together

```
order updates ──► Watch flow (Event Router → 5 checks) ──► failed check ─┐
customer / driver / carrier messages ──────────────────────────────────┤
                                                                         ▼
Incident flow:  Ingest → History → Triage → Clash → Group → Missing Info
                → Planner → Safety Gate ─┬─ allow ─► Action → Verify ─┐
                                         ├─ ask ───► Human Decision ──┤
                                         └─ block ────────────────────┤
                                                                       ▼
                                       Case Log · Promise Tracker · Learner
```

| Who runs what | Used for |
|---|---|
| **Jev** (TypeSafe) | quick judgements: pick one, score, yes/no with a probability |
| **Claude** | writing and planning: Planner, decision cards, pulling claims out of messages, Architect |
| **Code** | maths, thresholds, routing, logging, actions |
| **OR-Tools** | route replanning |

## What the data and rules tell us

From the 50 public delivery cases ([`data/`](../data/README.md)) and the [hackathon rules](hackathon/README.md):

- **We are the coordination desk, not the carrier.** Every case is an escalation to "Rivet Delivery Desk". The carrier ("Plover Arc Logistics") controls bookings, routes and drivers, and the merchant ("Tallowmere Goods") controls refunds and replacements. Our actions are mostly *asking the right party for the right thing on the right channel*, not changing things directly.
- **The scored skill is choosing the next action.** Each case has a snapshot of events up to escalation (usually 2), and then a recorded next action: who to contact, which channel, what to say. The answer is often a single well-aimed message.
- **Boundaries matter as much as actions.** Cases spell out what *not* to do: don't promise an exact arrival time, don't say a parcel was delivered when it wasn't, don't decide compensation the merchant hasn't, don't ask for entry codes you don't need. The Safety Gate and Planner must respect these.
- **Inputs are messages, not telemetry.** There are 11 channels (email, customer portal, dispatch chat, call transcripts, depot, warehouse, freight and broker queues, safety incident queue, business portal, pickup-point portal) and about 20 kinds of sender. There's no GPS, fleet or ETA data.
- **Case types:** slot changes, address fixes, access problems, missed or failed deliveries, damage (with photos), lost or misdelivered parcels, cold-chain breaches, returns and labels, pallet and freight logistics, customs and import charges, billing disputes.
- **The Reality Test adds harder versions:** conflicting stories, failed actions, missing context, noise and longer histories. Doing nothing or escalating can be correct. Coverage beats brilliance.

**What this changes:**

1. The core incident flow is even more clearly the product. Its output per case is: what we know, what clashes, the next action (recipient + channel + message), what we won't do and why, and whether a human is needed.
2. The **Missing Info** node moves into the core, because "ask the right party first" is the most common correct answer.
3. **Clash Check** stays core (driver vs customer vs tracking).
4. The **Watch flow, Replan Route (OR-Tools) and the fleet/GPS checks have no data**. They're demo extras with a small fake fleet, not something the Reality Test will score.
5. **Practice loop:** run every public delivery case using `?view=escalation`, and compare against `next_action`. This is our eval set.

## Team decisions (morning of 10 Oct)

- **Scoring is on the Reality Test, so most of the team works on the agent's decisions.** The frontend is one person's job.
- **Two views of the same trace:** first a 2D n8n-style node view for replaying the decisions on one order, then a **3D view** (three.js) built in parallel. In 3D the agents are characters ("hamsters") at stations in an office, and parcels move between them, so a business owner can watch their workflow from above. A toggle switches between the two. The design is in [`plans/`](plans/).
- **Don't overfit to the 50 public cases.** Generate our own nasty edge cases (clashing stories, failed tools, missing info, noise) and keep the public ones as a held-out check.
- **Human side:** route cases to the right person (driver ops, support, claims), and keep a full case log from order to delivery to any incident.
- **From the kickoff talk (Anthropic):** build the test suite first, test beyond the happy path, give tools timeouts so the agent knows when they fail, use structured outputs, put a human-in-the-loop hook before irreversible actions, let Claude read images and PDFs directly, and iterate prompts against a fixed set of examples.

## What we build first

The **core incident flow** is what gets scored, so it comes first: Ingest, History Lookup, Triage, Clash Check, Missing Info, Planner, Safety Gate, Human Decision, Action, Verify, Case Log. A starter version lives at [`apps/api/flows/default-incident.json`](../apps/api/flows/default-incident.json). Run it against the 50 public delivery cases as an eval before 16:30.

After that: Group Check, Promise Tracker → extras (watch flow and Replan Route with a fake fleet, Learner, Architect, Self-Test, voice).
