# 026 trace (naive design)
- Load: LEAK: index Context states the answer ("Recovery should be managed by the carrier without exposing the other household's details").
- Ingest: carrier located sealed parcel at wrong stop; third-party details restricted to recovery team [carrier, verified]. Recipient wants carrier recovery and redelivery to verified address, will not contact the other household.
- Triage (Jev): no "misdelivered" label. address p=0.41, missing p=0.38 -> argmax "address". FLAW: low-confidence pick passed on as fact; Planner prompt now says "address problem".
- Clash: none p=0.05. Missing Info: enough yes p=0.77.
- Planner: email "Delivery investigations, Plover Arc (recovery team)": recover DL-026 from the wrong stop, redeliver to verified address, confirm slot, keep third-party details internal. Customer portal update: carrier is arranging recovery, we will confirm the time when the carrier does.
- Gate: shares_third_party no p=0.08; risk 0.15 -> allow.
- Action: 2 sends OK. Verify yes.
