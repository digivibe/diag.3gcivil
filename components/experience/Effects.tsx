"use client";

import { Bloom, EffectComposer, Noise, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import type { Theme } from "./story";

/**
 * Sombre : rendu HDR → bloom sur les émissifs (> 1), tone mapping filmique, vignettage, grain.
 * Clair : pas de bloom (rien n'est émissif), tone mapping neutre pour garder les gris fidèles.
 * Pas de MSAA : trop coûteux sur GPU intégré ; SMAA optionnel sur les écrans basse densité.
 */
export function Effects({ theme, smaa }: { theme: Theme; smaa: boolean }) {
  const dark = theme === "dark";
  return (
    <EffectComposer multisampling={0}>
      {dark ? <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.6} luminanceSmoothing={0.25} radius={0.72} /> : <></>}
      <ToneMapping mode={dark ? ToneMappingMode.ACES_FILMIC : ToneMappingMode.NEUTRAL} />
      <Vignette offset={0.3} darkness={dark ? 0.7 : 0.22} />
      <Noise premultiply blendFunction={BlendFunction.ADD} opacity={dark ? 0.12 : 0.05} />
      {smaa ? <SMAA /> : <></>}
    </EffectComposer>
  );
}
