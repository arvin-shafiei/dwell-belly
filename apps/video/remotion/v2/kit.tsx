// Motion primitives for the v2 film. Everything animates with spring().
import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT, MONO } from "../theme";

export const K = {
  bg: "#19191d",
  panel: "#222228",
  panel2: "#2a2a31",
  line: "rgba(255,255,255,0.10)",
  line2: "rgba(255,255,255,0.18)",
  text: "#f4f2ee",
  muted: "#9d9aa3",
  orange: "#ff6a1a",
  green: "#3ecf8e",
  amber: "#f5b740",
  red: "#ff5a4f",
  blue: "#6aa8ff",
};

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 -> 1 spring starting at `at`. */
export const useSpring = (at = 0, opts: { damping?: number; mass?: number; stiffness?: number; dur?: number } = {}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame: frame - at,
    fps,
    config: { damping: opts.damping ?? 18, mass: opts.mass ?? 0.7, stiffness: opts.stiffness ?? 120 },
    durationInFrames: opts.dur,
  });
};

export const sp = (frame: number, fps: number, at: number, damping = 18, mass = 0.7) =>
  spring({ frame: frame - at, fps, config: { damping, mass, stiffness: 120 } });

/** Linear 0..1 over [a, b], eased. */
export const ramp = (frame: number, a: number, b: number, ease = Easing.out(Easing.cubic)) => interpolate(frame, [a, b], [0, 1], { ...clamp, easing: ease });

/** Fade/lift wrapper driven by a 0..1 value. */
export const Pop: React.FC<{ v: number; dy?: number; dx?: number; scale?: boolean; style?: React.CSSProperties; children: React.ReactNode }> = ({ v, dy = 24, dx = 0, scale, style, children }) => (
  <div style={{ opacity: Math.min(1, Math.max(0, v)), transform: `translate(${(1 - v) * dx}px, ${(1 - v) * dy}px) ${scale ? `scale(${0.9 + 0.1 * v})` : ""}`, ...style }}>{children}</div>
);

/**
 * Kinetic headline: words spring up one after another. Words wrapped in
 * *stars* are set in orange.
 */
export const Kinetic: React.FC<{ text: string; at?: number; size?: number; weight?: number; stagger?: number; color?: string; style?: React.CSSProperties; out?: number }> = ({
  text,
  at = 0,
  size = 64,
  weight = 650,
  stagger = 2.2,
  color = K.text,
  style,
  out,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  const o = out === undefined ? 1 : interpolate(frame, [out, out + 10], [1, 0], clamp);
  return (
    <div style={{ fontFamily: FONT, fontSize: size, fontWeight: weight, letterSpacing: -size * 0.02, lineHeight: 1.12, color, display: "flex", flexWrap: "wrap", columnGap: size * 0.26, opacity: o, ...style }}>
      {words.map((w, i) => {
        // *a few words* are set in orange; the stars may span several words
        const starsBefore = words.slice(0, i).join(" ").split("*").length - 1;
        const hot = w.startsWith("*") || starsBefore % 2 === 1;
        const clean = w.replace(/\*/g, "");
        const v = spring({ frame: frame - at - i * stagger, fps, config: { damping: 16, mass: 0.6, stiffness: 140 } });
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: size * 0.08 }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - v) * 105}%)`, opacity: Math.min(1, v * 1.4), color: hot ? K.orange : undefined }}>{clean}</span>
          </span>
        );
      })}
    </div>
  );
};

/** Small monospaced label. */
export const Label: React.FC<{ children: React.ReactNode; color?: string; size?: number; style?: React.CSSProperties }> = ({ children, color = K.orange, size = 20, style }) => (
  <div style={{ fontFamily: MONO, fontSize: size, letterSpacing: size * 0.1, textTransform: "uppercase", color, ...style }}>{children}</div>
);

/** Scene header: kicker plus kinetic line, top-left. */
export const Header: React.FC<{ kicker: string; line: string; at?: number; out?: number; size?: number }> = ({ kicker, line, at = 0, out, size = 58 }) => {
  const frame = useCurrentFrame();
  const v = ramp(frame, at, at + 12);
  const o = out === undefined ? 1 : interpolate(frame, [out, out + 10], [1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: 120, top: 84, right: 120, opacity: o }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, opacity: v }}>
        <div style={{ width: 12, height: 12, background: K.orange, transform: `scale(${v})` }} />
        <Label>{kicker}</Label>
      </div>
      <Kinetic text={line} at={at + 4} size={size} style={{ marginTop: 18, maxWidth: 1500 }} />
    </div>
  );
};

/** Text that types itself out between frames a and b. */
export const Typed: React.FC<{ text: string; a: number; b: number; style?: React.CSSProperties; caret?: boolean }> = ({ text, a, b, style, caret = true }) => {
  const frame = useCurrentFrame();
  const n = Math.round(interpolate(frame, [a, b], [0, text.length], clamp));
  const typing = frame >= a && frame < b;
  return (
    <span style={style}>
      {text.slice(0, n)}
      {caret && typing ? <span style={{ color: K.orange }}>▍</span> : null}
    </span>
  );
};

/** Number that counts up. */
export const CountUp: React.FC<{ to: number; at: number; dur?: number; decimals?: number; prefix?: string; suffix?: string; style?: React.CSSProperties }> = ({ to, at, dur = 36, decimals = 0, prefix = "", suffix = "", style }) => {
  const frame = useCurrentFrame();
  const v = interpolate(frame, [at, at + dur], [0, to], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <span style={style}>
      {prefix}
      {v.toFixed(decimals)}
      {suffix}
    </span>
  );
};

/** Browser-window frame for console footage. */
export const Device: React.FC<{ width: number; url?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ width, url = "localhost:3000", children, style }) => {
  const height = (width * 9) / 16;
  return (
    <div
      style={{
        width,
        borderRadius: 18,
        overflow: "hidden",
        background: "#0f0f12",
        border: `1.5px solid ${K.line2}`,
        boxShadow: "0 40px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.4)",
        ...style,
      }}
    >
      <div style={{ height: 44, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", background: "#141418", borderBottom: `1px solid ${K.line}` }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c, opacity: 0.85 }} />
        ))}
        <div style={{ marginLeft: 18, flex: 1, maxWidth: 520, height: 26, borderRadius: 7, background: "#1f1f25", color: K.muted, fontFamily: MONO, fontSize: 14, display: "flex", alignItems: "center", padding: "0 12px" }}>{url}</div>
      </div>
      <div style={{ position: "relative", width, height, overflow: "hidden" }}>{children}</div>
    </div>
  );
};

/** Full-screen dark background with a faint dot grid. */
export const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ backgroundColor: K.bg, fontFamily: FONT, color: K.text }}>
    <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
    {children}
  </AbsoluteFill>
);

/** Tag at the top right for simulated footage. */
export const SimBadge: React.FC<{ text?: string }> = ({ text = "Simulated city · visualisation of agent traces · not the agent" }) => (
  <div style={{ position: "absolute", top: 80, right: 60, fontFamily: MONO, fontSize: 19, letterSpacing: 1.6, textTransform: "uppercase", color: K.text, background: "rgba(25,25,29,0.82)", border: `1.5px solid ${K.orange}`, padding: "8px 14px" }}>{text}</div>
);
