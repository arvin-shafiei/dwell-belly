# video

Turns real screenshots and screen recordings of Rivet into the demo video and the README GIFs.

1. `scripts/capture.mjs` (Playwright) captures stills and clips from the running app into `docs/media/`, and lists them in `docs/media/manifest.json`.
2. `remotion/` (Remotion) cuts them into a video and GIFs. Nothing in it is invented: every shot is a captured still or clip, and a shot whose file is missing is skipped.

## Remotion

```bash
npm run studio -w video        # preview and scrub in the browser
npm run render:demo -w video   # -> demo/rivet-demo.mp4 (1920x1080, 30 fps, 60 s, H.264)
npm run render:gifs -w video   # -> docs/media/hero.gif and docs/media/feature-{voice,playbook,city,decisions}.gif
npm run render:all -w video
```

Options (after `--`): `--wait=15` waits up to 15 minutes for `docs/media/manifest.json` before rendering; `--audio=voiceover.mp3` lays a file from `docs/media/` under the demo (the `audio` slot; there is no voiceover by default).

| Composition | Size | Length | Output |
|---|---|---|---|
| `Demo` | 1920x1080, 30 fps | 60 s | `demo/rivet-demo.mp4` (kept under 50 MB: re-encoded at a higher CRF if bigger) |
| `HeroGif` | 1200x675, 15 fps | 8 s loop | `docs/media/hero.gif` |
| `FeatureGif-voice`, `-playbook`, `-city`, `-decisions` | 960x540, 15 fps | 5 s loops | `docs/media/feature-*.gif` |

GIFs are rendered to MP4 first and converted with an ffmpeg palette; if one is over 8 MB it is redone at a lower frame rate, size and colour count.

### Files

- `remotion/scan-media.mjs` lists what is in `docs/media/` (with clip lengths from ffprobe) into `remotion/media.generated.json` (gitignored). `RIVET_MEDIA_DIR` points it elsewhere.
- `remotion/compositions/Demo.tsx` is the video, beat by beat: hook (0-6 s), a real case run (6-20), making a playbook (20-30), a person decides and voice (30-40), the live city (40-52), results and the one-liner (52-60).
- `remotion/compositions/Gifs.tsx` holds the hero montage and the feature loops.
- `remotion/copy.ts` holds the camera moves per still and `PRACTICE_SCORE`. Set the score only if the real practice screenshot shows it.
- `remotion/components/` holds the Ken Burns still, the clip player, captions, the SIMULATED tag and the crossfading reel.

### Honesty rules (PRD Part H)

- City footage carries a "Simulated city · visualisation" tag in every shot.
- No numbers in captions. Any number on screen is the one in the real screenshot.
- If a capture is missing, its shot is dropped (or the beat becomes a plain text card), never replaced by a mock.

## Licence

Remotion is not open source in the usual sense: it is free for individuals and for companies with up to 3 employees, and needs a company licence above that. See <https://www.remotion.dev/license>. Our use (a hackathon team) is within the free tier. The rest of this folder is Apache 2.0 like the repo.

Fonts: Instrument Sans and Spline Sans Mono (SIL Open Font License), from Fontsource.
