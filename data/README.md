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
