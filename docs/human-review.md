# Human review desk

Open **Human review** in the workflow console header or the city HUD. Both open a drawer and keep the current view mounted. The standalone desk is `/review`; `/review?case=<task id>` opens a specific card, and `?source=simulation` shows city cases.

The desk reads the actual handover cards from saved agent traces under `ANSWERS/`, `runs/`, and `examples/practice-run/`. `POST /api/cases` now saves API handovers under `runs/api/`, so console and real-agent city runs also appear. There are no seeded production cards. Scored answer files and traces are never changed by review.

Each card shows its owning team, deadline, reason for stopping, conflicting evidence, the statements behind the decision, prior attempts, option effects, the fact that would change the decision, proposed messages, history and fallback. Search and team/status filters narrow the queue. It refreshes every five seconds.

## Decisions

- Choose one of the card's options, enter your name, optionally add a handover note, then record the decision.
- Real-case choices are stored atomically under `runs/human-review/decisions/`. A competing or duplicate choice returns 409. Recorded means **awaiting execution**, not an action completed by the carrier. The current runtime has no `resumeCase` endpoint or option-to-action mapping, so the desk does not infer an action from an option's wording.
- Reality Test cards are read-only.
- A passed deadline is shown as overdue with the fallback. The real owning lead still needs to review it; the desk does not execute a fallback or claim it ran.
- Simulation cards are clearly labelled and kept in their own source tab. Their choices use `rivet-human-review` BroadcastChannel requests and acknowledgements to call the existing engine's `decide()`. The city must stay open in the same browser. The engine's 15-minute deadline is shared with the desk, and invalid, duplicate or late choices are rejected. Its configured fallback runs when its clock reaches the deadline.

## Integration

`apps/web/src/review/ReviewEntry.tsx` is a reusable entry with the pending agent-case count. `HumanDesk` works as a full page or embedded view. The console header and city use `ReviewDrawer`, with focus trapping, Escape-to-close and focus restoration.

`GET /api/review/tasks` lists cards. `POST /api/review/tasks` accepts `{ trace, result? }` for a returned agent trace. `POST /api/review/tasks/<id>/decision` accepts `{ optionId, who, note? }`. The trace adapter reads the current node output and the future PRD's `card` event format.

## Keeping the checkout current

`sh scripts/pull-loop.sh start` starts one background loop, pulling `origin/main` every 600 seconds. `status` shows the PID and log; `stop` ends it. It fetches but defers integration when there are uncommitted edits, skips ongoing git operations, uses fast-forward only on main and merges on a feature branch. It never autostashes or rebases local work. A merge started by this script is aborted if it conflicts.

The loop runs until stopped or the computer shuts down. It does not push changes.
