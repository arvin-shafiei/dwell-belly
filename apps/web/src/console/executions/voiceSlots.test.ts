import { describe, expect, it } from "vitest";
import type { ExecutionRecord, OutboxEntry } from "../types";
import { approvalRerun, callableRows, callRequest, callRerun, cardOpen, noteCaseText, noteRerun } from "./voiceSlots";

const row = (channel: string): OutboxEntry => ({ action: { recipient: "Ms Patel", channel, kind: "k", purpose: "Agree a slot", message: "Hello" }, status: "held_for_human", note: "" });
const ex = { id: "e1", caseId: "delivery-003", dataset: "public", workflowId: "default-incident", title: "Case 003" } as ExecutionRecord & { title: string };
const card = { routeTo: "Desk manager", summary: "", tried: [], options: [{ id: "option-1", label: "A", undoable: true }], wouldChangeMyMind: "", deadlineMins: 10, fallback: "" };

describe("voice slots", () => {
  it("offers a call only on call or phone channels", () => {
    expect(callableRows([row("Email"), row("Phone call"), row("Call"), row("SMS")]).map((r) => r.action.channel)).toEqual(["Phone call", "Call"]);
    expect(callableRows(null)).toEqual([]);
  });
  it("gives a voice note the run's own messages, so a pasted case still guides transcription", () => {
    const run = { ...ex, trace: { events: [{ kind: "run_start", inputs: [
      { n: 1, channel: "Driver chat", from: "Fen Orlo, route driver", excerpt: "I am at 7 Sedgeglass Mews for DL-003." },
      { n: 2, channel: "Dispatch chat", from: "Dispatch", excerpt: "Contact Elva Kesh." },
    ] }] } } as unknown as ExecutionRecord;
    expect(noteCaseText(run)).toBe("From: Fen Orlo, route driver\nI am at 7 Sedgeglass Mews for DL-003.\n\nFrom: Dispatch\nContact Elva Kesh.");
    expect(noteCaseText(ex)).toBe("");
  });
  it("treats a callback route as a phone channel", () => {
    expect(callableRows([row("Verified order callback route"), row("Callback"), row("Email")]).map((r) => r.action.channel))
      .toEqual(["Verified order callback route", "Callback"]);
  });
  it("only an undecided card with options is open", () => {
    expect(cardOpen(card)).toBe(true);
    expect(cardOpen({ ...card, chosen: "option-1" })).toBe(false);
    expect(cardOpen(null)).toBe(false);
  });
  it("builds execute bodies that link back to the parent", () => {
    const note = { n: 0, timestamp: "", stage: null, channel: "Voice note", from: "Driver", to: "Desk", body: "b", source: "live_human" as const };
    expect(noteRerun(ex, note)).toMatchObject({ parentExecutionId: "e1", extraEvents: [note], voice: { trigger: "note" } });
    const d = { optionId: "option-1", label: "A", by: "voice" as const, who: "Desk manager" };
    expect(approvalRerun(ex, d)).toMatchObject({ parentExecutionId: "e1", humanDecision: d, voice: { trigger: "approval" } });
    expect(callRerun(ex, { events: [note], callId: "c1" })).toMatchObject({ voice: { trigger: "call", callId: "c1" } });
    expect(callRerun(ex, { events: [], decision: d }).voice?.trigger).toBe("approval");
  });
  it("keeps the call brief within 600 characters", () => {
    const r = callRequest(ex, { ...row("Call"), action: { ...row("Call").action, message: "x".repeat(900) } });
    expect(r.brief.length).toBe(600);
    expect(r).toMatchObject({ purpose: "call", calleeName: "Ms Patel", goal: "Agree a slot", mode: "demo" });
  });
});
