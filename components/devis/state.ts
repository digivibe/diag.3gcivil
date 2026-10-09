/**
 * État de la scène de la demande de diagnostic, écrit par GSAP (components/devis/Devis.tsx)
 * et lu à chaque image par la scène 3D — même principe que components/experience/story.ts.
 */
export const devisState = {
  /** Position sur l'animation Blender : 0 = rue, ≈ 0,42 = les vantaux s'ouvrent, 1 = hall. */
  p: 0,
  /** Part des fenêtres allumées (0 → 1), dans un ordre aléatoire fixé par le modèle. */
  lights: 0.18,
};

/** Instant (sur p) où les vantaux commencent à s'ouvrir : frame 80 / 190 (scripts/blender/devis_camera_keys.json). */
export const DOOR_OPENS_AT = 80 / 190;

export const devisUniforms = {
  uLights: { value: devisState.lights },
};
