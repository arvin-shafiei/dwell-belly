# Submission tracker

Every item the rules require (`docs/hackathon/rules.md` sections 6 to 8, and `docs/PRD.md` Parts A5 and H), where it lives, who owns it, and its status.

Placeholder files start with `[MISSING]` and say what must replace them. **Before the 16:20 freeze check, this must print nothing:**

```bash
git grep -n "\[MISSING\]" -- ':!docs/submission-tracker.md' ':!docs/PRD.md'
```

| Item | Rule | Path | Owner | Status |
|---|---|---|---|---|
| Source code: the agent runtime | 6A | `apps/api/src/agent/` | Anson | Merged (PRs #3, #7, #8). 225 agent tests and 15 eval tests pass offline with fakes. Has run on real models: see `eval/results.md`. |
| First real run: 5 practice cases plus the 12 fixtures | PRD K3, C4 | `npm run answer` | Anson | Partly done. 3 practice folders through `npm run answer`, and 48 cases through the eval (12 practice, 36 generated). The 12 stress-test fixtures have not been run. |
| Full timed run (target: 62 cases under 8 minutes) | PRD D5, C4 | `npm run answer` | Anson | Done once. All 50 practice cases, each cut at its escalation, 8 at a time: 50 of 50 answered, no failures, 165 s in total (17 to 32 s per case), $2.70 (about $0.054 per case). Deciding on `claude-opus-5-5`, reading and checking on `claude-sonnet-5-5`, Jev on. The 12 stress-test fixtures were not in this run. |
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
| `result.json` saved next to each trace | PRD J0 | `apps/api/src/agent/cli.ts` | Anson | Done. Written by `cli.ts`; it carries the analysis, decision, gate verdicts, outbox and card, and none of the case text. |
| Voice layer (PRD Part I) | 8 (Best Voice), 10 | `apps/api/src/voice/`, `apps/api/src/app/api/voice/`, `apps/web/src/voice/` | Oriol | Built on branch `oriol/voice`. Voice notes, audio files in cases transcribed as claims, Desk Caller agent created (`ELEVENLABS_AGENT_ID`), calls with in-call promise checks through the gate and Jev, approve by voice. 34 api voice tests, 5 loader tests, 4 web tests; smoke test passes against the real API. Lives in the console only (Executions, Voice strip); the dev bench is removed. |
| Voice mounted in the desk console | 8, 10 (demo) | `apps/web/src/console/executions/VoiceSlot.tsx`, `voiceComponents.ts` | Arvin + Oriol | Slots built by Arvin (note button on the case header, call button on Call or Phone outbox rows, approve by voice on open cards). Connected by `oriol/voice` through `VOICE_LOADERS`. |
| Voice accuracy measured and fixed | 8 (Best Voice), 16 | `scripts/voice/accuracy.mjs`, `apps/api/src/voice/references.ts` | Oriol | Done. Case-aware transcription: reference-heavy word errors 22.0% → 5.1%, critical details kept 76.4% → 97.2%, mis-heard reference codes 3 → 0; ordinary speech 0% errors before and after. |
| Voice approval feeding the agent (`humanDecision` in `run.ts`) | 8 | `apps/api/src/agent/run.ts` | Anson | Missing. Until then a voice decision is shown and recorded but does not release held messages. |
| Voice marked as an unverified claim in the agent's input | PRD D2.14, I5 | `apps/api/src/agent/load.ts` (`fromView`), `prompts.ts` | Anson | Missing. `fromView` still labels events `voice: live human`; it should say `voice (unverified claim)`, plus one Understand-prompt sentence that voice is a claim even from carrier staff. |
| Keys for a full voice rehearsal | | `apps/api/.env.local` | Oriol | All set and verified on Oriol's machine: ElevenLabs key, Desk Caller agent id, Anthropic, TypeSafe (Jev answered in 280 ms; a spoken refund promise was denied in 274 ms, a harmless sentence allowed in 225 ms). Regenerate all of them after the event. |
| README section saying `/city` is a visualisation, not part of the agent | 6B, 15 | `README.md` | Arvin | Missing |
| LinkedIn and X posts | 6F | `docs/launch-posts.md`, `SUBMISSION.md` | Unassigned | Placeholder |
| Apache 2.0 licence | 6G | `LICENSE` | | Done |
| Third-party material | 6G, 17 | `docs/hackathon/`, `data/raw/` | Oriol (decision) | Open. Recommended: remove the kickoff transcript, replace the rules and guides with links plus our own summary, credit the organisers' practice cases. |
| Submission form fields | 7 | `SUBMISSION.md` | Unassigned | Placeholder |
| Committed eval results | PRD F4, rules 16 | `eval/results.md` | Anson | Done for two 48-case runs, generated by `node scripts/eval/report.mjs`. Neither run is the current code, the with-Context view is not run, and cost and time are not in the eval output. The file says so. |
| Example run on public cases | PRD C4, rules 16 | `examples/practice-run/` | Oriol | Placeholder |
| Replay without keys | PRD F4, rules 16 | a script next to the runner | Anson | Done: `npm run replay -- ANSWERS` re-renders ANSWER.md and REASONING.md from `result.json` and reports any file that differs. `--write` rewrites them. |
| Judging presentation | 8, 10 | `docs/presentation.md` | Unassigned | Placeholder |
| Mock HUD labelled SIMULATED | 13, PRD J4 | `apps/web/src/world/modules/WorkflowHud*` | Arvin | Done: "Simulated · mock agent" in the top bar, a tag and explanation on the workflow panel, and a tag on the decision card. Remove only when the HUD replays real traces. **Still open:** the "Expected" check (`WorkflowHud/parts.tsx` `ExpectedLine`) compares the mock with the answer key it copied, so it always matches. Hide it unless a real trace is loaded (PRD J4). |
| Questions for the organisers | PRD L2 | | Oriol | Not asked yet: supplied tools, the case format, explicit questions, how many cases, which commit hash |

Update this table in the same PR as the change it tracks.
