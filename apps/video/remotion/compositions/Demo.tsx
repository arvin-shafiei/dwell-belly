import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { EvidenceCard, FlowCard } from "../components/Cards";
import { Caption, Scrim, SimTag, StackedLines, TitleBlock, Wordmark } from "../components/Overlays";
import { layout, Reel, type Shot } from "../components/Reel";
import { ClipShot, StillShot } from "../components/Shots";
import { cam, PRACTICE_SCORE } from "../copy";
import { hasClip, hasStill, pickStill } from "../media";
import { C, ONE_LINER, REPO_URL } from "../theme";

export const DEMO_FPS = 30;
export const DEMO_FRAMES = 60 * DEMO_FPS;

export type DemoProps = {
  /** Optional voiceover or music, a file in docs/media (e.g. "voiceover.mp3"). */
  audio: string | null;
  audioVolume: number;
};

type Cap = { kicker?: string; text: string; sub?: string };

const Captioned: React.FC<{ d: number; cap?: Cap; sim?: boolean; scrim?: boolean; children: React.ReactNode }> = ({ d, cap, sim, scrim = true, children }) => (
  <AbsoluteFill>
    {children}
    {scrim ? <Scrim strength={0.35} /> : null}
    {sim ? <SimTag /> : null}
    {cap ? <Caption durationInFrames={d} {...cap} /> : null}
  </AbsoluteFill>
);

/** A still shot, or nothing if the still is missing. */
function stillShot(name: string, weight: number, cap?: Cap, opts: { camKey?: string; sim?: boolean } = {}): Shot | null {
  if (!hasStill(name)) return null;
  const c = cam(opts.camKey ?? name);
  return {
    weight,
    render: (d) => (
      <Captioned d={d} cap={cap} sim={opts.sim}>
        <StillShot name={name} durationInFrames={d} from={c.from} to={c.to} />
      </Captioned>
    ),
  };
}

/** A clip shot (falling back to a still), or nothing if neither exists. */
function clipShot(clipName: string, fallback: string | undefined, weight: number, cap?: Cap, opts: { sim?: boolean; skip?: number; maxRate?: number } = {}): Shot | null {
  if (!hasClip(clipName)) return fallback ? stillShot(fallback, weight, cap, { sim: opts.sim }) : null;
  return {
    weight,
    render: (d) => (
      <Captioned d={d} cap={cap} sim={opts.sim}>
        <ClipShot name={clipName} durationInFrames={d} fallbackStill={fallback && hasStill(fallback) ? fallback : undefined} skipSeconds={opts.skip ?? 0} maxRate={opts.maxRate ?? 2} />
      </Captioned>
    ),
  };
}

const textCard = (weight: number, lines: string[]): Shot => ({
  weight,
  render: () => (
    <AbsoluteFill style={{ backgroundColor: C.ink }}>
      <StackedLines lines={lines} every={10} size={72} accentLast />
    </AbsoluteFill>
  ),
});

const keep = (xs: (Shot | null)[]) => xs.filter((x): x is Shot => x !== null);

/** A segment's shots, or a plain text card if no media for it exists. */
const orCard = (xs: (Shot | null)[], lines: string[]) => {
  const k = keep(xs);
  return k.length ? k : [textCard(1, lines)];
};

export const Demo: React.FC<DemoProps> = ({ audio, audioVolume }) => {
  const s = (sec: number) => Math.round(sec * DEMO_FPS);

  // 0-6 s: the hook. Text first, then the city flyover with the title.
  const flyStill = pickStill("city-aerial", "city-night", "city-port");
  const hookCity: Shot | null =
    hasClip("city-flyover") || flyStill
      ? {
          weight: 1,
          render: (d) => (
            <AbsoluteFill>
              {hasClip("city-flyover") ? (
                <ClipShot name="city-flyover" durationInFrames={d} fallbackStill={flyStill} maxRate={1.6} />
              ) : (
                <StillShot name={flyStill!} durationInFrames={d} {...cam(flyStill!)} />
              )}
              <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(17,17,19,0.82) 0%, rgba(17,17,19,0.45) 55%, rgba(17,17,19,0.1) 100%)" }} />
              <SimTag />
              <Sequence from={6}>
                <TitleBlock title="Rivet" line="The delivery desk that knows when to stop." />
              </Sequence>
            </AbsoluteFill>
          ),
        }
      : null;
  const hookText: Shot = {
    weight: 1,
    render: () => (
      <AbsoluteFill style={{ backgroundColor: C.ink }}>
        <StackedLines lines={["Calls. Emails. Portal messages.", "Stories that don't match.", "Every one needs the right next step."]} every={16} size={78} accentLast />
      </AbsoluteFill>
    ),
  };
  const hook = layout(hookCity ? [{ ...hookText, weight: 2.4 }, { ...hookCity, weight: 3.6 }] : [{ ...hookText, weight: 3 }, { ...textCard(3, ["Rivet", "The delivery desk that knows when to stop."]) }], s(6), 0);

  // 6-20 s: a real case run.
  const caseRun = layout(
    orCard(
      [
        { weight: 3.6, render: () => <FlowCard /> },
        clipShot("case-run", "case-run-detail", 2.4, { kicker: "A real case run", text: "The agent reads the case and takes one step." }, { skip: 0.3, maxRate: 3 }),
        stillShot("case-run-detail", 2.5, { kicker: "Headline", text: "What it did, in one line, and whether that was right." }, { camKey: "case-headline" }),
        stillShot("case-run-detail", 3, { kicker: "What was sent", text: "One email to the carrier team that owns the problem." }, { camKey: "case-sent" }),
        stillShot("case-run-detail", 2.5, { kicker: "Steps", text: "Every step it took, checked off." }, { camKey: "case-steps" }),
      ],
      ["A real case run.", "Headline, what was sent, every step."],
    ),
    s(14),
    s(6),
  );

  // 20-30 s: make a playbook.
  const playbook = layout(
    orCard(
      [
        clipShot("playbook-build", "playbooks-ai-builder", 4.4, { kicker: "Make a playbook", text: "Describe the business in plain words. The AI builds the decision tree, and it passes the safety check." }, { maxRate: 4 }),
        stillShot("playbooks-tree", 2.6, { kicker: "Playbook", text: "Every step is a box you can see and change: send, ask a person, or stop." }),
        stillShot("playbooks-practice", 3, { kicker: "Practice", text: "Run it on stored cases and see if it is getting better.", sub: PRACTICE_SCORE ?? undefined }),
      ],
      ["Make a playbook.", "The AI builds the decision tree."],
    ),
    s(10),
    s(20),
  );

  // 30-40 s: a person decides, and voice.
  const decide = layout(
    orCard(
      [
        stillShot("case-run-voice", 3.8, { kicker: "A person decides", text: "When it should not act alone, it stops and lays out the options." }, { camKey: "voice-card" }),
        stillShot("decisions", 2.6, { kicker: "Decisions", text: "A person makes the call, and the decision is saved." }),
        stillShot("case-run-voice", 3.6, { kicker: "Voice", text: "Or approve by voice, on a call with the desk manager." }, { camKey: "voice-approve" }),
      ],
      ["When it is unsure, it stops.", "A person decides."],
    ),
    s(10),
    s(30),
  );

  // 40-52 s: the live city (simulated, labelled), feeding a real agent case.
  const city = layout(
    orCard(
      [
        clipShot("city-crash", "city-crash", 3, { kicker: "The live city", text: "A truck crashes on the ring road. It shows up as an incident." }, { sim: true }),
        stillShot("city-control", 3.2, { kicker: "City tab", text: "Make something happen from the console: weather, time, incidents." }, { sim: true }),
        stillShot("city-aerial", 3.2, { kicker: "Real agent", text: "Its incidents become cases that the real agent works." }, { sim: true, camKey: "city-cases" }),
        stillShot("city-port", 2.6, { kicker: "The live city", text: "Ships berth at the container port." }, { sim: true }),
      ],
      ["A live 3D city.", "Its incidents become real cases."],
    ),
    s(12),
    s(40),
  );

  // 52-60 s: results, then the one-liner and repo.
  const end = layout(
    [
      ...keep([stillShot("results", 2.3, { kicker: "Results", text: "Every stored case: what it did, and whether it was right." })]),
      { weight: 3.4, render: () => <EvidenceCard /> },
      {
        weight: 2.3,
        render: () => (
          <AbsoluteFill style={{ backgroundColor: C.ink }}>
            <TitleBlock title="Rivet" line={`${ONE_LINER.replace(/^Rivet: t/, "T")}.`} small={REPO_URL} />
          </AbsoluteFill>
        ),
      },
    ],
    s(8),
    s(52),
  );

  const all = [...hook, ...caseRun, ...playbook, ...decide, ...city, ...end];
  return (
    <AbsoluteFill style={{ backgroundColor: C.ink }}>
      <Reel placed={all} total={DEMO_FRAMES} xf={12} fadeFirst={8} fadeLast={0} />
      <Sequence from={s(6)} durationInFrames={s(46) + 6}>
        <Wordmark />
      </Sequence>
      {audio ? <Audio src={staticFile(audio)} volume={audioVolume} /> : null}
    </AbsoluteFill>
  );
};
