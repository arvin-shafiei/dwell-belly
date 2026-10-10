"use client";
// The 3D city. Each module is independent and wrapped so one failure can't break the scene.
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, PerformanceMonitor, Stats } from "@react-three/drei";
import { Suspense, useState } from "react";
import { ModuleBoundary } from "./ModuleBoundary";
import { installLogDepthPatch } from "./logDepthPatch";

installLogDepthPatch();
import Ground from "./modules/Ground";
import Roads from "./modules/Roads";
import Buildings from "./modules/Buildings";
import Landmarks from "./modules/Landmarks";
import Docks from "./modules/Docks";
import Countryside from "./modules/Countryside";
import Depot from "./modules/Depot";
import Suburbs from "./modules/Suburbs";
import Traffic from "./modules/Traffic";
import TrafficLights from "./modules/TrafficLights";
import DeliveryFleet from "./modules/DeliveryFleet";
import Crashes from "./modules/Crashes";
import Responders from "./modules/Responders";
import Roadworks from "./modules/Roadworks";
import Sky from "./modules/Sky";
import CameraRig from "./modules/CameraRig";
import WorkflowDriver from "./modules/WorkflowDriver";
import Life from "./modules/Life";
import Transit from "./modules/Transit";
import Scenarios from "./modules/Scenarios";
import Airport from "./modules/Airport";
// Layer 2
import Motorway from "./modules/Motorway";
import River from "./modules/River";
import ContainerTerminal from "./modules/ContainerTerminal";
import Industrial from "./modules/Industrial";
import Southbank from "./modules/Southbank";
import OldTown from "./modules/OldTown";
import Shoreditch from "./modules/Shoreditch";
import Hampstead from "./modules/Hampstead";
import Rail from "./modules/Rail";
import Crowds from "./modules/Crowds";
import Streetscape from "./modules/Streetscape";
import Construction from "./modules/Construction";
import Chases from "./modules/Chases";

const MODULES = {
  Sky, Ground, Roads, Buildings, Landmarks, Docks, Countryside, Depot, Suburbs, Airport,
  Traffic, Transit, TrafficLights, DeliveryFleet, Crashes, Responders, Roadworks, Scenarios, Life, CameraRig, WorkflowDriver,
  Motorway, River, ContainerTerminal, Industrial, Southbank, OldTown, Shoreditch, Hampstead, Rail, Crowds, Streetscape, Construction, Chases,
};

export default function World() {
  // GPU first: ask for the discrete/high-performance GPU (on Macs Chrome runs WebGL on Metal via ANGLE),
  // and drop resolution automatically if frame rate falls, instead of burning CPU/GPU.
  const [dpr, setDpr] = useState(1.5);
  // ?stats=1 shows FPS / frame time (click the panel to cycle FPS, ms, MB).
  const [showStats] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("stats"));
  return (
    <Canvas
      shadows
      dpr={dpr}
      camera={{ position: [0, 260, 320], fov: 45, near: 1, far: 4000 }}
      gl={{ antialias: true, powerPreference: "high-performance", stencil: false, logarithmicDepthBuffer: true }}
    >
      <PerformanceMonitor onIncline={() => setDpr(Math.min(2, window.devicePixelRatio))} onDecline={() => setDpr(1)} />
      <AdaptiveDpr pixelated />
      {showStats && <Stats className="!left-auto !right-2 !top-16" />}
      <color attach="background" args={["#a9c7e8"]} />
      {/* Fallback light so the scene is visible even before Sky is implemented. Sky may add more. */}
      <hemisphereLight args={["#ffffff", "#556655", 0.6]} />
      {Object.entries(MODULES).map(([name, M]) => (
        <ModuleBoundary key={name} name={name}>
          <Suspense fallback={null}>
            <M />
          </Suspense>
        </ModuleBoundary>
      ))}
    </Canvas>
  );
}
