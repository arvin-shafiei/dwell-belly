# Demo video

Two cuts of the same video, both recorded from the real running product. Neither has audio; on-screen captions carry the story. Rules section 6E asks for about 60 seconds, so the short cut is the submission video.

| File | Length | What it is |
|---|---|---|
| **[`rivet-demo.mp4`](rivet-demo.mp4)** | 59 s | **The submission video.** The problem, one real case from start to finish (with the safety check and the email it sent), the desk console (Watch it think, Decisions, Playbooks), the 3D city and the numbers. |
| [`rivet-demo-full.mp4`](rivet-demo-full.mp4) | 1:56 | The full cut, with the five second opinions, the decision card and every console page. 1920×1080, 30 fps, H.264, about 23 MB. |

## The submission cut (59 s)

1920×1080, 30 fps, H.264, about 16 MB.

| About | What you see |
|---|---|
| 0:00 | The problem: case after case lands on the desk, which controls none of the parties, and the stories don't match (the carrier's record says failed attempt at 08:40; the recipient says she was home and didn't hear the intercom) |
| 0:05 | Title: "Hamyway City. The delivery desk that knows when to stop." |
| 0:07 | One real case (`delivery-013`) through the flow: Load, Understand, three quick checks, Plan the reply (act, ask, hand over), then the safety check, where the needle lands under 0.3 (clear), and the one email it sent to Tracking support |
| 0:19 | The desk console, real footage: **Watch it think** (each step appears as the agent works the case), **Decisions** (cases waiting for a person, each option spelled out, nothing on hold sent until someone decides), **Playbooks** (the same flow as a graph you can edit, with a case lighting up its path) |
| 0:44 | The 3D city, tagged "Simulated city · visualisation of agent traces · not the agent": deliveries, traffic, the river and the port; a truck crash becomes an incident and a case for the desk |
| 0:49 | The numbers from the latest eval run: 0.92 on 48 test cases, 46 of 48 passed, 0 rules broken, 165 s for 50 cases, 5¢ per case |
| 0:55 | End card with the repository address |

## The full cut (1:56)

| About | What you see |
|---|---|
| 0:00 | The problem: case after case lands on the desk, and the desk controls none of the parties |
| 0:08 | Title: "Hamyway City. The delivery desk that knows when to stop." |
| 0:12 | One real case, start to finish (`delivery-013`, a recipient disputes a failed delivery attempt): Load reads the whole folder (emails, portal messages, call transcripts, attachments) |
| 0:20 | Understand sorts records from claims; three quick checks run at once (what kind of problem, five seats, do the stories match); Plan picks one move: act, ask, hand over or wait |
| 0:32 | The safety check: every message is scored before it goes (below 0.3 clear, 0.3 to 0.8 a person decides, 0.8 or more stopped), then the one email it sent to the team that owns the problem |
| 0:44 | Second opinions: five seats (customer advocate, rule keeper, safety officer, sceptic, ops pragmatist) look at every case in one call |
| 0:52 | When it should not act alone, it stops and hands a person one card: why, and each option with what happens and whether it can be undone; approve by voice (console only, never in the scored run) |
| 1:08 | The desk console, real footage: Watch it think (each step appears as the agent works), New case, Decisions, Playbooks (a case lights up its path), How it works, Results |
| 1:36 | The 3D city, tagged "Simulated city · visualisation of agent traces · not the agent": a truck crash becomes an incident and a case for the desk; a motorcade under a rolling road closure |
| 1:48 | The numbers: 0.92 on 48 test cases, 46 of 48 passed, 0 rules broken, 165 s for 50 cases, 5¢ per case |
| 1:54 | Close, with the repository address |

Rendered with Remotion (`apps/video/`) from footage captured by `apps/video/scripts/capture.mjs`. The stills and GIFs used in the main README are in [`docs/media/`](../docs/media/), listed in `docs/media/manifest.json`.
