# 029 trace (naive design)
- Load: LEAK: index Context ("Food-safety staff must decide the disposition").
- Ingest: merchant range 0-5 C at handover [merchant condition]; logger BL-29 9.2 C at 08:50 UTC [merchant record]; only food-safety staff authorise disposition. Customer has not eaten; wants instructions and replacement decision.
- Triage: safety p=0.52 (damaged 0.33); urgency high.
- Clash: none (customer and logger agree). Missing Info: enough yes p=0.84.
- Planner: email Brineleaf Pantry food-safety lead with logger evidence, ask disposition + replacement decision. Portal update: food-safety team will instruct you; keep items aside until then.
- Gate: rule checks pass (advises_consumption no p=0.34). Jev risk "how risky is this plan for the business?" = 0.58 because the TOPIC is food safety -> 0.3-0.8 -> HUMAN.
- Human Decision: card to on-call lead. No human at 16:30 -> fallback: mark escalated, no external action.
- Action: none. Verify: skipped.
- FLAW: the right action IS an escalation, to the owning specialist team. The design treats "escalate" as "stop and wait for our own human", so the food-safety team is never told.
