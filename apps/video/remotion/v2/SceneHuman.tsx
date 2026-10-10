import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { MONO } from "../theme";
import { Header, K, Kinetic, Label, Pop, ramp, sp, Stage, Typed } from "./kit";

// From the team framework map, section 2.
const SEATS: [string, string[]][] = [
  ["Customer advocate", ["How upset?", "Vulnerable person?", "Already failed once?"]],
  ["Rule keeper", ["Asking for what the desk can't grant?", "Legal, regulator, police or press?"]],
  ["Safety officer", ["Person at risk?", "Asking for safety advice?"]],
  ["Sceptic", ["Do the stories contradict?", "A message giving orders to the bot?", "Requester not on record?"]],
  ["Ops pragmatist", ["Deadline within a day?", "Nothing owed right now?"]],
];

export const SceneSeats: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flow = ramp(frame, 200, 240);
  return (
    <Stage>
      <Header kicker="Second opinions" line="Five seats look at every case, in *one call.*" />
      <div style={{ position: "absolute", top: 330, left: 120, right: 120, display: "flex", gap: 22 }}>
        {SEATS.map(([role, qs], i) => {
          const v = sp(frame, fps, 20 + i * 9, 14);
          return (
            <Pop key={role} v={v} dy={80} style={{ flex: 1 }}>
              <div style={{ background: K.panel, borderRadius: 16, border: `1.5px solid ${K.line2}`, padding: "26px 24px", height: 400 }}>
                <div style={{ width: 54, height: 54, borderRadius: 27, background: i === 3 ? K.orange : K.panel2, border: `1.5px solid ${K.line2}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 22, color: i === 3 ? "#140b05" : K.text }}>
                  {i + 1}
                </div>
                <div style={{ fontSize: 31, fontWeight: 650, marginTop: 20 }}>{role}</div>
                <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                  {qs.map((q, k) => (
                    <Pop key={q} v={sp(frame, fps, 50 + i * 9 + k * 7, 16)} dy={14}>
                      <div style={{ fontSize: 24, color: K.muted, lineHeight: 1.3 }}>{q}</div>
                    </Pop>
                  ))}
                </div>
              </div>
            </Pop>
          );
        })}
      </div>
      <div style={{ position: "absolute", top: 790, left: 120, right: 120, display: "flex", alignItems: "center", gap: 26, opacity: flow, transform: `translateY(${(1 - flow) * 30}px)` }}>
        {["12 scores", "thresholds in config", "notes for the planner", "or a person decides"].map((t, i) => (
          <React.Fragment key={t}>
            <div style={{ fontSize: 32, fontWeight: 600, color: i === 3 ? K.orange : K.text }}>{t}</div>
            {i < 3 ? <div style={{ color: K.muted, fontSize: 30 }}>→</div> : null}
          </React.Fragment>
        ))}
      </div>
      <div style={{ position: "absolute", top: 870, left: 120, fontSize: 26, color: K.muted, opacity: ramp(frame, 240, 270) }}>
        Fast judgements from TypeSafe Jev. The rule that sends a red case to a person is enforced in code.
      </div>
    </Stage>
  );
};

// A real decision card: docs/media/case-run-voice.png (case gen-1201).
const OPTIONS = [
  ["Sign off redirect or hold", "The desk emails the Plover Arc Logistics exception desk with your named sign-off, asking it to hold DL-907 or redirect it to the family address before 16:00 UTC on 4 Mar."],
  ["Ask for proof first", "The desk asks Calla on the portal for the death certificate and evidence that she may act for the estate. You decide once these arrive."],
  ["Let return proceed", "No instruction goes to the carrier, so DL-907 returns to the sender at 16:00 UTC on 4 Mar."],
];

export const SceneDecision: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = sp(frame, fps, 30, 16);
  const stamp = sp(frame, fps, 62, 9, 0.5);
  const voice = sp(frame, fps, 300, 14);
  const pulse = 1 + 0.05 * Math.sin((frame - 300) / 4) * (frame > 315 ? 1 : 0);
  return (
    <Stage>
      <Header kicker="When it stops" line="When it should not act alone, it *stops* and hands a person one card." size={52} />
      <div style={{ position: "absolute", left: 220, right: 220, top: 300, transform: `translateY(${(1 - card) * 300}px) scale(${0.94 + 0.06 * card})`, opacity: Math.min(1, card) }}>
        <div style={{ background: K.panel, borderRadius: 20, border: `2px solid ${K.amber}`, padding: "32px 40px", boxShadow: "0 40px 120px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 38, fontWeight: 700 }}>A person needs to decide</div>
            <div style={{ fontSize: 22, color: K.muted, opacity: ramp(frame, 50, 64) }}>
              Asked: <span style={{ color: K.text }}>Rivet Delivery Desk supervisor</span> · within 15 min
            </div>
          </div>
          <div style={{ display: "flex", gap: 18, alignItems: "flex-start", marginTop: 20 }}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 17,
                padding: "6px 10px",
                border: `1.5px solid ${K.amber}`,
                color: K.amber,
                whiteSpace: "nowrap",
                transform: `scale(${1.6 - 0.6 * Math.min(1, stamp)}) rotate(${(1 - Math.min(1, stamp)) * -8}deg)`,
                opacity: Math.min(1, stamp),
              }}
            >
              AGENT JUDGED UNSAFE
            </div>
            <div style={{ fontSize: 27, lineHeight: 1.4 }}>
              <Typed text="The recipient is reported deceased and his daughter asks to redirect or cancel his parcel: a bereavement exception that only a named supervisor can sign off." a={70} b={140} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 18, marginTop: 28 }}>
            {OPTIONS.map(([t, d], i) => {
              const v = sp(frame, fps, 150 + i * 16, 14);
              const badge = sp(frame, fps, 170 + i * 16, 9, 0.5);
              return (
                <Pop key={t} v={v} dy={60} style={{ flex: 1 }}>
                  <div style={{ background: K.panel2, borderRadius: 14, border: `1.5px solid ${K.line2}`, padding: "22px 22px", height: 270 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <div style={{ fontSize: 27, fontWeight: 650 }}>{t}</div>
                      <div style={{ fontFamily: MONO, fontSize: 14, color: K.red, border: `1.2px solid ${K.red}`, padding: "3px 7px", whiteSpace: "nowrap", transform: `scale(${Math.min(1, badge)})` }}>CAN'T UNDO</div>
                    </div>
                    <div style={{ fontSize: 21, color: K.muted, marginTop: 12, lineHeight: 1.4 }}>{d}</div>
                  </div>
                </Pop>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 220, right: 220, top: 920, display: "flex", alignItems: "center", gap: 26, opacity: Math.min(1, voice), transform: `translateY(${(1 - voice) * 30}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 26px", borderRadius: 12, background: K.orange, color: "#140b05", fontSize: 28, fontWeight: 650, transform: `scale(${pulse})` }}>
          <svg width={22} height={26} viewBox="0 0 22 26"><rect x={6} y={1} width={10} height={16} rx={5} fill="#140b05" /><path d="M2 12a9 9 0 0 0 18 0M11 21v4" stroke="#140b05" strokeWidth={2.4} fill="none" /></svg>
          Approve by voice
        </div>
        <div style={{ fontSize: 26, color: K.muted }}>The desk manager can decide on a call. Voice lives in the console; it is never in the scored run.</div>
      </div>
      <div style={{ position: "absolute", left: 220, top: 255, opacity: ramp(frame, 230, 250) }}>
        <Kinetic text="Each option says what happens, and whether it can be undone." at={230} size={28} weight={500} color={K.muted} />
      </div>
    </Stage>
  );
};
