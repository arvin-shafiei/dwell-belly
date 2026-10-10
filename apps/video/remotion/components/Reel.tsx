import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Fade } from "./Shots";

export type Shot = {
  /** Relative length within its segment (weights are scaled to fit). */
  weight: number;
  render: (durationInFrames: number) => React.ReactNode;
};

export type Placed = { from: number; durationInFrames: number; render: Shot["render"] };

/** Splits `total` frames across shots by weight; integer frames, exact sum. */
export function layout(shots: Shot[], total: number, start = 0): Placed[] {
  const w = shots.reduce((s, x) => s + x.weight, 0) || 1;
  let acc = 0;
  return shots.map((s, i) => {
    const from = Math.round((acc / w) * total);
    acc += s.weight;
    const to = i === shots.length - 1 ? total : Math.round((acc / w) * total);
    return { from: start + from, durationInFrames: to - from, render: s.render };
  });
}

/**
 * Plays placed shots back to back. Each shot (but the first) fades in over
 * `xf` frames on top of the previous one, which is held `xf` frames longer.
 */
export const Reel: React.FC<{ placed: Placed[]; xf?: number; total: number; fadeFirst?: number; fadeLast?: number }> = ({ placed, xf = 12, total, fadeFirst = 0, fadeLast = 0 }) => (
  <AbsoluteFill>
    {placed.map((p, i) => {
      const last = i === placed.length - 1;
      const len = Math.min(total - p.from, p.durationInFrames + (last ? 0 : xf));
      return (
        <Sequence key={i} from={p.from} durationInFrames={len}>
          <Fade durationInFrames={len} inFrames={i === 0 ? fadeFirst : xf} outFrames={last ? fadeLast : 0}>
            {p.render(len)}
          </Fade>
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
