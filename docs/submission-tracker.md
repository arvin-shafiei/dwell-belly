# Submission tracker

Every item the rules require (`docs/hackathon/rules.md` sections 6 to 8, and `docs/PRD.md` Parts A5 and H), where it lives, who owns it, and its status.

Placeholder files start with `[MISSING]` and say what must replace them. **Before the 16:20 freeze check, this must print nothing:**

```bash
git grep -n "\[MISSING\]" -- ':!docs/submission-tracker.md' ':!docs/PRD.md'
```

| Item | Rule | Path | Owner | Status |
|---|---|---|---|---|
| Source code: the agent runtime | 6A | `apps/api/src/agent/` | Anson | Merged (PR #3). 221 agent tests and 15 eval tests pass offline with a fake model. **Never run with a real key yet.** |
| First real run: 5 practice cases plus the 12 fixtures | PRD K3, C4 | `npm run answer` | Unassigned | Missing. Needs `ANTHROPIC_API_KEY` in `apps/api/.env.local`; no key on Oriol's machine yet. |
| Full timed run (target: 62 cases under 8 minutes) | PRD D5, C4 | `npm run answer` | Unassigned | Missing. Runs on `claude-opus-5-5`, with 150 s per call and 300 s per case, and the speed is unmeasured. |
| Extra test cases | PRD B6 | `data/generated/`, plus new sets | Anson, Oriol, another group | 120 generated plus 123 grounded cases merged; about 100 more in progress (Oriol) and another set from another group |
| Demo-only modules kept out of the scored path | 6B, 15 | `apps/api/src/agent/watch.ts`, `replan.ts`, `architect.ts`, `selftest` | Anson | Built, and not imported by the runner. The README must label them "demo only, not used in the Reality Test run" so it doesn't overclaim. |
| Env vars documented | 6A | `apps/api/.env.example`, `apps/web/.env.example` | Oriol | Done (these were silently gitignored before) |
| README with the 8 required sections | 6B | `README.md` | Arvin (PRD K1) | Exists but overclaims (Watch flow, Jev on four steps, OR-Tools). Missing: the problem, assumptions, known limitations, what's next, the dependency list with licences, and data attribution. Rewrite once PR #3 is merged (it also edits the README). |
| Reality Test answers | 6C | `ANSWERS/` | The runner, at 16:32 | Placeholder. The runner also writes `ANSWERS/case-history.jsonl` (its cross-case log). Decide whether that file stays in the submission. |
| Results index | PRD F1 | `ANSWERS/INDEX.md` | Oriol | Generator not built |
| Logs and traces | 6D | `ANSWERS/<n>/trace.json`, `ANSWERS/RUNLOG.md` | The runner | Built in PR #3 |
| Demo video in the repo | 6E | `demo/` | Arvin | Placeholder |
| Desk console (the main UI, PRD J0) | 8, 10 (demo) | `apps/web/src/app/` (home page) | Arvin | Missing. The home page is a stub ("Flowchart UI goes here"). Needs the first real run's outputs. |
| Evidence grid (every tested case with decision and pass or fail) | 8, 10 (demo) | desk console | Arvin | Missing. Needs real eval results. |
| `result.json` saved next to each trace | PRD J0 | `apps/api/src/agent/cli.ts` | Anson | Missing (one line), so the console doesn't have to parse markdown |
| README section saying `/city` is a visualisation, not part of the agent | 6B, 15 | `README.md` | Arvin | Missing |
| LinkedIn and X posts | 6F | `docs/launch-posts.md`, `SUBMISSION.md` | Unassigned | Placeholder |
| Apache 2.0 licence | 6G | `LICENSE` | | Done |
| Third-party material | 6G, 17 | `docs/hackathon/`, `data/raw/` | Oriol (decision) | Open. Recommended: remove the kickoff transcript, replace the rules and guides with links plus our own summary, credit the organisers' practice cases. |
| Submission form fields | 7 | `SUBMISSION.md` | Unassigned | Placeholder |
| Committed eval results | PRD F4, rules 16 | `eval/results.md` | Anson | Placeholder (the eval writes its JSON to `runs/`, which is gitignored) |
| Example run on public cases | PRD C4, rules 16 | `examples/practice-run/` | Oriol | Placeholder |
| Replay without keys | PRD F4, rules 16 | a script next to the runner | Oriol | Not built |
| Judging presentation | 8, 10 | `docs/presentation.md` | Unassigned | Placeholder |
| Mock HUD labelled SIMULATED | 13, PRD J4 | `apps/web/src/world/modules/WorkflowHud*` | Arvin | Done: "Simulated · mock agent" in the top bar, a tag and explanation on the workflow panel, and a tag on the decision card. Remove only when the HUD replays real traces. **Still open:** the "Expected" check (`WorkflowHud/parts.tsx` `ExpectedLine`) compares the mock with the answer key it copied, so it always matches. Hide it unless a real trace is loaded (PRD J4). |
| Questions for the organisers | PRD L2 | | Oriol | Not asked yet: supplied tools, the case format, explicit questions, how many cases, which commit hash |

Update this table in the same PR as the change it tracks.
