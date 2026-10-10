// Offline learning index. Never imported by the agent: answer keys stay on the evaluation side.
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const ROOT = path.resolve(import.meta.dirname, "../..");
const MUTATION_GROUPS = {
  conflicting_information: ["conflicting_evidence"], failed_action: ["failed_action"],
  missing_context: ["missing_evidence"], noise: ["communication"],
  superseded_request: ["valid_changes"], out_of_policy_demand: ["owner_coordination"],
  embedded_instructions: ["untrusted_content"], unverified_identity: ["identity_privacy"],
  needs_human: ["human_authority"], safety_hazard: ["hazard"],
  no_action_needed: ["wait_duplicate"], unusual_exception: ["unfamiliar"],
  false_alarm: ["hazard"], regulated_goods: ["regulated_border", "hazard"],
  safeguarding: ["human_authority", "identity_privacy", "communication"],
  privacy_and_data: ["identity_privacy"], fraud_signal: ["identity_privacy", "untrusted_content"],
  hidden_injection: ["untrusted_content"], pressure_to_falsify: ["truthful_status"],
  time_and_numbers: ["deadline_math"], cross_border: ["regulated_border"],
  attachment_evidence: ["missing_evidence", "conflicting_evidence"],
  multi_issue: ["multi_issue"], language_and_transcripts: ["communication", "missing_evidence"],
  format_trap: ["communication", "valid_changes"], long_context: ["communication"],
  disruption: ["network_disruption", "wait_duplicate"], unexpected: ["unfamiliar"],
};
const FIXTURE_GROUPS = {
  "101": ["wait_duplicate", "conflicting_evidence"], "102": ["untrusted_content", "missing_evidence"],
  "103": ["identity_privacy"], "104": ["failed_action", "deadline_math"],
  "105": ["deadline_math"], "106": ["multi_issue", "missing_evidence"],
  "107": ["valid_changes"], "108": ["conflicting_evidence", "identity_privacy"],
  "109": ["hazard", "human_authority", "communication", "multi_issue"],
  "110": ["conflicting_evidence", "deadline_math"], "111": ["human_authority", "identity_privacy"],
  "112": ["wait_duplicate", "communication"],
};
// Bulk cases can apply several transforms but store only one mutation label.
// Keep every tested boundary, including the secondary layer, in this offline index.
const TRANSFORM_GROUPS = {
  surface_swap: [], noise: ["communication"], long_thread: ["communication"],
  duplicate_request: ["wait_duplicate"], channel_swap: ["communication"],
  injection_quoted: ["untrusted_content"], injection_attachment: ["untrusted_content"],
  unrelated_attachment: ["missing_evidence", "conflicting_evidence"],
  missing_attachment: ["missing_evidence", "truthful_status"],
  unverified_claim: ["conflicting_evidence", "identity_privacy", "truthful_status"],
  false_alarm: ["hazard"], fyi_no_action: ["wait_duplicate"],
  legal_threat: ["human_authority"],
  vulnerable_person: ["human_authority", "identity_privacy", "communication"],
  unverified_redirect: ["identity_privacy", "missing_evidence", "valid_changes"],
};
// Suggestions from rubrics, not a live keyword classifier. A match identifies a decision boundary
// tested by this case, including prohibitions; it never asserts that an incident actually occurred.
const RUBRIC_SIGNALS = [
  ["identity_privacy", /\b(identit|unverified|verif(?:y|ied|ication)|privacy|personal details|third.party|password|credential)/i],
  ["hazard", /\b(safe(?:ty)?|hazard|medicin|insulin|consumption|handling|injur|leak|temperature)/i],
  ["human_authority", /\b(legal|solicitor|regulator|police|welfare|bereavement|liability|supervisor)/i],
  ["missing_evidence", /\b(missing|unreadable|attachment|photo|choose|choice|clarif|ask.*reference)/i],
  ["conflicting_evidence", /\b(conflict|contradict|disput|both accounts|neither account|scan.*receipt)/i],
  ["failed_action", /\b(bounc|failed|dead route|wrong queue|rejected request)/i],
  ["valid_changes", /\b(supersed|withdraw|latest valid|corrected instruction)/i],
  ["wait_duplicate", /\b(duplicate|already resolved|already open|no action|nothing.*owed|not yet overdue)/i],
  ["deadline_math", /\b(deadline|cut.?off|UTC|BST|time.zone|arithmetic|quantity|units)/i],
  ["regulated_border", /\b(customs|broker|import|regulated|compliance|incoterms)/i],
  ["multi_issue", /\b(separate issues|each parcel|each shipment|two.*owners|several.*issues|both.*request)/i],
  ["untrusted_content", /\b(inject|embedded instruction|automated system|falsif|self.score)/i],
  ["network_disruption", /\b(network|incident notice|recovery list|flood|outage|strike)/i],
  ["capacity_disruption", /\b(reschedul|redeliver|traffic|vehicle|route.*clos|replacement.*van|breakdown)/i],
  ["dependencies", /\b(pending verification|until.*confirm|only after|before.*book|prerequisite)/i],
];
const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const sortedFiles = async (dir) => (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();

export function groupCase({ mutation, fixture, evidence, patterns = [], transforms = [] }, groups) {
  if (mutation && !Object.hasOwn(MUTATION_GROUPS, mutation)) throw new Error(`Unmapped mutation: ${mutation}`);
  if (fixture && !Object.hasOwn(FIXTURE_GROUPS, fixture)) throw new Error(`Unmapped fixture: ${fixture}`);
  const selected = new Set(["owner_coordination", "truthful_status", "unfamiliar"]);
  const basis = ["Universal owner, truthful-status and unfamiliar-case guidance"];
  for (const id of mutation ? MUTATION_GROUPS[mutation] : fixture ? FIXTURE_GROUPS[fixture] : []) selected.add(id);
  if (mutation) basis.push(`Source difficulty label: ${mutation}`);
  if (fixture) basis.push(`Fixture rubric mapping: ${fixture}`);
  for (const transform of transforms) {
    if (!Object.hasOwn(TRANSFORM_GROUPS, transform)) throw new Error(`Unmapped transform: ${transform}`);
    for (const id of TRANSFORM_GROUPS[transform]) selected.add(id);
    basis.push(`Source transform: ${transform}`);
  }
  for (const id of patterns) {
    if (!groups.some((g) => g.id === id)) throw new Error(`Unmapped decision pattern: ${id}`);
    selected.add(id);
    basis.push(`Source case annotation: ${id}`);
  }
  for (const [id, signal] of RUBRIC_SIGNALS) if (signal.test(evidence)) {
    selected.add(id);
    basis.push(`Rubric boundary suggests: ${id}`);
  }
  return { groups: groups.filter((g) => selected.has(g.id)).map((g) => g.id), grouping_basis: basis };
}

export async function buildCatalogue(root = ROOT) {
  const policy = await json(path.join(root, "apps/api/src/agent/decision-patterns.json"));
  const cases = [];
  for (const [set, directory] of [["public", "data/cases/delivery"], ["generated", "data/generated/delivery"], ["adversarial", "data/adversarial/delivery"], ["city", "data/city/delivery"], ["bulk", "data/bulk/delivery"]]) {
    for (const file of await sortedFiles(path.join(root, directory))) {
      const source = `${directory}/${file}`;
      const c = await json(path.join(root, source));
      const isPublic = set === "public";
      const decisions = isPublic ? [c.next_action.summary] : c.expected.acceptable_actions.map((a) => a.summary);
      const required = isPublic ? [c.next_action.summary] : c.expected.must;
      const prohibited = isPublic ? [c.boundaries].filter(Boolean) : c.expected.must_not;
      const learning = isPublic ? `${c.context} ${c.outcome}` : c.rationale;
      const evidence = [...decisions, ...required, ...prohibited, learning].join("\n");
      cases.push({
        id: c.id, set, title: c.title, source,
        provenance: isPublic ? "Organiser's disclosed calibration answer; not runtime evidence"
          : c.keySource === "rule" ? "Rule-derived synthetic answer key; coarse load/regression material, not an independent unseen case, verified execution or authoritative policy"
            : "Synthetic answer key; not a verified execution or authoritative policy",
        ...(set === "bulk" ? { seed_case: c.seed_case, key_source: c.keySource, transforms: c.transforms, layout: c.layout } : {}),
        review: c.review ?? null,
        ...groupCase({ mutation: isPublic ? undefined : c.mutation, evidence, patterns: c.decision_patterns, transforms: c.transforms }, policy.groups),
        acceptable_decisions: isPublic ? ["contact"] : c.expected.acceptable_dispositions,
        decision: decisions.length ? decisions : c.expected.acceptable_dispositions.map((d) => d === "no_action" ? "Log why nothing is owed now; send nothing." : "Hand the specific unresolved decision to an authorised person."),
        learning, required, prohibited,
      });
    }
  }
  const dir = "docs/stress-test/fixtures";
  for (const id of (await readdir(path.join(root, dir))).sort()) {
    const source = `${dir}/${id}/rubric.json`;
    const c = await json(path.join(root, source));
    const prohibited = [...c.prohibited_actions, ...c.critical_failures];
    cases.push({
      id: `fixture-${id}`, set: "fixture", title: c.slug, source,
      provenance: "Design stress-test rubric; not a verified execution or authoritative policy", review: null,
      ...groupCase({ fixture: id, evidence: [...c.required_outcomes, ...prohibited].join("\n") }, policy.groups),
      acceptable_decisions: [], decision: c.required_outcomes,
      learning: `Avoid: ${c.red_flags.join("; ")}`,
      required: c.required_outcomes, prohibited, acceptable_alternatives: c.acceptable_alternatives,
    });
  }
  if (new Set(cases.map((c) => c.id)).size !== cases.length) throw new Error("Duplicate case ids in learning catalogue");
  return {
    version: policy.version,
    warning: "Offline study material, not execution results. Group suggestions and synthetic answer keys require review. Indexed cases are development/calibration material, not a held-out generalisation test. The runtime imports only the separately curated general decision guidance, never this catalogue or case-specific answers.",
    sets: Object.fromEntries([...new Set(cases.map((c) => c.set))].map((s) => [s, cases.filter((c) => c.set === s).length])),
    groups: policy.groups.map((g) => ({ ...g, case_ids: cases.filter((c) => c.groups.includes(g.id)).map((c) => c.id) })),
    cases,
  };
}

const cell = (s) => s.replace(/\|/g, "/").replace(/\s+/g, " ");
export function renderGuide(catalogue) {
  const lines = ["# Decision patterns from the case sets", "", "Generated by `npm run learn:cases`. See `cases.json` for every case's main learning, acceptable decisions, requirements, prohibitions, source and suggested overlapping groups.", "", catalogue.warning, "", `Cases indexed: ${Object.values(catalogue.sets).reduce((a, b) => a + b, 0)} (${Object.entries(catalogue.sets).map(([s, n]) => `${n} ${s}`).join(", ")}).`, "", "A case may belong to several groups. Counts show suggested coverage, not pass rates. Universal owner, truthful-status and unfamiliar-case guidance applies to every case.", "", "| Group | Cases | General lesson |", "|---|---:|---|"];
  for (const g of catalogue.groups) lines.push(`| ${g.name} (${g.id}) | ${g.case_ids.length} | ${cell(g.guidance)} |`);
  lines.push("", "## Main decisions by case", "", "These are source-key decisions, not predictions or executed outcomes. Case-specific names, facts and answers are never sent to the planner.", "", "| Case | Set | Suggested groups | Main decision |", "|---|---|---|---|");
  for (const c of catalogue.cases) lines.push(`| [${c.id}](../../${c.source}) | ${c.set} | ${c.groups.join(", ")} | ${cell(c.decision.join("; "))} |`);
  return lines.join("\n") + "\n";
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const catalogue = await buildCatalogue();
  const out = path.join(ROOT, "data/decision-patterns");
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, "cases.json"), JSON.stringify(catalogue, null, 2) + "\n");
  await writeFile(path.join(out, "README.md"), renderGuide(catalogue));
  console.log(`Indexed ${catalogue.cases.length} cases into ${catalogue.groups.length} overlapping decision groups`);
}
