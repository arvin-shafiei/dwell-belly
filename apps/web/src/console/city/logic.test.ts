import { describe, expect, it } from "vitest";
import { deliveryBars, filterScenarios, formatHour, isTelemetry, linkState, sourceTag, vehicleRows, INJECTORS, STALE_MS } from "./logic";
import type { CityTelemetry } from "../../world/controlChannel";

const tel = (at: number) => ({ type: "telemetry", at }) as CityTelemetry;

describe("console city logic", () => {
  it("link state", () => {
    expect(linkState(null, 0)).toBe("waiting");
    expect(linkState(tel(1000), 1000 + STALE_MS)).toBe("live");
    expect(linkState(tel(1000), 1001 + STALE_MS)).toBe("stale");
  });
  it("formats hours", () => {
    expect(formatHour(17.5)).toBe("17:30");
    expect(formatHour(6)).toBe("06:00");
    expect(formatHour(23.999)).toBe("00:00");
    expect(formatHour(-1)).toBe("23:00");
  });
  it("tags sources", () => {
    expect(sourceTag("agent")).toBe("REAL");
    expect(sourceTag("mock")).toBe("SIMULATED");
    expect(sourceTag(undefined)).toBe("SIMULATED");
  });
  it("filters scenarios", () => {
    const list = [
      { id: "delivery-001", title: "Door slot change", scene: "door_slot_change", where: "suburbs" },
      { id: "delivery-002", title: "Customs invoice", scene: "customs_invoice", where: "docks" },
    ];
    expect(filterScenarios(list, "")).toHaveLength(2);
    expect(filterScenarios(list, "DOCKS").map((s) => s.id)).toEqual(["delivery-002"]);
    expect(filterScenarios(list, "001")).toHaveLength(1);
  });
  it("delivery bars share", () => {
    const bars = deliveryBars({ en_route: 2, delayed: 1, delivered: 1, loading: 0, failed: 0 });
    expect(bars.find((b) => b.key === "en_route")?.share).toBe(0.5);
    expect(deliveryBars({ en_route: 0, delayed: 0, delivered: 0, loading: 0, failed: 0 }).every((b) => b.share === 0)).toBe(true);
  });
  it("sorts vehicles", () => {
    expect(vehicleRows({ van: 2, car: 9, bus: 2 })).toEqual([["car", 9], ["bus", 2], ["van", 2]]);
  });
  it("narrows telemetry", () => {
    expect(isTelemetry(tel(1))).toBe(true);
    expect(isTelemetry({ type: "ping" })).toBe(false);
  });
  it("has all eight injectors", () => {
    expect(INJECTORS.map((i) => i.event)).toHaveLength(8);
  });
});
