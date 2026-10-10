"use client";
// The 3D city. Each module is independent and wrapped so one failure can't break the scene.
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { Suspense, useState } from "react";
import { ModuleBoundary } from "./ModuleBoundary";
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

const MODULES = {
  Sky, Ground, Roads, Buildings, Landmarks, Docks, Countryside, Depot, Suburbs,
  Traffic, Transit, TrafficLights, DeliveryFleet, Crashes, Responders, Roadworks, Scenarios, Life, CameraRig, WorkflowDriver,
};

export default function World() {
  // GPU first: ask for the discrete/high-performance GPU (on Macs Chrome runs WebGL on Metal via ANGLE),
  // and drop resolution automatically if frame rate falls, instead of burning CPU/GPU.
  const [dpr, setDpr] = useState(1.5);
  return (
    <Canvas
      shadows
      dpr={dpr}
      camera={{ position: [0, 260, 320], fov: 45, near: 1, far: 4000 }}
      gl={{ antialias: true, powerPreference: "high-performance", stencil: false }}
    >
      <PerformanceMonitor onIncline={() => setDpr(Math.min(2, window.devicePixelRatio))} onDecline={() => setDpr(1)} />
      <AdaptiveDpr pixelated />
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
