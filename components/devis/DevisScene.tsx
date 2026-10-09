"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { adoptModel } from "@/components/prestations/parts";
import { createSpecimenMaterial, type SpecimenVariant } from "@/components/stage/shaders";
import { StageCanvas, useStagePointer } from "@/components/stage/StageCanvas";
import { StageGround } from "@/components/stage/StageGround";
import { devisState, devisUniforms } from "./state";

/** Immeuble, hall et trajectoire caméra modélisés dans Blender : scripts/blender/devis_building.py (npm run devis:build). */
const MODEL = "/models/devis_building.glb";

/** Matériaux du site, attribués d'après le nom des matériaux Blender (couleurs sombre / clair). */
function createMaterials() {
  const dissolve = { value: 0 };
  const make = (variant: SpecimenVariant, color: string, colorLight: string, uniforms?: Record<string, THREE.IUniform>) =>
    createSpecimenMaterial(variant, { color, colorLight, dissolve, uniforms });
  const materials = {
    stone: make("stone", "#b9b1a3", "#ece6da", { uRustic: { value: 0 } }),
    stone_base: make("stone", "#a9a193", "#e2dbcd", { uRustic: { value: 1 } }),
    window: make("window", "#0b1220", "#9fb4c8", { uLights: devisUniforms.uLights }),
    frame: make("steel", "#20252c", "#3a414b"),
    railing: make("steel", "#15181d", "#2a2f36"),
    roof: make("steel", "#4f5b68", "#7b8794"),
    door: make("steel", "#173a35", "#1f4d46"),
    brass: make("steel", "#9c7a3c", "#b8924a"),
    floor: make("floor", "#8e8a83", "#e9e6e0"),
    wall_in: make("plain", "#a8a39a", "#efebe3"),
    board: make("board", "#0c1a33", "#dfe8f4"),
    lamp: make("plain", "#ffd9a0", "#fff1d6"),
    pavement: make("plain", "#3a3d43", "#c9ccd1"),
  };
  materials.lamp.uniforms.uEmissive.value = 2.4;
  materials.brass.uniforms.uEmissive.value = 0.15;
  return materials;
}

function createRig(scene: THREE.Object3D, animations: THREE.AnimationClip[], materials: ReturnType<typeof createMaterials>) {
  const model = adoptModel(scene, materials, materials.stone);
  const source = model.getObjectByProperty("isPerspectiveCamera", true) as THREE.PerspectiveCamera;
  // Caméra et vantaux : trois pistes sur la même timeline (0 → 190 frames), avancées ensemble.
  const mixer = new THREE.AnimationMixer(model);
  const actions = animations.map((clip) => {
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    action.paused = true;
    return action;
  });
  const duration = Math.max(...animations.map((clip) => clip.duration));
  return { model, source, mixer, actions, duration };
}

function Building({ onReady }: { onReady: () => void }) {
  const gltf = useGLTF(MODEL);
  const pointer = useStagePointer();
  const materials = useMemo(() => createMaterials(), []);
  const rig = useMemo(() => createRig(gltf.scene, gltf.animations, materials), [gltf, materials]);
  const look = useRef(new THREE.Vector2());
  const frames = useRef(0);

  useEffect(
    () => () => {
      rig.mixer.stopAllAction();
      Object.values(materials).forEach((material) => material.dispose());
    },
    [rig, materials],
  );

  useFrame((state, delta) => {
    const { model, source, mixer, actions, duration } = rig;
    const time = THREE.MathUtils.clamp(devisState.p, 0, 1) * (duration - 1e-4);
    actions.forEach((action) => {
      action.time = time;
    });
    mixer.update(0);
    model.updateMatrixWorld(true);

    const camera = state.camera as THREE.PerspectiveCamera;
    source.getWorldPosition(camera.position);
    source.getWorldQuaternion(camera.quaternion);
    // Légère parallaxe au pointeur, et respiration lente.
    const dt = Math.min(delta, 1 / 20);
    look.current.x = THREE.MathUtils.damp(look.current.x, pointer.inside ? pointer.x : 0, 2.5, dt);
    look.current.y = THREE.MathUtils.damp(look.current.y, pointer.inside ? pointer.y : 0, 2.5, dt);
    camera.rotateY(-look.current.x * 0.025 + Math.sin(state.clock.elapsedTime * 0.2) * 0.006);
    camera.rotateX(look.current.y * 0.018);

    // Écran portrait : champ élargi pour garder la façade, puis le hall, dans l'image.
    const { width, height } = state.size;
    const portrait = THREE.MathUtils.clamp((1.1 - width / height) / 0.6, 0, 1);
    const fov = THREE.MathUtils.lerp(source.fov, 64, portrait);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    devisUniforms.uLights.value = devisState.lights;
    frames.current += 1;
    if (frames.current === 3) onReady();
  });

  return <primitive object={rig.model} />;
}

/** Scène de la demande : rue, porte cochère, hall. Montée à l'ouverture du formulaire seulement. */
export default function DevisScene({ onReady }: { onReady: () => void }) {
  return (
    <StageCanvas className="devis__canvas" camera={{ position: [7.5, 1.7, 33], fov: 40 }} modal>
      <StageGround y={-0.15} />
      <Building onReady={onReady} />
    </StageCanvas>
  );
}

// Importer ce module (au survol d'un bouton "Demander un diagnostic") précharge déjà le modèle.
useGLTF.preload(MODEL);
