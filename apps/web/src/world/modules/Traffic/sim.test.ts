import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emit } from "../../bus";
import { allVehicles, type VehicleEntry } from "../../registry";
import { edgeKey } from "../../roads";
import { useWorld } from "../../store";
import { TrafficSim } from "./sim";

const DT = 1 / 30;
// Signals run off performance.now(); drive it from simulated time so lights cycle in the test.
let clock = 0;
beforeEach(() => {
  vi.spyOn(performance, "now").mockImplementation(() => clock);
});

function mine(): VehicleEntry[] {
  return [...allVehicles()].filter((v) => /^(car|taxi|hgv)-/.test(v.id));
}

function run(sim: TrafficSim, seconds: number, each?: (prev: Map<string, [number, number]>) => void) {
  const prev = new Map<string, [number, number]>();
  for (let i = 0; i < seconds / DT; i++) {
    for (const v of mine()) prev.set(v.id, [v.object.position.x, v.object.position.z]);
    clock += DT * 1000;
    sim.step(DT);
    each?.(prev);
  }
}

describe("TrafficSim (headless)", () => {
  let sim: TrafficSim;
  afterEach(() => {
    sim.stop();
    useWorld.setState({ blocked: {}, incidents: [] });
  });

  it("spawns 76 vehicles that move without teleporting", () => {
    sim = new TrafficSim();
    sim.start();
    expect(mine().length).toBe(76);
    const start = new Map(mine().map((v) => [v.id, v.object.position.clone()]));
    let worst = 0;
    run(sim, 40, (prev) => {
      for (const v of mine()) {
        const p = prev.get(v.id);
        if (!p) continue;
        worst = Math.max(worst, Math.hypot(v.object.position.x - p[0], v.object.position.z - p[1]));
      }
    });
    // 25 m/s max * 1/30 s ≈ 0.8 m
    expect(worst).toBeLessThan(1.2);
    const moved = mine().filter((v) => v.object.position.distanceTo(start.get(v.id)!) > 30).length;
    expect(moved).toBeGreaterThan(60);
  });

  it("never drives onto a closed road and turns back from one it is on", () => {
    sim = new TrafficSim();
    sim.start();
    run(sim, 5);
    // close a busy downtown street plus whatever edges vehicles are on right now (to force U-turns)
    const keys = new Set([edgeKey("g_0_0", "g_1_0"), edgeKey("g_0_0", "g_0_1")]);
    const victims = mine().filter((v) => v.edgeKey?.startsWith("g_")).slice(0, 3);
    for (const v of victims) keys.add(v.edgeKey!);
    for (const k of keys) useWorld.getState().blockEdge(k, "test");
    emit({ type: "road:blocked", edgeKey: [...keys][0], reason: "test" });
    const entered: string[] = [];
    const onNow = new Map(mine().map((v) => [v.id, v.edgeKey]));
    run(sim, 30, () => {
      for (const v of mine())
        if (v.edgeKey !== onNow.get(v.id)) {
          if (v.edgeKey && keys.has(v.edgeKey) && v.edgeKey !== onNow.get(v.id)) {
            // reversing on the same closed edge after a U-turn is allowed; entering a new one is not
            const before = onNow.get(v.id);
            if (before !== v.edgeKey) entered.push(`${v.id}:${v.edgeKey}`);
          }
          onNow.set(v.id, v.edgeKey);
        }
    });
    expect(entered).toEqual([]);
    // nobody is still queued in front of a closure (no incident given, so the closure is mid-edge);
    // vehicles past it, e.g. waiting at the next light after a U-turn, are fine
    const stuck = mine().filter((v) => v.edgeKey && keys.has(v.edgeKey) && v.stopped && v.t < 0.5);
    expect(stuck.map((v) => `${v.id} ${v.from}->${v.to} t=${v.t.toFixed(2)}`)).toEqual([]);
  });

  it("crash() stops a car; incident:cleared replaces it with a fresh one elsewhere", () => {
    sim = new TrafficSim();
    sim.start();
    run(sim, 2);
    const v = mine().find((x) => x.kind === "car")!;
    expect(v.crash!()).toBe(true);
    expect(v.crash!()).toBe(false);
    run(sim, 2);
    expect(v.stopped).toBe(true);
    const { x, z } = v.object.position;
    useWorld.getState().addIncident({
      id: "inc-1", kind: "car_crash", edgeKey: v.edgeKey!, x, z, status: "cleared", createdAt: 0, note: "test",
    });
    const oldId = v.id;
    emit({ type: "incident:cleared", incidentId: "inc-1" });
    expect(mine().some((e) => e.id === oldId)).toBe(false);
    expect(mine().length).toBe(76);
  });
});
