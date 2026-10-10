# Arvin: status for the team plan (10 Oct, ~11:00)

### Who and what
Arvin. 3D city view for the demo video (30%). Own `apps/web/src/world/**` and page `/city` (`apps/web/src/app/city`). Not touching `apps/api` or the agent.

### Built so far
**Pushed (origin/main, incl. 7c44ece):** three.js city (r3f + drei): roads with left-hand driving and `findPath` around blocked roads, buildings/skyline, suburbs, depot, airport, traffic + lights, crashes (fire/smoke), responders, roadworks closing roads, ambient life, countryside, delivery fleet, responder dispatch for pileups, `WorkflowDriver/engine.ts` (mock agent: walks a case through ingest → … → log with fake risk/gate/cost and a decision card, driven by scenarios), minimap, `WorkflowHud` overlay (mini flow graph, scenario picker). `scenarios.ts` + generated `scenarios.data.ts` map all 50 public delivery cases to a city scene, plus 12 Reality Test modifiers (clash, tool fail, injection, do_nothing…).

**Local only (not pushed):** `Scenarios/` (acts a case out in the city; `Scenarios.tsx` on main is a stub), `Docks/`, `Transit/`, `Landmarks/` helpers. 395 vitest tests pass locally.

**Mocked:** the whole workflow. Nothing reads real traces or calls the API yet.

### Interfaces
Consumed by HUD and driver (`apps/web/src/world/store.ts`):
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
Bus (`bus.ts`):
```ts
| { type: "request:scenario"; scenarioId: string; modifiers: Modifier[] }
| { type: "scenario:staged"; runId: string; scenarioId: string; modifiers: Modifier[]; x: number; z: number; vehicleId?: string }
| { type: "scenario:resolved"; runId: string; scenarioId: string; outcome: "acted" | "asked_for_info" | "escalated" | "blocked" | "no_action" };
```
Mock engine (`WorkflowDriver/engine.ts`, pushed):
```ts
export type NodeId =
  | "ingest" | "history" | "triage" | "clash" | "group" | "missing_info"
  | "planner" | "gate" | "human" | "action" | "verify" | "log";
export interface DecisionCard { options: string[]; safe: string; chosen?: string; auto?: boolean; }
// engine.decide(caseId: string, option: string): boolean
```
**Assumed from backend (does not exist yet):** a trace per case (JSON, one entry per node with status, summary, cost, latency, decision type, actions) that I can map 1:1 onto `WorkflowEvent`.

### Assumptions about other parts
- Backend publishes the trace schema early and keeps node ids matching `default-incident.json`; the stress test's 3-call architecture (Understand/Decide/Gate) is fine as long as the trace still names SPEC steps.
- Either `GET /api/cases/:id/trace` or trace files in `ANSWERS/<n>/trace.json` I can fetch. Replay only; 3D never calls the agent.
- Decision types (`act`, `ask_for_info`, `route_to_owner`, `hold_for_human`, `wait_until`, `refuse`) replace my `Outcome` once they exist.

### Voice in your area
Show voice, never produce it. Need trace/bus events:
- `voice:note_in {caseId, from, source, transcript}` → driver van shows a pulsing mic bubble, transcript ticks into HUD tagged as a claim with its source.
- `call:ringing | call:connected | call:ended {caseId, callee: driver|recipient|manager, source}` → phone-ring icon over the van/house/depot, camera flies there, live transcript panel, speaking character highlighted.
- `decision:voice {caseId, option}` → manager desk at the depot lights up, decision card shows "approved by voice: option 2", then calls my `engine.decide` (or the real equivalent).
- `source: simulated_persona` gets a visible "SIMULATED" badge.
Need from voice: those events on the bus or in the trace, plus optional audio URL to play in the demo.

### Next 2 hours
- 11:00–11:30 commit + push remaining local modules (Scenarios, Docks, Transit, Landmarks).
- 11:30–12:30 trace → `WorkflowEvent` adapter; replay one real practice-case trace in `/city`. Blocked on trace schema.
- 12:30–13:00 voice HUD states (ringing, transcript, voice approval) driven by the mock.
- Abort rule stands: if core isn't end to end by 14:30, I move to helping the core.

### Risks
- 3D bundle/perf: low-end laptop frame rate during recording. Mitigation: record video early (by 15:30).
- Trace schema arriving late: I keep the mock engine as a fallback for the video.
- None of my code is on the Reality Test path; `/city` cannot break the batch runner.
