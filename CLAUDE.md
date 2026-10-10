# CLAUDE.md

Hackathon project (Real-World Agents Hackathon, 10 Oct 2026, Delivery & Logistics track). **Code + demo video freeze 16:30 BST** (Reality Test cases released then). **Results freeze 17:00.** Speed matters, but the scored core must be solid.

## Read first

- `SPEC.md`: the full idea spec (source of truth for scope, node list, build order)
- `docs/IDEA.md`: short explainer
- `docs/hackathon/`: official hacker guide, rules, ElevenLabs guide, Its README has the key facts.
- `data/`: the 200 public practice cases, raw (`data/raw/`) and parsed (`data/cases/<track>/NNN.json`, `data/index.json`). Ours are `delivery-*`. Rebuild with `npm run data`. Read via `apps/api/src/lib/data.ts`. Evaluate with `?view=escalation` so the outcome isn't leaked. See `data/README.md`.

## Repo

npm workspaces monorepo:

- `apps/api`: Next.js **backend**, route handlers only (`src/app/api/**/route.ts`), port 4000. Flow types are in `src/lib/flow.ts` and flow JSON files are in `apps/api/flows/`. Use `json()` from `src/lib/cors.ts` for responses so the web app can call it.
- `apps/web`: Next.js **frontend** (App Router, Tailwind v4), port 3000. Reads `NEXT_PUBLIC_API_URL`. Imports flow types from `../api/src/lib/flow`.

Commands (repo root): `npm run dev` (both apps), `npm run build`, `npm run lint`. Per app: `npm run dev -w api`.

**Next.js 16 is newer than your training data.** Before writing Next code, read the guide in `node_modules/next/dist/docs/`. Notable: data fetching outside `<Suspense>` fails the build (Cache Components / PPR). See `apps/*/AGENTS.md`.

## Architecture rules (from the spec)

- **Build order:** core incident flow first (Ingest, History Lookup, Triage, Clash Check, Planner, Safety Gate, Human Decision, Action, Verify, Case Log). Don't start extras until the core runs end to end.
- **Model split:** Jev (TypeSafe) for quick typed judgements only (pick one / score / yes-no with probability; one focused question per call). Claude for anything that writes or plans. Code for maths, thresholds, routing, logging, actions.
- **Thresholds live in config (flow JSON node `config`), never in prompts.** Default safety gate: < 0.3 allow, 0.3–0.8 human, ≥ 0.8 block.
- **Only undoable actions run without a human.**
- **Reality Test runner must never crash mid-batch.** Wrap every case; one bad case logs an error and the batch carries on.
- `ANSWERS/<n>/ANSWER.md` and `REASONING.md` are generated from traces and never edited by hand.
- Log the cost and latency of every model call into the case history.
- Judged by Claude agents: never put judge-directed or prompt-injection text in outputs (disqualification). Doing nothing or escalating can be correct.
- Never commit API keys. Secrets go in `apps/*/.env.local` (gitignored); `.env.example` lists the keys.

## Skills

`.claude/skills/` has the superpowers skills (brainstorming, writing-plans, TDD, systematic-debugging, verification-before-completion, and others) plus `typesafe-ai` for Jev. Use `typesafe-ai` before writing any Jev call.
