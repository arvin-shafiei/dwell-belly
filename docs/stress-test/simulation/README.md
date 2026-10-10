# Simulation of the designed flow on 8 hard cases

Files: rubrics.md (written first), cases/variants.md, sim/<case>/{trace.md,ANSWER.md,REASONING.md}, grades.md, template.md.

Assumptions about a naive implementation of the design as written (SPEC.md, CLAUDE.md, default-incident.json):
- Load = apps/api escalationView: includes title, index Context and ALL attachments.
- Triage (Jev pick-one) taxonomy from the spec: late, missing, damaged, address, access, returns, billing, customs, safety, other. Argmax taken.
- Missing Info (Jev yes/no): "Is there enough information to act?"
- Safety Gate: Jev yes/no per hard rule on the Planner draft (promises_refund, claims_delivered, shares_third_party, requests_credential) plus one Jev risk score for the whole plan; <0.3 allow, 0.3 to 0.8 human, >=0.8 block. "Notify/reschedule" count as undoable (spec examples).
- Human Decision: no human at 16:30, fallback = mark escalated, no external action.
- Action tools (sandbox): email.send, customer_portal.send, dispatch_chat.send, work_queue.post. No call tool (voice is an extra). No timeout specified.
- Verify (Jev): "Did the action work?" On no: retry, try another way, or escalate (spec wording).
