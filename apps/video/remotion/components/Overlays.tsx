import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, MONO } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Scales overlay sizes to the composition (designed at 1920 wide). */
export const useUnit = () => {
  const { width } = useVideoConfig();
  return width / 1920;
};

/**
 * Lower-third caption: a small orange kicker over one plain sentence, on a
 * solid dark panel. Slides up and fades in, fades out at the end.
 */
export const Caption: React.FC<{ kicker?: string; text: string; durationInFrames: number; sub?: string; fixed?: boolean }> = ({ kicker, text, sub, durationInFrames, fixed }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const u = useUnit();
  // `fixed` captions do not animate (for loops, where a blink would show)
  // Enters a few frames late and leaves a little early, so captions never overlap in a crossfade.
  const enter = fixed ? 1 : spring({ frame: frame - 6, fps, config: { damping: 200, mass: 0.6 }, durationInFrames: 14 });
  const out = fixed ? 1 : interpolate(frame, [durationInFrames - 18, durationInFrames - 11], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-start", padding: `0 0 ${88 * u}px ${96 * u}px`, pointerEvents: "none" }}>
      <div
        style={{
          opacity: enter * out,
          transform: `translateY(${(1 - enter) * 24 * u}px)`,
          background: "rgba(17,17,19,0.92)",
          borderLeft: `${6 * u}px solid ${C.orange}`,
          padding: `${22 * u}px ${34 * u}px ${24 * u}px ${30 * u}px`,
          maxWidth: 1240 * u,
          boxShadow: `0 ${12 * u}px ${40 * u}px rgba(0,0,0,0.35)`,
        }}
      >
        {kicker ? (
          <div style={{ fontFamily: MONO, fontSize: 20 * u, letterSpacing: 2 * u, textTransform: "uppercase", color: C.orange, marginBottom: 10 * u }}>{kicker}</div>
        ) : null}
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 46 * u, lineHeight: 1.15, color: C.text, letterSpacing: -0.4 * u }}>{text}</div>
        {sub ? <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 28 * u, lineHeight: 1.3, color: C.muted, marginTop: 8 * u }}>{sub}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

/** Corner tag for footage that comes from the simulated city (PRD H1). */
export const SimTag: React.FC<{ label?: string }> = ({ label = "Simulated city · a visualisation, not the agent" }) => {
  const u = useUnit();
  return (
    <AbsoluteFill style={{ alignItems: "flex-end", justifyContent: "flex-start", padding: `${48 * u}px ${56 * u}px`, pointerEvents: "none" }}>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 20 * u,
          letterSpacing: 2 * u,
          textTransform: "uppercase",
          color: C.text,
          background: "rgba(17,17,19,0.78)",
          border: `${1.5 * u}px solid ${C.orange}`,
          padding: `${8 * u}px ${14 * u}px`,
        }}
      >
        {label}
      </div>
    </AbsoluteFill>
  );
};

/** Small "Hamyway City" wordmark, bottom right. */
export const Wordmark: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => {
  const u = useUnit();
  return (
    <AbsoluteFill style={{ alignItems: "flex-end", justifyContent: "flex-end", padding: `${52 * u}px ${64 * u}px`, pointerEvents: "none", opacity }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 * u, background: "rgba(17,17,19,0.7)", padding: `${8 * u}px ${14 * u}px` }}>
        <div style={{ width: 14 * u, height: 14 * u, background: C.orange }} />
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 26 * u, color: C.text, letterSpacing: -0.2 * u }}>Hamyway City</div>
      </div>
    </AbsoluteFill>
  );
};

/** Darkens the bottom of a shot so captions read on busy footage. */
export const Scrim: React.FC<{ strength?: number }> = ({ strength = 0.55 }) => (
  <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,${strength}) 100%)`, pointerEvents: "none" }} />
);

/** Lines of text that land one after another (used for the hook). */
export const StackedLines: React.FC<{ lines: string[]; every: number; size?: number; color?: string; accentLast?: boolean }> = ({
  lines,
  every,
  size = 84,
  color = C.text,
  accentLast = false,
}) => {
  const frame = useCurrentFrame();
  const u = useUnit();
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${150 * u}px` }}>
      {lines.map((l, i) => {
        const t = frame - i * every;
        const a = interpolate(t, [0, 8], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
        return (
          <div
            key={l}
            style={{
              fontFamily: FONT,
              fontWeight: 600,
              fontSize: size * u,
              lineHeight: 1.12,
              letterSpacing: -1.2 * u,
              color: accentLast && i === lines.length - 1 ? C.orange : color,
              opacity: a,
              transform: `translateY(${(1 - a) * 18 * u}px)`,
            }}
          >
            {l}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Title block: big name, one-line promise, optional small line. */
export const TitleBlock: React.FC<{ title: string; line: string; small?: string; align?: "left" | "center" }> = ({ title, line, small, align = "left" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const u = useUnit();
  const a = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 18 });
  const b = spring({ frame: frame - 6, fps, config: { damping: 200 }, durationInFrames: 18 });
  const c = spring({ frame: frame - 12, fps, config: { damping: 200 }, durationInFrames: 18 });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: align === "center" ? "center" : "flex-start", padding: `0 ${150 * u}px`, textAlign: align }}>
      <div style={{ display: "flex", alignItems: "center", gap: 22 * u, opacity: a, transform: `translateY(${(1 - a) * 20 * u}px)` }}>
        <div style={{ width: 34 * u, height: 34 * u, background: C.orange }} />
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 120 * u, color: C.text, letterSpacing: -3 * u, lineHeight: 1 }}>{title}</div>
      </div>
      <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 56 * u, color: C.text, marginTop: 26 * u, letterSpacing: -0.8 * u, opacity: b, transform: `translateY(${(1 - b) * 20 * u}px)`, maxWidth: 1500 * u }}>
        {line}
      </div>
      {small ? (
        <div style={{ fontFamily: MONO, fontSize: 28 * u, color: C.orange, marginTop: 30 * u, opacity: c, letterSpacing: 0.5 * u }}>{small}</div>
      ) : null}
    </AbsoluteFill>
  );
};
