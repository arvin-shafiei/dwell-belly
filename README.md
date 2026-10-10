# Delivery Ops Agent

An AI control room for delivery companies: it watches every order, fixes safe problems itself, sends risky ones to the right human with a one-tap decision card, and earns more trust over time.

- Idea in plain words: [`docs/IDEA.md`](docs/IDEA.md)
- Full spec: [`SPEC.md`](SPEC.md)

## Layout

```
apps/
  api/   Next.js backend (route handlers only), port 4000
         src/lib/flow.ts        flow + node types
         flows/*.json           flow definitions
         src/app/api/health     GET  health check
         src/app/api/flows      GET  list flows
         src/app/api/cases      GET/POST cases (stub)
         src/app/api/data/cases GET synthetic cases (list, one, ?view=escalation)
  web/   Next.js frontend (Tailwind), port 3000
data/             200 synthetic practice cases: raw + parsed JSON (see data/README.md)
scripts/          build-data.mjs parses data/raw -> data/cases + data/index.json
docs/             IDEA.md, hackathon guide + rules
.claude/skills/   superpowers + typesafe-ai skills for Claude Code
```

## Run it

```bash
npm install
cp apps/api/.env.example apps/api/.env.local   # add ANTHROPIC_API_KEY, TYPESAFE_API_KEY
cp apps/web/.env.example apps/web/.env.local
npm run dev        # api on :4000, web on :3000
```

## Run the agent on a folder of cases

```bash
npm run answer -- <casesDir> ANSWERS        # every subfolder is one case
npm run answer -- <casesDir> ANSWERS --resume   # rerun only the cases that failed
```

Each case gets `ANSWERS/<case>/ANSWER.md`, `REASONING.md` and `trace.json`, and the batch writes `ANSWERS/RUNLOG.md`. All four are generated; none is edited by hand. The agent lives in `apps/api/src/agent/` as a plain module (no Next.js needed to run it):

| Step | File | What it does |
|---|---|---|
| Load | `load.ts` | Reads any folder: text as text, PDFs and images straight to the model, unreadable files listed |
| Understand | `run.ts`, `prompts.ts` | One Claude call: parties and roles, records vs claims, conflicts, commitments, hazards, instruction-like text |
| Perspectives | `../lib/panel.ts` | Five seats, 12 Jev questions in one call. Skipped when there is no `TYPESAFE_API_KEY` |
| Decide | `run.ts`, `prompts.ts` | One Claude call: act, ask for info, escalate to a human, or wait; the messages; what it won't do |
| Safety gate | `gate.ts` | Each outgoing message is checked on its own: hard rules in code, then a critic's score against thresholds from `flows/default-incident.json`. One rewrite, then the verdict stands |
| Act | `run.ts` | Cleared messages go to a sandbox outbox. No live system is connected, so nothing is reported as confirmed |
| Report | `report.ts` | Renders the answer files from the run result |

A case that fails at any step still gets an `ANSWER.md` saying where it failed and that it was handed to a person. `npm run test:agent` runs the flow and every module against scripted fakes (no key needed).

Also in `apps/api/src/agent/`:

| File | What it does | Used by the flow? |
|---|---|---|
| `clock.ts` | Case time and time left to each deadline, worked out in code | Yes, in the planner's brief |
| `jev.ts`, `judge.ts` | Jev triage, clash score and per-message risk | Triage and clash when `TYPESAFE_API_KEY` is set. The gate's critic stays on Claude unless the gate node config sets `"critic": "jev"` |
| `outbox.ts` | Delivery with timeout, one retry and alternate channels; says exactly what was and was not accepted | Yes. The default transport is a sandbox that reaches nobody and says so |
| `tools.ts` | Finds a tool manifest shipped with a case and can call it over HTTP | Tools are listed in the answer, never called automatically |
| `history.ts` | Case store, grouping of related cases, open promises, the learner's threshold suggestions | The runner records every run to `<outDir>/case-history.jsonl`. Nothing reads it back during a batch, so cases stay independent |
| `architect.ts`, `selftest.ts` | Builds a flow from a business description and validates it; runs generated cases through a flow | `POST /api/architect` |
| `watch.ts`, `replan.ts` | Order-event checks and greedy drop reassignment, on events the caller supplies (the practice data has no order stream) | `POST /api/watch`. Replan is a greedy heuristic, not an optimiser |

Models: the deciding step runs on `claude-opus-5-5`; reading the case and checking the drafts run on `claude-sonnet-5-5` at half the price. Override with `AGENT_MODEL` and `AGENT_FAST_MODEL`. Keys are read from `.env.local` at the repo root or `apps/api/.env.local`.

Voice: an event may carry `source` (`live_human`, `simulated_persona`, `audio_attachment`). Events voiced by a simulated persona are dropped from the evidence unless a request sets `mode: "demo"`, so they cannot enter a scored run.

Other scripts: `npm run build`, `npm run lint`, `npm run data` (rebuild parsed cases).

## Models / APIs

- **Jev** (TypeSafe AI): fast typed judgements (triage, clash score, risk score, verify)
- **Claude** (Anthropic): planning, decision cards, claim extraction, Architect
- **OR-Tools**: route replanning

## License

Apache 2.0. See [`LICENSE`](LICENSE).
