# Arvin: status for the team plan (10 Oct, 11:50)

### Who and what
Arvin: frontend, the 3D city for the demo video (30% of the score). I own `apps/web/src/world/**` and the `/city` page. Per `docs/submission-tracker.md` I also own the README rewrite, `demo/` (the video) and the SIMULATED label on the mock HUD. I don't touch `apps/api`.

### Built so far
**Pushed to origin/main (latest `4c7360c`), working in Chrome:**
- **City:** a three.js city spanning about ±1100 m, built from 34 modules in `apps/web/src/world/modules/`.
- **Layer 1:** roads, buildings, landmarks, docks, depot, suburbs, countryside, traffic and lights, transit (buses and metro with passengers boarding), the Rivet delivery fleet, crashes and pileups, responders, roadworks, scenarios, sky, camera, HUD, minimap.
- **Layer 2:**
  - motorway
  - river with 7 bridges (Tower Bridge lifts)
  - container terminal (flatbeds that overturn)
  - industrial area (smoke drifting over the city)
  - Old Town, Southbank, Shoreditch, Hampstead
  - construction, police chases, GPU crowds, streetscape
  - weather
  - airport (plane crash into the city: buildings collapse, then rebuild)
- **Tools:** `?stats=1` shows FPS, `?skip=`/`?only=` turn modules on and off, and `window.__city.bench()` times rendering. Warm render is about 3.9 ms/frame (770 draw calls, 3.7M triangles). First load is 10–20 s while shaders compile.
- **Scenarios:** all 50 practice cases and 12 edge-case modifiers can be acted out in the city (`scenarios.ts`, generated from `data/`).

**Mocked:** `modules/WorkflowDriver/engine.ts` fakes the agent: node walk, gate, decision card, cost. It's **not yet labelled SIMULATED** (tracker item, a blocker for video takes).

**Local only:** Rail (last agent still building). Also 2–3 module layout tests fail because of road overlaps; they're cosmetic, not runtime errors.

### Interfaces
**Consumes (from origin/main `apps/api/src/lib/trace.ts`, provided by Anson's runtime):** `Trace { version, runId, caseId, flowId, mode, synthetic?, events: TraceEvent[] }` with `run_start | node_start | model_call | node_end | edge | run_end`. Endpoint: `POST /api/cases` → `{ trace, outcome, outbox, card }`.

**Produces and consumes (`world/store.ts`):**
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
**Bus events (`world/bus.ts`):**
```ts
  | { type: "request:scenario"; scenarioId: string; modifiers: import("./scenarios").Modifier[] }
  | { type: "scenario:staged"; runId: string; scenarioId: string; modifiers: import("./scenarios").Modifier[]; x: number; z: number; vehicleId?: string }
  | { type: "scenario:resolved"; runId: string; scenarioId: string; outcome: "acted" | "asked_for_info" | "escalated" | "blocked" | "no_action" };
```

### Assumptions about other parts
- Practice-run traces (`ANSWERS/<n>/trace.json` or `examples/practice-run/`) get committed, so the city can replay **real** traces offline during recording, without keys.
- `POST /api/cases` with `mode: "demo"` is safe to call from the browser for a live case.

### Voice in my area
Not built yet. I propose these bus events:
```ts
| { type: "voice:call"; callId: string; caseId: string; from: string; to: string; source: "live_human" | "simulated_persona" | "audio_attachment"; state: "ringing" | "live" | "ended" }
| { type: "voice:transcript"; callId: string; speaker: string; text: string; final: boolean }
| { type: "voice:note"; caseId: string; vehicleId?: string; text: string; source: "live_human" | "simulated_persona" | "audio_attachment" }
| { type: "decision:voice"; caseId: string; optionId: string }
```
**What the city would show:**
- a phone ringing above the van or house
- a speech bubble on the person speaking
- a live transcript in the HUD
- a voice-note envelope flying to the depot
- the decision card confirming "option 2" when it's approved by voice
- a SIMULATED tag on persona voices

**What I need:** an `EventSource` stream from the voice layer.

### Next 2 hours
- **11:50–12:20:** SIMULATED label on the mock HUD; merge origin/main; finish Rail.
- **12:20–13:20:** swap the mock for real traces (the shapes match): replay a trace file per scenario and fall back to mock with the label.
- **13:20–14:00:** rewrite the README (8 sections, honest labels for demo-only parts).
- **14:00–15:30:** camera tour shots and the first demo video takes; final take by 16:10.

**Blocked on:** committed real traces (needs someone to run the first real run with a key).

### Risks
- **Real traces:** if none land, the video shows the mock, which is allowed only if clearly labelled.
- **Machine load:** heavy scenes and parallel agents. I'll freeze 3D features at 15:00.
- **Reality Test:** my code is frontend only and can't touch the scored run.
