# CLAUDE.md

Hackathon project (Real-World Agents Hackathon, 10 Oct 2026, Delivery & Logistics track). **Code + demo video freeze 16:30 BST** (Reality Test cases released then). **Results freeze 17:00.** Speed matters, but the scored core must be solid.

## Read first

- `docs/PRD.md`: **the source of truth.** Scope, agent behaviour rules, the shared contract (types every part imports), voice, UI integration, outputs, timeline. Where anything else in the repo disagrees, the PRD wins. Change it by PR, with a changelog line.
- `SPEC.md`: the original idea spec (node list, vision). Superseded by `docs/PRD.md` where they differ.
- `docs/stress-test/`: the morning stress test of the design: edge-case catalogue, 12 fixtures with rubrics, simulation, architecture and voice reviews
- `docs/IDEA.md`: short explainer
- `docs/hackathon/`: official hacker guide, rules, ElevenLabs guide, kickoff talk transcript. Its README has the key facts.
- `docs/delivery-cases.md`: what the 50 delivery cases actually ask for, the boundaries that recur, and where the spec has no data behind it
- `data/`: the 200 public practice cases, raw (`data/raw/`) and parsed (`data/cases/<track>/NNN.json`, `data/index.json`). Ours are `delivery-*`. Rebuild with `npm run data`. Read via `apps/api/src/lib/data.ts`. Evaluate with `?view=escalation` so the outcome isn't leaked. See `data/README.md`.

## Repo

npm workspaces monorepo:

- `apps/api`: Next.js **backend**, route handlers only (`src/app/api/**/route.ts`), port 4000. Flow types are in `src/lib/flow.ts` and flow JSON files are in `apps/api/flows/`. Use `json()` from `src/lib/cors.ts` for responses so the web app can call it.
- `apps/web`: Next.js **frontend** (App Router, Tailwind v4), port 3000. Reads `NEXT_PUBLIC_API_URL`. Imports flow types from `../api/src/lib/flow`.

Commands (repo root): `npm run dev` (both apps), `npm run build`, `npm run lint`. Per app: `npm run dev -w api`.

**Next.js 16 is newer than your training data.** Before writing Next code, read the guide in `node_modules/next/dist/docs/`. Notable: data fetching outside `<Suspense>` fails the build (Cache Components / PPR). See `apps/*/AGENTS.md`.

## 3D city (`apps/web/src/world/`, page `/city`)

A three.js (react-three-fiber + drei) city where the delivery workflow plays out: delivery trucks, traffic, crashes, police, roadworks that close roads so traffic reroutes. The workflow side is **mocked on the frontend** for now (`modules/WorkflowDriver.tsx`), not wired to the real agent.

- **Shared contracts (change only with care, everything depends on them):** `config.ts` (zone boxes, sizes), `roads.ts` (road graph, `findPath` avoiding blocked edges, `lanePosition`, drive on the LEFT), `store.ts` (zustand: blocked roads, incidents, deliveries, workflow events, camera focus), `registry.ts` (live vehicles, per-frame), `bus.ts` (one-off events + UI requests), `signals.ts` (traffic light timing).
- **Modules:** one file each in `world/modules/` (helpers in `world/modules/<Name>/`). `World.tsx` mounts every 3D module inside a `ModuleBoundary`, so a crashing module disappears instead of killing the scene. Overlays (`WorkflowHud`, `Minimap`) are DOM, mounted by `CityPage.tsx`.
- **Ownership:** incidents are created by `Crashes`/`Roadworks`; `Responders` moves them to responding → clearing → cleared and reopens the road (Roadworks reopens its own). Vehicles must re-path with `findPath(…, blockedSet())` when their next road gets blocked.
- Per-frame data goes in `registry.ts`, never in zustand (re-render storm). Tests: `npm test -w web` (vitest).

## Architecture rules (from the spec, superseded by `docs/PRD.md` section 6 where they differ)

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
