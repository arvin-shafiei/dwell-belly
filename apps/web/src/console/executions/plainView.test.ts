import { describe, expect, it } from "vitest";
import { plainStep, scrubLeaks } from "../../ui/plain";
import type { Trace } from "../types";
import { caseName, checklist, headline, messageOf, plainChannel, statusWord } from "./plainView";

const trace = (outcome: string, extra: Trace["events"] = []): Trace => ({
  version: 1, runId: "r", caseId: "delivery-024", flowId: "f", mode: "practice",
  events: [
    { t: 0, kind: "run_start", title: "Case 024: Parcel missing", inputs: [] },
    { t: 1, kind: "node_start", nodeId: "ingest", nodeType: "ingest" },
    { t: 2, kind: "node_end", nodeId: "ingest", status: "ok", summary: "ingest: 1 files, 0 attachments read", latencyMs: 1, costUsd: 0 },
    { t: 3, kind: "node_start", nodeId: "perspectives", nodeType: "perspectives" },
    { t: 4, kind: "node_end", nodeId: "perspectives", status: "ok", summary: "perspectives: skipped: no Jev key", latencyMs: 1, costUsd: 0 },
    { t: 5, kind: "node_start", nodeId: "triage", nodeType: "triage" },
    { t: 6, kind: "node_end", nodeId: "triage", status: "ok", summary: "triage: missed_or_failed_delivery · medium", latencyMs: 1, costUsd: 0 },
    { t: 7, kind: "node_start", nodeId: "gate", nodeType: "safety_gate" },
    { t: 8, kind: "node_end", nodeId: "gate", status: "ok", summary: "gate: 2 of 2 messages cleared", latencyMs: 1, costUsd: 0,
      output: { type: "safety_gate", risk: 0.1, decision: "allow", allowBelow: 0.3, blockAbove: 0.8 } },
    { t: 9, kind: "node_start", nodeId: "verify", nodeType: "verify" },
    { t: 10, kind: "node_end", nodeId: "verify", status: "ok", summary: "verify: accepted by the outbox; receipt and reply unverified", latencyMs: 1, costUsd: 0 },
    { t: 11, kind: "node_start", nodeId: "log", nodeType: "case_log" },
    { t: 12, kind: "node_end", nodeId: "log", status: "ok", summary: "log written", latencyMs: 1, costUsd: 0 },
    ...extra,
    { t: 20, kind: "run_end", outcome: outcome as "acted", totalCostUsd: 0.07, totalLatencyMs: 20,
      nextAction: { recipient: "Delivery investigations", channel: "email", message: "Please investigate.", undoable: true } },
  ],
});

describe("case run in plain words", () => {
  it("writes a headline sentence", () => {
    expect(headline({ status: "success", outcome: "acted", trace: trace("acted") })).toBe("Emailed Delivery investigations");
    expect(headline({ status: "success", outcome: "asked_for_info", trace: trace("asked_for_info") })).toBe("Asked Delivery investigations for more information");
    expect(headline({ status: "success", outcome: "blocked", trace: null })).toBe("Stopped: it wasn't safe to send anything");
    expect(headline({ status: "running", outcome: null, trace: null })).toBe("Working on it…");
  });

  it("names the person deciding when escalated", () => {
    const t = trace("escalated", [
      { t: 13, kind: "node_end", nodeId: "human", status: "ok", summary: "card", latencyMs: 1, costUsd: 0,
        output: { type: "human_decision", card: { routeTo: "Desk supervisor", summary: "s", tried: [], options: [], wouldChangeMyMind: "", deadlineMins: 0, fallback: "" } } },
    ]);
    expect(headline({ status: "success", outcome: "escalated", trace: t })).toBe("Handed this to Desk supervisor to decide");
  });

  it("builds the message card", () => {
    expect(messageOf({ outcome: "acted", trace: trace("acted") })).toEqual({ title: "What we sent", to: "Delivery investigations", how: "Email", message: "Please investigate." });
    expect(messageOf({ outcome: "escalated", trace: trace("escalated") })?.title).toBe("Message waiting to go");
  });

  it("turns steps into a plain checklist, hiding skipped and log steps, never raw summaries", () => {
    const steps = checklist(trace("acted"));
    expect(steps.map((s) => s.text)).toEqual([
      "Read the messages",
      "Problem: missed delivery",
      "Safety check passed (risk: low)",
      "Sent, waiting for a reply",
    ]);
    const all = steps.map((s) => s.text).join(" ");
    expect(all).not.toMatch(/Jev|outbox|_|:\s*\d+ files/);
  });

  it("gives the list a status word and a case name", () => {
    expect(statusWord({ status: "success", outcome: "escalated" })).toBe("Needs a person");
    expect(statusWord({ status: "error", outcome: null })).toBe("Stopped");
    expect(statusWord({ status: "running", outcome: null })).toBe("Working…");
    expect(caseName("delivery-024", "Case 024: Parcel missing")).toBe("Parcel missing");
    expect(caseName("gen-007")).toBe("Practice case 7");
    expect(caseName("delivery-024")).toBe("Delivery case 24");
    expect(plainChannel("sms")).toBe("Text message");
  });
});

describe("shared glossary as used here", () => {
  it("hides skipped second opinions and scrubs leak words", () => {
    expect(plainStep("perspectives", "perspectives: skipped: no Jev key")).toBeNull();
    expect(plainStep("safety_gate", "gate: 1 of 2 messages cleared")).toBe("Safety check: 1 held for a person");
    expect(scrubLeaks("Claude flagged missed_or_failed_delivery")).not.toMatch(/Claude|_/);
  });
});
