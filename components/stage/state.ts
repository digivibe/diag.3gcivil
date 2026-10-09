/**
 * États pilotés par le scroll (GSAP) et lus à chaque frame par les scènes de section.
 * Même principe que components/experience/story.ts : objets mutables, aucun re-render React.
 */
export const prestationsState = {
  /** Progression continue sur les spécimens : 0 → nombre de prestations. */
  t: 0,
};

export const archiveState = {
  /** Dossier courant, en continu : 0 → nombre de dossiers - 1. */
  t: 0,
  /** Vitesse de feuilletage (lissée), pour les déformations. */
  velocity: 0,
};

/** Pointeur normalisé (-1 → 1) relatif à la zone de la scène, mis à jour par StageCanvas. */
export const stagePointer = { x: 0, y: 0, u: 0.5, v: 0.5, inside: false };

/** Visibilité (0 → 1) d'un spécimen sur la progression t : fondu de ±`fade` autour de ses bornes. */
export function segmentVisibility(t: number, index: number, count: number, fade = 0.14) {
  const enter = index === 0 ? 1 : smoothstep(index - fade, index + fade, t);
  const exit = index === count - 1 ? 1 : 1 - smoothstep(index + 1 - fade, index + 1 + fade, t);
  return Math.min(enter, exit);
}

/** Progression locale (0 → 1) à l'intérieur du segment d'un spécimen. */
export function segmentProgress(t: number, index: number) {
  return Math.min(Math.max(t - index, 0), 1);
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const k = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return k * k * (3 - 2 * k);
}

/** Sous-intervalle [a, b] de p remis sur 0 → 1. */
export function phase(p: number, a: number, b: number) {
  return Math.min(Math.max((p - a) / (b - a), 0), 1);
}
