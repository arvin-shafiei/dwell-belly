import assert from "node:assert/strict";
import { test } from "node:test";
import { caseKeyterms, unknownReferences } from "./references.ts";

const caseText = [
  "Event 1 | 2026-02-04T09:00:00Z | Context | Email\nFrom: Dispatch, Plover Arc Logistics\nTo: Desk\nDL-6010 (TG-6010) is booked for 10:00 to 14:00.",
  "- **From:** Elva Kesh, recipient\nPlease check INV-024 [urgent] and route LG4.",
].join("\n\n");

test("caseKeyterms takes the case's references, times and people, cleaned for the speech-to-text API", () => {
  const terms = caseKeyterms(caseText);
  for (const t of ["DL-6010", "TG-6010", "INV-024", "LG4", "10:00", "14:00", "Dispatch", "Elva Kesh"]) assert.ok(terms.includes(t), `missing ${t}`);
  assert.equal(new Set(terms).size, terms.length, "no duplicates");
  for (const t of terms) {
    assert.doesNotMatch(t, /[<>{}[\]\\]/, "no characters the API rejects");
    assert.ok(t.length < 50 && t.split(/\s+/).length <= 5, `too long: ${t}`);
  }
});

test("caseKeyterms caps the list at 100 terms", () => {
  const many = Array.from({ length: 300 }, (_, i) => `DL-${1000 + i}`).join(" ");
  assert.equal(caseKeyterms(many).length, 100);
});

test("unknownReferences flags a reference the case does not contain, ignoring hyphens and case", () => {
  assert.deepEqual(unknownReferences("Parcel DL6210 is at the gate", caseText), ["DL6210"]);
  assert.deepEqual(unknownReferences("Parcel dl6010 and TG-6010 are here", caseText), []);
  assert.deepEqual(unknownReferences("The gate is locked", caseText), []);
});

test("caseTextOf turns case events into text the keyterms and reference check can read", async () => {
  const { caseTextOf } = await import("./references.ts");
  const text = caseTextOf([{ from: "Dispatch, carrier", body: "DL-6010 booked." }, { from: null, body: "Second." }]);
  assert.equal(text, "From: Dispatch, carrier\nDL-6010 booked.\n\nFrom: \nSecond.");
  assert.ok(caseKeyterms(text).includes("DL-6010"));
});
