import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";
import { ROOT, buildCatalogue, groupCase, renderGuide } from "./learn-cases.mjs";

const catalogue = await buildCatalogue();

test("the catalogue covers every indexed source case and preserves key provenance without claiming execution", async () => {
  let count = 12;
  for (const file of ["data/index.json", "data/generated/index.json", "data/adversarial/index.json"]) {
    const index = JSON.parse(await readFile(path.join(ROOT, file), "utf8"));
    count += file === "data/index.json" ? index.filter((c) => c.track === "delivery").length : index.length;
  }
  // City cases have their own dataset and are counted by the loader.
  const { loadCases } = await import("./cases.mjs");
  count += (await loadCases("city")).length;
  assert.equal(catalogue.cases.length, count);
  assert.equal(new Set(catalogue.cases.map((c) => c.id)).size, count);
  const publicCase = catalogue.cases.find((c) => c.id === "delivery-001");
  assert.match(publicCase.decision[0], /recipient.*choose/i);
  assert.match(publicCase.provenance, /calibration/);
  const generated = catalogue.cases.find((c) => c.id === "gen-801");
  assert.ok(generated.groups.includes("identity_privacy"));
  assert.match(generated.provenance, /not a verified execution/);
  assert.ok(generated.required.length && generated.prohibited.length && generated.learning);
  assert.match(catalogue.warning, /never this catalogue or case-specific answers/);
});

test("compound fixtures have overlapping groups and retain their actual required decisions", () => {
  const compound = catalogue.cases.find((c) => c.id === "fixture-109");
  for (const id of ["hazard", "human_authority", "communication", "multi_issue"]) assert.ok(compound.groups.includes(id));
  assert.equal(compound.required.length, 3);
  assert.ok(catalogue.cases.find((c) => c.id === "adv-100").groups.includes("network_disruption"));
  assert.throws(() => groupCase({ mutation: "new-unmapped-pattern", evidence: "" }, catalogue.groups), /Unmapped mutation/);
});

test("generated learning artefacts can be reproduced exactly from the current sources", async () => {
  assert.deepEqual(JSON.parse(await readFile(path.join(ROOT, "data/decision-patterns/cases.json"), "utf8")), catalogue);
  assert.equal(await readFile(path.join(ROOT, "data/decision-patterns/README.md"), "utf8"), renderGuide(catalogue));
  const policy = JSON.parse(await readFile(path.join(ROOT, "apps/api/src/agent/decision-patterns.json"), "utf8"));
  assert.equal(new Set(policy.groups.map((g) => g.id)).size, policy.groups.length);
  for (const c of catalogue.cases) for (const id of c.groups) assert.ok(policy.groups.some((g) => g.id === id));
});
