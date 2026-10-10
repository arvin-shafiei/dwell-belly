// Scans docs/media and writes remotion/media.generated.json, which the
// compositions import to decide which shots exist. Missing media is skipped.
//
//   node remotion/scan-media.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const MEDIA_DIR = process.env.RIVET_MEDIA_DIR ? resolve(process.env.RIVET_MEDIA_DIR) : resolve(here, "../../../docs/media");
const OUT = join(here, "media.generated.json");

function probe(file) {
  const args = ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file];
  for (const bin of [["ffprobe"], ["npx", "remotion", "ffprobe"]]) {
    try {
      const out = execFileSync(bin[0], [...bin.slice(1), ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      const j = JSON.parse(out);
      const v = (j.streams || []).find((s) => s.codec_type === "video") || {};
      let duration = parseFloat(j.format?.duration ?? v.duration ?? "NaN");
      return { width: v.width ?? null, height: v.height ?? null, duration: Number.isFinite(duration) ? duration : null };
    } catch {
      // try the next binary
    }
  }
  return { width: null, height: null, duration: null };
}

export function scanMedia({ quiet = false } = {}) {
  const stills = {};
  const clips = {};
  let manifest = null;
  if (existsSync(MEDIA_DIR)) {
    for (const f of readdirSync(MEDIA_DIR)) {
      if (!/\.png$/i.test(f)) continue;
      const p = probe(join(MEDIA_DIR, f));
      stills[f.replace(/\.png$/i, "")] = { file: f, width: p.width, height: p.height };
    }
    // clips/*.webm -> "name"; clips/v2/*.mp4 -> "v2/name"
    for (const sub of ["", "v2"]) {
      const clipDir = join(MEDIA_DIR, "clips", sub);
      if (!existsSync(clipDir)) continue;
      for (const f of readdirSync(clipDir)) {
        if (!/\.(webm|mp4|mov)$/i.test(f)) continue;
        const full = join(clipDir, f);
        if (statSync(full).size < 10_000) continue; // still being written, or empty
        const p = probe(full);
        if (!p.duration || p.duration < 0.5) continue;
        const key = (sub ? `${sub}/` : "") + f.replace(/\.(webm|mp4|mov)$/i, "");
        clips[key] = { file: `clips/${sub ? `${sub}/` : ""}${f}`, ...p };
      }
    }
    const mf = join(MEDIA_DIR, "manifest.json");
    if (existsSync(mf)) {
      try {
        manifest = JSON.parse(readFileSync(mf, "utf8"));
      } catch {
        manifest = null;
      }
    }
  }
  const data = { scannedAt: new Date().toISOString(), stills, clips, manifest };
  writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n");
  if (!quiet) {
    console.log(`media: ${Object.keys(stills).length} stills, ${Object.keys(clips).length} clips, manifest ${manifest ? "found" : "missing"}`);
    console.log(`  stills: ${Object.keys(stills).join(", ") || "(none)"}`);
    console.log(`  clips:  ${Object.entries(clips).map(([k, v]) => `${k} (${v.duration.toFixed(1)}s)`).join(", ") || "(none)"}`);
  }
  return data;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  scanMedia();
}
