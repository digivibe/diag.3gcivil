"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import { CameraRig } from "./CameraRig";
import { Effects } from "./Effects";
import { Ground } from "./Ground";
import { HotspotProjector } from "./Hotspots";
import { currentTheme, emit, on, story, type Theme } from "./story";
import { Structure, StoryDriver } from "./Structure";
import { THEMES } from "./uniforms";

/** Signale au loader que les shaders sont compilés et que les premières images sont rendues. */
function ReadySignal() {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 3) emit("ready", undefined);
  });
  return null;
}

/** Coupe la boucle de rendu quand l'histoire 3D n'est plus à l'écran. */
function FrameloopController() {
  const setFrameloop = useThree((state) => state.setFrameloop);
  useEffect(() => on("phase", (phase) => setFrameloop(phase === "story" ? "always" : "never")), [setFrameloop]);
  return null;
}

const MAX_DPR = 1.5;
const MIN_DPR = 0.75;

export default function Scene() {
  const [maxDpr] = useState(() => Math.min(window.devicePixelRatio, MAX_DPR));
  const [dpr, setDpr] = useState(maxDpr);
  // SMAA seulement sur écran basse densité, et abandonné dès que le GPU peine.
  const [smaa, setSmaa] = useState(() => !story.isMobile && window.devicePixelRatio < 1.5);
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => on("theme", setTheme), []);

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
      camera={{ fov: 35, near: 0.1, far: 600, position: [-27, 5, 31] }}
      fallback={<div className="webgl__fallback" />}
    >
      <color attach="background" args={[THEMES[theme].background]} />
      {/* Résolution adaptative : la 3D descend jusqu'à 75 % de la définition sur les GPU modestes. */}
      <PerformanceMonitor
        factor={1}
        flipflops={4}
        onChange={({ factor }) => setDpr(Math.round((MIN_DPR + (maxDpr - MIN_DPR) * factor) * 10) / 10)}
        onDecline={() => setSmaa(false)}
        onFallback={() => setDpr(MIN_DPR)}
      />
      <Suspense fallback={null}>
        <CameraRig />
        <StoryDriver />
        <Structure />
        <Ground />
        <HotspotProjector />
        <Effects theme={theme} smaa={smaa} />
        <ReadySignal />
      </Suspense>
      <FrameloopController />
    </Canvas>
  );
}
