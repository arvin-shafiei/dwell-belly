# Arvin: status for the team plan (10 Oct, 11:05)

### Who and what
Arvin. Frontend 3D city for the demo video (30%). I own `apps/web/src/world/**` and the `/city` page (`apps/web/src/app/city`). I'm not touching `apps/api` or the agent. Built with Claude Code subagents (about 35 so far), one module each.

### Built so far
**Pushed to origin/main (latest 8f98484):**
- **Contracts:**
  - `config.ts` (zones; Layer 2 world ±1100, `RIVER`, `WIND`, `MOTORWAY`)
  - `roads.ts` (graph, `findPath` avoiding blocked edges, left-hand lanes, `districts/*.ts` merged at load)
  - `store.ts`, `registry.ts`, `bus.ts`, `signals.ts`
  - `scenarios.ts` plus the generated `scenarios.data.ts`: all 50 delivery cases mapped to a city scene, plus 12 Reality Test modifiers
- **Layer 1 modules (`world/modules/`), all working:** Ground, Roads, Buildings, Landmarks, Docks, Countryside, Depot, Suburbs, Airport (stub until its agent lands), Traffic, TrafficLights, Transit (buses and metro with boarding), DeliveryFleet, Responders, Roadworks, Scenarios (acts any case out), Life, Sky, CameraRig (follow, cinematic tour), WorkflowDriver, WorkflowHud, Minimap.
- 26 commits, about 460 vitest tests.

**Mocked:** `WorkflowDriver/engine.ts` fakes the agent: node walk, risk, gate, cost, decision card. Nothing reads real traces yet.

**Local or in flight, not pushed:**
- 17 Layer 2 agents are running: motorway, river and Tower Bridge, container terminal (flatbeds), industrial (smoke over the city), Old Town, Southbank, Shoreditch, Hampstead, rail, GPU crowds, streetscape, construction, police chases, plus upgrades to Traffic, Ground, Countryside and Sky (weather).
- Crashes is temporarily unmounted in `World.tsx` mid-rewrite (pileups).
- 7 tests fail locally because of that work in flight.

### Interfaces
Consumed by the HUD (`store.ts`):
```ts
export interface WorkflowEvent {
  id: string;
  t: number; // performance.now() ms
  caseId: string; // e.g. "CASE-0042"
  nodeId: string; // flow node id from apps/api/flows/default-incident.json, e.g. "triage"
  status: "start" | "ok" | "ask" | "block" | "error";
  summary: string;
}
```
Produced and consumed (`bus.ts`):
```ts
  | { type: "request:scenario"; scenarioId: string; modifiers: import("./scenarios").Modifier[] }
  | { type: "scenario:staged"; runId: string; scenarioId: string; modifiers: import("./scenarios").Modifier[]; x: number; z: number; vehicleId?: string }
  | { type: "scenario:resolved"; runId: string; scenarioId: string; outcome: "acted" | "asked_for_info" | "escalated" | "blocked" | "no_action" };
```
**Assumed from the backend, which doesn't exist yet:** one trace per case, with entries `{nodeId, status, summary, costUsd, latencyMs}` and a final `{decisionType, actions[{recipient, channel, message, status}]}`. A `GET` for the list and one `GET` per trace (the shape in `docs/plans/2026-10-10-3d-workflow-viz-design.md` §4). I'll map it 1:1 onto `WorkflowEvent` and replace the mock.

### Assumptions about other parts
- The backend writes traces for practice runs that I can replay, so the demo shows real decisions rather than mock ones.
- Node ids stay `ingest, history, triage, clash, missing_info, group, planner, gate, human, action, verify, log`, or someone tells me the new ones. The stress-test 3-call design still maps onto them.

### Voice in my area
Voice isn't built in my area yet. It would show up as events on `bus.ts` (proposed):
```ts
| { type: "voice:call"; callId: string; caseId: string; from: string; to: string; source: "live_human" | "simulated_persona" | "audio_attachment"; state: "ringing" | "live" | "ended" }
| { type: "voice:transcript"; callId: string; speaker: string; text: string; final: boolean }
| { type: "voice:note"; caseId: string; vehicleId?: string; text: string; source: "live_human" | "simulated_persona" | "audio_attachment" }
| { type: "decision:voice"; caseId: string; optionId: string }
```
What the city would show:
- a phone ringing over the van or house;
- a speech bubble on the speaking character;
- a live transcript in the HUD;
- a voice-note envelope flying from a driver to the depot;
- the manager desk lighting up when someone says "option 2";
- a "SIMULATED" tag on persona voices.

From the voice layer I need these events, ideally through a small browser bridge (an `EventSource` from the API).

### Next 2 hours
- **11:05–12:00:** merge Layer 2 agents as they land, re-enable Crashes, run a perf pass in Chrome (target 50+ fps on M4).
- **12:00–13:00:** swap the mock workflow for real traces once the backend publishes them (needs the trace shape agreed). Add voice events if the voice owner agrees the shape.
- **13:00–14:00:** set up camera tour shots and record a first demo take. Blocked on: trace format and endpoint.

### Risks
- **Builds:** parallel agents can break the build mid-edit. This happened once and was fixed in minutes; each agent now checks the page still builds.
- **Performance:** the bigger world may run too slowly. Fallback: drop districts from `World.tsx`.
- **Mock data:** if real traces don't land, the demo shows the mock engine. It must be labelled simulated, so judges never see fabricated results.
- **Reality Test:** my code is frontend only and can't affect the scored run.
