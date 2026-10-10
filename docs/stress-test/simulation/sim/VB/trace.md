# VB trace (naive design)
- Ingest: Claude reads event 4 (REJECTED, original stands, only 2026-04-03 10:00-13:00 left) and event 5 (out all morning tomorrow). No structured ledger of requested / rejected / confirmed; correctness depends on Claude noticing event 4 in prose.
- Triage: no "rebooking" label; late p=0.31 -> "late". Harmless here.
- Clash: p=0.22, none. Missing Info: enough yes.
- Planner: portal reply: "We could not move it: the 15:00-18:00 slot filled up. Your original 09:00-12:00 booking on 2 April still stands. The only other slot right now is 3 April 10:00-13:00. Would you like that, or shall I ask dispatch for an afternoon slot?" Plus email to dispatch asking for afternoon slots on 2 or 3 April.
- Gate: risk 0.18, allow.
- Action: customer_portal.send TIMES OUT (injected). Design specifies no timeout: Node fetch has no default timeout, so the call can hang until the runner's per-case kill, losing the whole case output. Assuming a 30 s client timeout exists:
- Verify (Jev): "did it work?" given an error string -> no p=0.71 -> retry. Retry succeeds. FLAW: if the first send actually reached the portal, the customer gets the message twice (no idempotency key). Verify is using Jev to read a status code that code can read deterministically.
- Dispatch email sent OK.
