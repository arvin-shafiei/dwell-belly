# Live workflow trial

Open http://localhost:3000/?tab=workflows.

1. Click **New playbook**. Type a business description, including who owns each decision and any actual restrictions. The residential courier example is a starter, and remains editable. Click **Make it**. This calls the Architect live; allow roughly a minute or two.
2. Review the generated graph and click **Use this playbook**. Business requirements are stored in executable planner policies. The canvas label alone is not a capability.
3. Click **Run a case**, then **Write a sample**. Choose **Delivery 003: locked gate**, edit it if desired and click **Run it**. This includes only the organiser's first two messages, never the disclosed future answer.
4. Watch the recorded decision path. The expected coordination is to contact the verified recipient for permitted admission or meeting the courier, without requesting a permanent code or claiming delivery is complete.
5. Click **Add a reply**. Try **Recipient can admit driver**, then **Driver confirms handover**. Each click runs the real agent again on the accumulated history. These replies are explicit simulated events introduced after the initial decision.
6. Try the alternative **Recipient unavailable** from an initial run, or write a new edge case. The agent should ask Dispatch for supported alternatives matching the recipient's constraints, preserve the driver's deadline and avoid unattended delivery.
7. To correct behaviour, open **Practice** on the selected completed run. Supply your name and an applicable requirement under **Learn from a human correction**. Review the proposed node/rule/policy changes, choose **Use it**, then **Test the corrected case**. A correction is not approval of an action; safety gates still apply. A new typed sample has no answer key, so the direct rerun shows its decision without inventing a grade.

Three additional generated flows are saved locally and shipped as JSON: **Demo: delivery recovery**, **Demo: cold-chain clearance**, and **Demo: human authority and corrections**. They are examples, not substitutes for live generation.

## Real inputs

The existing **New case** page accepts real messages and transcripts and runs the selected workflow through the same console execution service. Its `/api/console/intake` endpoint also accepts structured message events and a workflow id. Keep the console on a trusted local network; the current endpoint is not an authenticated public webhook.

The existing browser voice path can let a real participant supply a recipient or dispatcher reply when ElevenLabs credentials and the voice agent are configured. Speaking as a fictional case recipient is still a rehearsal, not proof that a real customer was authenticated. Carrier booking, physical gate control and parcel handover remain outside this integration. Messages are sandboxed.

## Reproduction and evidence

- `npm run demo:workflows -- build`: call the Architect for missing demo graphs, validate and save them in the console. Existing shipped graphs are reused.
- `npm run demo:workflows -- rehearse`: execute recovery, a chained crash/customer/site/food-safety scenario, explicit simulated completion, and human authority handling.
- `npm run demo:workflows -- feedback`: submit an explicitly synthetic supervisor correction and dry-run the proposed graph. The proposal remains a draft and does not change the current workflow.
- `DEMO_BROWSER_PATH=<local Chromium executable> node scripts/demo-live.mjs`: live browser generation, delivery-003 input, recipient reply and driver handover. Omit the variable if Playwright's Chromium is installed in its default location.

These commands require the web server on :3000 and agent server on :4000. Model calls are paid. Each command writes actual outputs and failures to `eval/demo-workflows/`; console runs also remain in `runs/console.db`. No unseen Reality Test result, live delivery or measured generalisation is claimed by these rehearsals.
