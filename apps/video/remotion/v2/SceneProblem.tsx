import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { MONO } from "../theme";
import { clamp, Header, K, Kinetic, Label, Pop, ramp, sp, Stage } from "./kit";

// Real practice-case titles and ids (Results page, docs/media/results.png).
const CASES: [string, string][] = [
  ["delivery-001", "Recipient cannot attend the scheduled delivery window"],
  ["delivery-013", "Recipient disputes a recorded failed delivery attempt"],
  ["delivery-002", "Apartment number missing from the delivery address"],
  ["delivery-003", "Driver cannot access a gated residential building"],
  ["delivery-004", "Recipient requests a call shortly before arrival"],
  ["delivery-005", "Recipient asks for an authorised household member to receive the parcel"],
  ["delivery-006", "Customer requests collection from a staffed pickup point"],
  ["delivery-007", "Pickup deadline is too short for the recipient"],
  ["delivery-008", "Recipient needs a defined delivery slot rather than an all-day estimate"],
  ["delivery-009", "Bulky delivery requires the recipient to clear an access route"],
  ["delivery-010", "Recipient wants delivery held during a short absence"],
  ["delivery-011", "Shipment tracking has not updated after depot arrival"],
  ["delivery-012", "Promised delivery day missed after vehicle breakdown"],
  ["delivery-014", "Driver arrives after the business receiving desk closes"],
  ["delivery-015", "Parcel has been routed to the wrong local depot"],
  ["delivery-045", "Import shipment is waiting for the shipper's commercial invoice"],
  ["delivery-031", "Return approved but the customer has no return label"],
  ["delivery-022", "A delivered household item is confirmed broken"],
];

// deterministic pseudo-random
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const CaseCard: React.FC<{ id: string; title: string; i: number; frame: number; fps: number; dim: number }> = ({ id, title, i, frame, fps, dim }) => {
  const at = 6 + i * 7;
  const v = sp(frame, fps, at, 14, 0.6);
  const col = i % 4;
  const row = Math.floor(i / 4);
  const x = 150 + col * 420 + (rnd(i, 1) - 0.5) * 60;
  const y = 330 + row * 140 + (rnd(i, 2) - 0.5) * 30;
  const fromX = (rnd(i, 3) - 0.5) * 900;
  const fromY = 500 + rnd(i, 4) * 300;
  const rot = (rnd(i, 5) - 0.5) * 8;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 380,
        padding: "18px 20px",
        background: K.panel,
        border: `1px solid ${K.line2}`,
        borderRadius: 12,
        boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
        opacity: Math.min(1, v) * (1 - dim * 0.82),
        transform: `translate(${(1 - v) * fromX}px, ${(1 - v) * fromY}px) rotate(${rot * (1 - v * 0.6)}deg)`,
        filter: dim > 0 ? `blur(${dim * 3}px)` : undefined,
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 15, color: K.muted, letterSpacing: 1 }}>{id}</div>
      <div style={{ fontSize: 22, fontWeight: 560, marginTop: 6, lineHeight: 1.25 }}>{title}</div>
    </div>
  );
};

/** 0-11 s: the desk is drowning, and the stories clash. */
export const SceneProblem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dim = ramp(frame, 175, 200);
  const push = interpolate(frame, [0, 200], [1, 1.06], clamp);
  const clashA = sp(frame, fps, 200, 15);
  const clashB = sp(frame, fps, 212, 15);
  const neq = sp(frame, fps, 232, 10);
  return (
    <Stage>
      <AbsoluteFill style={{ transform: `scale(${push})` }}>
        {CASES.map(([id, t], i) => (
          <CaseCard key={id} id={id} title={t} i={i} frame={frame} fps={fps} dim={dim} />
        ))}
      </AbsoluteFill>
      <Header kicker="The problem" line="Case after case lands on the desk. It *controls* none of the parties." size={54} out={170} />
      {frame >= 190 ? (
        <AbsoluteFill>
          <div style={{ position: "absolute", left: 120, top: 84 }}>
            <Kinetic text="And the stories *don't* match." at={192} size={64} />
          </div>
          <div style={{ position: "absolute", top: 400, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 48 }}>
            <Pop v={clashA} dx={-120} dy={0}>
              <div style={{ width: 640, padding: "30px 34px", background: K.panel, borderRadius: 16, borderTop: `5px solid ${K.blue}` }}>
                <Label color={K.blue}>Carrier record</Label>
                <div style={{ fontSize: 38, fontWeight: 600, marginTop: 14, lineHeight: 1.2 }}>Failed-attempt scan at 08:40 UTC.</div>
              </div>
            </Pop>
            <div style={{ fontSize: 110, fontWeight: 700, color: K.red, transform: `scale(${neq})`, opacity: Math.min(1, neq) }}>≠</div>
            <Pop v={clashB} dx={120} dy={0}>
              <div style={{ width: 640, padding: "30px 34px", background: K.panel, borderRadius: 16, borderTop: `5px solid ${K.amber}` }}>
                <Label color={K.amber}>Recipient says</Label>
                <div style={{ fontSize: 38, fontWeight: 600, marginTop: 14, lineHeight: 1.2 }}>"I was at home and did not hear the intercom."</div>
              </div>
            </Pop>
          </div>
          <div style={{ position: "absolute", top: 700, left: 0, right: 0, textAlign: "center", opacity: ramp(frame, 255, 275) }}>
            <div style={{ fontSize: 34, color: K.muted }}>Act on the wrong one and the desk makes a promise it can't keep.</div>
          </div>
          <div style={{ position: "absolute", bottom: 60, left: 120, fontFamily: MONO, fontSize: 17, color: K.muted, opacity: ramp(frame, 230, 250) }}>
            Practice case delivery-013, from the organisers' synthetic set
          </div>
        </AbsoluteFill>
      ) : null}
    </Stage>
  );
};

/** Title card. */
export const SceneTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = sp(frame, fps, 0, 14);
  const line = ramp(frame, 18, 48);
  return (
    <Stage>
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 160 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 30, transform: `translateY(${(1 - a) * 40}px)`, opacity: Math.min(1, a) }}>
          <div style={{ width: 54, height: 54, background: K.orange, transform: `rotate(${(1 - a) * 90}deg)` }} />
          <div style={{ fontSize: 190, fontWeight: 700, letterSpacing: -6, lineHeight: 1 }}>Rivet</div>
        </div>
        <Kinetic text="The delivery desk that knows *when to stop.*" at={10} size={66} weight={560} style={{ marginTop: 34 }} />
        <div style={{ height: 4, background: K.orange, width: 900 * line, marginTop: 30 }} />
      </AbsoluteFill>
    </Stage>
  );
};
