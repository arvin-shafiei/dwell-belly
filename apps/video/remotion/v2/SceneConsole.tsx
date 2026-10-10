import React from "react";
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ClipShot } from "../components/Shots";
import { hasClip, hasStill, still } from "../media";
import { MONO } from "../theme";
import { clamp, Device, Header, K, Kinetic, Label, ramp, sp, Stage, SimBadge } from "./kit";

/** One console shot: a v2 clip if it exists, else a v1 clip, else a still. */
export type ConsoleShot = { clips: string[]; still?: string; kicker: string; line: string; note?: string; dur?: number; skip?: number; rate?: number; zoom?: [number, number, number] };

// Captions describe what each recording shows (checked against docs/media/clips/v2).
export const CONSOLE_SHOTS: ConsoleShot[] = [
  { clips: ["v2/home"], still: "console-home", kicker: "Home", line: "What the desk is handling, right now.", note: "Cases handled, sent, waiting on a person, and cost.", dur: 100, rate: 2.5 },
  { clips: ["v2/watch-it-think", "case-run"], still: "case-run-detail", kicker: "Watch it think", line: "Each step appears as the agent works the case.", note: "Here it ends by messaging the security team at Plover Arc Logistics.", dur: 190, skip: 4, rate: 6, zoom: [0.58, 0.55, 1.3] },
  { clips: ["v2/new-case"], kicker: "New case", line: "Drop in a case and run it.", note: "Emails, portal messages, call transcripts, attachments." },
  { clips: ["v2/decisions"], still: "decisions", kicker: "Decisions", line: "Cases waiting for a person, with each option spelled out.", note: "Nothing on hold is sent until someone decides.", dur: 130, rate: 3 },
  { clips: ["v2/playbooks", "playbook-build"], still: "playbooks-ai-builder", kicker: "Playbooks", line: "The same flow as a graph you can edit. A case lights it up.", note: "The AI can also draft a new playbook from a plain description.", dur: 130, rate: 3 },
  { clips: ["v2/how-it-works"], kicker: "How it works", line: "The whole method, explained inside the console.", dur: 110, rate: 3 },
  { clips: ["v2/palette"], kicker: "Command palette", line: "Jump anywhere from the keyboard.", dur: 75 },
  { clips: ["v2/results"], still: "results", kicker: "Results", line: "Every stored case: what it did, and whether it was right.", dur: 110, rate: 3 },
];

const DEF_DUR = 105;

/** The shots that have footage, in order, with start frames. */
export const availableConsoleShots = () => {
  let at = 0;
  return CONSOLE_SHOTS.map((s) => ({ ...s, clip: s.clips.find(hasClip), useStill: s.still && hasStill(s.still) ? s.still : undefined }))
    .filter((s) => s.clip || s.useStill)
    .map((s) => {
      const d = s.dur ?? DEF_DUR;
      const r = { ...s, at, d };
      at += d;
      return r;
    });
};
export const consoleDuration = () => availableConsoleShots().reduce((a, s) => a + s.d, 0);

const DEVICE_W = 1330;

const Media: React.FC<{ clip?: string; stillName?: string; d: number; skip?: number; rate?: number; zoom?: [number, number, number] }> = ({ clip, stillName, d, skip, rate, zoom }) => {
  const frame = useCurrentFrame();
  if (clip) return <ClipShot name={clip} durationInFrames={d} maxRate={rate ?? 2.5} skipSeconds={clip.startsWith("v2/") ? skip ?? 0 : 0} from={{ x: 0.5, y: 0.5, scale: 1 }} to={zoom ? { x: zoom[0], y: zoom[1], scale: zoom[2] } : { x: 0.5, y: 0.5, scale: 1 }} />;
  const s = still(stillName!);
  if (!s) return null;
  const z = interpolate(frame, [0, d], [1, 1.08], clamp);
  return <Img src={staticFile(s.file)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 0%", transform: `scale(${z})`, transformOrigin: "50% 20%" }} />;
};

export const SceneConsole: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shots = availableConsoleShots();
  const enter = sp(frame, fps, 6, 16);
  const idx = Math.max(0, shots.findLastIndex((s) => frame >= s.at));
  return (
    <Stage>
      <div style={{ position: "absolute", left: 90, top: 84, opacity: ramp(frame, 0, 12) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 12, height: 12, background: K.orange }} />
          <Label>The desk console · real footage</Label>
        </div>
      </div>
      {/* left column: what you are looking at */}
      {shots.map((s, i) => (
        <Sequence key={`t${i}`} from={s.at} durationInFrames={s.d}>
          <ShotText shot={s} per={s.d} n={i + 1} total={shots.length} />
        </Sequence>
      ))}
      {/* device on the right; footage slides between shots */}
      <div style={{ position: "absolute", right: 60, top: 150, transform: `translateX(${(1 - enter) * 900}px) rotate(${(1 - enter) * 4}deg)` }}>
        <Device width={DEVICE_W}>
          {shots.map((s, i) => {
            const local = frame - s.at;
            if (local < -12 || local > s.d + 2) return null;
            const v = i === 0 ? 1 : sp(frame, fps, s.at - 12, 18);
            return (
              <AbsoluteFill key={i} style={{ transform: `translateX(${(1 - v) * DEVICE_W}px)`, zIndex: i }}>
                <Sequence from={s.at - 12} durationInFrames={s.d + 14} layout="none">
                  <AbsoluteFill>
                    <Media clip={s.clip} stillName={s.useStill} d={s.d + 14} skip={s.skip} rate={s.rate} zoom={s.zoom} />
                  </AbsoluteFill>
                </Sequence>
              </AbsoluteFill>
            );
          })}
        </Device>
        <div style={{ display: "flex", gap: 8, marginTop: 22, justifyContent: "center" }}>
          {shots.map((_, i) => (
            <div key={i} style={{ width: i === idx ? 34 : 10, height: 10, borderRadius: 5, background: i === idx ? K.orange : K.line2 }} />
          ))}
        </div>
      </div>
    </Stage>
  );
};

const ShotText: React.FC<{ shot: ReturnType<typeof availableConsoleShots>[number]; per: number; n: number; total: number }> = ({ shot, per, n, total }) => {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [per - 10, per], [1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: 90, top: 330, width: 440, opacity: out }}>
      <div style={{ fontFamily: MONO, fontSize: 18, color: K.muted, opacity: ramp(frame, 0, 10) }}>
        {String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>
      <Label style={{ marginTop: 14, opacity: ramp(frame, 2, 12) }}>{shot.kicker}</Label>
      <Kinetic text={shot.line} at={4} size={44} style={{ marginTop: 16 }} />
      {shot.note ? (
        <div style={{ fontSize: 26, color: K.muted, marginTop: 24, lineHeight: 1.4, opacity: ramp(frame, 22, 36), transform: `translateY(${(1 - ramp(frame, 22, 36)) * 16}px)` }}>{shot.note}</div>
      ) : null}
    </div>
  );
};

/** The simulated city, labelled as a visualisation of agent traces. */
export const SceneCity: React.FC<{ d: number }> = ({ d }) => {
  const frame = useCurrentFrame();
  const shots: { clip?: string; still?: string; cap: string }[] = [
    { clip: "city-flyover", still: "city-aerial", cap: "A live 3D city: deliveries, traffic, the river and the port." },
    { clip: "city-crash", still: "city-crash", cap: "A truck crash becomes an incident, and a case for the desk." },
    { still: "city-port", cap: "Ships berth at the container port." },
    { clip: "v2/city-motorcade", still: "city-motorcade", cap: "A motorcade crosses the city under a rolling road closure." },
  ].filter((s) => (s.clip && hasClip(s.clip)) || (s.still && hasStill(s.still)));
  if (!shots.length) return null;
  const per = Math.floor(d / shots.length);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {shots.map((s, i) => {
        const useClip = s.clip && hasClip(s.clip);
        return (
          <Sequence key={i} from={i * per} durationInFrames={i === shots.length - 1 ? d - i * per : per + 8}>
            <CityShot clip={useClip ? s.clip : undefined} stillName={s.still} cap={s.cap} d={i === shots.length - 1 ? d - i * per : per + 8} first={i === 0} />
          </Sequence>
        );
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 60, background: "#000" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 60, background: "#000" }} />
      <SimBadge />
      <div style={{ position: "absolute", top: 76, left: 90, opacity: ramp(frame, 4, 16) }}>
        <Label>Demo only</Label>
      </div>
    </AbsoluteFill>
  );
};

const CityShot: React.FC<{ clip?: string; stillName?: string; cap: string; d: number; first: boolean }> = ({ clip, stillName, cap, d, first }) => {
  const frame = useCurrentFrame();
  const fade = first ? 1 : ramp(frame, 0, 8);
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      {clip ? (
        <ClipShot name={clip} durationInFrames={d} maxRate={2} skipSeconds={1} from={{ x: 0.5, y: 0.5, scale: 1.02 }} to={{ x: 0.5, y: 0.5, scale: 1.1 }} />
      ) : stillName && still(stillName) ? (
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <Img src={staticFile(still(stillName)!.file)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${interpolate(frame, [0, d], [1.04, 1.16], clamp)})` }} />
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.65) 100%)" }} />
      <div style={{ position: "absolute", left: 90, bottom: 100 }}>
        <Kinetic text={cap} at={4} size={46} />
      </div>
    </AbsoluteFill>
  );
};

// Latest numbers (team framework map, 14:10).
export const SceneNumbers: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items: { to: number; dec?: number; pre?: string; suf?: string; label: string; hot?: boolean }[] = [
    { to: 0.92, dec: 2, label: "score on 48 test cases" },
    { to: 46, suf: " / 48", label: "cases passed" },
    { to: 0, label: "rules broken", hot: true },
    { to: 165, suf: " s", label: "for 50 cases, 50 of 50 answered" },
    { to: 5, suf: "¢", label: "per case" },
  ];
  return (
    <Stage>
      <Header kicker="How we know" line="The latest eval run, scored *case by case.*" size={54} />
      <div style={{ position: "absolute", left: 120, right: 120, top: 430, display: "flex", gap: 28 }}>
        {items.map((it, i) => {
          const v = sp(frame, fps, 14 + i * 7, 15);
          return (
            <div key={it.label} style={{ flex: 1, borderTop: `3px solid ${it.hot ? K.orange : K.line2}`, paddingTop: 26, opacity: Math.min(1, v), transform: `translateY(${(1 - v) * 50}px)` }}>
              <div style={{ fontSize: 108, fontWeight: 700, letterSpacing: -3.5, lineHeight: 1, color: it.hot ? K.orange : K.text, fontVariantNumeric: "tabular-nums" }}>
                {it.to === 0 ? "0" : <CountUpInline to={it.to} at={18 + i * 7} dec={it.dec ?? 0} />}
                <span style={{ fontSize: 60 }}>{it.suf}</span>
              </div>
              <div style={{ fontSize: 28, color: K.muted, marginTop: 18, lineHeight: 1.3 }}>{it.label}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 120, right: 120, top: 760, fontSize: 26, color: K.muted, lineHeight: 1.5, opacity: ramp(frame, 70, 90) }}>
        A message that breaks a "must never" rule scores the whole case 0. One run against our own answer keys, not the judges' score, so a case or two either way is noise.
      </div>
      <div style={{ position: "absolute", left: 120, top: 880, display: "flex", gap: 40, opacity: ramp(frame, 90, 110), fontFamily: MONO, fontSize: 20, color: K.muted }}>
        <span>0.87 → 0.89 → 0.90 → <span style={{ color: K.orange }}>0.92</span> over four runs</span>
        <span>288 agent tests pass with no key</span>
      </div>
    </Stage>
  );
};

const CountUpInline: React.FC<{ to: number; at: number; dec: number }> = ({ to, at, dec }) => {
  const frame = useCurrentFrame();
  const v = interpolate(frame, [at, at + 34], [0, to], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  return <>{v.toFixed(dec)}</>;
};

export const SceneEnd: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = sp(frame, fps, 0, 14);
  return (
    <Stage>
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 160 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26, opacity: Math.min(1, a), transform: `translateY(${(1 - a) * 30}px)` }}>
          <div style={{ width: 44, height: 44, background: K.orange }} />
          <div style={{ fontSize: 150, fontWeight: 700, letterSpacing: -5, lineHeight: 1 }}>Rivet</div>
        </div>
        <Kinetic text="The delivery desk that knows *when to stop.*" at={8} size={60} weight={560} style={{ marginTop: 30 }} />
        <div style={{ fontFamily: MONO, fontSize: 30, color: K.orange, marginTop: 44, opacity: ramp(frame, 26, 40) }}>github.com/arvin-shafiei/dwell-belly</div>
        <div style={{ fontSize: 24, color: K.muted, marginTop: 18, opacity: ramp(frame, 34, 48) }}>Real-World Agents Hackathon · Delivery & Logistics · Apache 2.0</div>
      </AbsoluteFill>
    </Stage>
  );
};
