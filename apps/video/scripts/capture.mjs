#!/usr/bin/env node
// Captures README / video media of the real running app (web on :3000, agent API on :4000).
//
//   npm run capture -w video                      # everything
//   npm run capture -w video -- --only=city-aerial,city-night
//   npm run capture -w video -- --skip-paid       # skip anything that calls the real model
//   BASE_URL=http://localhost:3000 HEADED=1 npm run capture -w video
//
// Stills: 1920x1080 viewport at deviceScaleFactor 2 -> docs/media/*.png (3840x2160).
// Clips:  Playwright recordVideo at 1920x1080, trimmed with ffmpeg (if present) to 8-15 s -> docs/media/clips/*.webm.
// Writes docs/media/manifest.json (merged with the previous one, so partial re-runs keep older entries).
// Every shot is independent: retries, timeouts, and a failure never stops the rest.
import { chromium } from "playwright";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
const OUT = join(ROOT, "docs/media");
const CLIPS = join(OUT, "clips");
const RAW = join(tmpdir(), "rivet-capture-raw");
const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const ARGS = process.argv.slice(2);
const ONLY = (ARGS.find((a) => a.startsWith("--only="))?.slice(7) || "").split(",").filter(Boolean);
const SKIP_PAID = ARGS.includes("--skip-paid");
const HEADED = process.env.HEADED === "1";

const VIEW = { width: 1920, height: 1080 };
const GPU_ARGS = ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-webgl", "--autoplay-policy=no-user-gesture-required"];
const CITY_CHANNEL = "rivet-city";

for (const d of [OUT, CLIPS, RAW]) mkdirSync(d, { recursive: true });

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const want = (name) => ONLY.length === 0 || ONLY.includes(name);

// ---------- manifest ----------
const MANIFEST = join(OUT, "manifest.json");
const prev = (() => {
  try {
    return JSON.parse(readFileSync(MANIFEST, "utf8"));
  } catch {
    return null;
  }
})();
const entries = new Map((prev?.files ?? []).map((f) => [f.file, f]));
const failures = new Map((prev?.failed ?? []).map((f) => [f.file, f]));

function record(file, caption, extra = {}) {
  const abs = join(OUT, file);
  const st = statSync(abs);
  entries.set(file, { file, caption, bytes: st.size, capturedAt: new Date().toISOString(), ...extra });
  failures.delete(file);
  log(`  saved ${file} (${(st.size / 1024).toFixed(0)} KB)`);
}
function fail(file, reason) {
  failures.set(file, { file, reason: String(reason).split("\n")[0].slice(0, 300), at: new Date().toISOString() });
  log(`  FAILED ${file}: ${reason}`);
}
function writeManifest(browserInfo) {
  const files = [...entries.values()].filter((f) => existsSync(join(OUT, f.file))).sort((a, b) => a.file.localeCompare(b.file));
  const out = {
    generatedAt: new Date().toISOString(),
    generator: "apps/video/scripts/capture.mjs",
    baseUrl: BASE,
    browser: browserInfo,
    stills: { viewport: VIEW, deviceScaleFactor: 2 },
    clips: { size: VIEW, format: "webm" },
    files,
    failed: [...failures.values()],
  };
  writeFileSync(MANIFEST, JSON.stringify(out, null, 2) + "\n");
}

// ---------- shot runner ----------
async function shot(name, fn, { retries = 1, timeoutMs = 180_000, gate = [name] } = {}) {
  if (!gate.some(want)) return;
  for (let attempt = 0; attempt <= retries; attempt++) {
    log(`> ${name}${attempt ? ` (retry ${attempt})` : ""}`);
    let timer;
    try {
      await Promise.race([
        fn(attempt),
        new Promise((_, rej) => (timer = setTimeout(() => rej(new Error(`timed out after ${timeoutMs / 1000}s`)), timeoutMs))),
      ]);
      clearTimeout(timer);
      return true;
    } catch (e) {
      clearTimeout(timer);
      if (e?.skip) {
        fail(e.file ?? name, `skipped: ${e.message}`);
        return false;
      }
      log(`  error: ${String(e?.message ?? e).split("\n")[0]}`);
      if (attempt === retries) fail(e?.file ?? fileFor(name), e?.message ?? e);
    }
  }
  return false;
}
const fileFor = (name) => (name.startsWith("clip:") ? `clips/${name.slice(5)}.webm` : `${name}.png`);
class Skip extends Error {
  constructor(msg, file) {
    super(msg);
    this.skip = true;
    this.file = file;
  }
}

// ---------- browser ----------
const HIDE_DEV_OVERLAY = () => {
  const add = () => {
    if (document.getElementById("__capture_css")) return;
    const s = document.createElement("style");
    s.id = "__capture_css";
    // Next.js dev overlay ("N" badge, issues pill) and text cursor blink.
    s.textContent = "nextjs-portal{display:none!important} *{caret-color:transparent!important}";
    (document.head || document.documentElement).appendChild(s);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add);
  else add();
};

async function launchBrowser() {
  const attempts = HEADED
    ? [{ label: "chromium headed", opts: { headless: false } }]
    : [
        { label: "chromium (new headless)", opts: { channel: "chromium", headless: true } },
        { label: "chrome (new headless)", opts: { channel: "chrome", headless: true } },
        { label: "chromium headed", opts: { headless: false } },
      ];
  for (const a of attempts) {
    try {
      const browser = await chromium.launch({ ...a.opts, args: GPU_ARGS });
      const page = await browser.newPage();
      const gl = await page.evaluate(() => {
        const c = document.createElement("canvas");
        const g = c.getContext("webgl2") || c.getContext("webgl");
        if (!g) return null;
        const ext = g.getExtension("WEBGL_debug_renderer_info");
        return ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER);
      });
      await page.close();
      if (!gl || /swiftshader/i.test(gl)) {
        log(`browser ${a.label}: WebGL ${gl ? `is software (${gl})` : "unavailable"}, trying the next option`);
        if (a === attempts[attempts.length - 1] && gl) return { browser, info: { launch: a.label, webgl: gl } };
        await browser.close();
        continue;
      }
      log(`browser: ${a.label}, WebGL renderer: ${gl}`);
      return { browser, info: { launch: a.label, webgl: gl } };
    } catch (e) {
      log(`browser ${a.label} failed: ${String(e.message).split("\n")[0]}`);
    }
  }
  throw new Error("no browser could be launched");
}

async function newContext(browser, { dsf = 2, video = false } = {}) {
  const ctx = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: dsf,
    colorScheme: "dark",
    reducedMotion: "no-preference",
    ...(video ? { recordVideo: { dir: RAW, size: VIEW } } : {}),
  });
  await ctx.addInitScript(HIDE_DEV_OVERLAY);
  ctx.setDefaultTimeout(20_000);
  return ctx;
}

async function goto(page, path, { idle = true } = {}) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 90_000 });
  if (idle) await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await sleep(1200);
}

async function still(page, file, caption, opts = {}) {
  await page.mouse.move(VIEW.width - 2, VIEW.height - 2).catch(() => {}); // no hover states
  await page.screenshot({ path: join(OUT, file), type: "png", animations: "allow", ...opts });
  record(file, caption);
}

// ---------- video trimming ----------
const HAS_FFMPEG = spawnSync("ffmpeg", ["-version"]).status === 0;

/** segments: [[startSec, endSec], ...] relative to the raw video start. Concatenated, re-encoded VP9. */
function cutClip(raw, file, segments, caption) {
  const out = join(OUT, file);
  if (!HAS_FFMPEG) {
    writeFileSync(out, readFileSync(raw));
    record(file, caption + " (untrimmed: ffmpeg not found)");
    return;
  }
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", raw]).toString().trim()) || 0;
  const segs = segments
    .map(([a, b]) => [Math.max(0, a), dur ? Math.min(b, dur) : b])
    .filter(([a, b]) => b - a > 0.3);
  if (!segs.length) throw new Error(`no usable segment (raw is ${dur.toFixed(1)}s)`);
  const parts = segs.map(([a, b], i) => `[0:v]trim=start=${a.toFixed(2)}:end=${b.toFixed(2)},setpts=PTS-STARTPTS,fps=30[v${i}]`);
  const filter = parts.join(";") + ";" + segs.map((_, i) => `[v${i}]`).join("") + `concat=n=${segs.length}:v=1:a=0[out]`;
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-i", raw, "-filter_complex", filter, "-map", "[out]",
    "-c:v", "libvpx-vp9", "-b:v", "8M", "-crf", "18", "-deadline", "good", "-cpu-used", "2", "-row-mt", "1", "-pix_fmt", "yuv420p", "-an", out,
  ]);
  const total = segs.reduce((s, [a, b]) => s + b - a, 0);
  record(file, caption, { seconds: +total.toFixed(1) });
}

/** Closes a recording context and returns the raw webm path. */
async function finishRecording(ctx, page, name) {
  const v = page.video();
  await ctx.close();
  const raw = join(RAW, `${name}.webm`);
  await v.saveAs(raw);
  return raw;
}

// ---------- city helpers ----------
async function openCity(page) {
  await page.goto(BASE + "/city", { waitUntil: "domcontentloaded", timeout: 90_000 });
  const t0 = Date.now();
  await page.waitForFunction(() => !!window.__city, null, { timeout: 150_000, polling: 500 });
  log(`  city ready in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  // Telemetry tap: the city streams a snapshot every second on the BroadcastChannel.
  await page.evaluate((name) => {
    const ch = new BroadcastChannel(name);
    window.__capCh = ch;
    ch.onmessage = (e) => {
      if (e.data?.type === "telemetry") window.__capTel = e.data;
    };
  }, CITY_CHANNEL);
  await sleep(5000);
}
const cmd = (page, msg) => page.evaluate((m) => window.__capCh.postMessage(m), msg);
const telemetry = (page) => page.evaluate(() => window.__capTel ?? null);
/** The first new incident of `kind` (e.g. "truck_crash") that was not in `knownIds`. Other crashes happen on
 *  their own all the time, so match the kind exactly and take the earliest one. */
async function waitForIncident(page, kind, knownIds, timeoutMs = 25_000) {
  const end = Date.now() + timeoutMs;
  let any = null;
  while (Date.now() < end) {
    const t = await telemetry(page);
    const inc = (t?.incidents ?? []).filter((i) => !knownIds.has(i.id) && i.kind === kind);
    any ??= inc[0] ?? null;
    // Prefer the staged crash the request asked for over the physics engine's own fender-benders
    // ("X ran into Y at 9 mph"), which happen anywhere at any time.
    const staged = inc.filter((i) => !/\bat \d+ mph\b/.test(i.note));
    if (staged.length) {
      log(`  incident ${staged[0].id}: ${staged[0].note}`);
      return staged[0];
    }
    await sleep(500);
  }
  return any;
}

/** Injects truck crashes until one lands on the open A-Ring, where the default camera angle can see it.
 *  Slip-road and side-street crashes sit under elevated roads or between buildings, and the camera ends up
 *  framing rooftops. */
async function injectVisibleTruckCrash(page, tries = 4) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    const before = new Set(((await telemetry(page))?.incidents ?? []).map((x) => x.id));
    await cmd(page, { type: "inject", event: "truck_crash" });
    const inc = await waitForIncident(page, "truck_crash", before, 30_000);
    if (!inc) continue;
    last = inc;
    if (/A-Ring/i.test(inc.note) && !/slip road/i.test(inc.note)) return inc;
    log(`  "${inc.note}" is usually hidden by buildings: injecting another`);
  }
  return last;
}

// ---------- console helpers ----------
/** Case-run list items whose status line (innerText) matches statusRe, practice cases last. */
async function runItems(page, statusRe) {
  const all = page.locator("button");
  const end = Date.now() + 20_000;
  let hits = [];
  while (Date.now() < end) {
    const texts = await all.evaluateAll((els) => els.map((e) => e.innerText || ""));
    hits = texts
      .map((t, i) => ({ i, t, lines: t.split("\n").map((l) => l.trim()) }))
      .filter((x) => x.lines.length >= 2 && x.lines.length <= 5 && /\bago$/.test(x.t.trim()) && x.lines.some((l) => statusRe.test(l)));
    if (hits.length) break;
    await sleep(500);
  }
  hits.sort((a, b) => /practice case/i.test(a.t) - /practice case/i.test(b.t));
  return hits.map((h) => ({ loc: all.nth(h.i), title: h.lines[0] }));
}
async function pickRun(page, statusRe) {
  return (await runItems(page, statusRe))[0] ?? null;
}

/** Zooms the React Flow canvas to about `targetScale`, then pans so the whole tree is centered in the
 *  canvas, or, when it is wider than the canvas, so its right end (the outcomes) stays in view. */
async function frameFlow(page, { targetScale }) {
  await page.getByRole("button", { name: "Fit View" }).click();
  await sleep(700);
  const scaleNow = () =>
    page.$eval(".react-flow__viewport", (e) => Number(/scale\(([\d.]+)\)/.exec(e.style.transform)?.[1] ?? 1));
  for (let i = 0; i < 12 && (await scaleNow()) * 1.1 < targetScale; i++) {
    await page.getByRole("button", { name: "Zoom In" }).click();
    await sleep(350);
  }
  await sleep(400);
  const pane = await page.locator(".react-flow__pane").boundingBox();
  const bb = await page.$$eval(".react-flow__node", (els) => {
    const r = els.map((e) => e.getBoundingClientRect());
    return { x0: Math.min(...r.map((b) => b.left)), x1: Math.max(...r.map((b) => b.right)), y0: Math.min(...r.map((b) => b.top)), y1: Math.max(...r.map((b) => b.bottom)) };
  });
  const margin = 50;
  const tx = bb.x1 - bb.x0 <= pane.width - 2 * margin ? pane.x + pane.width / 2 - (bb.x0 + bb.x1) / 2 : pane.x + pane.width - margin - bb.x1;
  const ty = pane.y + pane.height / 2 - (bb.y0 + bb.y1) / 2;
  const sx = pane.x + pane.width / 2, sy = pane.y + pane.height - 40;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + tx / 2, sy + ty / 2, { steps: 8 });
  await page.mouse.move(sx + tx, sy + ty, { steps: 8 });
  await page.mouse.up();
  await sleep(600);
}

// =====================================================================
const { browser, info: browserInfo } = await launchBrowser();
process.on("SIGINT", () => {
  writeManifest(browserInfo);
  process.exit(130);
});

try {
  // ---------------- console stills ----------------
  const ctx = await newContext(browser, { dsf: 2 });
  const page = await ctx.newPage();

  await shot("console-home", async () => {
    await goto(page, "/");
    await still(page, "console-home.png", "Console home: live status and the latest delivery cases waiting on the desk.");
  });

  await shot("playbooks-tree", async () => {
    await goto(page, "/?tab=workflows");
    await page.getByRole("button", { name: "Tidy up" }).click();
    await sleep(800);
    await page.getByRole("button", { name: "Hide menu" }).click().catch(() => {}); // more room for the tree
    await sleep(600);
    await frameFlow(page, { targetScale: 0.5 });
    await still(page, "playbooks-tree.png", "Playbook editor: the default incident flow, from reading the messages through the safety check to send, ask a person or stop.");
    await page.getByRole("button", { name: "Show menu" }).click().catch(() => {}); // the collapse is remembered per browser
  });

  await shot("playbooks-practice", async () => {
    await goto(page, "/?tab=workflows");
    await page.getByRole("button", { name: "Practice", exact: true }).first().click();
    await sleep(2500);
    const panel = page.locator("aside").last();
    let text = await page.locator("body").innerText();
    // An existing practice run shows up as a point on the "Getting better?" chart.
    const hasRun = /Getting better\?[\s\S]*\d+%/.test(text);
    if (!hasRun) {
      if (SKIP_PAID) throw new Skip("no practice run exists and --skip-paid is set", "playbooks-practice.png");
      const two = page.getByRole("button", { name: /Practice on 2 cases/ });
      if (await two.count()) {
        log("  no practice run yet: starting one on 2 cases (paid)");
        await two.click();
        await page.waitForFunction(() => /\d+%/.test(document.body.innerText.split("Getting better?")[1] ?? ""), null, { timeout: 600_000, polling: 2000 });
      }
    }
    const adv = page.getByRole("button", { name: "Advanced" }).last();
    if (await adv.count()) {
      await adv.click().catch(() => {});
      await sleep(1200);
    }
    void panel;
    await page.getByRole("button", { name: "Tidy up" }).click().catch(() => {});
    await sleep(500);
    await frameFlow(page, { targetScale: 0.5 }).catch(() => {});
    await still(page, "playbooks-practice.png", "Practice: run the playbook against stored cases and watch the score per version (\"Getting better?\").");
  }, { timeoutMs: 720_000 });

  let sentRunTitle = null;
  await shot("case-run-detail", async () => {
    await goto(page, "/?tab=executions");
    const run = await pickRun(page, /^Sent$/);
    if (!run) throw new Error("no run with status Sent in the list");
    sentRunTitle = run.title;
    await run.loc.click();
    await sleep(2000);
    await still(page, "case-run-detail.png", `A case run the agent sent: the decision, the voice strip and each step it took ("${sentRunTitle}").`);
  });

  await shot("case-run-voice", async () => {
    await goto(page, "/?tab=executions");
    // Prefer the run whose voice strip has the most controls (voice note, call, approve by voice).
    const items = (await runItems(page, /^(Sent|Needs a person|Asked a question|Nothing to do|Stopped)$/)).map((r) => r.loc);
    const n = Math.min(items.length, 14);
    let best = { i: -1, score: -1 };
    for (let i = 0; i < n; i++) {
      await items[i].click();
      await sleep(900);
      const score = await page.evaluate(() => {
        const h = [...document.querySelectorAll("div,h2,h3,section")].find((e) => e.textContent?.trim() === "Voice");
        const sec = h?.parentElement;
        if (!sec) return 0;
        return [...sec.querySelectorAll("button")].filter((b) => /voice|call|approve/i.test(b.textContent ?? "")).length +
          (/Call |Approve by voice/i.test(sec.textContent ?? "") ? 2 : 0);
      });
      if (score > best.score) best = { i, score };
    }
    if (best.i < 0) throw new Error("no case runs listed");
    await items[best.i].click();
    await sleep(1500);
    const voice = page.getByText("Voice", { exact: true }).first();
    await voice.scrollIntoViewIfNeeded();
    await voice.evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.mouse.wheel(0, -120);
    await sleep(800);
    await still(page, "case-run-voice.png", "The voice strip on a case run: record a voice note as the driver, take the agent's call, or approve by voice.");
  });

  await shot("decisions", async () => {
    await goto(page, "/review");
    const waiting = await page.getByText(/^\s*0\s*$/).count();
    for (const tab of ["Waiting", "Decided", "All"]) {
      await page.getByRole("button", { name: tab, exact: true }).click().catch(() => {});
      await sleep(1200);
      const empty = await page.getByText("Nothing to decide").count();
      if (!empty) break;
    }
    void waiting;
    // open the first card in the list, if any
    const list = page.locator("button").filter({ hasText: /\w{12,}/ });
    if (await list.count()) {
      await list.first().click().catch(() => {});
      await sleep(1500);
    }
    await still(page, "decisions.png", "Decisions: cases the agent handed to a person, with what it proposes and why.");
  });

  await shot("results", async () => {
    await goto(page, "/?tab=evidence");
    // Bring the cases that were actually run (and checked) to the top.
    const right = page.getByRole("button", { name: /^Right\?/ });
    for (let i = 0; i < 2; i++) {
      const top = await page.locator("tbody tr, [role=row]").nth(1).innerText().catch(() => "");
      if (top && !/Not run yet/.test(top)) break;
      await right.click().catch(() => {});
      await sleep(900);
    }
    await still(page, "results.png", "Results: every stored case, what the agent did and whether it was right.");
  });

  await shot("city-control", async () => {
    await goto(page, "/?tab=city");
    await page.waitForFunction(() => {
      const f = document.querySelector("iframe");
      try {
        return !!f?.contentWindow?.__city;
      } catch {
        return false;
      }
    }, null, { timeout: 150_000, polling: 1000 });
    await sleep(8000);
    await still(page, "city-control.png", "City tab: control the live 3D city (weather, time, incidents) next to what is happening and the cases it raised.");
  }, { timeoutMs: 240_000 });

  await ctx.close();

  // ---------------- AI builder: still + clip from one paid call ----------------
  await shot("playbooks-ai-builder", async () => {
    if (SKIP_PAID) throw new Skip("--skip-paid", "playbooks-ai-builder.png");
    const vctx = await newContext(browser, { dsf: 2, video: true });
    const p = await vctx.newPage();
    const t0 = Date.now();
    const at = () => (Date.now() - t0) / 1000;
    let ok = false;
    const marks = {};
    try {
      await goto(p, "/?tab=workflows");
      await p.getByRole("button", { name: "New playbook" }).first().click();
      await sleep(1200);
      marks.type = at();
      const box = p.getByPlaceholder("Describe your delivery business");
      await box.click();
      await box.pressSequentially("Frozen food, cold-chain vans", { delay: 55 });
      await sleep(500);
      marks.click = at();
      await p.getByRole("button", { name: "Make it" }).click();
      await p.getByText(/steps, ready to check|That didn.t work/).first().waitFor({ timeout: 100_000 });
      marks.result = at();
      if (await p.getByText(/That didn.t work/).count()) throw new Error("the builder answered without a playbook");
      await p.getByRole("button", { name: "Use this playbook" }).and(p.locator(":enabled")).waitFor({ timeout: 60_000 }).catch(() => {});
      marks.revealed = at();
      await sleep(1500);
      await p.getByRole("button", { name: "Fit View" }).click().catch(() => {});
      await sleep(1500);
      marks.end = at();
      await still(p, "playbooks-ai-builder.png", "AI playbook builder: \"Frozen food, cold-chain vans\" turned into a checked playbook tree in one call.");
      ok = true;
    } finally {
      const raw = await finishRecording(vctx, p, "playbook-build");
      if (ok && want("clip:playbook-build")) {
        try {
          const a = [Math.max(0, marks.type - 0.8), marks.click + 2.2];
          const revealLen = Math.min(Math.max(marks.revealed - marks.result, 2), 9);
          const bStart = marks.result - 0.8;
          const b = [bStart, Math.min(marks.result + revealLen + 2, bStart + (14.8 - (a[1] - a[0])))]; // total <= 15 s
          cutClip(raw, "clips/playbook-build.webm", [a, b],
            "The AI builder: type a business, press Make it, and watch the playbook tree being placed (the model wait is cut).");
        } catch (e) {
          fail("clips/playbook-build.webm", e.message);
        }
      }
      log(`  builder marks: ${JSON.stringify(marks)}`);
    }
  }, { retries: 0, timeoutMs: 300_000, gate: ["playbooks-ai-builder", "clip:playbook-build"] });

  // ---------------- case-run clip ----------------
  await shot("clip:case-run", async () => {
    const vctx = await newContext(browser, { dsf: 1, video: true });
    const p = await vctx.newPage();
    const t0 = Date.now();
    const at = () => (Date.now() - t0) / 1000;
    let start = 0, end = 0;
    try {
      await goto(p, "/?tab=executions");
      const run = await pickRun(p, /^Sent$/);
      if (!run) throw new Error("no Sent run");
      start = at();
      await sleep(800);
      await run.loc.click();
      await sleep(1800);
      // Open the folded details so there is something to scroll through.
      await p.getByRole("button", { name: "▸ Details" }).first().click().catch(() => {});
      await sleep(900);
      await p.mouse.move(1200, 640);
      // Ease the detail pane (the scrollable column right of the list) down over ~9 s.
      await p.evaluate(async () => {
        const pane = [...document.querySelectorAll("div")]
          .filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 40)
          .sort((x, y) => y.getBoundingClientRect().width - x.getBoundingClientRect().width)[0];
        if (!pane) return;
        const dist = Math.min(pane.scrollHeight - pane.clientHeight, 1500);
        const t0 = performance.now(), dur = 9000;
        await new Promise((done) => {
          const step = (now) => {
            const k = Math.min(1, (now - t0) / dur);
            pane.scrollTop = dist * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
            if (k < 1) requestAnimationFrame(step);
            else done();
          };
          requestAnimationFrame(step);
        });
      });
      await sleep(1200);
      end = at();
    } finally {
      const raw = await finishRecording(vctx, p, "case-run");
      if (end) cutClip(raw, "clips/case-run.webm", [[start, Math.min(end, start + 15)]], "Opening a case run the agent sent and scrolling through its decision, voice strip and steps.");
    }
  }, { retries: 1 });

  // ---------------- city stills ----------------
  const cityStills = ["city-aerial", "city-port", "city-night", "city-crash", "city-motorcade"];
  if (cityStills.some(want)) {
    await shot("city-stills", async () => {
      const cctx = await newContext(browser, { dsf: 2 });
      const p = await cctx.newPage();
      try {
        await openCity(p);
        await sleep(6000); // let the intro flight settle
        const t = await telemetry(p);
        const dayHour = t && t.timeOfDay > 7 && t.timeOfDay < 18 ? t.timeOfDay : 13;
        if (!t || !(t.timeOfDay > 7 && t.timeOfDay < 18)) {
          await cmd(p, { type: "time", hour: 13 });
          await sleep(2500);
        }

        await shot("city-aerial", async () => {
          await still(p, "city-aerial.png", "The 3D city from above: downtown, the river, docks and delivery traffic, all simulated live.");
        });

        await shot("city-port", async () => {
          await p.evaluate(() => {
            try {
              window.__cityShips?.forceArrival("terminal");
            } catch {}
          });
          await p.keyboard.press("2");
          await sleep(12_000);
          await still(p, "city-port.png", "The container port: ships berthing at the terminal with cranes, tugs and trucks.");
        });

        await shot("city-night", async () => {
          await p.keyboard.press("1");
          await sleep(2500);
          await cmd(p, { type: "time", hour: 22.5 });
          await sleep(6000);
          await still(p, "city-night.png", "The city at night: street lights, lit windows and traffic, set from the console's time control.");
        });

        await shot("city-crash", async () => {
          await cmd(p, { type: "time", hour: dayHour });
          await sleep(2500);
          const inc = await injectVisibleTruckCrash(p);
          if (!inc) throw new Error("no crash incident appeared in telemetry");
          await cmd(p, { type: "focus", x: inc.x, z: inc.z });
          await sleep(6000);
          await cmd(p, { type: "focus", x: inc.x, z: inc.z }); // again, in case auto camera moved
          await sleep(4500);
          await still(p, "city-crash.png", "A truck crash injected from the console: the road closes and responders arrive while the agent works the affected deliveries.");
        });

        await shot("city-motorcade", async () => {
          // There is no channel command for city events; the Events module (when mounted) starts a headline
          // motorcade ~45 s after load. Look for one in telemetry for a while.
          const end = Date.now() + 60_000;
          let count = 0;
          while (Date.now() < end) {
            count = (await telemetry(p))?.vehicles?.motorcade ?? 0;
            if (count) break;
            await sleep(1000);
          }
          if (!count) throw new Skip("no motorcade in the city (no BroadcastChannel command for events, and none spawned within 60 s)", "city-motorcade.png");
          const pos = await p.evaluate(() => {
            let found = null;
            window.__city?.scene?.traverse((o) => {
              if (!found && /motorcade|limousine/i.test(`${o.name} ${o.userData?.kind ?? ""}`)) {
                const v = o.getWorldPosition(o.position.clone());
                found = { x: v.x, z: v.z };
              }
            });
            return found;
          });
          if (!pos) throw new Skip(`motorcade present (${count} vehicles) but could not be located in the scene to frame it`, "city-motorcade.png");
          await cmd(p, { type: "focus", x: pos.x, z: pos.z });
          await sleep(4000);
          await still(p, "city-motorcade.png", "A motorcade crossing the city under a rolling road closure.");
        }, { retries: 0, timeoutMs: 90_000 });
      } finally {
        await cctx.close();
      }
    }, { retries: 0, timeoutMs: 600_000, gate: cityStills });
  }

  // ---------------- city clips (one recorded session, two cuts) ----------------
  if (want("clip:city-flyover") || want("clip:city-crash")) {
    await shot("city-clips", async () => {
      const vctx = await newContext(browser, { dsf: 1, video: true });
      const p = await vctx.newPage();
      const t0 = Date.now();
      const at = () => (Date.now() - t0) / 1000;
      const marks = {};
      try {
        await openCity(p);
        await sleep(6000);
        const t = await telemetry(p);
        if (!t || !(t.timeOfDay > 7 && t.timeOfDay < 18)) {
          await cmd(p, { type: "time", hour: 13 });
          await sleep(2000);
        }
        if (want("clip:city-flyover")) {
          await p.keyboard.press("c");
          marks.tour = at();
          await sleep(16_000);
          await p.keyboard.press("Escape");
          await sleep(1500);
        }
        if (want("clip:city-crash")) {
          await p.keyboard.press("1");
          await sleep(2500);
          const inc = await injectVisibleTruckCrash(p);
          if (inc) {
            await cmd(p, { type: "focus", x: inc.x, z: inc.z });
            marks.crash = at();
            await sleep(16_000);
          } else marks.crashMissing = true;
        }
      } finally {
        const raw = await finishRecording(vctx, p, "city");
        log(`  city marks: ${JSON.stringify(marks)}`);
        if (marks.tour != null && want("clip:city-flyover")) {
          try {
            cutClip(raw, "clips/city-flyover.webm", [[marks.tour + 0.5, marks.tour + 14.5]], "Cinematic camera tour of the 3D city (the \"c\" key).");
          } catch (e) {
            fail("clips/city-flyover.webm", e.message);
          }
        }
        if (want("clip:city-crash")) {
          if (marks.crash != null) {
            try {
              cutClip(raw, "clips/city-crash.webm", [[marks.crash + 0.3, marks.crash + 14.3]], "A truck crash injected from the console: the camera flies in, the road closes and responders arrive.");
            } catch (e) {
              fail("clips/city-crash.webm", e.message);
            }
          } else fail("clips/city-crash.webm", "no crash incident appeared");
        }
      }
    }, { retries: 0, timeoutMs: 400_000, gate: ["clip:city-flyover", "clip:city-crash"] });
  }
} finally {
  writeManifest(browserInfo);
  await browser.close().catch(() => {});
  try {
    rmSync(RAW, { recursive: true, force: true });
  } catch {}
}

log("done");
for (const f of [...entries.values()].sort((a, b) => a.file.localeCompare(b.file))) log(`  ${f.file.padEnd(32)} ${(f.bytes / 1024).toFixed(0).padStart(6)} KB`);
for (const f of failures.values()) log(`  FAILED ${f.file}: ${f.reason}`);
