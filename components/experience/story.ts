import type Lenis from "lenis";
import { CHAPTERS } from "@/lib/content";

/**
 * État partagé entre le DOM (scroll, HUD) et la scène WebGL.
 * Objet mutable volontairement : il est écrit par GSAP et lu à chaque frame,
 * sans passer par React (aucun re-render pendant le scroll).
 */
const hasWindow = typeof window !== "undefined";

export const story = {
  /** Position sur la trajectoire caméra exportée de Blender (0 → 1). */
  cam: 0,
  /** Décalage optique horizontal (fraction de la largeur) pour cadrer le bâtiment à côté du texte. */
  frameX: 0.17,
  intro: 0,
  solid: 0,
  xray: 0,
  lens: 0,
  corrosion: 0,
  labels: 0,
  explode: 0,
  fem: 0,
  repair: 0,
  pointer: { x: 0, y: 0 },
  camPos: [0, 0, 0] as [number, number, number],
  isMobile: hasWindow && (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768),
  reducedMotion: hasWindow && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  lenis: null as Lenis | null,
};

export type StoryState = typeof story;

/** Début de chaque chapitre, en vh depuis le haut de l'histoire. */
export const CHAPTER_STARTS = CHAPTERS.map((_, i) =>
  CHAPTERS.slice(0, i).reduce((sum, ch) => sum + ch.height, 0),
);
export const STORY_HEIGHT = CHAPTERS.reduce((sum, ch) => sum + ch.height, 0);
/** Distance de scroll pilotant la timeline (la dernière section reste à l'écran). */
export const STORY_SCROLL = STORY_HEIGHT - 100;

export type Theme = "dark" | "light";

/** Thème courant, posé sur <html data-theme> par le script d'amorçage du layout. */
export const currentTheme = (): Theme =>
  hasWindow && document.documentElement.dataset.theme === "light" ? "light" : "dark";

type Events = {
  ready: undefined;
  intro: undefined;
  chapter: number;
  phase: "story" | "content";
  theme: Theme;
};
type AnyListener = (payload: unknown) => void;

const listeners = new Map<keyof Events, Set<AnyListener>>();
const sticky = new Map<keyof Events, unknown>();
const STICKY: (keyof Events)[] = ["ready", "intro"];

/** Abonnement ; les évènements "ready" et "intro" sont rejoués aux abonnés tardifs. */
export function on<K extends keyof Events>(type: K, listener: (payload: Events[K]) => void) {
  const set = listeners.get(type) ?? new Set<AnyListener>();
  listeners.set(type, set);
  const wrapped = listener as AnyListener;
  set.add(wrapped);
  if (sticky.has(type)) listener(sticky.get(type) as Events[K]);
  return () => {
    set.delete(wrapped);
  };
}

export function emit<K extends keyof Events>(type: K, payload: Events[K]) {
  if (STICKY.includes(type)) {
    if (sticky.has(type)) return;
    sticky.set(type, payload);
  }
  listeners.get(type)?.forEach((listener) => listener(payload));
}

export function scrollToTarget(target: string | HTMLElement) {
  const element = typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
  if (!element) return;
  if (story.lenis) story.lenis.scrollTo(element, { duration: 2.2 });
  else element.scrollIntoView({ behavior: story.reducedMotion ? "auto" : "smooth" });
}
