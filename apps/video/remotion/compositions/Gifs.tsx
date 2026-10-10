import React from "react";
import { AbsoluteFill, Freeze, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption, Scrim, SimTag, Wordmark } from "../components/Overlays";
import { layout, Reel, type Shot } from "../components/Reel";
import { ClipShot, StillShot } from "../components/Shots";
import { cam } from "../copy";
import { hasClip, hasStill, pickStill } from "../media";
import { C, FONT } from "../theme";

export const GIF_FPS = 15;

type Cap = { kicker?: string; text: string };

/** A still that zooms in and back out, so the loop point is invisible. */
const PingPong: React.FC<{ name: string; d: number; camKey?: string }> = ({ name, d, camKey }) => {
  const c = cam(camKey ?? name);
  const half = Math.floor(d / 2);
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={half}>
        <StillShot name={name} durationInFrames={half} from={c.from} to={c.to} />
      </Sequence>
      <Sequence from={half}>
        <StillShot name={name} durationInFrames={d - half} from={c.to} to={c.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

const Layer: React.FC<{ d: number; cap?: Cap; sim?: boolean; children: React.ReactNode; fixed?: boolean }> = ({ d, cap, sim, children, fixed }) => (
  <AbsoluteFill>
    {children}
    <Scrim strength={0.35} />
    {sim ? <SimTag /> : null}
    {cap ? <Caption durationInFrames={d} fixed={fixed} {...cap} /> : null}
  </AbsoluteFill>
);

const Missing: React.FC<{ text: string }> = ({ text }) => (
  <AbsoluteFill style={{ backgroundColor: C.ink, alignItems: "center", justifyContent: "center", color: C.text, fontFamily: FONT, fontSize: 48 }}>{text}</AbsoluteFill>
);

/** Shot for the README montage: a clip if there is one, else a still. */
function montageShot(opts: { clip?: string; stills: string[]; cap?: Cap; sim?: boolean; camKey?: string }): Shot | null {
  const st = pickStill(...opts.stills);
  const useClip = opts.clip && hasClip(opts.clip);
  if (!useClip && !st) return null;
  return {
    weight: 1,
    render: (d) => (
      <Layer d={d} cap={opts.cap} sim={opts.sim}>
        {useClip ? <ClipShot name={opts.clip!} durationInFrames={d} fallbackStill={st} maxRate={3} /> : <StillShot name={st!} durationInFrames={d} {...cam(st === opts.stills[0] && opts.camKey ? opts.camKey : st!)} />}
      </Layer>
    ),
  };
}

/** README hero: about 8 s, four beats, loops back to the first frame. */
export const HeroGif: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  const shots = [
    montageShot({ clip: "city-flyover", stills: ["city-aerial", "city-night"], cap: { kicker: "Rivet", text: "The delivery desk that knows when to stop." }, sim: true }),
    montageShot({ stills: ["case-run-detail", "console-home"], camKey: "case-sent", cap: { kicker: "Case run", text: "Reads the case, takes one well-aimed step." } }),
    montageShot({ stills: ["playbooks-tree", "playbooks-ai-builder"], cap: { kicker: "Playbooks", text: "The AI builds the decision tree." } }),
    montageShot({ stills: ["case-run-voice", "decisions"], camKey: "voice-card", cap: { kicker: "Decisions", text: "When unsure, a person decides." } }),
  ].filter((x): x is Shot => x !== null);
  if (!shots.length) return <Missing text="Rivet" />;
  const xf = 6;
  const placed = layout(shots, durationInFrames - xf);
  return (
    <AbsoluteFill style={{ backgroundColor: C.ink }}>
      <Reel placed={placed} total={durationInFrames} xf={xf} />
      {/* fade back into the first frame so the GIF loops cleanly */}
      <Sequence from={durationInFrames - xf} durationInFrames={xf}>
        <FadeIn d={xf}>
          <Freeze frame={0}>{shots[0].render(placed[0].durationInFrames + xf)}</Freeze>
        </FadeIn>
      </Sequence>
    </AbsoluteFill>
  );
};

const FadeIn: React.FC<{ d: number; children: React.ReactNode }> = ({ d, children }) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: interpolate(f, [0, d], [0, 1], { extrapolateRight: "clamp" }) }}>{children}</AbsoluteFill>;
};

export type FeatureName = "voice" | "playbook" | "city" | "decisions";

/** Short loop for one feature. */
export const FeatureGif: React.FC<{ feature: FeatureName }> = ({ feature }) => {
  const { durationInFrames: d } = useVideoConfig();
  const body = (() => {
    switch (feature) {
      case "voice": {
        const st = pickStill("case-run-voice", "decisions");
        if (!st) return null;
        return (
          <Layer fixed d={d} cap={{ kicker: "Voice", text: "Approve by voice." }}>
            <PingPong name={st} d={d} camKey={st === "case-run-voice" ? "voice-approve" : undefined} />
          </Layer>
        );
      }
      case "decisions": {
        const st = pickStill("case-run-voice", "decisions");
        if (!st) return null;
        return (
          <Layer fixed d={d} cap={{ kicker: "A person decides", text: "When it is unsure, it stops and asks." }}>
            <PingPong name={st} d={d} camKey={st === "case-run-voice" ? "voice-card" : undefined} />
          </Layer>
        );
      }
      case "playbook": {
        if (hasClip("playbook-build")) {
          return (
            <Layer fixed d={d} cap={{ kicker: "Playbooks", text: "The AI builds the decision tree." }}>
              <ClipShot name="playbook-build" durationInFrames={d} fallbackStill={pickStill("playbooks-tree", "playbooks-ai-builder")} maxRate={4} />
            </Layer>
          );
        }
        const a = pickStill("playbooks-ai-builder", "playbooks-tree");
        const b = pickStill("playbooks-tree", "playbooks-practice");
        if (!a) return null;
        const half = Math.floor(d / 2);
        return (
          <Layer fixed d={d} cap={{ kicker: "Playbooks", text: "The AI builds the decision tree." }}>
            <Sequence durationInFrames={half}>
              <StillShot name={a} durationInFrames={half} {...cam(a)} />
            </Sequence>
            <Sequence from={half}>
              <StillShot name={b ?? a} durationInFrames={d - half} {...cam(b ?? a)} />
            </Sequence>
          </Layer>
        );
      }
      case "city": {
        if (hasClip("city-flyover")) {
          return (
            <Layer fixed d={d} sim cap={{ kicker: "Live city", text: "A 3D city whose incidents become cases." }}>
              <ClipShot name="city-flyover" durationInFrames={d} fallbackStill={pickStill("city-aerial")} maxRate={2} />
            </Layer>
          );
        }
        const names = ["city-aerial", "city-port", "city-night", "city-motorcade"].filter(hasStill);
        if (!names.length) return null;
        const placed = layout(names.map((n) => ({ weight: 1, render: (dd: number) => <StillShot name={n} durationInFrames={dd} {...cam(n)} /> })), d);
        return (
          <Layer fixed d={d} sim cap={{ kicker: "Live city", text: "A 3D city whose incidents become cases." }}>
            <Reel placed={placed} total={d} xf={5} />
          </Layer>
        );
      }
    }
  })();
  return (
    <AbsoluteFill style={{ backgroundColor: C.ink }}>
      {body ?? <Missing text={feature} />}
      <Wordmark />
    </AbsoluteFill>
  );
};
