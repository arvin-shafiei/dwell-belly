# Demo video: 60-second shot list

Owner: Arvin. This is the script for `demo/demo.mp4` (rules section E, PRD Part H1). It is recorded on the desk console at **http://localhost:3000** after the dashboard-v2 merge, with the 3D city as a short opening.

**The rules this script follows:**
- It shows the real working product: real agent runs saved in `runs/console.db`, real numbers from `eval/results.md`, and no slides.
- The 3D city appears for **10 seconds at most** and is captioned as a visualisation. It is never shown as evidence.
- No number appears on screen unless it comes from `eval/results.md` or from a run in `runs/console.db`.
- Nothing simulated appears without its label ("Practice case" in the console, "SIMULATED" in the city).
- Nothing in the video depends on a live agent call. Every beat replays a saved run, so a slow API cannot ruin a take.

---

## The three cases (real runs in `runs/console.db`)

| Beat | Case | Execution id | What the agent did | Saved facts |
|---|---|---|---|---|
| **Clash caught** | `delivery-013` (organiser practice case: the recipient disputes a recorded failed delivery) | `5881d315-39d4-4d5a-a627-0bd23f8a9d0d` | "Do the stories match?" found 1 conflict: the carrier logged a failed attempt at 08:40 UTC, but the recipient says she was at home and didn't hear the intercom. It didn't pick a side. It emailed the carrier's Tracking support, which owns the review, asking for the route-record finding and a visit on the morning of 2026-02-15, and drew no conclusion about fault. | The safety check cleared 2 of 2 messages (risk 0.10). Eval: right, score 1.0. Took 37 s, cost $0.056. |
| **Asked a person** | `gen-1201` (generated hard case: a relative writes from the recipient's account as the return-to-sender timer runs down) | `e4c60526-7c28-448b-bc56-85bb606b3d18` | The daughter says the recipient has died and asks for a redirect or a refund. The carrier accepts a choice only from the verified recipient. The agent sent one gentle holding reply that promises nothing, and handed the case to the desk supervisor with a decision card. The card has three options, what each would send, the deadline (16:00 UTC, 4 Mar), a safe fallback, and "what would change my mind" (proof that she may act for the estate). | Won't do: ask the carrier to redirect, hold or cancel; promise a redirect, cancellation or refund; call the order number again. Took 88 s, cost $0.095. Not eval-scored in the console. In the Run 4 eval this case scored 0.60 (not passing): the judge wanted a message sent to the supervisor rather than a handover card, so show the card, never a score. |
| **Correctly did nothing** | `gen-1103` (generated hard case: "FYI only… No action required from the desk") | **None yet. Run it once before recording (see pre-flight step 3).** | Expected: no message to anyone; the update is recorded for information only. The answer key requires exactly that, and its `must_not` list bans re-messaging the site or the planner. | The DB has no clean no-action run today (see the note below). |

**Why there's no stored no-action id:** the DB holds 9 finished runs. The only `no_action` row is `3f08c82f-759f-4605-abaf-82e515e66c71`, a re-run of `gen-1201` after a supervisor picked "Sign off redirect or hold" in the city HUD. The chosen option says the desk then emails the carrier, but the agent sent nothing. **Do not show that run** (it's reported to the lead as a possible bug). The scored evidence for "does nothing when nothing is owed" is in `eval/results.md`: across all four scored runs it sent a message 0 times in 3 such cases.

**Not used, and why:**
- The `delivery-003` voice pair (`29e2f585…` is simulated, `31d53d7d…` comes from `test-call-1`): it isn't a real person on a real call, so it isn't used as a voice beat.
- The `delivery-001` run (`1a619ef0…`, right, 0.9) makes a good spare "ask for info" case: it offers the carrier's two slots and says "Until Plover Arc confirms a change, your delivery stays in the morning slot."

---

## Pre-flight (do this before pressing record)

1. **Servers:** the merged build is running: the console on :3000 and the agent API on :4000. Run `curl -s localhost:3000/api/console/status`. Don't start or kill anyone else's servers.
2. **Screen:** use a 1440×900 browser window, 100% zoom, the bookmarks bar hidden, no other tabs, notifications off (macOS Focus). Record the window only (QuickTime → File → New Screen Recording → record selected portion).
3. **Make the no-action run (one paid call, about $0.05 and about 60 s):** open `http://localhost:3000/?tab=evidence`, type `gen-1103` in **Find a case**, then press **Run** on its row. Wait for **Finished**, open it and check that **zero messages** were sent. Write the new execution id here: `gen-1103 → ____________`. If it sent anything, don't use it: say so to the lead and use the 2D fallback for beat 4 (below).
4. **Open these tabs in order** (the takes then use only tab switches, with no typing on camera):
   - Tab 1: `http://localhost:3000/city` (full screen; city footage only)
   - Tab 2: `http://localhost:3000/?tab=executions&id=5881d315-39d4-4d5a-a627-0bd23f8a9d0d`
   - Tab 3: `http://localhost:3000/?tab=executions&id=e4c60526-7c28-448b-bc56-85bb606b3d18`
   - Tab 4: `http://localhost:3000/?tab=executions&id=<gen-1103 id from step 3>`
   - Tab 5: `http://localhost:3000/?tab=evidence`
   - Tab 6: `eval/results.md` rendered on GitHub (or in the editor's Markdown preview), scrolled to "All cases"
5. **Check the labels on the merged build.** This script uses the labels in the code today ("Case runs", "Step log", "Results", "Right?", "Safety check", "Practice case"). If dashboard-v2 renamed any of them, use the new label and keep the beat the same.
6. **Never click an option tile on a decision card.** Each tile is a button that records a human choice and re-runs the case (a paid call and a new row in the DB).
7. **Don't click "Answer" on these three runs.** Console runs don't store `ANSWER.md` (the column is empty), so that tab would show "No written answer for this case run." The decision, message and card are all on the main view and in the **Step log**.

---

## Take A: the main cut (city hook plus console), 60 s

Captions are burned in, bottom third, white on a dark band, at most 9 words each. There's no voiceover, or the same words read flatly.

| Time | Tab and exact clicks | On screen | Caption |
|---|---|---|---|
| **0:00–0:07** | Tab 1 (`/city`). It's already running. Before recording, click **Camera tour** in the console's City tab, or let the city's own camera move. Don't click anything else. | The 3D city: vans, drivers, an incident flaring up. Any voice bubble from a simulated persona shows its **SIMULATED** tag. | `A delivery desk: calls, emails, stories that clash.` Corner tag for the full 7 s: `Visualisation (replays agent traces). Not the agent.` |
| **0:07–0:09** | Cmd+2 (Tab 2). | Case runs list, with `delivery-013` selected. | `Hamyway City: the desk agent that knows when to stop.` |
| **0:09–0:20** | Hover the conflict line in **Steps** ("Do the stories match?": *1 conflict: whether the recipient was reachable at the attempt*). Then scroll so the message card is visible (To: Tracking support, Plover Arc Logistics · Email). Hover **Right ✓**. | The clash row, the message to the owning team, the safety check row "2 of 2 messages cleared", and **Right ✓**. | `Scan says "failed attempt". She says she was home.` → (at 0:14) `It asks the carrier to review. Picks no side.` |
| **0:20–0:22** | Cmd+3 (Tab 3). | `gen-1201` opens. | `A harder one.` |
| **0:22–0:36** | Scroll slowly to the card **A person needs to decide** ("Asked: Rivet Delivery Desk supervisor"): the line saying why it stopped → the three option tiles, each with what it would send. Click **▸ More** (on the toggle, **never on an option tile**: a tile re-runs the case with a paid call). Hold for 2 s on "What would settle it:" and "If nobody answers:". | The card: "The recipient is reported deceased and his daughter asks to redirect or cancel his parcel… only a named supervisor can sign off." Deadline 16:00 UTC, 4 Mar. One holding reply recorded, with no promise in it. | `Recipient has died. Daughter asks for a redirect.` → (0:28) `It won't decide that. A supervisor will.` → (0:33) `One kind reply. No promise. Clear options.` |
| **0:36–0:44** | Cmd+4 (Tab 4, `gen-1103`). Point at the empty outbox / "nothing sent" and the decision row. | The FYI-only message from the freight planner, decision **no action**, and zero messages. | `"FYI only." So it sends nothing.` |
| **0:44–0:54** | Cmd+5 (Results), then Cmd+6 (`eval/results.md`, "All cases" table, the Run 4 column, "current code"). Hold the zoom on these rows: Passing, Sent a message when nothing was owed, Sent a message when a person had to decide, Broke a must-never rule. | Results grid rows with ✓ and ✗, then the table. | `48 tested cases: 46 right, mean score 0.92.` → (0:49) `Never messaged when a person had to decide (0 of 5).` → (0:52) `50 of 50 practice cases in 165 s, $2.70.` |
| **0:54–1:00** | Stay on the table or cut to Tab 2. | Still frame. | `Most agents answer. Hamyway City knows who decides, and when to stop.` |

**On-screen numbers allowed, and their source:** "46 of 48 passing, mean 0.92" (Run 4), "0 of 5", "0 of 3", "0 of 48 must-never rules broken" (Run 4), "50 of 50 in 165 s, $2.70 (about $0.054 per case)" all come from `eval/results.md`. "2 of 2 messages cleared", "Right, 1.0", 37 s and $0.056 come from run `5881d315…`. Say "no must-never rule broken in the latest run" (Run 4, 0 of 48), not "never breaks a rule": Run 3 had 2 breaks, which don't recur in Run 4. The two Run 4 fails are escalations where the judge scored the extra message (`gen-1201`, `gen-904`). That includes our "asked a person" case, so don't show a pass mark for `gen-1201`.

---

## Take B: the 2D-only safety take, 60 s, no 3D footage

Record this one first, and use it if the city stutters, the GPU struggles or anyone doubts the city label. It's the same as Take A with the hook replaced:

| Time | Tab and exact clicks | On screen | Caption |
|---|---|---|---|
| **0:00–0:07** | `http://localhost:3000/` (**Home**). Don't click anything. | Big plain totals, "Real cases only", Recent cases. | `A delivery desk: calls, emails, stories that clash.` → `Hamyway City decides who owns it, and when to stop.` |
| **0:07–1:00** | Same as Take A from 0:07. | | |

**If the gen-1103 run is missing or sent something:** in either take, replace 0:36–0:44 with Tab 6 (`eval/results.md`) zoomed on the row "Sent a message when nothing was owed: 0% (0 of 3)" (the same in all four runs), captioned `When nothing is owed, it sends nothing (0 of 3).` Then go straight to Results.

---

## Backup: the agent API is slow or down

The video never needs a live call; every beat above opens a run that's already saved. If a beat should show the agent *working* step by step:

1. **"▶ Watch it think"** (on the case-run page in dashboard-v2, `Replay.tsx`): open the saved run (Tab 2 or 3) and click **▶ Watch it think**. It plays the saved trace back beat by beat: the messages in, each step in plain words, "Do the stories match?", the safety check, the message or the decision. Every beat takes 0.6 to 1.2 s, and there's no model call. A full `delivery-013` replay fits in the 0:09–0:20 slot, so it can replace the hover-and-scroll there.
2. **If that button isn't in the merged build:** go to **Playbooks**, choose the case run (`delivery-013` or `gen-1201`) in the run picker, and click **Play again**. The flow canvas lights up each step from the saved trace.
3. **Never** record a live run that's spinning, an error banner, or a run started on camera and cut mid-way.
4. **If :3000 itself is down:** record Take B against whichever console build is up and serving the same `runs/` (dev branch servers share `runs/` through the symlink). The execution ids are the same everywhere.

---

## After recording

- Trim to 60 s or less. Compress to 720p and under 30 MB: `ffmpeg -i raw.mov -vf scale=-2:720 -c:v libx264 -crf 28 -preset slow -an demo/demo.mp4`. Commit it normally (not LFS) by **16:00**.
- Watch it once with the sound off and check these: every number is in the allowed list above; the city carries its visualisation tag; nothing simulated appears without its label; there are no API keys, terminal tabs or other cases' personal data on screen.
- Update `docs/submission-tracker.md` (video row) and `SUBMISSION.md` (video path).
