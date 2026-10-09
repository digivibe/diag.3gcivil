"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { story } from "./story";

export const CAMERA_PATH_URL = "/models/camera_paths.glb";

function createRig(scene: THREE.Object3D, animations: THREE.AnimationClip[]) {
  const source = scene.getObjectByProperty("isPerspectiveCamera", true) as THREE.PerspectiveCamera;
  const clip = animations.find((animation) => animation.name === "camera_path") ?? animations[0];
  const mixer = new THREE.AnimationMixer(scene);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  action.paused = true;
  return { scene, source, clip, mixer, action };
}

/**
 * Caméra pilotée par l'animation exportée de Blender (scripts/blender/camera_path.py).
 * Le scroll ne "joue" pas l'animation : il fixe son temps, amorti pour donner de l'inertie.
 */
export function CameraRig() {
  const gltf = useGLTF(CAMERA_PATH_URL);
  const rig = useRef<ReturnType<typeof createRig> | null>(null);
  const time = useRef(story.cam);
  const look = useRef(new THREE.Vector2());

  useEffect(() => {
    rig.current = createRig(gltf.scene, gltf.animations);
    return () => {
      rig.current?.mixer.stopAllAction();
      rig.current = null;
    };
  }, [gltf]);

  useFrame((state, delta) => {
    const current = rig.current;
    if (!current) return;
    const camera = state.camera as THREE.PerspectiveCamera;
    const { width, height } = state.size;
    const dt = Math.min(delta, 1 / 20);

    time.current = story.reducedMotion ? story.cam : THREE.MathUtils.damp(time.current, story.cam, 3.2, dt);
    current.action.time = THREE.MathUtils.clamp(time.current, 0, 1) * (current.clip.duration - 1e-4);
    current.mixer.update(0);
    current.scene.updateMatrixWorld(true);
    current.source.getWorldPosition(camera.position);
    current.source.getWorldQuaternion(camera.quaternion);

    // Légère parallaxe au pointeur (désactivée au tactile).
    if (!story.isMobile && !story.reducedMotion) {
      look.current.x = THREE.MathUtils.damp(look.current.x, story.pointer.x, 2.4, dt);
      look.current.y = THREE.MathUtils.damp(look.current.y, story.pointer.y, 2.4, dt);
      camera.rotateY(-look.current.x * 0.028);
      camera.rotateX(-look.current.y * 0.018);
    }

    // Écran portrait : champ plus large et bâtiment remonté au-dessus du texte.
    const portrait = THREE.MathUtils.clamp((1.1 - width / height) / 0.6, 0, 1);
    camera.fov = THREE.MathUtils.lerp(current.source.fov, 56, portrait);
    const shiftX = story.frameX * (1 - portrait);
    const shiftY = 0.14 * portrait;
    camera.setViewOffset(width, height, -shiftX * width, shiftY * height, width, height);

    story.camPos[0] = camera.position.x;
    story.camPos[1] = camera.position.y;
    story.camPos[2] = camera.position.z;
  });

  return null;
}

useGLTF.preload(CAMERA_PATH_URL);
