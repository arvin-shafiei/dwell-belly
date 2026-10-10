import data from "./media.generated.json";

type Still = { file: string; width: number | null; height: number | null };
type Clip = { file: string; width: number | null; height: number | null; duration: number };

const stills = (data as { stills: Record<string, Still> }).stills ?? {};
const clips = (data as { clips: Record<string, Clip> }).clips ?? {};

export const hasStill = (name: string) => Boolean(stills[name]);
export const hasClip = (name: string) => Boolean(clips[name]);
export const still = (name: string): Still | undefined => stills[name];
export const clip = (name: string): Clip | undefined => clips[name];

/** First still that exists, in order of preference. */
export const pickStill = (...names: string[]) => names.find(hasStill);
/** First clip that exists, in order of preference. */
export const pickClip = (...names: string[]) => names.find(hasClip);
