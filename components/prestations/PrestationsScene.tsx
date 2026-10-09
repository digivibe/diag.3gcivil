"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { currentTheme, on } from "@/components/experience/story";
import { applyTranslucentTheme } from "@/components/stage/shaders";
import { StageCanvas, useStageLabels, useStagePointer } from "@/components/stage/StageCanvas";
import { StageGround } from "@/components/stage/StageGround";
import { prestationsState, segmentProgress, segmentVisibility, smoothstep } from "@/components/stage/state";
import { createBeamSpecimen } from "./BeamSpecimen";
import { createCoreSpecimen } from "./CoreSpecimen";
import { createDroneSpecimen } from "./DroneSpecimen";
import { createOpeningSpecimen } from "./OpeningSpecimen";
import type { Specimen, StageAssets } from "./parts";

/** Assets modélisés et animés dans Blender : scripts/blender/stage_assets.py (npm run assets:build). */
const MODELS = { drone: "/models/drone.glb", heb: "/models/heb.glb", camera: "/models/stage_camera.glb" };

const FACTORIES: ((assets: StageAssets) => Specimen)[] = [
  createDroneSpecimen,
  createOpeningSpecimen,
  createCoreSpecimen,
  createBeamSpecimen,
];

function SpecimenView({ index, create, assets }: { index: number; create: (assets: StageAssets) => Specimen; assets: StageAssets }) {
  const labels = useStageLabels();
  const pointer = useStagePointer();
  const specimen = useMemo(() => create(assets), [create, assets]);

  useEffect(() => {
    applyTranslucentTheme(specimen.translucent, currentTheme());
    const off = on("theme", (theme) => applyTranslucentTheme(specimen.translucent, theme));
    return () => {
      off();
      specimen.dispose();
    };
  }, [specimen]);

  useFrame((state, delta) => {
    const t = prestationsState.t;
    specimen.update({
      p: segmentProgress(t, index),
      visibility: segmentVisibility(t, index, FACTORIES.length),
      time: state.clock.elapsedTime,
      delta: Math.min(delta, 1 / 20),
      pointer,
      labels,
    });
  });

  return <primitive object={specimen.root} />;
}

function createCameraRig(scene: THREE.Object3D, animations: THREE.AnimationClip[]) {
  const source = scene.getObjectByProperty("isPerspectiveCamera", true) as THREE.PerspectiveCamera;
  const clip = animations.find((animation) => animation.name === "stage_path") ?? animations[0];
  const mixer = new THREE.AnimationMixer(scene);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  action.paused = true;
  return { scene, source, clip, mixer, action };
}

/**
 * Caméra animée dans Blender (stage_camera.glb), "scrubbée" comme celle de l'histoire :
 * un palier par spécimen, transition autour de chaque changement de prestation.
 */
function StageCamera() {
  const gltf = useGLTF(MODELS.camera);
  const pointer = useStagePointer();
  const rig = useRef<ReturnType<typeof createCameraRig> | null>(null);
  const time = useRef(0);
  const look = useRef(new THREE.Vector2());

  useEffect(() => {
    rig.current = createCameraRig(gltf.scene, gltf.animations);
    return () => {
      rig.current?.mixer.stopAllAction();
      rig.current = null;
    };
  }, [gltf]);

  useFrame((state, delta) => {
    const current = rig.current;
    if (!current) return;
    const dt = Math.min(delta, 1 / 20);
    const t = prestationsState.t;
    let s = 0;
    for (let k = 0; k < FACTORIES.length - 1; k++) s += smoothstep(k + 0.72, k + 1.28, t);
    time.current = THREE.MathUtils.damp(time.current, s / (FACTORIES.length - 1), 4, dt);
    current.action.time = THREE.MathUtils.clamp(time.current, 0, 1) * (current.clip.duration - 1e-4);
    current.mixer.update(0);
    current.scene.updateMatrixWorld(true);
    const camera = state.camera as THREE.PerspectiveCamera;
    current.source.getWorldPosition(camera.position);
    current.source.getWorldQuaternion(camera.quaternion);
    if (camera.fov !== current.source.fov) {
      camera.fov = current.source.fov;
      camera.updateProjectionMatrix();
    }
    // Respiration lente + parallaxe au pointeur.
    look.current.x = THREE.MathUtils.damp(look.current.x, pointer.inside ? pointer.x : 0, 2.5, dt);
    look.current.y = THREE.MathUtils.damp(look.current.y, pointer.inside ? pointer.y : 0, 2.5, dt);
    camera.rotateY(-look.current.x * 0.035 + Math.sin(state.clock.elapsedTime * 0.18) * 0.012);
    camera.rotateX(look.current.y * 0.025);
  });

  return null;
}

function Specimens() {
  const [drone, heb] = useGLTF([MODELS.drone, MODELS.heb]);
  const assets = useMemo<StageAssets>(() => ({ drone: drone.scene, heb: heb.scene }), [drone, heb]);
  return FACTORIES.map((create, index) => <SpecimenView key={index} index={index} create={create} assets={assets} />);
}

export default function PrestationsScene({ className, overlay }: { className?: string; overlay?: ReactNode }) {
  return (
    <StageCanvas className={className} camera={{ position: [9.9, 5.4, 14.6], fov: 32 }} overlay={overlay}>
      <StageCamera />
      <StageGround />
      <Specimens />
    </StageCanvas>
  );
}

useGLTF.preload([MODELS.drone, MODELS.heb, MODELS.camera]);
