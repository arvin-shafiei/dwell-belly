"use client";
// Small inline-SVG chart: pass rate and mean score per workflow version.
import type { CurvePoint } from "./testing";

const W = 332;
const H = 120;
const PAD = { l: 28, r: 10, t: 10, b: 22 };

export function LearningCurve({ points, current }: { points: CurvePoint[]; current: number | null }) {
  if (!points.length) {
    return <div className="rounded-md border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-white/40">The curve appears after the first finished test run.</div>;
  }
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => PAD.t + (1 - v) * ih;
  const line = (vals: (number | null)[]) =>
    vals.map((v, i) => (v === null ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(" ");
  const rate = points.map((p) => p.passRate);
  const score = points.map((p) => p.meanScore);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Learning curve: pass rate and mean score per version" className="block">
        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.08)" strokeDasharray={g === 0.5 ? "3 4" : undefined} />
            <text x={PAD.l - 6} y={y(g) + 3} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.35)">{g * 100}%</text>
          </g>
        ))}
        <polyline points={line(rate)} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" />
        <polyline points={line(score)} fill="none" stroke="#ff6a1a" strokeWidth="2" strokeLinejoin="round" strokeDasharray="5 3" />
        {points.map((p, i) => (
          <g key={p.version}>
            <circle cx={x(i)} cy={y(p.passRate)} r="3.5" fill="#22c55e">
              <title>{`v${p.version}: pass rate ${Math.round(p.passRate * 100)}% over ${p.runs} run(s)`}</title>
            </circle>
            {p.meanScore !== null && (
              <circle cx={x(i)} cy={y(p.meanScore)} r="3" fill="#ff6a1a">
                <title>{`v${p.version}: mean score ${p.meanScore.toFixed(2)}`}</title>
              </circle>
            )}
            <text
              x={x(i)} y={H - 6} textAnchor="middle" fontSize="10"
              fill={p.version === current ? "#ffffff" : "rgba(255,255,255,0.45)"} fontWeight={p.version === current ? 700 : 400}
            >
              v{p.version}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex gap-3 text-[10.5px] text-white/50">
        <span className="inline-flex items-center gap-1"><span className="h-0.5 w-3 bg-[#22c55e]" /> pass rate</span>
        <span className="inline-flex items-center gap-1"><span className="h-0.5 w-3 border-t-2 border-dashed border-[#ff6a1a]" /> mean score</span>
      </div>
    </div>
  );
}
