"use client";

import gsap from "gsap";
import { useEffect } from "react";
import { on, story } from "@/components/experience/story";
import { CHAPTERS } from "@/lib/content";
import { pauseSound, playSound, setMotion, unlockSound, type SoundName } from "./engine";

/** Gestes qui autorisent le son (règle des navigateurs) ; le défilement n'en fait pas partie. */
const GESTURES = ["pointerdown", "keydown", "touchend"] as const;
const INTERACTIVE = "a[href], button, summary";
const CONFIRM = ".button--primary, .contact__cta, .service__cta, .site-header .button--small";
/** Vitesse Lenis (px par image) qui donne le souffle maximal. */
const MAX_SPEED = 70;

/** Position stéréo d'un point de l'écran, atténuée pour rester naturelle. */
const panAt = (x: number) => ((x / window.innerWidth) * 2 - 1) * 0.6;

/**
 * Branche les sons sur le site : survols et clics (délégués), chapitres de l'histoire,
 * ouverture des questions de la FAQ, souffle qui suit la vitesse de défilement.
 * Les sections propres (prestations, archive, pathologies) appellent playSound directement.
 */
export function SoundDirector() {
  useEffect(() => {
    const unlock = (event: Event) => {
      // Le bouton son gère lui-même son premier clic (sinon il activerait puis couperait aussitôt).
      if ((event.target as Element | null)?.closest?.(".sound-toggle")) return;
      unlockSound();
    };
    GESTURES.forEach((type) => window.addEventListener(type, unlock, { capture: true, passive: true }));

    // Survol : seulement si c'est la souris qui a bougé, pas la page qui défile sous un pointeur immobile.
    let scrollAtMove = Number.NaN;
    let hovered: Element | null = null;
    const onMove = () => {
      scrollAtMove = window.scrollY;
    };
    const onOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const target = (event.target as Element).closest?.(INTERACTIVE) ?? null;
      if (target === hovered) return;
      hovered = target;
      if (!target || window.scrollY !== scrollAtMove || target.closest("[data-sound='none']")) return;
      playSound("hover", { pan: panAt(event.clientX), variant: target.matches("nav a, .hud__chapter, .archive__link") ? 1 : 0 });
    };

    const onClick = (event: MouseEvent) => {
      const target = (event.target as Element).closest?.("a[href], button");
      if (!target) return;
      const custom = target.getAttribute("data-sound");
      if (custom === "none") return;
      const name = (custom ?? (target.matches(CONFIRM) ? "confirm" : "click")) as SoundName;
      const variant = custom === "switch" && document.documentElement.dataset.theme === "light" ? 1 : 0;
      playSound(name, { pan: panAt(event.clientX || window.innerWidth / 2), variant });
    };

    // "toggle" ne remonte pas : écouté en phase de capture.
    const onToggle = (event: Event) => {
      if (event.target instanceof HTMLDetailsElement) playSound(event.target.open ? "open" : "close");
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("click", onClick);
    document.addEventListener("toggle", onToggle, true);

    // Chaque chapitre a sa note (elle monte avec l'histoire), placée du côté du texte.
    // Le premier défilement annonce le chapitre 0 où l'on se trouve déjà : seul un vrai changement sonne.
    let chapter = 0;
    const offChapter = on("chapter", (index) => {
      if (index === chapter) return;
      chapter = index;
      playSound("chapter", { index, pan: CHAPTERS[index].align === "left" ? -0.35 : 0.35 });
    });

    let lastY = window.scrollY;
    const tick = () => {
      const y = window.scrollY;
      const velocity = story.lenis ? story.lenis.velocity : y - lastY;
      lastY = y;
      setMotion(velocity / MAX_SPEED);
    };
    gsap.ticker.add(tick);

    const onVisibility = () => pauseSound(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      GESTURES.forEach((type) => window.removeEventListener(type, unlock, { capture: true }));
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("click", onClick);
      document.removeEventListener("toggle", onToggle, true);
      document.removeEventListener("visibilitychange", onVisibility);
      gsap.ticker.remove(tick);
      offChapter();
    };
  }, []);

  return null;
}
