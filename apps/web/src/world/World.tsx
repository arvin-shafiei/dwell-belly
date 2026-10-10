"use client";
// The 3D city. Each module is independent and wrapped so one failure can't break the scene.
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
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

const MODULES = {
  Sky, Ground, Roads, Buildings, Landmarks, Docks, Countryside, Depot, Suburbs,
  Traffic, TrafficLights, DeliveryFleet, Crashes, Responders, Roadworks, Life, CameraRig, WorkflowDriver,
};

export default function World() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 260, 320], fov: 45, near: 1, far: 4000 }}
      gl={{ antialias: true }}
    >
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
