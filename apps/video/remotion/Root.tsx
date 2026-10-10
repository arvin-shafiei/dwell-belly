import React, { useEffect, useState } from "react";
import { Composition, continueRender, delayRender } from "remotion";
import { Demo, DEMO_FPS, DEMO_FRAMES, type DemoProps } from "./compositions/Demo";
import { DemoV2, v2Duration, V2_FPS } from "./v2/DemoV2";
import { FeatureGif, type FeatureName, GIF_FPS, HeroGif } from "./compositions/Gifs";
import "./theme";

export const FEATURES: FeatureName[] = ["voice", "playbook", "city", "decisions"];

/** Holds the first frame until the web fonts are ready. */
const useFonts = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));
  useEffect(() => {
    document.fonts.ready.then(() => continueRender(handle));
  }, [handle]);
};

export const Root: React.FC = () => {
  useFonts();
  const demoDefaults: DemoProps = { audio: null, audioVolume: 1 };
  return (
    <>
      <Composition id="Demo" component={Demo} durationInFrames={DEMO_FRAMES} fps={DEMO_FPS} width={1920} height={1080} defaultProps={demoDefaults} />
      <Composition id="DemoCut" component={DemoV2} durationInFrames={Math.min(1800, v2Duration(true))} fps={V2_FPS} width={1920} height={1080} defaultProps={{ ...demoDefaults, cut: true }} />
      <Composition id="DemoV2" component={DemoV2} durationInFrames={v2Duration()} fps={V2_FPS} width={1920} height={1080} defaultProps={demoDefaults} />
      <Composition id="HeroGif" component={HeroGif} durationInFrames={8 * GIF_FPS} fps={GIF_FPS} width={1200} height={675} />
      {FEATURES.map((f) => (
        <Composition key={f} id={`FeatureGif-${f}`} component={FeatureGif} durationInFrames={5 * GIF_FPS} fps={GIF_FPS} width={960} height={540} defaultProps={{ feature: f }} />
      ))}
    </>
  );
};
