"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { groundShader } from "@/components/experience/shaders/materials";
import { uniforms } from "@/components/experience/uniforms";

/** Sol technique (même trame que la scène principale), au niveau 0 des spécimens. */
export function StageGround({ y = 0 }: { y?: number }) {
  const material = useMemo(() => new THREE.ShaderMaterial({ ...groundShader, uniforms }), []);
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, y, 0]} material={material}>
      <planeGeometry args={[160, 160]} />
    </mesh>
  );
}
