// Captions and camera targets. Keep the words plain and true to what the
// screenshot shows. No numbers unless they are visible in a real screenshot.
import type { Cam } from "./components/Shots";

/**
 * Practice score as shown in the real playbooks-practice.png (for example
 * "4 of 5 right"). Leave null unless the screenshot itself shows it.
 */
export const PRACTICE_SCORE: string | null = null;

/** Camera moves per still: [from, to]. x, y are 0..1 of the image. */
export const CAMS: Record<string, [Cam, Cam]> = {
  "console-home": [{ x: 0.55, y: 0.4, scale: 1.02 }, { x: 0.55, y: 0.3, scale: 1.22 }],
  "case-run-detail": [{ x: 0.6, y: 0.5, scale: 1.0 }, { x: 0.62, y: 0.42, scale: 1.12 }],
  "case-headline": [{ x: 0.62, y: 0.12, scale: 1.6 }, { x: 0.66, y: 0.12, scale: 1.8 }],
  "case-sent": [{ x: 0.64, y: 0.32, scale: 1.55 }, { x: 0.64, y: 0.38, scale: 1.7 }],
  "case-steps": [{ x: 0.6, y: 0.78, scale: 1.6 }, { x: 0.6, y: 0.86, scale: 1.75 }],
  "case-run-voice": [{ x: 0.62, y: 0.4, scale: 1.05 }, { x: 0.68, y: 0.58, scale: 1.25 }],
  "voice-card": [{ x: 0.64, y: 0.24, scale: 1.45 }, { x: 0.64, y: 0.24, scale: 1.65 }],
  "voice-approve": [{ x: 0.66, y: 0.58, scale: 1.7 }, { x: 0.68, y: 0.59, scale: 2.1 }],
  "playbooks-ai-builder": [{ x: 0.5, y: 0.5, scale: 1.0 }, { x: 0.45, y: 0.5, scale: 1.3 }],
  "playbooks-tree": [{ x: 0.4, y: 0.55, scale: 1.3 }, { x: 0.72, y: 0.55, scale: 1.6 }],
  "playbooks-practice": [{ x: 0.7, y: 0.5, scale: 1.15 }, { x: 0.9, y: 0.6, scale: 1.7 }],
  decisions: [{ x: 0.5, y: 0.4, scale: 1.1 }, { x: 0.5, y: 0.38, scale: 1.38 }],
  results: [{ x: 0.5, y: 0.3, scale: 1.04 }, { x: 0.3, y: 0.15, scale: 1.35 }],
  "city-aerial": [{ x: 0.45, y: 0.5, scale: 1.0 }, { x: 0.4, y: 0.45, scale: 1.18 }],
  "city-cases": [{ x: 0.8, y: 0.25, scale: 1.6 }, { x: 0.86, y: 0.22, scale: 2.0 }],
  "city-crash": [{ x: 0.55, y: 0.55, scale: 1.15 }, { x: 0.86, y: 0.3, scale: 1.75 }],
  "city-port": [{ x: 0.4, y: 0.5, scale: 1.04 }, { x: 0.55, y: 0.45, scale: 1.18 }],
  "city-night": [{ x: 0.4, y: 0.5, scale: 1.02 }, { x: 0.45, y: 0.45, scale: 1.15 }],
  "city-motorcade": [{ x: 0.4, y: 0.5, scale: 1.04 }, { x: 0.5, y: 0.55, scale: 1.18 }],
  "city-control": [{ x: 0.55, y: 0.4, scale: 1.0 }, { x: 0.72, y: 0.3, scale: 1.25 }],
};

export const cam = (key: string): { from: Cam; to: Cam } => {
  const c = CAMS[key] ?? [{ x: 0.5, y: 0.5, scale: 1.02 }, { x: 0.5, y: 0.5, scale: 1.1 }];
  return { from: c[0], to: c[1] };
};
