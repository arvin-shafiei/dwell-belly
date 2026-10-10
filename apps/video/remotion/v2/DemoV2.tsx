import React from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import { springTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { SceneCity, SceneConsole, SceneEnd, SceneNumbers, consoleDuration } from "./SceneConsole";
import { FLOW_FRAMES, SceneFlow } from "./SceneFlow";
import { SceneDecision, SceneSeats } from "./SceneHuman";
import { SceneProblem, SceneTitle } from "./SceneProblem";
import { K } from "./kit";

export const V2_FPS = 30;
const T = 16; // transition length
const CITY = 300;

const scenes = () => {
  return [
    { d: 285, el: <SceneProblem />, t: "fade" },
    { d: 120, el: <SceneTitle />, t: "slide" },
    { d: FLOW_FRAMES, el: <SceneFlow />, t: "slide" },
    { d: 285, el: <SceneSeats />, t: "slide" },
    { d: 385, el: <SceneDecision />, t: "slide" },
    { d: Math.max(60, consoleDuration() + 16), el: <SceneConsole />, t: "fade" },
    { d: CITY, el: <SceneCity d={CITY} />, t: "fade" },
    { d: 270, el: <SceneNumbers />, t: "slide" },
    { d: 150, el: <SceneEnd />, t: "fade" },
  ];
};

export const v2Duration = () => {
  const s = scenes();
  return s.reduce((a, x) => a + x.d, 0) - T * (s.length - 1);
};

export type DemoV2Props = { audio: string | null; audioVolume: number };

export const DemoV2: React.FC<DemoV2Props> = ({ audio, audioVolume }) => {
  const s = scenes();
  const timing = springTiming({ config: { damping: 200 }, durationInFrames: T });
  return (
    <AbsoluteFill style={{ backgroundColor: K.bg }}>
      <TransitionSeries>
        {s.map((x, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <TransitionSeries.Transition presentation={x.t === "slide" ? slide({ direction: "from-right" }) : fade()} timing={timing} /> : null}
            <TransitionSeries.Sequence durationInFrames={x.d}>{x.el}</TransitionSeries.Sequence>
          </React.Fragment>
        ))}
      </TransitionSeries>
      {audio ? <Audio src={staticFile(audio)} volume={audioVolume} /> : null}
    </AbsoluteFill>
  );
};
