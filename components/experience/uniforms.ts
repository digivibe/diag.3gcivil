import * as THREE from "three";
import { HOTSPOTS } from "@/lib/content";
import building from "./building.json";
import type { Theme } from "./story";

/** Palettes de la scène 3D ; les couleurs CSS équivalentes sont dans app/globals.css. */
export const THEMES = {
  dark: {
    background: "#05070d",
    ground: "#070a12",
    scan: "#5fd4ff",
    concrete: "#a6abb3",
    rust: "#6b2a0c",
    rustGlow: "#ff6a1f",
    rustGlowIntensity: 2.2,
    key: 1.15,
    sky: [0.16, 0.19, 0.26],
    groundLight: [0.035, 0.04, 0.055],
    fogDensity: 0.011,
  },
  light: {
    background: "#e2e5ea",
    ground: "#dde1e7",
    scan: "#2337c6",
    concrete: "#e8eaee",
    rust: "#7a3410",
    rustGlow: "#e2531a",
    rustGlowIntensity: 1,
    key: 0.95,
    sky: [0.44, 0.46, 0.5],
    groundLight: [0.2, 0.21, 0.24],
    fogDensity: 0.0085,
  },
} as const;

export const TOP = building.storeys * building.storeyHeight;
/** Écart entre niveaux en vue éclatée (m). */
export const EXPLODE_GAP = 2;

/**
 * Uniforms partagés par référence entre tous les ShaderMaterial :
 * une seule mise à jour par frame pilote l'ensemble de la scène.
 */
export const uniforms = {
  uTime: { value: 0 },
  uIntro: { value: 0 },
  uSolidY: { value: -1 },
  uXrayY: { value: TOP + 3 },
  uLens: { value: 0 },
  uCorrosion: { value: 0 },
  uRepair: { value: 0 },
  uFem: { value: 0 },
  uExplode: { value: 0 },
  uGap: { value: EXPLODE_GAP },
  uHot: { value: HOTSPOTS.map((h) => new THREE.Vector4(h.position[0], h.position[1], h.position[2], h.radius)) },
  uTheme: { value: 0 },
  uScanColor: { value: new THREE.Color() },
  uRustColor: { value: new THREE.Color() },
  uRustGlow: { value: new THREE.Color() },
  uFogColor: { value: new THREE.Color() },
  uFogDensity: { value: 0.011 },
  uKeyDir: { value: new THREE.Vector3(-0.45, 0.75, 0.5).normalize() },
  uKeyColor: { value: new THREE.Color() },
  uSky: { value: new THREE.Color() },
  uGroundLight: { value: new THREE.Color() },
  uConcrete: { value: new THREE.Color() },
  uStoreyH: { value: building.storeyHeight },
  uTop: { value: TOP },
  uPointSize: { value: 26 },
  uPixelRatio: { value: 1 },
  uBaseColor: { value: new THREE.Color() },
};

let lastTick = 0;

/**
 * Fait avancer uTime, partagé par tous les canvas (histoire, prestations, archive).
 * Chaque canvas actif l'appelle à chaque image : le pas suit l'horloge réelle, donc deux canvas
 * dans la même image ne l'accélèrent pas, et uTime continue d'avancer quand l'histoire est coupée.
 */
export function advanceTime() {
  const now = performance.now() / 1000;
  uniforms.uTime.value += Math.min(now - lastTick, 1 / 20);
  lastTick = now;
}

export function applyThemeUniforms(theme: Theme) {
  const t = THEMES[theme];
  uniforms.uTheme.value = theme === "light" ? 1 : 0;
  uniforms.uScanColor.value.set(t.scan);
  uniforms.uRustColor.value.set(t.rust);
  uniforms.uRustGlow.value.set(t.rustGlow).multiplyScalar(t.rustGlowIntensity);
  uniforms.uFogColor.value.set(t.background);
  uniforms.uFogDensity.value = t.fogDensity;
  uniforms.uKeyColor.value.setRGB(t.key, t.key * 0.98, t.key * 0.95);
  uniforms.uSky.value.setRGB(t.sky[0], t.sky[1], t.sky[2]);
  uniforms.uGroundLight.value.setRGB(t.groundLight[0], t.groundLight[1], t.groundLight[2]);
  uniforms.uConcrete.value.set(t.concrete);
  uniforms.uBaseColor.value.set(t.ground);
}

applyThemeUniforms("dark");
