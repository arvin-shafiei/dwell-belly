import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clip, still } from "../media";
import { C } from "../theme";

/** A camera move: zoom `scale` centred on the point (x, y), each 0..1 of the image. */
export type Cam = { x: number; y: number; scale: number };

const ease = Easing.bezier(0.42, 0, 0.58, 1);

function camAt(from: Cam, to: Cam, progress: number): Cam {
  const p = ease(Math.min(1, Math.max(0, progress)));
  return {
    x: from.x + (to.x - from.x) * p,
    y: from.y + (to.y - from.y) * p,
    scale: from.scale + (to.scale - from.scale) * p,
  };
}

/**
 * Moves the camera over a full-frame layer. The focal point is pulled toward
 * the centre of the frame as far as the zoom allows, so edges never show.
 */
const CamLayer: React.FC<{ from: Cam; to: Cam; durationInFrames: number; children: React.ReactNode }> = ({ from, to, durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const c = camAt(from, to, frame / Math.max(1, durationInFrames - 1));
  const s = Math.max(1, c.scale);
  // translate so the focal point moves toward the centre, clamped to the image edges
  const maxX = ((s - 1) * width) / 2;
  const maxY = ((s - 1) * height) / 2;
  const tx = Math.max(-maxX, Math.min(maxX, (0.5 - c.x) * width * s));
  const ty = Math.max(-maxY, Math.min(maxY, (0.5 - c.y) * height * s));
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: C.ink }}>
      <AbsoluteFill style={{ transform: `translate(${tx}px, ${ty}px) scale(${s})`, transformOrigin: "50% 50%", willChange: "transform" }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Ken Burns pan and zoom over a still from docs/media. */
export const StillShot: React.FC<{ name: string; from?: Cam; to?: Cam; durationInFrames: number; fit?: "cover" | "contain" }> = ({
  name,
  from = { x: 0.5, y: 0.5, scale: 1.02 },
  to = { x: 0.5, y: 0.5, scale: 1.1 },
  durationInFrames,
  fit = "cover",
}) => {
  const s = still(name);
  if (!s) return null;
  return (
    <CamLayer from={from} to={to} durationInFrames={durationInFrames}>
      <Img src={staticFile(s.file)} style={{ width: "100%", height: "100%", objectFit: fit, objectPosition: "50% 0%" }} />
    </CamLayer>
  );
};

/**
 * Plays a clip from docs/media/clips across `durationInFrames`. Long clips are
 * sped up (at most `maxRate`) and then trimmed; short clips play once and the
 * fallback still (if any) holds underneath for the rest.
 */
export const ClipShot: React.FC<{
  name: string;
  durationInFrames: number;
  fallbackStill?: string;
  skipSeconds?: number;
  maxRate?: number;
  from?: Cam;
  to?: Cam;
}> = ({ name, durationInFrames, fallbackStill, skipSeconds = 0, maxRate = 2, from = { x: 0.5, y: 0.5, scale: 1 }, to = { x: 0.5, y: 0.5, scale: 1.05 } }) => {
  const { fps } = useVideoConfig();
  const c = clip(name);
  if (!c) return fallbackStill ? <StillShot name={fallbackStill} durationInFrames={durationInFrames} /> : null;
  const usable = Math.max(0.5, c.duration - skipSeconds - 0.15);
  const want = durationInFrames / fps;
  const rate = Math.min(maxRate, Math.max(1, usable / want));
  const playFrames = Math.min(durationInFrames, Math.floor((usable / rate) * fps));
  return (
    <AbsoluteFill>
      {fallbackStill ? <StillShot name={fallbackStill} durationInFrames={durationInFrames} from={to} to={to} /> : null}
      <Sequence durationInFrames={playFrames} layout="none">
        <CamLayer from={from} to={to} durationInFrames={durationInFrames}>
          <OffthreadVideo
            src={staticFile(c.file)}
            muted
            playbackRate={rate}
            trimBefore={Math.round(skipSeconds * fps)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </CamLayer>
      </Sequence>
    </AbsoluteFill>
  );
};

/** Fades a layer in over `inFrames` and out over `outFrames`. */
export const Fade: React.FC<{ durationInFrames: number; inFrames?: number; outFrames?: number; children: React.ReactNode }> = ({
  durationInFrames,
  inFrames = 10,
  outFrames = 10,
  children,
}) => {
  const frame = useCurrentFrame();
  const a = inFrames > 0 ? interpolate(frame, [0, inFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const b = outFrames > 0 ? interpolate(frame, [durationInFrames - outFrames, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  return <AbsoluteFill style={{ opacity: Math.min(a, b) }}>{children}</AbsoluteFill>;
};
