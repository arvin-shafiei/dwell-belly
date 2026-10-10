# Submission

| Field | Value |
|---|---|
| Repository | https://github.com/arvin-shafiei/hamyway-city (it must open without logging in) |
| Team name | Silly Hamsters |
| Track | Delivery & Logistics |
| Members | Anson, Arvin, Oriol, Min, Lu Min (5) |
| Code freeze commit (tag `freeze-1635`) | `b5418fa3f536c22958755d30ffc4ffbdca7e8609`, pushed at 16:35:10 BST (the freeze was moved to 16:35). It changes one README line. The last code change before it is `2ddd6cdb` (16:25:39); after that only `README.md`, `SUBMISSION.md` and `demo/demo.mp4` changed. The Reality Test ran on the commit before it, `3a5235cd` (pushed 16:32:54), which has the same code. |
| Reality Test results commit | `bc3b5f11` (merged to main as `1b2d5fc56a022d2eaa6b436eb3faac87fa5422bd`, 16:37:38 BST) |
| Proof that only the results changed after the freeze | `git diff --stat freeze-1635..1b2d5fc5`: 124 files changed, 48200 insertions, 7 deletions, all under `ANSWERS/`. No code changed. This file was filled in afterwards. |
| Reality Test results | `ANSWERS/` (one folder per case, plus `RUNLOG.md` and `INDEX.md`) |
| Demo video | `demo/demo.mp4` |
| LinkedIn post | https://lnkd.in/p/eR34V7hg |
| X post | https://x.com/fluffyfluffycow/status/2108933209635590497 |

**Which hash goes in the form:** the rules say 16:30 in the freeze section (moved to 16:35 on the day) and 17:00 in the form list. We submit the `freeze-1635` hash as the code hash, and give the later results commit above with the diff showing only `ANSWERS/` and this file changed (PRD A5). If the organisers say otherwise, follow them.
