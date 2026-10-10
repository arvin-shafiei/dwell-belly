import { describe, expect, it } from "vitest";
import { easeInOutCubic, framePosition, pickTourShot, zoneFrame, HOTKEYS, type TourIncident } from "./logic";

describe("easeInOutCubic", () => {
  it("maps endpoints and midpoint, clamps outside 0..1", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(2)).toBe(1);
  });
});

describe("framePosition", () => {
  it("places the camera at the given distance and elevation from the target", () => {
    const [x, y, z] = framePosition(10, 0, 20, 0, Math.PI / 4, 100);
    const d = Math.hypot(x - 10, y, z - 20);
    expect(d).toBeCloseTo(100);
    expect(y).toBeCloseTo(100 * Math.sin(Math.PI / 4));
    // azimuth 0 means the camera sits on the +z side of the target
    expect(x).toBeCloseTo(10);
    expect(z).toBeGreaterThan(20);
  });
});

describe("zoneFrame", () => {
  it("centres on the zone box and scales distance with zone size", () => {
    const f = zoneFrame("docks");
    expect(f.x).toBe(290);
    expect(f.z).toBe(0);
    expect(zoneFrame("downtown").distance).toBeGreaterThan(f.distance);
  });
});

describe("pickTourShot", () => {
  const inc = (id: string, createdAt: number, status: TourIncident["status"] = "active"): TourIncident => ({
    id, kind: "car_crash", x: 1, z: 2, status, createdAt,
  });

  it("shows the newest unseen active incident on odd steps", () => {
    const shot = pickTourShot(1, [inc("a", 1), inc("b", 5), inc("c", 3)], new Set());
    expect(shot).toEqual({ kind: "incident", id: "b", x: 1, z: 2 });
    const next = pickTourShot(3, [inc("a", 1), inc("b", 5), inc("c", 3)], new Set(["b"]));
    expect(next).toMatchObject({ kind: "incident", id: "c" });
  });

  it("falls back to the newest incident when all have been seen", () => {
    expect(pickTourShot(1, [inc("a", 1), inc("b", 5)], new Set(["a", "b"]))).toMatchObject({ id: "b" });
  });

  it("ignores cleared incidents and cycles scenic shots", () => {
    const kinds = [0, 1, 2, 3, 4, 5].map((s) => pickTourShot(s, [inc("x", 1, "cleared")], new Set()).kind);
    expect(kinds).not.toContain("incident");
    expect(new Set(kinds)).toEqual(new Set(["chase", "skyline", "docks", "roadworks"]));
  });

  it("uses scenic shots on even steps even when incidents exist", () => {
    expect(pickTourShot(2, [inc("a", 1)], new Set()).kind).not.toBe("incident");
  });
});

describe("HOTKEYS", () => {
  it("lists every bound key", () => {
    const keys = HOTKEYS.map((h) => h.keys).join(" ");
    for (const k of ["WASD", "Q", "E", "R", "F", "1", "V", "C", "Esc"]) expect(keys).toContain(k);
  });
});
