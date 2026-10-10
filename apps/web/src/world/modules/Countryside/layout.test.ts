import { describe, expect, it } from "vitest";
import { WATER_X, ZONES, inBox } from "../../config";
import { FARM, inAirport, tallPropAllowed, distToSegment, hillHeight, makeFields, makeHills, makeTrees, makeTurbines, roadDistance } from "./layout";

describe("distToSegment", () => {
  it("measures to the interior and to the endpoints", () => {
    expect(distToSegment(5, 3, 0, 0, 10, 0)).toBeCloseTo(3);
    expect(distToSegment(-4, 3, 0, 0, 10, 0)).toBeCloseTo(5);
    expect(distToSegment(13, 4, 0, 0, 10, 0)).toBeCloseTo(5);
    expect(distToSegment(1, 1, 2, 2, 2, 2)).toBeCloseTo(Math.SQRT2);
  });
});

describe("countryside layout", () => {
  const hills = makeHills();
  const turbines = makeTurbines(hills);
  const fields = makeFields();
  const trees = makeTrees(hills, turbines);

  it("keeps farm buildings off the lanes", () => {
    const footprints: [number, number, number][] = [
      [FARM.farmhouse.x, FARM.farmhouse.z, 7],
      [FARM.barn.x, FARM.barn.z, 11],
      [FARM.silo.x, FARM.silo.z, 3.5],
      [FARM.pond.x, FARM.pond.z, FARM.pond.r],
      [FARM.windmill.x, FARM.windmill.z, 5],
      [FARM.tractor.x, FARM.tractor.z, 3],
    ];
    for (const [x, z, r] of footprints) expect(roadDistance(x, z)).toBeGreaterThan(r + 4.5);
    for (const t of turbines) {
      expect(roadDistance(t.x, t.z)).toBeGreaterThan(8);
      expect(tallPropAllowed(t.x, t.z)).toBe(true);
      expect(inAirport(t.x, t.z, 20)).toBe(false);
    }
  });

  it("keeps hills clear of the westmost lane", () => {
    expect(hillHeight(hills, -345, 0)).toBe(0);
    for (const h of hills.slice(0, 15)) expect(h.x + h.r).toBeLessThanOrEqual(-357);
    // nothing of the hills inside the airport box + margin
    for (let x = -480; x <= -230; x += 5) for (let z = -460; z <= -230; z += 5) expect(hillHeight(hills, x, z)).toBe(0);
  });

  it("scatters a few thousand trees, never on roads, zones or sea", () => {
    expect(trees.length).toBeGreaterThan(900);
    expect(trees.length).toBeLessThanOrEqual(2600);
    for (const t of trees) {
      expect(roadDistance(t.x, t.z)).toBeGreaterThanOrEqual(9);
      expect(t.x).toBeLessThanOrEqual(WATER_X - 10);
      expect(inAirport(t.x, t.z)).toBe(false);
      for (const z of [ZONES.downtown, ZONES.docks, ZONES.depot, ZONES.suburbs, ZONES.countryside])
        expect(inBox(z, t.x, t.z)).toBe(false);
    }
  });

  it("is deterministic", () => {
    expect(makeTrees(hills, turbines).slice(0, 5)).toEqual(trees.slice(0, 5));
  });

  it("lays field stripes inside the zone and off the lanes", () => {
    expect(fields.stripes.length).toBeGreaterThan(100);
    for (const s of fields.stripes) {
      expect(inBox(ZONES.countryside, s.x, s.z)).toBe(true);
      expect(roadDistance(s.x, s.z)).toBeGreaterThanOrEqual(5);
    }
    expect(fields.pastures.length).toBe(3);
    for (const p of fields.pastures) expect(p.spots.length).toBeGreaterThan(20);
    expect(fields.pieces.length).toBeGreaterThan(100);
  });
});
