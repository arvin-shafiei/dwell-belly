"use client";
// Module: Chases. The city goes a bit wild:
// - Police pursuits every 90-150 s: a getaway (black saloon, or a stolen Rivet van) bolts at 1.7x the
//   limit, weaving through traffic, mounting kerbs and running reds; 2-3 Battenburg police cars chase it
//   (re-pathing at each junction), with a helicopter overhead (searchlight at night). It ends in a PIT
//   and arrest, a crash (car_crash incident + closed road for Responders), or an escape onto the motorway.
// - Street racers at night: two tuned cars with neon underglow launch from a red light down an avenue.
// - Speed cameras: 6 posts on main roads flash at anything doing over 1.3x the limit.
// Logic: ./Chases/logic.ts (pure, tested), ./Chases/sim.ts (per-frame driver), ./Chases/meshes.ts.
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { ChaseSim } from "./Chases/sim";

export default function Chases() {
  const [sim] = useState(() => new ChaseSim());
  const warned = useRef(false);

  useEffect(() => {
    sim.start();
    // demo hooks for the lead (no HUD buttons): window.__cityChase() / window.__cityRace()
    const w = window as unknown as Record<string, unknown>;
    w.__cityChase = () => sim.triggerChase();
    w.__cityRace = () => sim.triggerRace();
    return () => {
      sim.stop();
      delete w.__cityChase;
      delete w.__cityRace;
    };
  }, [sim]);

  useEffect(() => () => sim.dispose(), [sim]);

  useFrame((_, delta) => {
    try {
      sim.step(delta);
    } catch (err) {
      if (!warned.current) console.warn("[Chases] frame step failed", err);
      warned.current = true;
    }
  });

  return <primitive object={sim.root} />;
}
