// ANSWER.md and REASONING.md are rendered from the run result and nothing else. They are never
// edited by hand. Wording is deliberate: a message in the sandbox outbox is "recorded", never
// "sent and confirmed", because no live system is connected.
import type { RunResult } from "./run.ts";

const DECISION_LABEL: Record<string, string> = {
  acted: "ACT",
  asked_for_info: "ASK FOR INFORMATION",
  escalated: "HOLD FOR A HUMAN",
  blocked: "BLOCKED BY THE SAFETY CHECK",
  no_action: "NO ACTION NEEDED NOW",
  error: "SYSTEM FAILURE: HANDED TO A HUMAN",
};

const STATUS_LABEL = {
  recorded: "Recorded in sandbox outbox, awaiting reply",
  failed: "Not delivered: every channel failed",
  held_for_human: "Proposed, held for a human",
  blocked: "Not sent: stopped by the safety check",
};

const cell = (s: string) => s.replace(/\|/g, "/").replace(/\s+/g, " ").trim();
const quote = (s: string) => s.split("\n").map((l) => `> ${l}`).join("\n");
const list = (items: string[], none: string) => (items.length ? items.map((i) => `- ${i}`).join("\n") : none);

export function renderAnswer(r: RunResult): string {
  const { bundle, decision: d, understanding: u, outbox, card } = r;
  const lines: string[] = [`# ${bundle.title}`, "", `**Decision:** ${DECISION_LABEL[r.outcome]}`];

  if (r.outcome === "error" || !d || !u) {
    lines.push(
      `**Why in one line:** The agent failed at the "${r.failedAt ?? "unknown"}" step, so it took no action and is handing the case to a person.`,
      "", "## What failed", `- ${r.error ?? "unknown error"}`,
      "", "## Actions", "None. Nothing was sent or recorded for this case.",
      "", "## Escalated", `To the desk supervisor, with the case files as received (${bundle.documents.length} text files, ${bundle.media.length} attachments). The agent's partial analysis is in REASONING.md.`,
    );
    return lines.join("\n") + "\n";
  }

  // The label says what kind of outcome it was; the sentence after it says what the desk actually does.
  lines[2] = `**Decision:** ${DECISION_LABEL[r.outcome]}. ${d.headline}`;
  lines.push(`**Why:** ${d.why}`, "", `**Situation:** ${u.summary}`);
  if (outbox.length && outbox.every((o) => o.status !== "recorded")) lines.push("", "No message has gone out for this case. Everything below is a proposal waiting for a person.");
  lines.push("", "## Actions");
  if (outbox.length === 0) {
    lines.push("None. No message is sent for this case.");
  } else {
    lines.push("| # | To | Channel | Status |", "|---|---|---|---|");
    outbox.forEach((o, i) => lines.push(`| ${i + 1} | ${cell(o.action.recipient)} | ${cell(o.action.channel)} | ${STATUS_LABEL[o.status]} |`));
    lines.push("", "## Messages");
    outbox.forEach((o, i) => {
      // A blocked draft is unsafe by the gate's own verdict, so its text is not published here.
      lines.push(`**${i + 1}. To ${o.action.recipient} via ${o.action.channel}** (${STATUS_LABEL[o.status].toLowerCase()})`, "",
        o.status === "blocked" ? "> Message text withheld: it was stopped by the safety check." : quote(o.action.message), "");
      if (o.status !== "recorded") lines.push(`Reason: ${o.note}`, "");
    });
  }

  lines.push("## Not done, on purpose", list(d.wont_do.map((w) => `${w.item}: ${w.reason}`), "Nothing was ruled out."));

  lines.push("", "## Escalated");
  if (card) {
    lines.push(`To: ${card.routeTo}`, "");
    if (card.whyStopped) lines.push(`**Why a person is needed:** ${card.whyStopped.line}`, "");
    lines.push(card.summary, "");
    if (card.evidence?.length) {
      lines.push("What the decision turns on:", ...card.evidence.map((e) => `- ${e.who} (${e.basis.replaceAll("_", " ")}): ${e.says}`), "");
    }
    if (card.clash) lines.push(`Conflict: ${card.clash}`, "");
    if (card.alreadyDone?.length) lines.push("Already done safely:", ...card.alreadyDone.map((x) => `- ${x}`), "");
    if (card.options.length) {
      lines.push("Options for the person deciding:",
        ...card.options.map((o) => `- **${o.label}**${o.effect ? `: ${o.effect}` : ""}${o.undoable ? "" : " (cannot be undone)"}`), "");
    }
    if (card.wouldChangeMyMind) lines.push(`What would settle it: ${card.wouldChangeMyMind}`, "");
    lines.push(`No person was available during this run. Safe fallback logged: ${card.fallback}`);
  } else {
    lines.push("Nothing.");
  }

  lines.push("", "## What failed", list([
    ...u.commitments.filter((c) => c.status === "rejected_or_failed").map((c) => `Earlier in the case: ${c.what} (owed by ${c.owed_by}) failed or was rejected.`),
    ...outbox.filter((o) => o.status === "failed").map((o) => `Message to ${o.action.recipient}: ${o.note}`),
    ...bundle.unreadable.map((f) => `Could not read ${f}.`),
    ...(bundle.tools?.length ? [`${bundle.tools.length} tool(s) came with the case (${bundle.tools.map((t) => t.name).join(", ")}). None was called: the agent only calls tools it has been configured to trust.`] : []),
    ...(r.panel && !r.panel.ok ? [`The perspectives check did not run (${r.panel.error}); the flow continued without it.`] : []),
  ], "Nothing."));

  const unsent = outbox.filter((o) => o.status !== "recorded").length;
  lines.push("", "## Waiting for");
  if (unsent && d.waiting_for.length) lines.push(`${unsent} message(s) above did not go out, so replies to them are not yet expected. Planned once a person has decided:`);
  const due = (by: string) => (by.trim() && !/^(none|no deadline|n\/a|open)\b/i.test(by.trim()) ? `, by ${by.trim()}` : "");
  lines.push(list(d.waiting_for.map((w) => `${w.what}, from ${w.from}${due(w.by)}`), "Nothing."));
  lines.push("", `**Confidence:** ${d.confidence}`);
  return lines.join("\n") + "\n";
}

export function renderReasoning(r: RunResult): string {
  const { bundle, understanding: u, decision: d } = r;
  const lines: string[] = [`# Reasoning: ${bundle.title}`, "", "## 1. What we received",
    list([
      ...bundle.documents.map((x) => `${x.name} (${x.chars ?? x.text.length} characters)`),
      ...bundle.media.map((m) => `${m.name} (${m.mediaType}, read by the model directly)`),
      ...bundle.unreadable.map((f) => `Not read: ${f}`),
    ], "Nothing readable.")];

  if (u) {
    lines.push("", u.summary, "", `Our role: ${u.our_role}`, `Case type: ${u.case_type}. Urgency: ${u.urgency}.`);
    lines.push("", "## 2. Facts and claims", "| Source | Statement | Basis |", "|---|---|---|",
      ...u.claims.map((c) => `| ${cell(c.who)} | ${cell(c.says)} | ${c.basis.replaceAll("_", " ")} |`));
    lines.push("", "## 3. Commitments so far", u.commitments.length
      ? ["| What | Owed by | Status | Due |", "|---|---|---|---|", ...u.commitments.map((c) => `| ${cell(c.what)} | ${cell(c.owed_by)} | ${c.status.replaceAll("_", " ")} | ${cell(c.due)} |`)].join("\n")
      : "None recorded.");
    lines.push("", "## 4. Conflicts and missing information",
      list([
        ...u.conflicts.map((c) => `Conflict between ${c.between} about ${c.about}. Would be settled by: ${c.what_would_settle_it}`),
        ...u.missing_info.map((m) => `Missing: ${m.what} (held by ${m.who_has_it})`),
      ], "None found."));
    lines.push("", "## 5. Who owns the decision", u.decision_owner, "",
      "Parties:", ...u.parties.map((p) => `- ${p.name} (${p.role.replaceAll("_", " ")}): ${p.controls}`));
    lines.push("", "## 6. Risk signals", list([
      ...u.hazards.map((h) => `Hazard: ${h}`),
      ...(u.vulnerable_or_distressed.toLowerCase() === "none" ? [] : [`Person: ${u.vulnerable_or_distressed}`]),
      ...u.deadlines.map((x) => `Deadline: ${x}`),
      // Paraphrased by the model, so no instruction-like text from the case is repeated here.
      ...u.instruction_like_text.map((x) => `Instruction-like text in the case, not followed: ${x}`),
      ...(r.panel?.ok ? r.panel.notes.map((n) => `Reviewer note: ${n}`) : []),
    ], "None."));
  }

  if (d) {
    lines.push("", "## 7. Decision", `${d.decision_type.replaceAll("_", " ")}: ${d.why}`,
      r.revised ? "\nThe first draft was stopped by the safety check and rewritten once." : "");
    if (r.candidates?.length) {
      lines.push("", "Drafts weighed before deciding:", "| Seat | Proposed | To | Why |", "|---|---|---|---|",
        ...r.candidates.map((c) => `| ${cell(c.stance)} | ${c.decision.decision_type.replaceAll("_", " ")} | ${cell(c.decision.actions.map((a) => a.recipient).join("; ")) || "nobody"} | ${cell(c.decision.why)} |`));
    }
    lines.push("", "## 8. Safety check, per message", r.gated.length
      ? ["| To | Risk | Verdict | Reason |", "|---|---|---|---|", ...r.gated.map((g) => `| ${cell(g.action.recipient)} | ${g.risk.toFixed(2)} | ${g.verdict} | ${cell(g.reasons.join("; ")) || "within the desk's role"} |`)].join("\n")
      : "No outgoing message to check.");
  }

  if (r.error) lines.push("", "## Failure", `Step: ${r.failedAt}. Error: ${r.error}`);

  lines.push("", "## Trace", "| Step | Status | Summary | Latency | Cost |", "|---|---|---|---|---|");
  for (const e of r.trace.events) {
    if (e.kind === "node_end") lines.push(`| ${e.nodeId} | ${e.status} | ${cell(e.summary)} | ${e.latencyMs} ms | $${e.costUsd.toFixed(4)} |`);
  }
  const calls = r.trace.events.filter((e) => e.kind === "model_call");
  const end = r.trace.events.findLast((e) => e.kind === "run_end");
  lines.push("", `Model calls: ${calls.length}. Total cost: $${end?.kind === "run_end" ? end.totalCostUsd.toFixed(4) : "0"}. Total time: ${end?.kind === "run_end" ? end.totalLatencyMs : 0} ms.`);
  return lines.filter((l) => l !== undefined).join("\n") + "\n";
}
