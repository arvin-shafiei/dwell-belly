# Delivery Ops Agent: Idea Spec Sheet

**Event:** Real-World Agents Hackathon, Saturday 10 October 2026
**Track:** Delivery & Logistics
**Project name:** TBD

---

## 1. One-liner

An AI control room for delivery companies. It watches every order from checkout to doorstep, fixes problems itself when it's safe, hands the risky ones to the right person with everything they need, and earns more trust over time. You set it up for any delivery business just by describing it, and it shows up as an n8n-style flowchart.

---

## 2. The problem

- Delivery ops still runs on calls, emails, driver messages, tickets and gut feel
- Stories clash all the time (driver says delivered, customer says nothing came)
- Escalations land in a shared inbox, nobody owns them, and they go stale
- Humans re-read 4 systems to understand one case, then fix it by hand in another tool, so nothing learns
- One root cause (a broken van) turns into 40 separate tickets
- Promises ("we'll call you back tomorrow") get made and forgotten
- Most problems are only handled after the customer complains

---

## 3. The edge

**vs other teams:** most will build "triage → act → escalate" on complaints only. We:

- Watch the whole order journey, not just complaints, and catch problems before the customer does
- Don't trust anyone: log who said what, spot clashes, double-check every action actually worked
- Only do undoable stuff alone; risky stuff goes to the right human with a one-tap decision card
- Group related cases (40 complaints = 1 broken van)
- Track every promise and chase it before it's late
- Learn from what managers approve and take on more over time
- Show cost per case with real numbers

**vs "why not just use n8n":**

- n8n gives you empty boxes. You still have to design the flow, write prompts, decide when to stop, and test it
- We build the flow from a description of the business
- Safety is built in by default (clash check, safety gate, human decision, verify)
- We see across cases (grouping, promises over days). n8n runs each trigger alone
- We learn from human decisions. n8n flows stay the same until someone edits them
- We test new flows with nasty cases before go-live
- Line for the demo: **"n8n is the toolbox. We're the ops expert who knows what to build and when to stop."**
- Possible future feature: export flows to n8n

**Honest note:** exception-handling agents for logistics already exist (project44, Swiftask, Lyzr, agencies like RaftLabs). The combo above is what's fresh, not the category.

---

## 4. How it works

Two flows plus builder tools.

- **Watch flow:** runs on every order update. Most checks pass and just get logged. A failed check opens a case
- **Incident flow:** runs when something's off (failed check, customer message, driver message, carrier update)
- **Builder tools:** Architect builds flows from a description; Self-Test throws nasty cases at a new flow

Each flow is stored as JSON/YAML. The runtime runs it. The UI renders and edits it, and lights up nodes as a case moves through.

---

## 5. Full node list (21 node types)

### A. Watch flow (every order update)

| # | Node | Runs on | What it does |
|---|------|---------|--------------|
| 1 | Event Router | code | Takes every update (order placed, address changed, loaded, departed, GPS ping, ETA changed, attempted, delivered) and sends it to the right check |
| 2 | Order Check | Jev | Address complete, time slot realistic, special notes (gate code, fragile, cold) |
| 3 | Load Check | code + Jev | Right van, van has space, cold items in a cold van |
| 4 | On-Route Check | code + Jev | Code works out ETA, Jev judges if the driver is late or later drops will miss their slot |
| 5 | Proof Check | Jev | Photo, GPS and driver note match the address |
| 6 | Aftercare Check | Jev | Any open complaint, claim or promise still hanging |

### B. Incident flow

**Intake**

| # | Node | Runs on | What it does |
|---|------|---------|--------------|
| 7 | Ingest | code + Claude | Customer calls/emails, driver voice notes, tickets, carrier updates, failed checks |
| 8 | History Lookup | code | Full story of that delivery and customer |

**Understand**

| # | Node | Runs on | What it does |
|---|------|---------|--------------|
| 9 | Triage | Jev | Case type (late, missing, damaged, address...) and urgency |
| 10 | Clash Check | Claude + Jev | Claude pulls out who said what, Jev scores if stories conflict |
| 11 | Group Check | Jev | Linked to other open cases (e.g. one broken van) |
| 12 | Missing Info | Jev | Enough to act, or ask customer/driver first |

**Decide**

| # | Node | Runs on | What it does |
|---|------|---------|--------------|
| 13 | Planner | Claude | Suggests what to do |
| 14 | Safety Gate | Jev + code | Jev scores risk, code thresholds decide: do it alone / ask a human / block |
| 15 | Human Decision | Claude + code | Writes the decision card, routes to the right person, sets a deadline and fallback |

**Act**

| # | Node | Runs on | What it does |
|---|------|---------|--------------|
| 16 | Action | code | Reschedule, redeliver, refund/credit, notify, contact driver/carrier, open claim, fix address |
| 17 | Replan Route | OR-Tools | Moves drops across vans with space and driver hours left |
| 18 | Verify | Jev | Did it actually work? If not: retry, try another way, or escalate |

**Remember**

| # | Node | Runs on | What it does |
|---|------|---------|--------------|
| 19 | Case Log | code | Every step, cost and timing; writes ANSWER.md and REASONING.md |
| 20 | Promise Tracker | Claude + Jev | Logs every promise made and chases it before it's late |
| 21 | Learner | code | Watches manager decisions, suggests giving the agent more freedom |

### C. Builder tools (outside the flow)

- **Architect** (Claude): builds a flow from a plain-English description of the business. Only arranges and configures existing node types, never writes new node code. Every generated flow gets schema-checked and dry-run before it's accepted
- **Self-Test** (Claude + code): generates nasty cases (clashing stories, missing order IDs, failed tools, out-of-policy demands) and runs them through a flow

**Model split:** Jev on ~12 nodes, Claude on ~7, code on the rest.

---

## 6. Human side

- **Routing:** damaged item → claims, driver issue → depot manager, urgent medical drop → on-call lead
- **Decision card:** short summary, the clash found, what was tried, 2–3 ready options (e.g. refund £20 / redeliver tomorrow / investigate), and the one fact that would settle it ("what would change my mind")
- **Human decides, agent acts:** they tap an option, the agent carries it out
- **Deadline + fallback:** if no answer in X mins, goes to the next person up or does the safe undoable option
- **Learner:** if managers always approve the same kind of case (e.g. late parcel, under £15, first complaint), it suggests letting the agent handle those alone. Show the threshold sliding in the flowchart
- **Optional voice:** for urgent cases, agent calls the on-call manager, reads the summary, they say "approve redelivery". Driver voice notes turn into case updates

**During the Reality Test:** no humans will answer, so the human node writes the decision card, marks the case escalated, and logs the safe fallback it would take.

---

## 7. Models and cost

- **Jev (TypeSafe AI):** fast decisions only: pick one, score, yes/no with a probability. Can't write, code, reason in multiple steps or do maths. Keep each call focused (unrelated info lowers accuracy)
- **Claude:** anything that writes or plans: Architect, Planner, decision cards, pulling claims out of messages
- **Code:** maths, thresholds, routing, logging, actions
- **OR-Tools:** route replanning. We don't build an optimiser

**Thresholds live in config, not prompts.** e.g. below 0.3 allow, 0.3–0.8 send to human, 0.8+ block. Changing risk tolerance = changing a number.

**Cost story (prove it, don't just claim it):**

- Log cost and time of every call in each case's history
- Show cost per case in the flowchart and README
- Example maths at Jev's published price ($42 per billion input tokens, output free): 10k deliveries/day × ~20 checks × ~2k tokens ≈ 400M tokens/day ≈ **~$17/day**
- Run the same checks through Claude once and show that number next to it
- Pitch: cheap enough to check every order at every step, 24/7, which isn't practical with a big LLM

Note: Jev's speed/cost claims mostly come from TypeSafe's own tests; outside reports (e.g. Vercel) are positive but early.

---

## 8. Case history

Full history per delivery, from order placed to after delivery: every message, check, decision, action, cost and timing.

It's the system's memory, not just a log. It powers:

- spotting repeat issues and repeat claimants
- grouping related cases
- chasing promises
- learning from past human decisions
- the ANSWER and REASONING files for submission

---

## 9. Demo plan (60 seconds)

- **0–15s:** type a business ("pharmacy courier, 40 drivers"), flowchart appears
- **15–40s:** a van breaks down. 40 complaints get grouped into one case, a clash is caught, drops get reassigned, customers told, refund gated, manager gets one decision card. Nodes light up as it runs
- **40–55s:** type a different business (frozen food), a different flowchart appears
- **55–60s:** cost per case and the one-liner

---

## 10. Reality Test plan

- One hardened default Delivery & Logistics flow runs the unseen cases. This is what gets scored, not the Architect
- Batch run, fully on its own, fast. Must never stop mid-run; one bad case can't crash the rest
- ANSWER.md and REASONING.md written straight from traces. Never hand-edited
- Optional: after the run, Architect groups failures and proposes a patch. Logged only, shown as before/after in the demo. No changes to results after 17:00

---

## 11. Submission checklist

- [ ] Public repo
- [ ] Apache 2.0 LICENSE file
- [ ] README: what, problem, architecture, how to run, models/APIs used, assumptions, limitations, what's next
- [ ] No API keys or secrets committed
- [ ] ANSWERS/<n>/ANSWER.md + REASONING.md for every Reality Test case, plus logs/traces
- [ ] 60s demo video inside the repo (Git LFS if needed)
- [ ] LinkedIn post + X post linking the repo
- [ ] SUBMISSION.md with post links, team, track
- [ ] Commit hash at 17:00 code freeze

---

## 12. Build order

1. **Core incident agent (likely what gets scored):** Ingest, History Lookup, Triage, Clash Check, Planner, Safety Gate, Human Decision, Action, Verify, Case Log
2. **Edge:** Group Check, Replan Route, Promise Tracker, Missing Info
3. **Watch flow:** Event Router + 5 checks
4. **Extras:** Learner, Architect, Self-Test, voice

---

## 13. Score estimate (if everything goes well)

| Category | Max | Estimate |
|----------|-----|----------|
| Right outcomes | 24.5 | 22–23 |
| Coverage | 14 | 13–14 |
| Judgement & safety | 14 | 13–14 |
| Engineering | 10.5 | 8.5–9.5 |
| Real-world use | 7 | 6.5–7 |
| Demo | 30 | 26–28 |
| **Total** | **100** | **~89–95** |

Best side-prize shot: Best Exception Handling. Maybe People's Choice. Best Voice only if voice is added.

---

## 14. Risks

- Building all 21 nodes and ending up with a half-working incident flow. **Lock the core first**
- Looking overbuilt to the engineering judges. Show the core is small and solid, the rest is add-ons
- Jev access: early access / waitlist. Confirm we have a working key before building around it
- Jev can be wrong. "No hallucinations" means the output always matches the format, not that it's always right
- Surprise cases might need things we didn't plan for. Missing Info + Safety Gate should catch those safely

---

## 15. Open questions

**Team and time**
- How many of us, and who owns what (agent core / UI / Reality Test runner / README + video + posts)?
- What time is it now, and what's the hard cut-off for features?

**Data and tools**
- What exactly is in the synthetic data (calls, emails, CRM, tickets, tracking, fleet data)?
- What tools/APIs does the environment give us, and can they fail on purpose?
- What format will the Reality Test cases come in, and how many?
- Is there a refund/credit policy in the data, or do we set our own thresholds?
- Is there any van/fleet data for Replan Route, or do we fake a small fleet?

**Models**
- Do we have a working Jev key right now (direct, OpenRouter or Vercel AI Gateway)?
- Which Claude model for Planner/Architect, and any rate limits to watch?
- Backup plan if Jev is down or too slow: Claude for the same nodes?

**Build**
- UI stack (React Flow?) and how the runtime talks to it
- Where case history lives (SQLite? JSON files?)
- Does the Architect build the default flow, or do we hand-build it and use Architect only for the demo?
- What counts as a "promise" for the Promise Tracker?
- What's the safe fallback per case type when no human answers?

**Scope**
- Voice in or out?
- Watch flow in or out if the core runs late?
- Learner: real logic, or just shown in the demo with sample decisions?

**Submission**
- Project name?
- Who posts on LinkedIn and X?
- Who records the video and when (must be in the repo by 16:30)?
