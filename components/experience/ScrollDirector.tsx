"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import { CHAPTERS } from "@/lib/content";
import { CHAPTER_STARTS, STORY_SCROLL, emit, on, story } from "./story";

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

const INITIAL = { cam: 0, frameX: 0.17, solid: 0, xray: 0, lens: 0, corrosion: 0, labels: 0, explode: 0, fem: 0, repair: 0 };

/**
 * Timeline maîtresse, exprimée en vh de scroll : chaque chapitre entre pendant 100 vh
 * (mouvement caméra), puis "tient" le reste de sa hauteur pendant que son effet se joue.
 */
function buildStoryTimeline() {
  Object.assign(story, INITIAL);
  const start = CHAPTER_STARTS;
  const enter = (i: number) => start[i] - 100;
  const hold = (i: number) => CHAPTERS[i].height - 100;
  const cam = (i: number) => i / (CHAPTERS.length - 1);
  const move = { duration: 100, ease: "power2.inOut" };

  const tl = gsap.timeline({ paused: true, defaults: { ease: "none", immediateRender: false } });

  // 01 Inspection : la caméra pivote, puis le béton se matérialise à partir du relevé.
  tl.fromTo(story, { cam: cam(0), frameX: 0.17 }, { cam: cam(1), frameX: -0.17, ...move }, enter(1));
  tl.fromTo(story, { solid: 0 }, { solid: 1, duration: hold(1) }, start[1]);

  // 02 Analyse : le front "rayons X" descend et révèle le ferraillage.
  tl.fromTo(story, { cam: cam(1), frameX: -0.17 }, { cam: cam(2), frameX: 0.17, ...move }, enter(2));
  tl.fromTo(story, { xray: 0 }, { xray: 1, duration: hold(2) }, start[2]);

  // 03 Pathologies : retour au béton, gros plan, corrosion, puis loupes rayons X et étiquettes.
  tl.fromTo(story, { cam: cam(2), frameX: 0.17, xray: 1 }, { cam: cam(3), frameX: 0.15, xray: 0, ...move }, enter(3));
  tl.fromTo(story, { corrosion: 0 }, { corrosion: 1, duration: hold(3) * 0.45 }, start[3]);
  tl.fromTo(story, { lens: 0 }, { lens: 1, duration: hold(3) * 0.4, ease: "power2.out" }, start[3] + hold(3) * 0.3);
  tl.fromTo(story, { labels: 0 }, { labels: 1, duration: hold(3) * 0.45 }, start[3] + hold(3) * 0.4);

  // 04 Modélisation : recul, vue éclatée niveau par niveau, carte d'efforts.
  tl.fromTo(
    story,
    { cam: cam(3), frameX: 0.15, lens: 1, labels: 1 },
    { cam: cam(4), frameX: -0.15, lens: 0, labels: 0, ...move },
    enter(4),
  );
  tl.fromTo(story, { explode: 0 }, { explode: 1, duration: hold(4) * 0.55, ease: "power2.inOut" }, start[4]);
  tl.fromTo(story, { fem: 0 }, { fem: 1, duration: hold(4) * 0.5 }, start[4] + hold(4) * 0.35);

  // 05 Rapport : remontage, puis les pathologies sont "réparées".
  tl.fromTo(
    story,
    { cam: cam(4), frameX: -0.15, explode: 1, fem: 1 },
    { cam: cam(5), frameX: 0.17, explode: 0, fem: 0, ...move },
    enter(5),
  );
  tl.fromTo(story, { repair: 0 }, { repair: 1, duration: hold(5) * 0.8 }, start[5]);

  tl.set({}, {}, STORY_SCROLL);
  return tl;
}

/** Révélations de texte : lignes masquées (SplitText), paragraphes et étiquettes en cascade. */
function revealChapter(section: HTMLElement, trigger: ScrollTrigger.Vars | null) {
  const title = section.querySelector<HTMLElement>("[data-reveal='lines']");
  const fades = section.querySelectorAll<HTMLElement>("[data-reveal='fade']");
  const items = section.querySelectorAll<HTMLElement>("[data-reveal='stagger'] > *");
  const tl = gsap.timeline({ paused: !trigger, scrollTrigger: trigger ?? undefined });
  tl.from(fades, { y: 24, autoAlpha: 0, duration: 0.9, ease: "power3.out", stagger: 0.12 }, 0.1);
  tl.from(items, { y: 16, autoAlpha: 0, duration: 0.6, ease: "power3.out", stagger: 0.06 }, 0.35);
  if (title) {
    SplitText.create(title, {
      type: "lines",
      mask: "lines",
      autoSplit: true,
      // Le tween retourné est tué et recréé à chaque re-découpage (resize, chargement des polices).
      onSplit: (split) => {
        const lines = gsap.from(split.lines, { yPercent: 110, duration: 1.1, ease: "expo.out", stagger: 0.09 });
        tl.add(lines, 0);
        return lines;
      },
    });
  }
  return tl;
}

export function ScrollDirector() {
  useGSAP(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    const root = document.documentElement;
    root.classList.add("is-loading");

    let lenis: Lenis | null = null;
    const raf = (time: number) => lenis?.raf(time * 1000);
    if (!story.reducedMotion) {
      lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, anchors: { offset: 0 }, autoRaf: false });
      lenis.on("scroll", ScrollTrigger.update);
      lenis.stop();
      story.lenis = lenis;
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
    }

    const onPointer = (event: PointerEvent) => {
      story.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      story.pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    let chapter = -1;
    ScrollTrigger.create({
      trigger: "#story",
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      animation: buildStoryTimeline(),
      onUpdate: (self) => {
        const scrolled = self.progress * STORY_SCROLL;
        let current = 0;
        CHAPTER_STARTS.forEach((startVh, i) => {
          if (scrolled >= startVh - 50) current = i;
        });
        if (current !== chapter) {
          chapter = current;
          emit("chapter", current);
        }
      },
      onLeave: () => emit("phase", "content"),
      onEnterBack: () => emit("phase", "story"),
    });

    const sections = gsap.utils.toArray<HTMLElement>("[data-chapter]");
    const heroReveal = story.reducedMotion ? null : revealChapter(sections[0], null);
    if (!story.reducedMotion) {
      sections.slice(1).forEach((section) =>
        revealChapter(section, { trigger: section, start: "top 40%", toggleActions: "play none none reverse" }),
      );
    }

    const offIntro = on("intro", () => {
      root.classList.remove("is-loading");
      lenis?.start();
      heroReveal?.play();
      gsap.to(story, { intro: 1, duration: story.reducedMotion ? 0 : 2.8, ease: "power3.inOut" });
      ScrollTrigger.refresh();
    });

    return () => {
      offIntro();
      window.removeEventListener("pointermove", onPointer);
      gsap.ticker.remove(raf);
      lenis?.destroy();
      story.lenis = null;
    };
  });

  return null;
}
