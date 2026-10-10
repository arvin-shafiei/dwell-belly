import { describe, expect, it } from "vitest";
import { WATER_X, ZONES } from "../../config";
import { fbm, mulberry32, shoreX, valueNoise } from "./noise";

describe("Ground noise", () => {
  it("rng is deterministic and in [0,1)", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("value noise and fbm stay in [0,1]", () => {
    for (let i = 0; i < 500; i++) {
      const x = i * 0.37 - 80;
      const y = i * 0.91 + 3;
      expect(valueNoise(x, y)).toBeGreaterThanOrEqual(0);
      expect(valueNoise(x, y)).toBeLessThanOrEqual(1);
      expect(fbm(x, y)).toBeGreaterThanOrEqual(0);
      expect(fbm(x, y)).toBeLessThanOrEqual(1);
    }
  });

  it("value noise is continuous", () => {
    expect(Math.abs(valueNoise(3.4999, 1.2) - valueNoise(3.5001, 1.2))).toBeLessThan(0.01);
    expect(Math.abs(valueNoise(4 - 1e-6, 1.2) - valueNoise(4 + 1e-6, 1.2))).toBeLessThan(0.001);
  });
});

describe("shoreX", () => {
  it("is the straight quay wall along the docks", () => {
    for (let z = ZONES.docks.minZ; z <= ZONES.docks.maxZ; z += 10) expect(shoreX(z)).toBe(WATER_X);
  });

  it("keeps the beach waterline inside WATER_X and out of the docks/highway", () => {
    for (let z = -3000; z <= 3000; z += 3) {
      const x = shoreX(z);
      expect(x).toBeLessThanOrEqual(WATER_X);
      expect(x).toBeGreaterThan(WATER_X - 12);
    }
  });

  it("is continuous just outside the quay", () => {
    expect(Math.abs(shoreX(80.01) - (WATER_X - 6))).toBeLessThan(0.01);
  });
});
