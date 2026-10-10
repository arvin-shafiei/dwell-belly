"use client";
// Module: Airport. "London Rivet City Airport" in the north-west zone: runway 09/27 with sequenced approach
// lights, terminal, tower, cargo sheds, fire station; 5 airliners flying a land -> gate -> depart loop on one
// runway lock; emergency landings and plane crashes with a full incident lifecycle (we own it end to end).
// Logic lives in ./Airport/*.ts (tested); this file wires it to the store, bus and the renderers.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { emit, on } from "../bus";
import { nextId } from "../registry";
import { blockedSet, useWorld } from "../store";
import Crew from "./Airport/Crew";
import Effects from "./Airport/Effects";
import Planes from "./Airport/Planes";
import Scenery from "./Airport/Scenery";
import { AirportSim, type SimEffects } from "./Airport/sim";

const effects: SimEffects = {
  addIncident: (i) => useWorld.getState().addIncident(i),
  updateIncident: (id, patch) => useWorld.getState().updateIncident(id, patch),
  blockEdge: (key, reason) => useWorld.getState().blockEdge(key, reason),
  unblockEdge: (key) => useWorld.getState().unblockEdge(key),
  emit,
  blocked: () => blockedSet(),
  newId: () => nextId("INC"),
  now: () => performance.now(),
};

export default function Airport() {
  const sim = useMemo(() => new AirportSim(effects), []);

  useEffect(
    () =>
      on((e) => {
        if (e.type === "request:plane") sim.request(e.kind);
      }),
    [sim],
  );

  // Leaving the page mid-incident: don't leave a road closed behind us.
  useEffect(
    () => () => {
      const c = sim.crash;
      if (c?.incidentId) {
        useWorld.getState().unblockEdge(c.edge);
        useWorld.getState().updateIncident(c.incidentId, { status: "cleared" });
      }
      if (sim.emergency) useWorld.getState().updateIncident(sim.emergency.incidentId, { status: "cleared" });
    },
    [sim],
  );

  useFrame((_, delta) => {
    if (useWorld.getState().paused) return;
    sim.step(Math.min(delta, 0.1));
  });

  return (
    <group name="airport">
      <Scenery />
      <Planes sim={sim} />
      <Crew sim={sim} />
      <Effects sim={sim} />
    </group>
  );
}
