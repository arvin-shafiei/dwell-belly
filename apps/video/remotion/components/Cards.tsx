import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "../theme";
import { useUnit } from "./Overlays";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const rise = (frame: number, at: number) => interpolate(frame - at, [0, 9], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

// From docs: README "How it works" and the team framework map (14:10).
const STEPS: { name: string; note: string }[] = [
  { name: "Load", note: "any case folder" },
  { name: "Understand", note: "records vs claims" },
  { name: "3 checks at once", note: "kind · 5 second opinions · do the stories match?" },
  { name: "Plan the reply", note: "act, ask, hand over, wait" },
  { name: "Safety check", note: "every message" },
];
const BANDS: { risk: string; label: string; what: string; color: string }[] = [
  { risk: "risk < 0.3", label: "Clear", what: "send", color: "#3ecf8e" },
  { risk: "0.3 – 0.8", label: "Unsure", what: "a person decides", color: "#f5b740" },
  { risk: "≥ 0.8", label: "Unsafe", what: "stop", color: "#ff5a4f" },
];

/** The agent's flow for one case, drawn as type, with the safety bands. */
export const FlowCard: React.FC = () => {
  const frame = useCurrentFrame();
  const u = useUnit();
  return (
    <AbsoluteFill style={{ backgroundColor: C.ink, padding: `${110 * u}px ${130 * u}px`, fontFamily: FONT, color: C.text, justifyContent: "center" }}>
      <div style={{ fontFamily: MONO, fontSize: 22 * u, letterSpacing: 2 * u, textTransform: "uppercase", color: C.orange, opacity: rise(frame, 0) }}>
        One case through the flow
      </div>
      <div style={{ display: "flex", gap: 18 * u, marginTop: 40 * u, alignItems: "stretch" }}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s.name}>
            <div
              style={{
                flex: i === 2 ? 1.5 : 1,
                border: `${1.5 * u}px solid ${i === 4 ? C.orange : C.line}`,
                background: C.ink2,
                padding: `${24 * u}px ${24 * u}px`,
                opacity: rise(frame, 4 + i * 5),
                transform: `translateY(${(1 - rise(frame, 4 + i * 5)) * 14 * u}px)`,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 34 * u, letterSpacing: -0.4 * u }}>{s.name}</div>
              <div style={{ fontSize: 23 * u, color: C.muted, marginTop: 10 * u, lineHeight: 1.3 }}>{s.note}</div>
            </div>
            {i < STEPS.length - 1 ? (
              <div style={{ alignSelf: "center", color: C.muted, fontSize: 30 * u, opacity: rise(frame, 6 + i * 5) }}>→</div>
            ) : null}
          </React.Fragment>
        ))}
      </div>
      <div style={{ display: "flex", gap: 24 * u, marginTop: 56 * u, marginLeft: "auto", width: "62%" }}>
        {BANDS.map((b, i) => (
          <div key={b.label} style={{ flex: 1, borderTop: `${5 * u}px solid ${b.color}`, background: C.ink2, padding: `${20 * u}px ${24 * u}px`, opacity: rise(frame, 32 + i * 5) }}>
            <div style={{ fontFamily: MONO, fontSize: 21 * u, color: C.muted }}>{b.risk}</div>
            <div style={{ fontWeight: 600, fontSize: 36 * u, marginTop: 6 * u }}>{b.label}</div>
            <div style={{ fontSize: 25 * u, color: C.muted, marginTop: 4 * u }}>{b.what}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 24 * u, color: C.muted, marginTop: 40 * u, opacity: rise(frame, 46) }}>Thresholds live in the flow file, not in prompts.</div>
    </AbsoluteFill>
  );
};

// Latest eval run (team framework map, 14:10; eval/results.md). Our eval, our answer keys.
const STATS: { big: string; small: string }[] = [
  { big: "0.92", small: "score on 48 test cases" },
  { big: "46 / 48", small: "cases passed" },
  { big: "0", small: "rules broken" },
  { big: "165 s", small: "for 50 cases, all answered" },
  { big: "5¢", small: "per case" },
];

/** The evidence: numbers from the latest real eval run. */
export const EvidenceCard: React.FC = () => {
  const frame = useCurrentFrame();
  const u = useUnit();
  return (
    <AbsoluteFill style={{ backgroundColor: C.ink, padding: `${130 * u}px ${130 * u}px`, fontFamily: FONT, color: C.text, justifyContent: "center" }}>
      <div style={{ fontFamily: MONO, fontSize: 22 * u, letterSpacing: 2 * u, textTransform: "uppercase", color: C.orange, opacity: rise(frame, 0) }}>
        Latest eval run
      </div>
      <div style={{ display: "flex", gap: 22 * u, marginTop: 36 * u }}>
        {STATS.map((s, i) => (
          <div key={s.small} style={{ flex: 1, borderTop: `${2 * u}px solid ${i === 2 ? C.orange : C.line}`, paddingTop: 24 * u, opacity: rise(frame, 4 + i * 4), transform: `translateY(${(1 - rise(frame, 4 + i * 4)) * 14 * u}px)` }}>
            <div style={{ fontWeight: 700, fontSize: 92 * u, letterSpacing: -2.5 * u, lineHeight: 1 }}>{s.big}</div>
            <div style={{ fontSize: 27 * u, color: C.muted, marginTop: 14 * u, lineHeight: 1.25 }}>{s.small}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 23 * u, color: C.muted, marginTop: 56 * u, opacity: rise(frame, 26) }}>
        One run, scored against our own answer keys, not the judges'. A case or two either way is noise.
      </div>
    </AbsoluteFill>
  );
};
