# Research behind the adversarial cases

Written on 10 Oct 2026 by four Claude Code research agents, each spending about 15 minutes on web sources, to find situations that break a delivery-desk agent. Each file is a list of seeds: the real rule or practice (with its source), the situation as it would reach the desk, the tempting wrong move, and the correct desk behaviour. The 100 cases in `data/adversarial/` were written from these seeds.

| File | Seeds | Covers |
|---|---|---|
| [`uk-regulation.md`](uk-regulation.md) | UKR-01 to UKR-43 | Consumer law, bladed articles, alcohol, vapes, corrosives, dangerous goods, UK GDPR, post-Brexit customs (NI, Channel Islands, Isle of Man), addressing (Glasgow and Edinburgh flats, new builds, BFPO, PO boxes), bank holidays by nation, the clock change, drivers' hours |
| [`uk-operations.md`](uk-operations.md) | UKO-01 to UKO-46 | Safeguarding and vulnerability, driver incidents, scams and fraud, lockers and pickup points, two-person and pallet deliveries, grocery and pharmacy, network disruption, sensitive contents |
| [`international.md`](international.md) | INT-01 to INT-40 | Incoterms, EU and US low-value rules as of 2026, liability conventions, sanctions and dual-use, CITES, air rules for batteries, country delivery practices, date, number and name formats, translation traps |
| [`ai-failure-modes.md`](ai-failure-modes.md) | AIF-01 to AIF-45 | Indirect prompt injection carriers, social engineering, reasoning failures (dates, counting, transcripts), calibration (over- and under-escalation), format brittleness, output-side risks |

[`coverage-audit.md`](coverage-audit.md) is the audit of the 305 cases that existed before: what they cover, where they are thin, and answer-key problems that are still open (leaky titles and contexts, keys that are too narrow, reused references).

Facts marked UNVERIFIED in a file were not confirmed against a source and are not load-bearing in any case.

## Findings for the agent itself

Beyond the cases, the research turned up these risks in our own pipeline:

- **Echoing injected text.** `gate.ts` scores outbound messages only. REASONING.md lists instruction-like text from the case, and the Understand step is asked to paraphrase it, but nothing checks that it did. Models explaining what they ignored tend to quote it, and the judging agents look for exactly that kind of text in outputs. The `hidden_injection` cases carry canary tokens to catch this. In the blind review it happened twice (adv-027, adv-075): the reviewer recognised the injection and still copied its token into the handoff. A code check that no instruction-like string or token from the case reappears in ANSWER.md, REASONING.md or the handoff would close it.
- **No check for factual correctness.** The gate's seven categories cover promises, disclosure and safety, but not a wrong date, count, time-zone conversion or reference. Compute dates and times in code (`clock.ts`) and compare every date and number in a message against the case.
- **Outdated knowledge.** Several real thresholds changed in 2025 and 2026, for example the US $800 de minimis suspension, the EU EUR 3 low-value duty, the Montreal Convention limit (26 SDR/kg), Jersey's GBP 60 GST limit and the 30% state-of-charge rule for lithium batteries. The agent should never quote a threshold, rate or compensation figure from memory.
