"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { groundShader } from "./shaders/materials";
import { uniforms } from "./uniforms";

export function Ground() {
  const material = useMemo(() => new THREE.ShaderMaterial({ ...groundShader, uniforms }), []);
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.61, 0]} material={material} frustumCulled={false}>
      <planeGeometry args={[420, 420]} />
    </mesh>
  );
}
