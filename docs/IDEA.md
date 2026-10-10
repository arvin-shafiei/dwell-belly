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

## What we build first

The **core incident flow** is what gets scored, so it comes first: Ingest, History Lookup, Triage, Clash Check, Planner, Safety Gate, Human Decision, Action, Verify, Case Log. A starter version lives at [`apps/api/flows/default-incident.json`](../apps/api/flows/default-incident.json).

After that: Group Check, Replan Route, Promise Tracker, Missing Info → the watch flow → extras (Learner, Architect, Self-Test, voice).
