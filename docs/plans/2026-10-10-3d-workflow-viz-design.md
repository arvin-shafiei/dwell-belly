# 3D workflow view ("Hamster Office"): design

Date: Sat 10 Oct 2026. Owner: Arvin (3D). 2D view: rest of team. Hard freeze: **16:30 BST** (code + demo video).
Status: design only. No packages installed, no app code written.

Process note: this went through the brainstorming skill as an **architectural** task (new UI subsystem plus a shared interface, the trace schema). The design was written by a subagent that could not ask questions, so every question it would have asked is written down in §10 with a recommended answer. Review §10 first.

---

## 1. Goal

Show the incident flow running on a real case, so a viewer gets it in a few seconds: **a parcel (the case) moves between hamster agents at their stations, each station lights up and shows what it decided and what it cost, the Safety Gate sends it down allow / ask / block, and the manager's desk shows the decision card.**

It serves the 60-second demo (30% of the score). It must not cost the scored core (Reality Test, 70%) anything:

- **Isolation.** The 3D code lives only in `apps/web/src/components/office3d/`. It reads trace files and never calls the agent runtime. If it breaks, delete the folder and the 2D view still works.
- **Arvin's time only.** Nobody else on the team touches 3D. The only shared work is the trace schema (§4), which the core needs anyway: `REASONING.md` is generated from traces, and CLAUDE.md asks for cost and latency on every call.
- **Abort rule.** If the core flow doesn't run end to end on the public delivery cases by **14:30**, Arvin stops 3D work and helps the core. The 2D view carries the demo.

### What the team agreed (WhatsApp, this morning)

- Build the **2D n8n-style view first** (team), with 3D in parallel (Arvin). Both run from the **same trace data**, with a **2D / 3D toggle**.
- The 2D view is for **decision replay on a specific order**. So per-order trace replay is a core requirement for both views, not a 3D extra.
- "Don't 3D everything." We're scored on Reality Test results. Keep 3D cheap.
- 3D vision: an office where **agents are hamsters at stations** (the team is Delivery Hamsters), seen **from above**, with **parcels moving between stations**. A city / dock yard / truck offloading / countryside world is a **stretch goal**, below the cut line.
- Human Decision becomes the **manager's desk**. Routing to the right people (drivers, support, claims) shows as the parcel going to the right desk.
- Kickoff tie-in: Anthropic's lunar base demo used buildings as tools (comms unit = "send message to customer"). We use **stations as nodes and tools, and the parcel as the case**. Same metaphor, so the pitch line is easy.

---

## 2. Approaches considered

### Chosen: react-three-fiber + drei, "Hamster Office" top-down scene, trace replay

- `@react-three/fiber` v9 (React 19) + `@react-three/drei` v10 + `three`. There are about 12 stations, so a declarative React scene makes state → visuals a few lines per station. No imperative scene-graph syncing.
- Hamsters, desks, gates and parcels are **built from primitives** (spheres, capsules, boxes). No GLTF, no asset pipeline, no loaders to fail.
- The camera is **top-down, angled about 55°**, with drei `MapControls` (pan and zoom, which covers "walk up to that agent"). It eases toward the active station.
- Text is **DOM**: drei `<Html>` labels above stations plus a normal React side panel. Text stays sharp in the video, and there's no font fetch (drei `<Text>` loads a font over the network, which is a risk on venue wifi).
- Data comes from a **saved trace JSON**, replayed by a pure reducer that the 2D and 3D views share.

### Rejected A: raw three.js (no R3F)

More setup code (renderer, resize, render loop, disposal, raycasting by hand), and node state would have to be pushed into the scene by hand from React. It saves one dependency and costs about 45 minutes. The scene is small, so R3F costs nothing at runtime. Rejected.

### Rejected B: 3D graph of glowing boxes and tubes (force-graph style), or the full multi-zone world as the base

- A 3D box graph is the same picture as the 2D view with worse text. It adds nothing a judge remembers, and the team asked for agents, not blocks.
- The full world (city, dock yard, truck offloading, countryside) is several scenes' worth of modelling. It's kept as a **stretch** (§8, below the cut line). Only the "loading dock" edge of the office makes it into the base, because the broken-van beat needs somewhere for parcels to arrive.

### Rejected C: live SSE from `apps/api` as the primary data path

Live streaming couples the demo to the runtime being up, fast and deterministic while we record. Traces must be written anyway, so replay is free, repeatable take after take, and runs offline. **Live mode is optional later**: `EventSource` feeds the same reducer, with no change to the views (§5).

---

## 3. File layout

```
apps/api/src/lib/trace.ts                 # shared TS types (§4), next to flow.ts. Core + both views import it
apps/api/src/app/api/traces/route.ts      # GET list of available traces  (read-only, ~15 lines)
apps/api/src/app/api/traces/[id]/route.ts # GET one trace file            (read-only, ~15 lines)
traces/<caseId>.json                      # written by the core's Case Log node (repo root, next to ANSWERS/)

apps/web/public/traces/                   # copies of the demo traces (offline fallback for recording)
  delivery-024.json  delivery-021.json  fleet-v12.json

apps/web/src/lib/replay/
  types.ts        # re-export from ../../../../api/src/lib/trace (same pattern page.tsx uses for flow.ts)
  reducer.ts      # pure: (state, TraceEvent) => state.   Node status, edges taken, cost total, current card
  useReplay.ts    # hook: loads a trace, plays it on a clock (speed, pause, step, seek), returns ReplayState
  layout.ts       # pure: Flow => {nodeId: {col, lane}}. Rank = longest path; gate children split into lanes
  loadTrace.ts    # fetch API -> fall back to /traces/<id>.json

apps/web/src/app/replay/page.tsx          # server page: <Suspense><ReplayClient/></Suspense>
apps/web/src/components/replay/
  ReplayClient.tsx   # "use client"; reads ?case=&view=2d|3d&speed=; owns useReplay; toggle; side panel
  SidePanel.tsx      # case header, step log, next action card, decision card, cost ticker (DOM, shared)
  Controls.tsx       # play / pause / step / restart / speed; keyboard: Space, →, R, 2, 3
apps/web/src/components/flow2d/ ...        # TEAM'S React Flow view; takes the same ReplayState + layout
apps/web/src/components/office3d/          # ARVIN ONLY
  Office3D.tsx       # "use client"; <Canvas>; loaded via next/dynamic({ ssr:false }) from ReplayClient
  Station.tsx        # desk + Hamster + status lamp + <Html> card; props: node, status, output
  Hamster.tsx        # primitive hamster; props: color (runner), mood (idle|working|done|alarm)
  SafetyGate.tsx     # turnstile + 3 chutes (allow/ask/block) + risk needle with config thresholds
  ManagerDesk.tsx    # Human Decision station; bigger desk, phone, "decision card" screen
  Parcel.tsx         # the case; lerps along taken edges
  ParcelSwarm.tsx    # InstancedMesh of N parcels for the grouping beat
  Floor.tsx          # floor grid, lane paint, loading-dock door
  webgl.ts           # canUseWebGL(); on failure ReplayClient forces view=2d
```

Next 16 notes (from `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`): `next/dynamic` with `ssr: false` is **only allowed inside a Client Component**, so `ReplayClient.tsx` (`"use client"`) does `dynamic(() => import("../office3d/Office3D"), { ssr: false })`. The page fetches no data on the server, and the trace loads client-side in `useReplay`, which sidesteps the "data fetching outside `<Suspense>` fails the build" rule. `useSearchParams` still needs the `<Suspense>` in `page.tsx`. Read `01-getting-started/05-server-and-client-components.md` before writing the page.

**Layout is shared:** `layout.ts` gives both views the same column/lane per node (2D: x = col·260, y = lane·140; 3D: x = col·4, z = lane·3). Flipping the toggle keeps your bearings, and a flow from the Architect (different business) lays itself out in both views with no hand placement.

---

## 4. Trace event schema (`apps/api/src/lib/trace.ts`)

This is the one interface the core agent has to honour. It's small on purpose. Case Log appends events as nodes run and writes the file at the end. **The file is written even when the case errors** (the runner must never crash mid-batch), ending in a `run_end` with `outcome: "error"`.

```ts
import type { NodeType, Runner } from "./flow";

export const TRACE_VERSION = 1;

export interface Trace {
  version: typeof TRACE_VERSION;
  runId: string;                 // e.g. "2026-10-10T15:02Z-practice"
  caseId: string;                // "delivery-024", or "fleet-v12" for a grouped case
  flowId: string;                // "default-incident"
  mode: "practice" | "reality" | "demo";
  synthetic?: boolean;           // true for hand-built or generated demo traces; UI shows a "Simulated" tag
  events: TraceEvent[];
}

/** t = ms since run start (real timings; the replay clock rescales them). */
type Base = { t: number };

export type TraceEvent =
  | (Base & { kind: "run_start"; title: string; inputs: InputRef[] })
  | (Base & { kind: "node_start"; nodeId: string; nodeType: NodeType })
  | (Base & { kind: "model_call"; nodeId: string; runner: Exclude<Runner, "code">;
              model: string; latencyMs: number; tokensIn: number; tokensOut: number;
              costUsd: number; ok: boolean; error?: string })
  | (Base & { kind: "node_end"; nodeId: string; status: "ok" | "error" | "skipped";
              summary: string;                 // one line for the station card, <= 80 chars
              output?: NodeOutput; latencyMs: number; costUsd: number })
  | (Base & { kind: "edge"; from: string; to: string; when?: "allow" | "ask" | "block" | string })
  | (Base & { kind: "group"; groupId: string; memberCaseIds: string[]; reason: string; p: number })
  | (Base & { kind: "run_end"; outcome: Outcome; totalCostUsd: number; totalLatencyMs: number;
              nextAction?: NextAction; error?: string });

export type Outcome = "acted" | "asked_for_info" | "escalated" | "blocked" | "no_action" | "error";

export interface InputRef { n: number; channel: string; from: string; excerpt: string }

export interface NextAction {
  recipient: string;             // "Delivery investigations, Plover Arc Logistics"
  channel: string;               // "Email" | "Customer portal" | ...
  message: string;
  undoable: boolean;
}

export interface DecisionCard {
  routeTo: "claims" | "depot_manager" | "support" | "on_call_lead" | "merchant" | string;
  summary: string;
  clash?: string;                // "Tracking says delivered 08:10; recipient says nothing arrived"
  tried: string[];
  options: { id: string; label: string; undoable: boolean }[];   // 2-3
  wouldChangeMyMind: string;
  deadlineMins: number;
  fallback: string;              // the safe, undoable option taken if nobody answers
  chosen?: string;               // option id; absent in the Reality Test (no human answers)
}

/** Typed per node so both views can render rich cards. All fields optional so the core can ship early. */
export type NodeOutput =
  | { type: "triage"; caseType: string; urgency: "low" | "medium" | "high"; p: number }
  | { type: "clash_check"; clash: boolean; p: number; claims: { who: string; says: string }[] }
  | { type: "missing_info"; missing: boolean; ask?: NextAction }
  | { type: "planner"; nextAction: NextAction; wontDo: string[] }
  | { type: "safety_gate"; risk: number; decision: "allow" | "ask" | "block";
      allowBelow: number; blockAbove: number }            // copied from node config, never hard-coded in UI
  | { type: "human_decision"; card: DecisionCard }
  | { type: "action"; done: NextAction; ok: boolean }
  | { type: "verify"; ok: boolean; p: number; note?: string }
  | { type: "group_check"; groupId?: string; size?: number }
  | { type: string; [k: string]: unknown };               // any other node: rendered as summary only
```

Why this shape:
- **Edges are explicit events.** The gate branch, and the human → action skip in Reality mode, come from what actually happened, not from guessing with the flow JSON.
- **Cost lives on both `model_call` and `node_end`.** The cost ticker is just a sum, and per-node cost appears on the station without extra work.
- `REASONING.md` can be rendered from this same file (node summaries in order plus the gate and card), which keeps "generated from traces, never hand-edited" true.

---

## 5. Replay engine (shared by 2D and 3D)

- `reducer.ts`: `ReplayState = { nodes: Record<id, {status: "idle"|"active"|"done"|"error"|"skipped", summary?, output?, costUsd?, latencyMs?}>, edgesTaken: Set<"from>to">, activeEdge?, gate?, card?, nextAction?, costUsd, group?, done }`. Pure, so it's quick to test with one fixture (TDD-friendly: feed `delivery-024.json`, assert the final state).
- `useReplay.ts`: each event gets a **display time** instead of its raw `t`. Every node gets at least 700 ms and at most 2.5 s (real Claude calls take 2 to 8 s, Jev about 100 ms, and both should read the same on video). `speed` param ×0.5 to ×4, plus pause, step and restart. **Deterministic**, so every recording take is identical.
- Live mode (optional, post-cut): `new EventSource(API/api/cases/stream?id=…)` dispatches into the same reducer.

---

## 6. Scene ("Hamster Office", top-down)

- **Floor:** a dark warm-grey office floor with painted lanes. Columns run left to right in flow order. The loading-dock door sits on the far left, and the filing room (Case Log) on the far right.
- **Stations (one per flow node):** a desk, a hamster sitting at it, a lamp, and an `<Html>` card above showing the node name, a runner badge (Jev = teal, Claude = orange, code = grey), and when done the one-line summary, latency and cost (e.g. `Triage · missing_parcel · high · p 0.91 · 120 ms · $0.00002`).
  - idle: hamster dim, lamp off. active: hamster bobs and types (y-sine), lamp pulses, camera eases over. done: lamp green, card stays. error: lamp red, card shows the error. skipped: the station fades to 30%.
- **Hamster:** a body sphere scaled (1, 0.85, 1.2), a head sphere, two ear spheres, two black eye spheres, a pink nose, and a scarf in the runner colour. About 8 meshes and 30 minutes of work. Mood is shown by bob speed and a "!" sprite on alarm.
- **Parcel (the case):** a cardboard box with a DL-number label. It glides along each `edge` event (lerp along a 2-segment path) and sits on the active desk.
- **Clash Check:** if `clash: true`, two speech-bubble `<Html>` tags pop up ("Tracker: delivered 08:10" vs "Recipient: nothing here") with a red link between them. This is the most "agent judgement" moment, so linger 1.5 s.
- **Safety Gate:** a turnstile station with **three chutes** fanning out: allow (green) to the Action desk, ask (amber) to the Manager's desk, block (red) to the filing room. A dial shows the risk needle against tick marks at `allowBelow` / `blockAbove`, **read from the trace**, which copies them from flow config. The chosen chute lights and the other two dim.
- **Manager's desk (Human Decision):** a bigger desk with a phone that rings (shake) when the parcel arrives. The **decision card slides into the side panel** (DOM, readable): summary, clash, the 2-3 option buttons, "what would change my mind", deadline and fallback. Routing shows as a sign above the desk (`→ Claims` / `→ Depot manager` / `→ Support`) from `card.routeTo`.
  - Demo mode: the card shows `chosen`, and the option highlights as if tapped.
  - Reality mode: it shows "No human in the loop: escalated · fallback logged: <fallback>", which is honest and matches SPEC §6.
- **Action → Verify:** an "outbox" station shows the NextAction as an envelope with recipient and channel. Verify's hamster gives a ✓ or ✗.
- **Side panel (DOM, shared with 2D):** case title and the input excerpts at top, a step log in the middle, the Next Action card (recipient · channel · message · undoable badge) and Decision card at the bottom, and a **cost ticker** in the corner (`$0.0031 this case · 4.2 s`), with Jev and Claude split.
- **Broken-van grouping beat (`fleet-v12.json`, a group trace):** the loading-dock door opens and **40 parcels** (one InstancedMesh, one draw call) slide onto the floor in a messy pile, each tagged with a complaint snippet tooltip on hover. A `group` event fires: the parcels **converge into one crate** stamped "V-12 breakdown · 40 → 1 case", and that crate becomes the parcel for the rest of the flow. The 40 positions come from a seeded random, so every take looks the same.
- **Performance:** about 12 stations × about 12 meshes, plus 40 instances, is well under 300 draw calls. `dpr={[1, 2]}`, no shadows (fake a blob shadow with a dark circle under each desk), `MeshStandardMaterial`, one hemisphere light and one directional light. Optional bloom on the lamps is post-cut. Expect 60 fps on a MacBook.
- **WebGL fallback:** `canUseWebGL()` is checked on mount. If it fails, or `?view=2d` is set, render the 2D view. The toggle (keys `2` / `3`) always works. **Record the 2D take first** as the safety take, then the 3D take.

---

## 7. Demo beats it supports (60 s video)

| Time | Beat | View |
|---|---|---|
| 0–12 s | "Your ops floor, run by hamsters." Top-down office, tagline: stations are tools, the parcel is the case (lunar-base tie-in). If the Architect exists, toggle to a second business's flow and the office re-lays itself out. | 3D |
| 12–25 s | **Broken van:** 40 parcels pour through the dock and collapse into one V-12 case. Tagged "Simulated" if the trace is synthetic (§10 Q4). | 3D |
| 25–45 s | **Real case `delivery-024`** (tracker says delivered, recipient has nothing): Ingest → History → Triage → **Clash** bubbles → Missing Info → Planner → **Gate needle lands in amber** → parcel to the Manager's desk → **decision card** → option chosen → outbox "Email → Delivery investigations, Plover Arc" → Verify ✓ → Case Log. Cost ticker running. | 3D, press `2` for 2 s to show the n8n view of the same moment, back to `3` |
| 45–55 s | Quick second case `delivery-021` at ×3: gate **allow**, straight to the outbox (ask the customer for photos via the portal, which is undoable, so no human needed). Shows the agent knows when *not* to escalate. | 3D |
| 55–60 s | Cost per case plus the one-liner. | panel |

The beats use **real practice traces** for 024 and 021 (run with `?view=escalation`), so the demo shows the same code that runs the Reality Test.

---

## 8. Build order (Arvin, about 2.5 h total; times are elapsed from start)

0. **(0:00–0:15) Contract first.** Commit `apps/api/src/lib/trace.ts` (§4) and tell the core owner and the 2D owner. Hand-write `public/traces/delivery-024.json` as a **fixture** (`synthetic: true`) so both views can start before the core writes real traces.
1. **(0:15–0:40) Shared replay.** `reducer.ts` + a test on the fixture, `useReplay.ts`, `layout.ts`, `loadTrace.ts`, `/replay` page, `ReplayClient`, `SidePanel`, `Controls`. *The 2D team can plug in here.*
2. **(0:40–0:55) Canvas up.** Install `three @react-three/fiber @react-three/drei` (check React 19.3 peer deps; if install fails, stop and stay 2D). Dynamic import, floor, camera, MapControls, one box per station from `layout.ts`, status colours from the reducer.
3. **(0:55–1:30) Office.** `Hamster`, `Station` with `<Html>` card, `Parcel` moving on edges, `SafetyGate` with chutes and needle, `ManagerDesk` with the side-panel decision card. Camera eases to the active station.
4. **(1:30–1:45) Robustness.** `webgl.ts` fallback to 2D, toggle keys, `?speed=`, deterministic timing. Swap the fixture for real `traces/delivery-024.json` and `delivery-021.json` from the core.
5. **(1:45–1:55) Record the safety take** (2D and 3D, `delivery-024`), commit the video.

**──────── CUT HERE IF LATE (or if it's past 15:15 BST, or the core isn't running end to end) ────────**
Steps 0–5 alone give a complete demo.

6. **(1:55–2:15)** Broken-van beat: `ParcelSwarm` (InstancedMesh, seeded), `group` event, crate merge. Needs `fleet-v12.json` (§10 Q4).
7. **(2:15–2:25)** Clash speech bubbles, phone shake, hamster typing bob, Verify ✓/✗.
8. **(2:25–2:35)** Polish: bloom on lamps, route-to signs, runner-split cost ticker.
9. **Stretch, only if everything else is done:** dragging stations (cosmetic, doesn't edit the flow), multi-zone world (city / dock yard / truck offloading / countryside as separate floor tiles), live SSE mode.

**Final recording no later than 16:10 BST.** Video committed by 16:25.

---

## 9. Testing and failure handling

- Reducer unit test on the fixture: final state has the gate decision `ask`, the card present, cost equal to the sum of `node_end.costUsd`, and every station `done` or `skipped`.
- `loadTrace` tries the API, then `/traces/<id>.json`, then shows "No trace for <id>" in the panel (never a blank canvas).
- Unknown node types or missing `output` render as a plain station with the summary only. A trace that ends in `run_end{outcome:"error"}` shows the red lamp on the failing station. That's a fine thing to show: "one bad case doesn't stop the batch".
- Wrap the 3D view in an error boundary that falls back to 2D.

---

## 10. Open questions (the ones I'd have asked), with recommended answers

1. **Who writes traces, and where?** *Recommended:* the core's Case Log writes `traces/<caseId>.json` at the repo root in the §4 schema, and Arvin commits `trace.ts` first so the core codes against it. *Alt:* the viz converts whatever log the core already has (an extra adapter, and a drift risk).
2. **SSE live or replay?** *Recommended:* replay only for the demo. Live SSE is stretch. *Alt:* live SSE (risky while recording, and adds API work for the core owner).
3. **Which case is the hero?** *Recommended:* `delivery-024` (it has a real clash and a carrier investigation, so it's a natural ask-branch). *Alts:* `delivery-021` (damage evidence; likely allow or missing-info, used as the second beat), or `delivery-012` (vehicle breakdown V-12, a single-case version of the van story). Whether 024 really lands on "ask" depends on the gate's risk score. If the real trace says allow, use whichever practice case actually routes to ask, and **don't hand-tune the trace**.
4. **Is the broken-van trace real or simulated?** The public data has no 40-case clusters, and Group Check isn't in the core. *Recommended:* generate 40 complaint variants of case 012's V-12 breakdown, run them through the real flow plus a quick Group Check if it exists. Otherwise ship `fleet-v12.json` with `synthetic: true` and an on-screen "Simulated" tag. Judges are Claude agents, and an unlabeled fake looks worse than a labeled one. *Alt:* drop the beat (it sits below the cut line anyway).
5. **3D or 2D as the primary demo view?** *Recommended:* 3D primary with a 2-second toggle to 2D mid-demo to show "n8n-style too". 2D is the safety take. *Alt:* 2D only, if step 2 fails.
6. **Flow JSON lacks `missing_info`.** `default-incident.json` has no Missing Info node yet, although docs/IDEA.md moves it into the core. *Recommended:* the core owner adds it, and the views lay out whatever the flow says. Nothing to do on the viz side.
7. **React 19.3 vs R3F v9 peer ranges.** *Recommended:* try a plain install at step 2. If it errors, use `--legacy-peer-deps` only if the dev page renders cleanly, else stay 2D. Don't spend more than 10 minutes on this.
8. **Hamsters vs neutral "agents"?** *Recommended:* hamsters. They match the team name, they're memorable for People's Choice, and they cost nothing extra since they're primitives either way. Keep the copy professional (a "Hamster Office" label, real case text) so it doesn't read as a joke to the technical judges.
9. **Recording setup.** *Recommended:* Chrome, 1920×1080 window, `?speed=1`, QuickTime screen recording, voiceover added after. Two takes minimum: 2D safety, then 3D.

---

## 11. Not doing (YAGNI)

Editing flows in 3D, GLTF models, shadows, physics, sound, multiplayer, the Watch flow in 3D, persistence of drag positions, and mobile layout.
