"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { createStructure, samplePointCloud } from "./geometry";
import { concreteShader, edgesShader, pointsShader, rebarShader, shellShader } from "./shaders/materials";
import { currentTheme, on, story, type Theme } from "./story";
import { TOP, applyThemeUniforms, uniforms } from "./uniforms";

const translucent = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } as const;

/** Thème sombre : couches translucides additives (bloom) ; thème clair : alpha classique. */
function applyTheme(materials: THREE.ShaderMaterial[], theme: Theme) {
  applyThemeUniforms(theme);
  const blending = theme === "light" ? THREE.NormalBlending : THREE.AdditiveBlending;
  materials.forEach((material) => {
    material.blending = blending;
  });
}

function createScene() {
  const { concrete, edges, rebar } = createStructure();
  const points = samplePointCloud(concrete, story.isMobile ? 32000 : 64000);
  const materials = {
    concreteCut: new THREE.ShaderMaterial({
      ...concreteShader(true),
      uniforms,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
    concrete: new THREE.ShaderMaterial({
      ...concreteShader(false),
      uniforms,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
    rebar: new THREE.ShaderMaterial({ ...rebarShader, uniforms }),
    shell: new THREE.ShaderMaterial({ ...shellShader, uniforms, side: THREE.DoubleSide, ...translucent }),
    edges: new THREE.ShaderMaterial({ ...edgesShader, uniforms, ...translucent }),
    points: new THREE.ShaderMaterial({ ...pointsShader, uniforms, ...translucent }),
  };
  return { geometries: { concrete, edges, rebar, points }, materials };
}

type Layers = Record<"concreteCut" | "concrete" | "rebar" | "shell" | "points", THREE.Object3D | null>;

/** Ossature béton armé : béton, enveloppe rayons X, arêtes, armatures et nuage de points. */
export function Structure() {
  const { geometries, materials } = useMemo(() => createScene(), []);
  const layers = useRef<Layers>({ concreteCut: null, concrete: null, rebar: null, shell: null, points: null });

  useEffect(() => {
    const translucentMaterials = [materials.shell, materials.edges, materials.points];
    applyTheme(translucentMaterials, currentTheme());
    return on("theme", (theme) => applyTheme(translucentMaterials, theme));
  }, [materials]);

  useEffect(
    () => () => {
      Object.values(geometries).forEach((geometry) => geometry.dispose());
      Object.values(materials).forEach((material) => material.dispose());
    },
    [geometries, materials],
  );

  // Chaque couche n'est dessinée que lorsqu'elle contribue à l'image.
  useFrame(() => {
    const { concreteCut, concrete, rebar, shell, points } = layers.current;
    const scanning = story.solid < 0.999 || story.xray > 0.001 || story.lens > 0.001;
    const xray = story.xray > 0.001 || story.lens > 0.001;
    if (concreteCut) concreteCut.visible = scanning;
    if (concrete) concrete.visible = !scanning;
    if (rebar) rebar.visible = xray;
    if (shell) shell.visible = xray;
    if (points) points.visible = story.solid < 0.999;
  });

  return (
    <group>
      <mesh
        ref={(mesh) => {
          layers.current.concreteCut = mesh;
        }}
        geometry={geometries.concrete}
        material={materials.concreteCut}
        frustumCulled={false}
      />
      <mesh
        ref={(mesh) => {
          layers.current.concrete = mesh;
        }}
        geometry={geometries.concrete}
        material={materials.concrete}
        frustumCulled={false}
        visible={false}
      />
      <mesh
        ref={(mesh) => {
          layers.current.rebar = mesh;
        }}
        geometry={geometries.rebar}
        material={materials.rebar}
        frustumCulled={false}
        visible={false}
      />
      <mesh
        ref={(mesh) => {
          layers.current.shell = mesh;
        }}
        geometry={geometries.concrete}
        material={materials.shell}
        frustumCulled={false}
        renderOrder={2}
        visible={false}
      />
      <lineSegments geometry={geometries.edges} material={materials.edges} frustumCulled={false} renderOrder={3} />
      <points
        ref={(cloud) => {
          layers.current.points = cloud;
        }}
        geometry={geometries.points}
        material={materials.points}
        frustumCulled={false}
        renderOrder={4}
      />
    </group>
  );
}

/** Recopie l'état du scroll dans les uniforms partagés, une fois par frame. */
export function StoryDriver() {
  const gl = useThree((state) => state.gl);

  useFrame((_, delta) => {
    uniforms.uTime.value += Math.min(delta, 1 / 20);
    uniforms.uIntro.value = story.intro;
    uniforms.uSolidY.value = THREE.MathUtils.lerp(-1, TOP + 1.8, story.solid);
    uniforms.uXrayY.value = THREE.MathUtils.lerp(TOP + 3, -1, story.xray);
    uniforms.uLens.value = story.lens;
    uniforms.uCorrosion.value = story.corrosion;
    uniforms.uRepair.value = story.repair;
    uniforms.uFem.value = story.fem;
    uniforms.uExplode.value = story.explode;
    uniforms.uPixelRatio.value = gl.getPixelRatio();
  });

  return null;
}
