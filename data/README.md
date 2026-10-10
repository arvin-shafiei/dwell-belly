# Synthetic data

200 synthetic practice cases from [DwellyOrg/HackatonPublicCases](https://github.com/DwellyOrg/HackatonPublicCases), 50 per track, downloaded 2026-10-10, plus a parsed JSON version the backend reads.

```
data/
  raw/<Track name>/<NNN>/      original files, unchanged
    index.md                   request, case details, next action, outcome
    history.md                 timeline of events
    attachments/               PDFs, PNGs, CSVs, TXTs (+ text sidecars, see below)
  cases/<track>/<NNN>.json     one parsed case per file
  index.json                   list of all 200 cases
```

Tracks: `banking`, `delivery` (ours), `insurance`, `property`. Case IDs look like `delivery-021`.

## Rebuild

```bash
npm run data        # node scripts/build-data.mjs, no dependencies
```

## Every attachment is readable as text

Each binary attachment has a text sidecar next to it, and the parser puts that text into the case JSON (`attachments[].text`):

| Attachment | Sidecar | How it was made |
|---|---|---|
| `*.pdf` (25) | `*.pdf.txt` | `pdftotext -layout` |
| `*.png` (13) | `*.png.ocr.txt` | `tesseract` OCR |
| photo-type `*.png` (7) | `*.png.desc.md` | written description of what the image shows (by Claude during data prep, not by the case authors) |
| `*.csv`, `*.txt` (5) | none needed | read as is |

Checked: all 200 cases parse, every case's event count matches the `Total events: N` line in its `history.md` (2,283 events), and all 43 attachments have non-empty text.

## Case JSON shape

```jsonc
{
  "id": "delivery-021", "track": "delivery", "number": "021",
  "title": "Case 021: Outer packaging is damaged and the merchant needs evidence",
  "details": { "status": "...", "primary_shipment": "DL-021", "coordinator": "...", ... },
  "context": "...", "initial_request": "...", "overview": "...",
  "escalation_snapshot": { "first_event": 1, "last_event": 2 },   // delivery only
  "next_action": { "summary": "...", "recipient": "...", "channel": "...", "recorded_event": 3 },
  "outcome": "...", "boundaries": "...",
  "events": [{ "n": 1, "timestamp": "2026-02-22T09:00:00Z", "stage": "Context",
               "channel": "Email", "from": "...", "to": "...", "body": "..." }],
  "attachments": [{ "name": "carton-overview.png", "type": "png", "path": "raw/...",
                    "text": "...", "text_source": "description+ocr" }]
}
```

## Using it for testing (don't leak the answer)

Give the agent only what was known at escalation: events up to `escalation_snapshot.last_event`, with no `next_action`, `outcome`, `overview` or `boundaries`. Then compare its decision with `next_action` and the later events. The API's `?view=escalation` does this cut for you.

## API

From `apps/api` (`src/lib/data.ts`):

- `GET /api/data/cases?track=delivery`: list of cases (index entries)
- `GET /api/data/cases/delivery-021`: full case
- `GET /api/data/cases/delivery-021?view=escalation`: only what was known at escalation

## Eval: generated hard cases and the scorer

`npm run learn:cases` builds [the decision-pattern catalogue](decision-patterns/README.md): main decisions, learnings and suggested overlapping groups for every public, generated, adversarial, city and stress-test fixture case. It is offline study material, not executed results. The agent imports only general group guidance and classifies the actual input; it never reads the catalogue's answer keys. `gen-3301` to `gen-3303` add chained disruption examples: crash followed by failed spare capacity, traffic followed by withdrawn and rejected slots, and replacement capacity blocked by goods-safety clearance. Their synthetic keys are unreviewed.

The 50 public delivery cases all end in "send one message". The Reality Test adds conflicting stories, failed actions, missing context, noise, and cases where escalating or doing nothing is right. `scripts/eval/` covers that gap.

```bash
npm run gen:cases -- --per 4                 # 12 difficulty patterns x 4 = 48 cases -> data/generated/delivery/gen-NNN.json
npm run gen:cases -- --only needs_human --per 6
npm run eval -- --agent baseline             # one Claude call per case, no flow: the floor to beat
npm run eval -- --api http://localhost:4000/api/cases
npm run eval -- --traces traces              # score trace files already on disk
npm run eval -- --agent baseline --set generated --limit 10
npm run eval -- --agent flow --set adversarial   # the 100 adversarial cases (data/adversarial/)
npm run answer -- data/adversarial/raw runs/adversarial   # the same cases as raw folders, through the real loader
npm run test:eval                            # unit tests for the scoring arithmetic, no API key needed
```

Both scripts read `ANTHROPIC_API_KEY` from `apps/api/.env.local`.

**Generated cases.** Each file has the history the desk sees (`events`, ending at the escalation), the difficulty pattern (`mutation`, listed in `scripts/eval/mutations.mjs`) and an answer key (`expected`): acceptable dispositions (`contact`, `escalate`, `no_action`), acceptable recipient and channel pairs, `must`, `must_not` and a reference message. Drafts that fail the structural checks in `gen-cases.mjs` are rejected and not written. The answer keys are written by Claude and have not been reviewed by a person, so read a failing case before trusting its verdict.

**What the agent sees.** Only `view`: id, title, context, initial request, events and attachments. Generated ids are opaque (`gen-007`) so the pattern does not leak. For public cases the cut is stricter than `?view=escalation`: title and Context are removed (they often state the answer) and so are attachments that only arrive after the escalation. `--with-context` puts title and Context back so the two scores can be compared.

**How an agent plugs in.** `--api` POSTs the view as JSON and expects a `Trace` back (or `{ trace }`), as defined in `docs/plans/2026-10-10-3d-workflow-viz-design.md` §4. The eval reads the `run_end` event (`outcome`, `nextAction`), the `human_decision` card and the planner's `wontDo`. `--traces <dir>` reads `<dir>/<caseId>.json` in the same shape.

**Scoring** (weights in `scripts/eval/score.mjs`): disposition 0.3, recipient 0.2, channel 0.1, content 0.4. Disposition and channel are checked in code. Recipient, content and rule-breaking are judged by Claude against the answer key. Breaking any `must_not` rule sets the case to 0. A case passes at 0.7 or above. Results print by set and by difficulty pattern, and every decision and verdict is saved to `runs/` (gitignored).

**Adversarial cases.** `data/adversarial/` holds 100 more cases in the same shape, written to break the agent where the generated set does not reach: alarming words in harmless cases, regulated goods, safeguarding, injection hidden in attachments and quoted replies, pressure to record something untrue, calendar and arithmetic traps, cross-border rules, attachments that decide the case, awkward file layouts and very long threads. Each also exists as a raw case folder with real PDF and PNG attachments. See `data/adversarial/README.md`, and `docs/research/` for the research behind them.

**Separate calibration from generalisation.** The public 50 are useful regression cases, but once their disclosed decisions are studied alongside the generated sets they are not a held-out generalisation test. Use fresh, unstudied combinations and independent review to assess unseen-case behaviour; do not tune the agent to reproduce named reference messages.
