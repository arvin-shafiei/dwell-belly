# Submission

| Field | Value |
|---|---|
| Repository | https://github.com/arvin-shafiei/hamyway-city (it must open without logging in) |
| Team name | Silly Hamsters |
| Track | Delivery & Logistics |
| Members | Anson, Arvin, Oriol, Min, Lu Min (5) |
| Code freeze commit (tag `freeze-1630`) | `8dc3e5d4b8fed8ee71a1969340f2ca4378597cf8`, merged at 16:30:47 BST: the commit that added the demo video. The last code change before it is `2ddd6cdb` (16:25:39); between the two only `README.md`, `SUBMISSION.md` and `demo/demo.mp4` changed. |
| Reality Test results commit | `bc3b5f11` (merged to main as `1b2d5fc56a022d2eaa6b436eb3faac87fa5422bd`, 16:37:38 BST) |
| Proof that only the results changed after the freeze | `git diff --stat freeze-1630..1b2d5fc5`: 125 files changed, 48201 insertions, 8 deletions. 124 of those files are under `ANSWERS/`. The other one is `README.md` (1 line: how the demo video is shown at the top). No code changed. This file was filled in afterwards. |
| Reality Test results | `ANSWERS/` (one folder per case, plus `RUNLOG.md` and `INDEX.md`) |
| Demo video | `demo/demo.mp4` |
| LinkedIn post | https://lnkd.in/p/eR34V7hg |
| X post | https://x.com/fluffyfluffycow/status/2108933209635590497 |

**Which hash goes in the form:** the rules say 16:30 in the freeze section and 17:00 in the form list. We submit the `freeze-1630` hash as the code hash, and give the later results commit above with the diff showing only `ANSWERS/` and this file changed (PRD A5). If the organisers say otherwise, follow them.
