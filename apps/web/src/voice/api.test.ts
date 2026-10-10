import { describe, expect, it } from "vitest";
import { DENIAL as SERVER_DENIAL } from "../../../api/src/voice/wording";
import { DENIAL } from "./api";

describe("voice api client", () => {
  it("falls back to exactly the server's denial wording", () => {
    expect(DENIAL).toBe(SERVER_DENIAL);
  });
});
