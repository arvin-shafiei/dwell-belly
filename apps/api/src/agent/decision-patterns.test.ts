import assert from "node:assert/strict";
import { test } from "node:test";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { DECISION_GROUP_IDS, decisionGroupNames, decisionGuidance } from "./decision-patterns.ts";
import { Understanding } from "./types.ts";
import { DECIDE_SYSTEM, UNDERSTAND_SYSTEM } from "./prompts.ts";

test("missing, duplicate or unknown group labels keep general reasoning and do not invent guidance", () => {
  const base = decisionGuidance();
  assert.match(base, /Find the decision owner/);
  assert.match(base, /Separate requests from completed outcomes/);
  assert.match(base, /Reason through an unfamiliar exception/);
  assert.equal(decisionGuidance(["made-up", "made-up"]), base);
  const grouped = decisionGuidance(["hazard", "hazard", "identity_privacy"]);
  assert.equal(grouped.match(/Route a real hazard/g)?.length, 1);
  assert.match(grouped, /Check identity and protect information/);
  assert.deepEqual(decisionGroupNames(["hazard", "unknown"]), ["Route a real hazard"]);
});

test("the structured intake format supports multiple valid groups while old analyses remain readable", () => {
  const field = Understanding.shape.decision_groups;
  assert.equal(field.safeParse(undefined).success, true);
  assert.equal(field.safeParse(["hazard", "multi_issue", "unfamiliar"]).success, true);
  assert.equal(field.safeParse(["delivery-001"]).success, false);
  const format = zodOutputFormat(Understanding);
  const properties = format.schema.properties;
  assert.ok(typeof properties === "object" && properties !== null && "decision_groups" in properties);
  assert.ok("constraints" in properties);
  const constraint = { surface: "site_access", requirement: "Receiving only 10:00–12:00", owner: "Receiving", scope: "shipment A", kind: "feasibility", state: "active", evidence: "Receiving's latest message" };
  assert.equal(Understanding.shape.constraints.safeParse([constraint]).success, true);
  assert.equal(Understanding.shape.constraints.safeParse([{ ...constraint, state: "booked" }]).success, false);
  assert.equal(Understanding.shape.constraints.safeParse(undefined).success, true);
});

test("chaining guidance combines current requirements without granting one actor universal authority", () => {
  assert.match(DECIDE_SYSTEM, /intersect confirmed operational feasibility/);
  assert.match(DECIDE_SYSTEM, /not a carrier's capacity statement/);
  assert.match(DECIDE_SYSTEM, /do not re-ask the customer/i);
  assert.match(DECIDE_SYSTEM, /complete accumulated history/);
});

test("intake learns decision boundaries without case keys, names or mutation labels", () => {
  for (const id of DECISION_GROUP_IDS) assert.ok(UNDERSTAND_SYSTEM.includes(`- ${id}:`));
  const guidance = decisionGuidance(DECISION_GROUP_IDS);
  assert.doesNotMatch(guidance + UNDERSTAND_SYSTEM, /gen-\d|adv-\d|delivery-\d|Plover Arc|Tallowmere|reference_message|acceptable_dispositions/);
  assert.match(UNDERSTAND_SYSTEM, /One main case_type never replaces these overlapping groups/);
});
