// Renders the Remotion compositions.
//
//   node remotion/render.mjs demo            -> demo/rivet-demo.mp4 (the 60 s cut, DemoCut)
//   node remotion/render.mjs full            -> demo/rivet-demo-full.mp4 (the full film, DemoV2) + docs/media/hero.gif
//   node remotion/render.mjs v1              -> demo/rivet-demo-v1.mp4 (the 60 s cut, Demo)
//   node remotion/render.mjs gifs            -> docs/media/hero.gif, docs/media/feature-*.gif
//   node remotion/render.mjs all
//   add --wait=15 to wait up to 15 minutes for docs/media/manifest.json first
//   add --audio=voiceover.mp3 to lay a file from docs/media under the demo
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MEDIA_DIR, scanMedia } from "./scan-media.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../../..");
const DEMO_OUT = join(REPO, "demo", "rivet-demo-v1.mp4");
const V2_OUT = join(REPO, "demo", "rivet-demo-full.mp4");
const CUT_OUT = process.env.CUT_OUT || join(REPO, "demo", "rivet-demo.mp4");
const V2_MAX = 60 * 1024 * 1024;
const MB = 1024 * 1024;
// 50 MB is the hard limit for committing without LFS; the PRD (H1) asks for under 30 MB.
const DEMO_MAX = 30 * MB;
const GIF_MAX = 8 * MB;
const FEATURES = ["voice", "playbook", "city", "decisions"];

const args = process.argv.slice(2);
const what = args.find((a) => !a.startsWith("--")) ?? "all";
const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const waitMin = Number(opt("wait") ?? 0);
const audio = opt("audio") ?? null;

const mb = (n) => `${(n / MB).toFixed(2)} MB`;

async function waitForManifest() {
  const mf = join(MEDIA_DIR, "manifest.json");
  const until = Date.now() + waitMin * 60_000;
  while (!existsSync(mf) && Date.now() < until) {
    console.log(`waiting for ${mf} ...`);
    await new Promise((r) => setTimeout(r, 20_000));
  }
  if (!existsSync(mf)) console.log("no manifest.json; rendering with whatever media exists");
}

function ffmpegCmd() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return ["ffmpeg"];
  } catch {
    return ["npx", "remotion", "ffmpeg"];
  }
}

async function main() {
  if (waitMin > 0) await waitForManifest();
  scanMedia();

  console.log("bundling ...");
  const serveUrl = await bundle({ entryPoint: join(here, "index.ts"), publicDir: MEDIA_DIR });

  const render = async (id, outputLocation, extra = {}) => {
    const inputProps = extra.inputProps ?? {};
    const composition = await selectComposition({ serveUrl, id, inputProps });
    let last = -1;
    await renderMedia({
      serveUrl,
      composition,
      inputProps,
      codec: "h264",
      outputLocation,
      concurrency: extra.concurrency ?? null,
      onProgress: ({ progress }) => {
        const p = Math.floor(progress * 10);
        if (p !== last) {
          last = p;
          process.stdout.write(`  ${id} ${p * 10}%\r`);
        }
      },
      ...extra.media,
    });
    process.stdout.write("\n");
  };

  if (what === "v1") {
    mkdirSync(dirname(DEMO_OUT), { recursive: true });
    const inputProps = { audio, audioVolume: 1 };
    for (const crf of [22, 25, 28]) {
      console.log(`rendering Demo (crf ${crf}) -> ${DEMO_OUT}`);
      await render("Demo", DEMO_OUT, { inputProps, media: { crf, x264Preset: "slow", pixelFormat: "yuv420p", muted: !audio } });
      const size = statSync(DEMO_OUT).size;
      console.log(`  ${DEMO_OUT}: ${mb(size)}`);
      if (size < DEMO_MAX) break;
    }
  }

  if (what === "demo" || what === "all") {
    const inputProps = { audio, audioVolume: 1, cut: true };
    for (const crf of [20, 24, 28]) {
      console.log(`rendering DemoCut (crf ${crf}) -> ${CUT_OUT}`);
      await render("DemoCut", CUT_OUT, { inputProps, media: { crf, x264Preset: "slow", pixelFormat: "yuv420p", muted: !audio } });
      const size = statSync(CUT_OUT).size;
      console.log(`  ${CUT_OUT}: ${mb(size)}`);
      if (size < 30 * MB) break;
    }
  }

  if (what === "full" || what === "all") {
    mkdirSync(dirname(V2_OUT), { recursive: true });
    const inputProps = { audio, audioVolume: 1 };
    for (const crf of [20, 24, 28]) {
      console.log(`rendering DemoV2 (crf ${crf}) -> ${V2_OUT}`);
      await render("DemoV2", V2_OUT, { inputProps, media: { crf, x264Preset: "slow", pixelFormat: "yuv420p", muted: !audio } });
      const size = statSync(V2_OUT).size;
      console.log(`  ${V2_OUT}: ${mb(size)}`);
      if (size < V2_MAX) break;
    }
  }

  // README hero from the best 6 s of v2: the safety check (needle lands in "clear", the sent email types out).
  if (what === "full" || what === "all" || what === "hero-v2") {
    const HERO_START = 32.4; // s: Problem 285 + Title 120 - 2 x 16 transition = 373 frames, + safety step at 610
    const ff = ffmpegCmd();
    const out = join(MEDIA_DIR, "hero.gif");
    for (const t of [{ fps: 15, w: 1200, c: 256 }, { fps: 12, w: 1200, c: 128 }, { fps: 10, w: 960, c: 96 }]) {
      const vf = `fps=${t.fps},scale=${t.w}:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=${t.c}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
      execFileSync(ff[0], [...ff.slice(1), "-y", "-v", "error", "-ss", String(HERO_START), "-t", "6", "-i", V2_OUT, "-vf", vf, "-loop", "0", out], { stdio: "inherit" });
      const size = statSync(out).size;
      console.log(`  ${out}: ${mb(size)} (from v2, ${t.fps} fps, ${t.w}px)`);
      if (size && size < GIF_MAX) break;
    }
  }

  if (what === "gifs" || what === "all") {
    const tmp = mkdtempSync(join(tmpdir(), "rivet-gif-"));
    const ff = ffmpegCmd();
    // hero.gif comes from the v2 film (see above); the HeroGif composition is kept for a stills-only fallback
    const jobs = [...FEATURES.map((f) => ({ id: `FeatureGif-${f}`, out: join(MEDIA_DIR, `feature-${f}.gif`), width: 960 }))];
    for (const job of jobs) {
      const mp4 = join(tmp, `${job.id}.mp4`);
      console.log(`rendering ${job.id}`);
      await render(job.id, mp4, { media: { crf: 12, muted: true } });
      // Palette GIFs look far better than straight conversion. Step down if too big.
      const tries = [
        { fps: 15, width: job.width, colors: 256, bayer: 4 },
        { fps: 12, width: job.width, colors: 128, bayer: 5 },
        { fps: 10, width: job.width, colors: 96, bayer: 5 },
        { fps: 10, width: job.width, colors: 96, bayer: 0 },
        { fps: 10, width: Math.round(job.width * 0.85), colors: 96, bayer: 0 },
        { fps: 8, width: Math.round(job.width * 0.75), colors: 64, bayer: 0 },
      ];

      for (const t of tries) {
        const vf = `fps=${t.fps},scale=${t.width}:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=${t.colors}:stats_mode=diff[p];[b][p]paletteuse=${t.bayer ? `dither=bayer:bayer_scale=${t.bayer}` : "dither=none"}:diff_mode=rectangle`;
        execFileSync(ff[0], [...ff.slice(1), "-y", "-v", "error", "-i", mp4, "-vf", vf, "-loop", "0", job.out], { stdio: "inherit" });
        const size = statSync(job.out).size;
        if (!size) throw new Error(`ffmpeg wrote an empty ${job.out}`);
        console.log(`  ${job.out}: ${mb(size)} (${t.fps} fps, ${t.width}px, ${t.colors} colours)`);
        if (size < GIF_MAX) break;
      }
    }
    rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
