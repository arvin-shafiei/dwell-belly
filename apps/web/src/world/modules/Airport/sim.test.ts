import { describe, expect, it } from "vitest";
import type { WorldEvent } from "../../bus";
import type { Incident } from "../../store";
import { AirportSim, type SimEffects } from "./sim";

function fake() {
  const incidents = new Map<string, Incident>();
  const blocked = new Set<string>();
  const events: WorldEvent[] = [];
  const statuses: string[] = [];
  let n = 0;
  const fx: SimEffects = {
    addIncident: (i) => {
      incidents.set(i.id, i);
      statuses.push(`${i.kind}:${i.status}`);
    },
    updateIncident: (id, p) => {
      const i = incidents.get(id)!;
      Object.assign(i, p);
      if (p.status) statuses.push(`${i.kind}:${p.status}`);
    },
    blockEdge: (k) => blocked.add(k),
    unblockEdge: (k) => blocked.delete(k),
    emit: (e) => events.push(e),
    blocked: () => blocked,
    newId: () => `INC-${++n}`,
    now: () => 0,
  };
  return { fx, incidents, blocked, events, statuses };
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const quiet = { firstEmergency: 1e9, firstCrash: 1e9 };

describe("AirportSim", () => {
  it("emergency landing: incident lifecycle, runway closed then reopened, crews return home", () => {
    const f = fake();
    const sim = new AirportSim(f.fx, rng(4), quiet);
    sim.request("emergency_landing");
    let closedSeen = false;
    for (let t = 0; t < 170; t += 0.05) {
      sim.step(0.05);
      if (sim.fleet.lock.closed) closedSeen = true;
    }
    expect(closedSeen).toBe(true);
    expect(f.statuses).toEqual([
      "emergency_landing:active",
      "emergency_landing:responding",
      "emergency_landing:clearing",
      "emergency_landing:cleared",
    ]);
    const inc = [...f.incidents.values()][0];
    expect(inc.note).toMatch(/Emergency landing: RV212 engine fire, runway 09 closed/);
    expect(f.events.map((e) => e.type)).toEqual(["incident:created", "incident:cleared"]);
    expect(sim.fleet.lock.closed).toBe(false);
    for (const u of sim.crew) expect(u.state).toBe("home");
    expect(sim.busy).toBe(false);
  });

  it("plane crash: blocks the road, crews drive out and foam it, then everything reopens", () => {
    const f = fake();
    const sim = new AirportSim(f.fx, rng(9), quiet);
    sim.request("plane_crash");
    let blockedKey = "";
    let sprayed = false;
    let crewOnRoad = false;
    for (let t = 0; t < 300; t += 0.05) {
      sim.step(0.05);
      if (f.blocked.size) blockedKey = [...f.blocked][0];
      if (sim.crew.some((u) => u.spraying)) sprayed = true;
      if (sim.crew.some((u) => u.from && u.to)) crewOnRoad = true;
    }
    expect(blockedKey).not.toBe("");
    expect(f.blocked.size).toBe(0);
    expect(sprayed).toBe(true);
    expect(crewOnRoad).toBe(true);
    expect(f.statuses).toEqual(["plane_crash:active", "plane_crash:responding", "plane_crash:clearing", "plane_crash:cleared"]);
    expect(f.events.map((e) => e.type)).toEqual(["incident:created", "road:blocked", "incident:cleared", "road:reopened"]);
    const inc = [...f.incidents.values()][0];
    expect(inc.edgeKey).toBe(blockedKey);
    expect(inc.note).toMatch(/down .*road closed/);
    for (const u of sim.crew) expect(u.state).toBe("home");
  });
});
