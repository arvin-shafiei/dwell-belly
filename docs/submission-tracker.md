# Submission tracker

Every item the rules require (`docs/hackathon/rules.md` sections 6 to 8, and `docs/PRD.md` Parts A5 and H), where it lives, who owns it, and its status.

Placeholder files start with `[MISSING]` and say what must replace them. **Before the 16:20 freeze check, this must print nothing:**

```bash
git grep -n "\[MISSING\]" -- ':!docs/submission-tracker.md' ':!docs/PRD.md'
```

| Item | Rule | Path | Owner | Status |
|---|---|---|---|---|
| Source code: the agent runtime | 6A | `apps/api/src/agent/` | Anson | In PR #3, not merged, never run with a real key |
| Env vars documented | 6A | `apps/api/.env.example`, `apps/web/.env.example` | Oriol | Done (these were silently gitignored before) |
| README with the 8 required sections | 6B | `README.md` | Arvin (PRD K1) | Exists but overclaims (Watch flow, Jev on four steps, OR-Tools). Missing: the problem, assumptions, known limitations, what's next, the dependency list with licences, and data attribution. Rewrite once PR #3 is merged (it also edits the README). |
| Reality Test answers | 6C | `ANSWERS/` | The runner, at 16:32 | Placeholder |
| Results index | PRD F1 | `ANSWERS/INDEX.md` | Oriol | Generator not built |
| Logs and traces | 6D | `ANSWERS/<n>/trace.json`, `ANSWERS/RUNLOG.md` | The runner | Built in PR #3 |
| Demo video in the repo | 6E | `demo/` | Arvin | Placeholder |
| LinkedIn and X posts | 6F | `docs/launch-posts.md`, `SUBMISSION.md` | Unassigned | Placeholder |
| Apache 2.0 licence | 6G | `LICENSE` | | Done |
| Third-party material | 6G, 17 | `docs/hackathon/`, `data/raw/` | Oriol (decision) | Open. Recommended: remove the kickoff transcript, replace the rules and guides with links plus our own summary, credit the organisers' practice cases. |
| Submission form fields | 7 | `SUBMISSION.md` | Unassigned | Placeholder |
| Committed eval results | PRD F4, rules 16 | `eval/results.md` | Anson | Placeholder (the eval writes its JSON to `runs/`, which is gitignored) |
| Example run on public cases | PRD C4, rules 16 | `examples/practice-run/` | Oriol | Placeholder |
| Replay without keys | PRD F4, rules 16 | a script next to the runner | Oriol | Not built |
| Judging presentation | 8, 10 | `docs/presentation.md` | Unassigned | Placeholder |
| Mock HUD labelled SIMULATED | 13, PRD J4 | `apps/web/src/world/` | Arvin | Open. It blocks any video take that shows `/city`. |
| Questions for the organisers | PRD L2 | | Oriol | Not asked yet: supplied tools, the case format, explicit questions, how many cases, which commit hash |

Update this table in the same PR as the change it tracks.
