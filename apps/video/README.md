# video

Turns real screenshots and screen recordings of Hamyway City into the demo video and the README GIFs.

1. `scripts/capture.mjs` (Playwright) captures stills and clips from the running app into `docs/media/`, and lists them in `docs/media/manifest.json`.
2. `remotion/` (Remotion) cuts them into a video and GIFs. Console and city shots are captured footage, and a shot whose file is missing is skipped. The animated explainer scenes in v2 (flow, seats, decision card, numbers) are drawn in code, using text and numbers taken from real runs and the team's framework map.

## Remotion

```bash
npm run studio -w video        # preview and scrub in the browser
npm run render:demo -w video   # -> demo/rivet-demo.mp4 (DemoCut, the 60 s cut of the v2 film; rules ask for about 60 s)
npm run render:demo-full -w video  # -> demo/rivet-demo-full.mp4 (DemoV2, about 1:56) and docs/media/hero.gif (6 s from it)
npm run render:v1 -w video     # -> demo/rivet-demo-v1.mp4 (Demo, the earlier 60 s cut of stills and clips)
npm run render:gifs -w video   # -> docs/media/feature-{voice,playbook,city,decisions}.gif
npm run render:hero -w video   # -> docs/media/hero.gif only, cut from an existing demo/rivet-demo-full.mp4
npm run render:all -w video
```

Options (after `--`): `--wait=15` waits up to 15 minutes for `docs/media/manifest.json` before rendering; `--audio=voiceover.mp3` lays a file from `docs/media/` under the film (the `audio` slot; there is no voiceover by default, and every beat has on-screen text because the video will often play muted).

| Composition | Size | Length | Output |
|---|---|---|---|
| `DemoCut` | 1920x1080, 30 fps, H.264 | 59.3 s (hard max 60) | `demo/rivet-demo.mp4`: problem, delivery-013 through the flow, console footage (Watch it think, Decisions, Playbooks), city, numbers, end card |
| `DemoV2` | 1920x1080, 30 fps, H.264 | about 116 s | `demo/rivet-demo-full.mp4` (re-encoded at a higher CRF if over 60 MB) |
| `Demo` | 1920x1080, 30 fps, H.264 | 60 s | `demo/rivet-demo-v1.mp4` |
| `FeatureGif-voice`, `-playbook`, `-city`, `-decisions` | 960x540, 15 fps | 5 s loops | `docs/media/feature-*.gif` |
| `HeroGif` | 1200x675, 15 fps | 8 s | not rendered by default (a stills-only fallback); `hero.gif` is cut from `DemoV2` |

GIFs go through an ffmpeg palette. If one is over 8 MB it is redone at a lower frame rate, colour count and size.

### The v2 film, beat by beat (`remotion/v2/`)

1. The problem: real practice-case titles pile up, then a real clash from delivery-013 (carrier scan vs. the recipient's account).
2. Title.
3. One real case through the flow: Load, Understand (records vs claims), three quick checks, Plan, Safety check. Animated nodes, drawn edges, a risk needle landing in the `< 0.3` band, then the email it actually sent.
4. Second opinions: the five seats and their questions.
5. A real decision card (from `case-run-voice.png`) assembling piece by piece, with approve by voice (console only, never in the scored run).
6. The console in action: the `docs/media/clips/v2/` recordings in a browser frame, with a caption per shot.
7. The 3D city, labelled "Simulated city · visualisation of agent traces · not the agent".
8. Numbers counting up from the latest eval run (team framework map, 14:10), with the caveat that this is our own eval.
9. End card.

### Files

- `remotion/scan-media.mjs` lists what is in `docs/media/` (with clip lengths from ffprobe) into `remotion/media.generated.json` (gitignored). `RIVET_MEDIA_DIR` points it elsewhere.
- `remotion/v2/` is the main film: `kit.tsx` (springs, kinetic type, device frame, count-up) and one file per group of scenes.
- `remotion/compositions/Demo.tsx` is the v1 cut, beat by beat: hook (0-6 s), a real case run (6-20), making a playbook (20-30), a person decides and voice (30-40), the live city (40-52), results and the one-liner (52-60).
- `remotion/compositions/Gifs.tsx` holds the hero montage and the feature loops.
- `remotion/copy.ts` holds the camera moves per still and `PRACTICE_SCORE`. Set the score only if the real practice screenshot shows it.
- `remotion/components/` holds the Ken Burns still, the clip player, captions, the SIMULATED tag and the crossfading reel.

### Honesty rules (PRD Part H)

- City footage carries a "Simulated city · visualisation" tag in every shot.
- Numbers on screen come from the real screenshots or the team's framework map (latest eval run), never from the mock HUD.
- If a capture is missing, its shot is dropped (or the beat becomes a plain text card), never replaced by a mock.

## Licence

Remotion is not open source in the usual sense: it is free for individuals and for companies with up to 3 employees, and needs a company licence above that. See <https://www.remotion.dev/license>. Our use (a hackathon team) is within the free tier. The rest of this folder is Apache 2.0 like the repo.

Fonts: Instrument Sans and Spline Sans Mono (SIL Open Font License), from Fontsource.
