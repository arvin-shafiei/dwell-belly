import { describe, expect, it } from "vitest";
import { spokenLanguage } from "./language";

describe("spokenLanguage", () => {
  it("reads the language a note was spoken in", () => {
    expect(spokenLanguage("[spoken in Spanish] La puerta está cerrada.")).toBe("Spanish");
  });
  it("is null for a note in English or without a mark", () => {
    expect(spokenLanguage("Gate's locked.")).toBeNull();
    expect(spokenLanguage("[unclear transcription] mumble")).toBeNull();
  });
});
