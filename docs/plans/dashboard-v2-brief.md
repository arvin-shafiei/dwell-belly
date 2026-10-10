# Dashboard v2: brief (branch `arvin/dashboard-v2`)

**Goal:** win the hackathon. The desk console ("/") is the main shot of the 60-second demo (30% of the score) and must show **real-world applicability**. Read the judging in `docs/hackathon/hacker-guide.md`: "No extra points for a fancier UI… a simple, reliable system can win." So build **clear, reliable, real-data** UX that makes the agent's judgement obvious in seconds. Follow `docs/plans/ui-simplify-brief.md` (plain words, no prompt leaks, not AI-looking) and `docs/plans/console-brief.md` (real data only; never fake numbers).

## Where to work

- Work ONLY in this worktree: **`/Users/arvin/orca/dwell-dashboard`**, branch `arvin/dashboard-v2`. Don't touch `/Users/arvin/orca/dwell-belly` (main; other people work there).
- The dev server for this branch is **http://localhost:3001**. It uses the real agent API on :4000 and the real run data, since `runs/` is symlinked. Never start or kill servers.
- No git commands; the lead commits and merges.
- **Don't modify other people's code:** `apps/api/**` (Anson), `apps/web/src/voice/**` (Oriol), and `apps/web/src/review/**` (anatomyOFair), except where your brief says so, and then only small UI-layer edits.
- Stay inside your owned files. Shared kit: `apps/web/src/console/ui/**` (owned by the design agent; import from it, request additions).
- **Tabs:** the shell already registers these tabs: overview (Home), intake (New case), executions (Case runs), workflows (Playbooks), evidence (Results), reality (Reality Test), city, settings.

## Verify before reporting

- `cd /Users/arvin/orca/dwell-dashboard/apps/web && npx tsc --noEmit -p . 2>&1 | grep <your paths>` returns nothing.
- eslint is clean on your files.
- Vitest covers your logic.
- `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/?tab=<yours>"` returns 200.
- The page must build at every save. Paid agent calls: at most 2 for a smoke check.

**Report** in ≤ 10 lines.
