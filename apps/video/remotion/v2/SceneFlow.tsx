import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { MONO } from "../theme";
import { clamp, Header, K, Label, Pop, ramp, sp, Stage, Typed } from "./kit";

// One real case (delivery-013) through the flow. Facts from docs/media/case-run-detail.png
// and the team framework map. Thresholds: < 0.3 clear, 0.3-0.8 unsure, >= 0.8 unsafe.
const NODES = [
  { name: "Load", who: "Code" },
  { name: "Understand", who: "Claude" },
  { name: "3 quick checks", who: "Jev ×3" },
  { name: "Plan the reply", who: "Claude" },
  { name: "Safety check", who: "Code + Claude" },
];

export const FLOW_START = 50; // first node lights up
export const FLOW_STEP = 140; // frames per node
export const FLOW_FRAMES = FLOW_START + FLOW_STEP * 5 + 110;

const NODE_W = 270;
const GAP = 64;
const ROW_Y = 330;
const LEFT = (1920 - (NODE_W * 5 + GAP * 4)) / 2;

const Pipeline: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  return (
    <div style={{ position: "absolute", left: 0, top: ROW_Y, width: 1920, height: 120 }}>
      <svg width={1920} height={120} style={{ position: "absolute", left: 0, top: 0 }}>
        {NODES.slice(0, -1).map((_, i) => {
          const x1 = LEFT + i * (NODE_W + GAP) + NODE_W;
          const x2 = x1 + GAP;
          const t = ramp(frame, FLOW_START + (i + 1) * FLOW_STEP - 22, FLOW_START + (i + 1) * FLOW_STEP);
          return (
            <g key={i}>
              <line x1={x1} y1={60} x2={x2} y2={60} stroke={K.line2} strokeWidth={2} />
              <line x1={x1} y1={60} x2={x1 + (x2 - x1) * t} y2={60} stroke={K.orange} strokeWidth={3} />
              {t > 0 && t < 1 ? <circle cx={x1 + (x2 - x1) * t} cy={60} r={7} fill={K.orange} /> : null}
            </g>
          );
        })}
      </svg>
      {NODES.map((n, i) => {
        const at = FLOW_START + i * FLOW_STEP;
        const appear = sp(frame, fps, 6 + i * 4, 16);
        const on = sp(frame, fps, at, 12);
        const active = frame >= at && frame < at + FLOW_STEP;
        const done = frame >= at + FLOW_STEP;
        return (
          <div
            key={n.name}
            style={{
              position: "absolute",
              left: LEFT + i * (NODE_W + GAP),
              top: 0,
              width: NODE_W,
              height: 120,
              borderRadius: 14,
              background: active ? "#2c2219" : K.panel,
              border: `2px solid ${active || done ? K.orange : K.line2}`,
              boxShadow: active ? `0 0 0 ${6 * on}px rgba(255,106,26,0.18)` : undefined,
              padding: "20px 22px",
              opacity: Math.min(1, appear),
              transform: `translateY(${(1 - appear) * 30}px) scale(${active ? 1 + 0.04 * on : 1})`,
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: 15, color: active || done ? K.orange : K.muted, letterSpacing: 1 }}>
              {String(i + 1).padStart(2, "0")} · {n.who}
            </div>
            <div style={{ fontSize: 31, fontWeight: 650, marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
              {n.name}
              {done ? <span style={{ color: K.green, fontSize: 28 }}>✓</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Wraps a step's detail so it springs in and fades when the next step starts. */
const Detail: React.FC<{ i: number; frame: number; fps: number; children: React.ReactNode; hold?: boolean }> = ({ i, frame, fps, children, hold }) => {
  const at = FLOW_START + i * FLOW_STEP;
  if (frame < at - 2 || (!hold && frame > at + FLOW_STEP + 8)) return null;
  const v = sp(frame, fps, at + 4, 16);
  const out = hold ? 1 : interpolate(frame, [at + FLOW_STEP - 6, at + FLOW_STEP + 6], [1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: 160, right: 160, top: 540, opacity: Math.min(1, v) * out, transform: `translateY(${(1 - v) * 40}px)` }}>{children}</div>
  );
};

const Chip: React.FC<{ v: number; children: React.ReactNode; color?: string }> = ({ v, children, color = K.line2 }) => (
  <Pop v={v} dy={30} scale>
    <div style={{ padding: "18px 26px", borderRadius: 12, background: K.panel, border: `1.5px solid ${color}`, fontSize: 30, fontWeight: 560 }}>{children}</div>
  </Pop>
);

const Gauge: React.FC<{ frame: number; fps: number; at: number }> = ({ frame, fps, at }) => {
  // needle sweeps up, then settles in the low band ("risk: low")
  const v = sp(frame, fps, at, 7, 1.1);
  const target = 0.13;
  const value = interpolate(v, [0, 1], [0.95, target]);
  const angle = -180 + value * 180; // 0 -> left, 1 -> right
  const R = 230;
  const cx = 260;
  const cy = 260;
  const arc = (a0: number, a1: number) => {
    const p = (t: number) => [cx + R * Math.cos(Math.PI * (1 + t)), cy + R * Math.sin(Math.PI * (1 + t))];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    return `M ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1}`;
  };
  const appear = sp(frame, fps, at - 20, 16);
  return (
    <div style={{ opacity: Math.min(1, appear), transform: `scale(${0.9 + 0.1 * appear})` }}>
      <svg width={520} height={300}>
        <path d={arc(0, 0.3)} stroke={K.green} strokeWidth={34} fill="none" />
        <path d={arc(0.3, 0.8)} stroke={K.amber} strokeWidth={34} fill="none" />
        <path d={arc(0.8, 1)} stroke={K.red} strokeWidth={34} fill="none" />
        <g transform={`rotate(${angle + 180} ${cx} ${cy})`}>
          <line x1={cx} y1={cy} x2={cx - R + 30} y2={cy} stroke={K.text} strokeWidth={7} strokeLinecap="round" />
        </g>
        <circle cx={cx} cy={cy} r={16} fill={K.text} />
        <text x={cx - R - 6} y={cy + 40} fill={K.muted} fontFamily="Spline Sans Mono" fontSize={18}>0</text>
        <text x={cx + R - 22} y={cy + 40} fill={K.muted} fontFamily="Spline Sans Mono" fontSize={18}>1</text>
      </svg>
    </div>
  );
};

export const SceneFlow: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = (i: number, k: number) => sp(frame, fps, FLOW_START + i * FLOW_STEP + 10 + k * 8, 15);
  const safetyAt = FLOW_START + 4 * FLOW_STEP;
  return (
    <Stage>
      <Header kicker="One real case, start to finish" line="delivery-013: a recipient disputes a *failed delivery attempt.*" size={50} />
      <Pipeline frame={frame} fps={fps} />

      <Detail i={0} frame={frame} fps={fps}>
        <Label>Reads the whole case folder</Label>
        <div style={{ display: "flex", gap: 22, marginTop: 26 }}>
          <Chip v={s(0, 0)}>Emails</Chip>
          <Chip v={s(0, 1)}>Portal messages</Chip>
          <Chip v={s(0, 2)}>Call transcripts</Chip>
          <Chip v={s(0, 3)}>Attachments, PDFs, images</Chip>
        </div>
      </Detail>

      <Detail i={1} frame={frame} fps={fps}>
        <Label>Sorts records from claims</Label>
        <div style={{ display: "flex", gap: 40, marginTop: 26 }}>
          <div style={{ flex: 1 }}>
            <Label color={K.blue} size={18}>Records</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 14 }}>
              <Chip v={s(1, 0)} color={K.blue}>Carrier scan: failed attempt, 08:40 UTC</Chip>
              <Chip v={s(1, 1)} color={K.blue}>Carrier note, 09:00 UTC</Chip>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <Label color={K.amber} size={18}>Claims</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 14 }}>
              <Chip v={s(1, 2)} color={K.amber}>"I was at home, I did not hear the intercom."</Chip>
              <Chip v={s(1, 3)} color={K.amber}>Asks for a review and another visit</Chip>
            </div>
          </div>
        </div>
      </Detail>

      <Detail i={2} frame={frame} fps={fps}>
        <Label>Three checks, run at the same time</Label>
        <div style={{ display: "flex", gap: 24, marginTop: 26 }}>
          {[
            ["What kind of problem?", "Missed delivery", K.text],
            ["Second opinions", "Five seats weigh in", K.text],
            ["Do the stories match?", "No: was the recipient reachable at the attempt?", K.amber],
          ].map(([q, a, c], k) => (
            <Pop key={q} v={s(2, k)} dy={30} style={{ flex: 1 }}>
              <div style={{ padding: "24px 26px", borderRadius: 14, background: K.panel, border: `1.5px solid ${K.line2}`, height: 190 }}>
                <div style={{ fontSize: 24, color: K.muted }}>{q}</div>
                <div style={{ fontSize: 32, fontWeight: 620, marginTop: 14, color: c, lineHeight: 1.2 }}>{a}</div>
              </div>
            </Pop>
          ))}
        </div>
      </Detail>

      <Detail i={3} frame={frame} fps={fps}>
        <Label>Picks one move</Label>
        <div style={{ display: "flex", gap: 22, marginTop: 26, alignItems: "center" }}>
          {["Act", "Ask", "Hand over", "Wait"].map((m, k) => {
            const chosen = m === "Act";
            const pick = sp(frame, fps, FLOW_START + 3 * FLOW_STEP + 60, 12);
            return (
              <Pop key={m} v={s(3, k)} dy={20}>
                <div
                  style={{
                    padding: "18px 34px",
                    borderRadius: 999,
                    fontSize: 32,
                    fontWeight: 620,
                    background: chosen && pick > 0.5 ? K.orange : K.panel,
                    color: chosen && pick > 0.5 ? "#140b05" : chosen ? K.text : K.muted,
                    border: `1.5px solid ${chosen ? K.orange : K.line2}`,
                    transform: `scale(${chosen ? 1 + 0.08 * pick : 1})`,
                    opacity: chosen ? 1 : 1 - 0.5 * pick,
                  }}
                >
                  {m}
                </div>
              </Pop>
            );
          })}
        </div>
        <Pop v={sp(frame, fps, FLOW_START + 3 * FLOW_STEP + 72, 15)} dy={20}>
          <div style={{ fontSize: 40, fontWeight: 600, marginTop: 34 }}>
            Send one message to <span style={{ color: K.orange }}>Tracking support, Plover Arc Logistics.</span>
          </div>
        </Pop>
      </Detail>

      <Detail i={4} frame={frame} fps={fps} hold>
        <div style={{ display: "flex", gap: 70, alignItems: "flex-start" }}>
          <div>
            <Label>Every message is checked before it goes</Label>
            <div style={{ marginTop: 10 }}>
              <Gauge frame={frame} fps={fps} at={safetyAt + 26} />
            </div>
          </div>
          <div style={{ flex: 1, paddingTop: 44 }}>
            {[
              ["under 0.3", "Clear", "send it", K.green],
              ["0.3 to 0.8", "Unsure", "hold it; a person decides", K.amber],
              ["0.8 and up", "Unsafe", "stop; nothing is sent", K.red],
            ].map(([r, l, w, c], k) => {
              const lit = k === 0 && frame > safetyAt + 70;
              return (
                <Pop key={l} v={s(4, k)} dx={40} dy={0}>
                  <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "16px 22px", marginBottom: 14, borderRadius: 12, background: lit ? "rgba(62,207,142,0.12)" : K.panel, border: `1.5px solid ${lit ? K.green : K.line}` }}>
                    <div style={{ width: 16, height: 16, borderRadius: 8, background: c }} />
                    <div style={{ fontFamily: MONO, fontSize: 20, color: K.muted, width: 150 }}>{r}</div>
                    <div style={{ fontSize: 32, fontWeight: 650, width: 150 }}>{l}</div>
                    <div style={{ fontSize: 26, color: K.muted }}>{w}</div>
                  </div>
                </Pop>
              );
            })}
            <Pop v={sp(frame, fps, safetyAt + 78, 14)} dy={16}>
              <div style={{ fontSize: 30, fontWeight: 600, marginTop: 16, color: K.green }}>Risk low: sent to the sandbox outbox.</div>
            </Pop>
          </div>
        </div>
      </Detail>
      {frame > safetyAt + FLOW_STEP - 10 ? <Outbox frame={frame} fps={fps} at={safetyAt + FLOW_STEP - 10} /> : null}
      <div style={{ position: "absolute", bottom: 40, right: 60, fontFamily: MONO, fontSize: 17, color: K.muted }}>Thresholds live in the flow file, not in prompts</div>
    </Stage>
  );
};

const MSG =
  "Hello, regarding DL-013 and your 09:00 UTC note about the failed-attempt scan at 08:40 UTC today. The recipient, Yara Elt, wrote to us at 09:10 UTC. She says she was at home and did not hear the intercom...";

/** The email it actually sent, sliding up over the flow. */
const Outbox: React.FC<{ frame: number; fps: number; at: number }> = ({ frame, fps, at }) => {
  const v = sp(frame, fps, at, 16);
  return (
    <AbsoluteFill style={{ background: `rgba(25,25,29,${0.75 * Math.min(1, v)})` }}>
      <div style={{ position: "absolute", left: 260, right: 260, top: 250, transform: `translateY(${(1 - v) * 500}px)` }}>
        <div style={{ background: K.panel, borderRadius: 18, border: `1.5px solid ${K.line2}`, padding: "36px 44px", boxShadow: "0 40px 100px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Label>What it sent</Label>
            <div style={{ fontFamily: MONO, fontSize: 18, color: K.green }}>Sent · ✓ Right</div>
          </div>
          <div style={{ fontSize: 30, marginTop: 22, color: K.muted }}>
            To <span style={{ color: K.text }}>Tracking support, Plover Arc Logistics</span> · Email
          </div>
          <div style={{ fontSize: 31, lineHeight: 1.5, marginTop: 22, minHeight: 190 }}>
            <Typed text={MSG} a={at + 12} b={at + 70} />
          </div>
          <div style={{ fontSize: 22, color: K.muted, marginTop: 10 }}>One message, to the team that owns the problem. No promise it can't keep.</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
