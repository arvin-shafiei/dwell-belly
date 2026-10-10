# Desk console ("/"): brief for console agents

The home page of `apps/web` becomes the **Rivet desk console**: an n8n-style control panel for the delivery escalation agent, and the main UI of the demo video (PRD Part J0; read `docs/PRD.md` J0 and `docs/submission-tracker.md`). The 3D city stays at `/city` and is controlled from the console's City tab.

**Licence: don't copy n8n's code or assets.** n8n is under the Sustainable Use License, not open source, and our repo is public Apache-2.0. Recreate the *look and workflow* (dark canvas with dotted grid, rounded node cards with icons and coloured side handles, a left icon sidebar, an executions list, node input/output panels, the "Execute workflow" button) with our own code on `@xyflow/react` (installed, MIT).

## Rules

- **Read first:** `apps/web/src/console/types.ts` (the contract), `apps/api/src/lib/trace.ts`, `apps/api/src/lib/flow.ts`, `apps/api/flows/default-incident.json`, `apps/api/src/app/api/cases/route.ts`, the "3D city" and "Next.js 16" notes in `CLAUDE.md`, and `apps/web/AGENTS.md`. Read `node_modules/next/dist/docs/` before writing route handlers or pages (Next 16: data access outside `<Suspense>` fails the build).
- **Real data only (PRD J0):** the console shows runner outputs (traces, ANSWER.md, REASONING.md, eval results) and console-triggered runs. Never present mock or city-simulated data as real; anything with `simulated: true` gets a visible SIMULATED tag.
- **Ownership:** you own only the files named in your brief. Don't edit other agents' files, shared contracts or package.json. Request contract changes in your report instead. No `npm install` (available: next 16, react 19, @xyflow/react, tailwind 4, zustand; SQLite is Node's built-in `node:sqlite`).
- **Look:** dark, dense, professional ops UI. Rivet orange `#ff6a1a` accent, n8n-like greys (`#1f1f23` canvas, `#2a2a30` cards), Inter or system font, tabular numerals. Must look great at 1920×1080 and work at 1280×720 with **no overlapping panels**.
- **Verify:**
  - `cd apps/web && npx tsc --noEmit -p . 2>&1 | grep <your paths>` returns nothing.
  - eslint is clean on your files.
  - Vitest covers any pure logic.
  - `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` and `/city` both return 200. A dev server is running; don't start another and don't `pkill`.
  - Keep the page building at every save.
- No browser and no git commit or push; the lead integrates and tests in Chrome.
- **Report:** ≤12 lines covering what you built, your files, how to use it, contract requests and known issues.
