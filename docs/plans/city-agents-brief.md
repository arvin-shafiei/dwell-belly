# 3D city: brief for module agents

You are one of ~20 agents building a 3D city in parallel, each owning ONE module. The city is a stylised London-ish world for "Rivet Delivery", a delivery company. Trucks and vans deliver parcels, traffic flows, things go wrong (car and truck crashes, van breakdowns, roadworks closing roads), police, ambulances and tow trucks respond, and traffic reroutes around closed roads. An AI ops workflow (mocked on the frontend) reacts to all of it. It's the hero of a 60-second hackathon demo video, so it has to look great and feel alive and a bit wild.

## Read first

- `apps/web/src/world/config.ts`: zone boxes, sizes. Stay inside your zone.
- `apps/web/src/world/roads.ts`: road graph, `findPath(from, to, blocked)`, `lanePosition(a, b, t)` (traffic drives on the **left**), `PLACES`, `DELIVERY_STOPS`, `edgeMidpoint`.
- `apps/web/src/world/store.ts`: zustand `useWorld`: blocked roads, incidents, deliveries, workflow events, selection/focus, `timeOfDay`, `paused`. `blockedSet()`.
- `apps/web/src/world/registry.ts`: live vehicles (per-frame positions, `crash()` hook, `vehiclesAhead`).
- `apps/web/src/world/bus.ts`: one-off events, plus UI requests (`request:crash`, `request:roadworks`, `request:breakdown`).
- `apps/web/src/world/signals.ts`: traffic light timing (`signalFor(node, fromNode, performance.now())`).
- `apps/web/src/world/World.tsx`, `CityPage.tsx`, and the "3D city" section of `CLAUDE.md`.

## Rules

1. **You own ONLY** `apps/web/src/world/modules/<YourModule>.tsx` and any new files under `apps/web/src/world/modules/<YourModule>/`. Do not edit anything else: shared contracts, other modules, World.tsx, package.json, configs. If you need a contract change, don't make it; describe it in your report and work around it locally.
2. **No installs.** Available: `three` 0.186, `@react-three/fiber` 9, `@react-three/drei` 10, `@react-three/postprocessing` 3, `zustand` 5, React 19, Tailwind 4 (DOM overlays only).
3. **No network assets.** No GLTF, no image URLs, no fonts. drei `<Text>`/`<Text3D>` fetch fonts, so don't use them. Build from primitives. For text and signs use `CanvasTexture` (draw text on a 2D canvas) or drei `<Html>` (sparingly, for a few labels).
4. **Look:** stylised low-poly, cohesive and saturated but tasteful (think Mini Motorways / Townscaper / Pocket City). Use `MeshStandardMaterial` (`flatShading` welcome) and roughness around 0.8. Brand colours: Rivet orange `#ff6a1a`, white vans. London touches welcome (red buses, black cabs, red phone boxes, brick).
5. **Performance budget is shared by 20 modules.** Use `InstancedMesh` (or drei `<Instances>`) for anything repeated. Aim for ≤150 draw calls for your module, and no per-frame allocations (reuse vectors/matrices). Don't call `setState`/zustand setters every frame; keep per-frame state in refs or the registry. `castShadow` only on big objects. Don't add lights except where your brief says (one cheap point light per emergency vehicle at most).
6. **Ground is y = 0.** Roads are drawn at y ≈ 0.02–0.06. Vehicles sit on y = 0.
7. In `useFrame`, skip simulation when `useWorld.getState().paused`. Use `performance.now()` as the shared clock (signals depend on it). Clamp `delta` to ≤ 0.1.
8. Default-export your component with `"use client"` at the top. 3D modules render inside the `<Canvas>`. DOM overlays (WorkflowHud, Minimap) render outside it.
9. **Superpowers:** use the superpowers skills where they fit. Use `test-driven-development` for pure logic (pathing, schedulers, engines): put tests in `modules/<YourModule>/*.test.ts`, run `npx vitest run src/world/modules/<YourModule>` from `apps/web`.
10. **Verify** from `apps/web`:
    - `npx tsc --noEmit -p . 2>&1 | grep "modules/<YourModule>"` returns nothing. Other modules are being edited concurrently, so ignore their errors.
    - `npx eslint src/world/modules/<YourModule>.tsx src/world/modules/<YourModule>` is clean.
    - `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/city` returns 200. A dev server is already running there.
    - Do NOT start another dev server, do NOT run `next build`, do NOT open a browser (the lead tests in Chrome), do NOT git commit or push.
11. **Report back** in ≤12 lines: what you built, files, how it interacts with other modules (events/store/registry), any contract change requests, known issues.

## Downtown block layout (for Buildings, Landmarks, Life)

Downtown roads run every 40 m along x and z from -160 to 160. Block cell centres are x, z ∈ {-140, -100, -60, -20, 20, 60, 100, 140}. Each block spans ±16 m around its centre (inside the 8 m roads). Keep a 3 m sidewalk, so buildable area is ±13 m.

**Reserved cells (Buildings must leave them empty; Landmarks fills them):**
- (-140, 140): police station
- (140, -140): hospital
- (-140, -140): highway maintenance yard
- (20, 20): central park with clock tower
- (140, 20): ferris wheel (riverside eye)
