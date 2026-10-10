"use client";
// "Approve by voice" for a decision card: the agent reads the card to the desk manager, they choose an
// option out loud, the agent reads it back, and the decision is returned to the console.
import { CallDrawer, type CallResult } from "./CallDrawer";
import type { DecisionCard, HumanDecision, VoiceSource } from "./api";

export function ApproveByVoice({ card, caseId, caseText, managerName = "Desk manager", startN, at, source = "live_human", onDecision, onEvents }: {
  card: DecisionCard;
  caseId: string;
  caseText: string;
  managerName?: string;
  startN: number;
  at: string;
  source?: VoiceSource;
  onDecision: (decision: HumanDecision) => void;
  onEvents?: (events: CallResult["events"]) => void;
}) {
  return (
    <CallDrawer
      label="Approve by voice"
      simulated={source === "simulated_persona"}
      request={{ mode: "demo", purpose: "approval", caseId, calleeRole: "desk manager", calleeName: managerName, brief: "", goal: "Get the desk manager's decision on this card.", card }}
      state={{ caseId, mode: "demo", source, caseText, calleeName: managerName, card, startN, at }}
      onDone={(result) => {
        if (result.decision) onDecision(result.decision);
        onEvents?.(result.events);
      }}
    />
  );
}
