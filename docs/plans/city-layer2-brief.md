# 3D city, Layer 2: brief for district and realism agents

Layer 1 built a working city: a 9×9 downtown grid inside a highway ring, docks, depot, suburbs, countryside, airport, traffic, crashes, responders, roadworks, transit and a mock AI workflow. **Layer 2 makes it WOW**: a much bigger, proper city with organic districts, a river with bridges, an outer motorway, a container terminal, heavy industry whose smoke drifts over the city, rail, construction, crowds everywhere and wild driving. Open http://localhost:3000/city mentally as a hero shot for a demo video: it should look like a real, dense, living metropolis from above, not a grid with things around it.

**First read `docs/plans/city-agents-brief.md`.** All its rules still apply (ownership, no installs, no network assets, perf, verification, no browser, no git, report format), except where this file overrides them.

## What changed in the shared contracts

- `config.ts`: `WORLD_SIZE` is now 2200 (world spans about ±1100). New zones are `containerTerminal`, `industrial`, `southbank`, `oldTown`, `shoreditch` and `hampstead`. `RIVER` (polyline, 70 m wide, flows west to east at z ≈ -560..-660 into the sea), `WIND` (smoke and clouds drift with it, blowing from the SE over the city), and `MOTORWAY` (C-shaped orbital polyline, open to the sea in the east).
- **District roads:** `apps/web/src/world/districts/<name>.ts`. Each district agent owns ONE such file and fills `nodes`/`edges` (see `districts/types.ts`). `roads.ts` merges them into the shared graph at load, so **every module automatically drives, paths and draws on your roads**: the Roads module renders all edges (kind "highway" = 12 m dual carriageway with barriers; "street" = 8 m with markings; "country" = 6 m), Traffic drives them, and Minimap draws them.
  - Node ids MUST be prefixed with your district (e.g. `ind_`, `ct_`, `old_`, `sb_`, `sh_`, `hp_`, `mw_`, `br_`).
  - Edges may connect to existing nodes: ring `h_0..h_15` (square ring at ±220, h_0 = (-220,-220) NW corner, going clockwise: north side h_0..h_3, east side h_4..h_7, south side h_8..h_11, west side h_12..h_15; check `roads.ts`), downtown `g_i_j`, `dock_*`, `depot_*`, `sub_*`, `farm_*`, `airport_*`, and motorway nodes `mw_*` once the Motorway agent adds them.
  - **Make roads organic:** curves are several short straight edges through extra nodes (every 15–30 m). Use crescents, diagonals, roundabouts (a ring of 6–8 nodes), cul-de-sacs, high streets, and varied block sizes. Avoid uniform grids.
  - Your district must stay **connected** to the rest of the network. `npx vitest run src/world/roads.test.ts` must pass ("is fully connected"). Never create an edge that crosses the river except via the Bridges agent's bridges.
  - Your roads must stay inside your zone box, except for the short connector roads that link to the existing network.
- Everything else (store, registry, bus, signals, scenarios) is unchanged.

## Realism bar

- **Density and variety:** many buildings with varied heights, footprints and roof types, ground-floor shops, street trees, parked cars, lamp posts, signage, and props. Use seeded randomness and instancing per archetype.
- **Life:** moving things wherever possible (people, vehicles, machines, smoke, water, flags, lights) on GPU-friendly paths.
- **Night:** windows and signs glow with `timeOfDay` (update on change only).

## Performance on the bigger world (a MacBook with Apple GPU; CPU is the bottleneck)

- **Animate on the GPU when there are many things.** For crowds, smoke, flags, water, blinking lights and so on, use a custom `onBeforeCompile` or `ShaderMaterial` with a `uTime` uniform: one uniform update per frame instead of thousands of matrix writes.
- **InstancedMesh:** call `computeBoundingSphere()` after filling so frustum culling works. Large static sets per district should be merged into a few meshes.
- **Draw calls:** your module ≤ 150. Shadows: `castShadow` only on tall buildings.
- No per-frame allocations, and no zustand writes per frame.
