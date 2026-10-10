# Public Example Cases

This folder contains **200 synthetic cases**—made-up but realistic business requests, messages and documents. There are **50 cases per track**:

- Banking & Financial Services
- Delivery & Logistics
- Insurance Claims Processing
- Property Management

Use these examples to understand the data and test your system. Many include completed histories and outcomes.

## File structure

```text
Property Management/
  003/
    index.md
    history.md
    attachments/
```

- **`index.md`** — the initial request, case details, any summary or outcome, and links to supporting files.
- **`history.md`** — emails, calls, notes and other events in time order.
- **`attachments/`** — supporting documents, images or data files. Not every case has attachments.

Start with `index.md`, then read the full history and attachments. Not all cases have the same summary sections.

Identify each case by **track + case number**. Numbers repeat across tracks. A matching number in `HackatonChallendges/` does not mean it is the same case.

## Using the examples

To test whether your system can decide what to do next:

1. Choose a decision point in the history.
2. Give the system only the events and attachments available at that point.
3. Hide later events and any summary or outcome that reveals the ending.
4. Compare the system's decision with the later evidence.

Otherwise, you may accidentally give the system the answer you are trying to test. The recorded outcome is an example, not necessarily the only acceptable decision.

## No submission required

These public examples are only for development and practice. **Do not submit results for this folder.** Submit results only for the cases in `HackatonChallendges/`.
