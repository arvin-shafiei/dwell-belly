import { describe, expect, it } from "vitest";
import { TIMING, newLife, stepLife } from "./lifecycle";

const idle = { anyArrived: false, towArrived: false, externallyCleared: false };

describe("incident lifecycle", () => {
  it("runs responding -> clearing -> cleared -> release in order", () => {
    const life = newLife(0);
    expect(stepLife(life, idle, 1)).toEqual([]);
    expect(stepLife(life, { ...idle, anyArrived: true }, 10)).toEqual(["set_responding"]);
    expect(stepLife(life, { ...idle, anyArrived: true }, 12)).toEqual([]);
    expect(stepLife(life, { ...idle, anyArrived: true, towArrived: true }, 20)).toEqual([]);
    expect(stepLife(life, { ...idle, anyArrived: true, towArrived: true }, 20 + TIMING.towWorkS - 0.1)).toEqual([]);
    expect(stepLife(life, { ...idle, anyArrived: true, towArrived: true }, 20 + TIMING.towWorkS)).toEqual(["set_clearing"]);
    const c = 20 + TIMING.towWorkS;
    expect(stepLife(life, idle, c + TIMING.towDepartS)).toEqual(["release_tow"]);
    expect(stepLife(life, idle, c + TIMING.clearAfterS - 0.01)).toEqual([]);
    expect(stepLife(life, idle, c + TIMING.clearAfterS)).toEqual(["set_cleared"]);
    expect(stepLife(life, idle, c + TIMING.clearAfterS + TIMING.returnDelayS)).toEqual(["release_units"]);
    expect(life.phase).toBe("done");
    expect(stepLife(life, idle, 999)).toEqual([]);
  });

  it("emits each action exactly once even with big time jumps", () => {
    const life = newLife(0);
    stepLife(life, { ...idle, anyArrived: true, towArrived: true }, 5);
    const acts = stepLife(life, { ...idle, anyArrived: true, towArrived: true }, 1000);
    expect(acts).toEqual(["set_clearing", "release_tow", "set_cleared", "release_units"]);
  });

  it("tow arriving first also counts as first arrival", () => {
    const life = newLife(0);
    expect(stepLife(life, { ...idle, anyArrived: true, towArrived: true }, 3)).toEqual(["set_responding"]);
  });

  it("gives up waiting for the tow after giveUpS", () => {
    const life = newLife(0);
    stepLife(life, { ...idle, anyArrived: true }, 5);
    expect(stepLife(life, { ...idle, anyArrived: true }, TIMING.giveUpS)).toContain("set_clearing");
  });

  it("releases units without re-clearing when cleared externally", () => {
    const life = newLife(0);
    stepLife(life, { ...idle, anyArrived: true }, 5);
    expect(stepLife(life, { ...idle, externallyCleared: true }, 6)).toEqual([]);
    expect(stepLife(life, idle, 6 + TIMING.returnDelayS)).toEqual(["release_tow", "release_units"]);
  });
});
