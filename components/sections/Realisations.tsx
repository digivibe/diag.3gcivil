"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { story } from "@/components/experience/story";
import { archiveState } from "@/components/stage/state";
import { REALISATIONS, REPERTOIRE } from "@/lib/content";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const ArchiveScene = dynamic(() => import("@/components/archive/ArchiveScene"), { ssr: false });

const TOTAL = REPERTOIRE.reduce((sum, group) => sum + group.items.length, 0);
const ENTRIES = REPERTOIRE.flatMap((group) => group.items.map((text) => ({ text, category: group.id, label: group.label })));
/** Missions affichées avant "Voir les autres" (par filtre). */
const PREVIEW = 6;

/** Mesures prises juste avant un changement du répertoire, pour animer ou ancrer le résultat. */
type Snapshot = { height: number; buttonTop: number | null; reveal: "filter" | "expand" | "collapse" };

/** Défilement instantané, synchronisé avec Lenis s'il est actif. */
function jumpTo(y: number) {
  if (story.lenis) story.lenis.scrollTo(y, { immediate: true, force: true });
  else window.scrollTo(0, y);
}

/**
 * Réalisations : archive 3D de dossiers feuilletés au scroll (section épinglée),
 * puis répertoire complet des missions, filtrable par catégorie.
 */
export function Realisations() {
  const root = useRef<HTMLElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const more = useRef<HTMLButtonElement>(null);
  const snapshot = useRef<Snapshot | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState(false);

  const matching = ENTRIES.filter((entry) => filter === "all" || entry.category === filter);
  const shown = new Set((expanded ? matching : matching.slice(0, PREVIEW)).map((entry) => entry.text));
  const remaining = matching.length - PREVIEW;

  const capture = (reveal: Snapshot["reveal"]) => {
    snapshot.current = {
      height: list.current?.offsetHeight ?? 0,
      buttonTop: more.current?.getBoundingClientRect().top ?? null,
      reveal,
    };
  };
  const chooseFilter = (id: string) => {
    if (id === filter) return;
    capture("filter");
    setFilter(id);
  };
  const toggleExpanded = () => {
    capture(expanded ? "collapse" : "expand");
    setExpanded(!expanded);
  };

  useGSAP(
    () => {
      const section = root.current!;
      const dossiers = gsap.utils.toArray<HTMLElement>(".dossier", section);
      const links = gsap.utils.toArray<HTMLElement>(".archive__link", section);
      const counter = section.querySelector<HTMLElement>(".archive__current");
      const last = REALISATIONS.length - 1;
      let active = -1;

      const apply = (progress: number, velocity = 0) => {
        archiveState.t = progress * last;
        archiveState.velocity = gsap.utils.clamp(-1, 1, velocity / 4000);
        const index = Math.round(archiveState.t);
        if (index === active) return;
        active = index;
        dossiers.forEach((dossier, i) => dossier.classList.toggle("is-active", i === index));
        links.forEach((link, i) => link.setAttribute("aria-current", i === index ? "true" : "false"));
        if (counter) counter.textContent = String(index + 1).padStart(2, "0");
      };

      // Épinglage CSS (position: sticky) dans .archive__scroll ; ScrollTrigger ne fait que lire la progression.
      const trigger = ScrollTrigger.create({
        trigger: section.querySelector(".archive__scroll"),
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => apply(self.progress, self.getVelocity()),
        onRefresh: (self) => apply(self.progress),
        onLeave: () => {
          archiveState.velocity = 0;
        },
      });
      apply(trigger.progress);

      const cleanups = links.map((link, i) => {
        const go = () => {
          const y = trigger.start + (i / last) * (trigger.end - trigger.start) + 1;
          if (story.lenis) story.lenis.scrollTo(y, { duration: 1.4 });
          else window.scrollTo({ top: y, behavior: story.reducedMotion ? "auto" : "smooth" });
        };
        link.addEventListener("click", go);
        return () => link.removeEventListener("click", go);
      });

      // Répertoire : compteur et entrées révélés à l'arrivée dans la vue.
      const count = section.querySelector<HTMLElement>(".repertoire__total");
      if (count && !story.reducedMotion) {
        const state = { value: 0 };
        gsap.to(state, {
          value: TOTAL,
          duration: 1.6,
          ease: "power3.out",
          scrollTrigger: { trigger: count, start: "top 85%" },
          onUpdate: () => {
            count.textContent = String(Math.round(state.value));
          },
        });
      }
      return () => cleanups.forEach((cleanup) => cleanup());
    },
    { scope: root },
  );

  // Après un changement de filtre ou un dépliage (rendu, avant affichage) : la hauteur de la liste part
  // de l'ancienne et les entrées qui apparaissent arrivent en cascade. Au repli, le bouton reste sous le pointeur.
  useGSAP(
    () => {
      const before = snapshot.current;
      const el = list.current;
      snapshot.current = null;
      if (!before || !el) return;
      gsap.killTweensOf(el);
      gsap.set(el, { clearProps: "height,overflow" });
      const items = gsap.utils.toArray<HTMLElement>(".repertoire__item:not([hidden])", el);

      if (before.reveal === "collapse") {
        // La liste raccourcit au-dessus du bouton : le défilement est compensé pour qu'il ne saute pas.
        const top = more.current?.getBoundingClientRect().top;
        if (before.buttonTop !== null && top !== undefined) jumpTo(window.scrollY + top - before.buttonTop);
        if (!story.reducedMotion) gsap.fromTo(items, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45, ease: "power2.out", overwrite: true });
        return;
      }
      if (story.reducedMotion) return;

      const entering = before.reveal === "expand" ? items.slice(PREVIEW) : items;
      gsap.fromTo(
        el,
        { height: before.height, overflow: "hidden" },
        { height: el.offsetHeight, duration: 0.7, ease: "power3.inOut", clearProps: "height,overflow" },
      );
      gsap.fromTo(entering, { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: "power3.out", stagger: 0.03, overwrite: true });
    },
    { scope: root, dependencies: [filter, expanded] },
  );

  return (
    <section id="realisations" ref={root} className="archive" aria-labelledby="realisations-title">
      <div className="archive__scroll" style={{ height: `${100 + (REALISATIONS.length - 1) * 85}svh` }}>
        <div className="archive__pin">
          <div className="archive__stage">
            <ArchiveScene className="stage-canvas archive__canvas" />
          </div>
          <div className="archive__panel">
            <header className="archive__head">
              <p className="eyebrow">La rigueur, l’expertise et l’innovation</p>
              <h2 id="realisations-title" className="section__title archive__title">
                Nos réalisations
              </h2>
            </header>
            <div className="archive__dossiers">
              {REALISATIONS.map((item, i) => (
                <article key={item.code} className={`dossier${i === 0 ? " is-active" : ""}`}>
                  <p className="dossier__meta">
                    <span className="dossier__code">{item.code}</span>
                    <span>{item.place}</span>
                  </p>
                  <h3 className="dossier__title">{item.title}</h3>
                  <p className="dossier__client">{item.client}</p>
                  <ul className="dossier__missions">
                    {item.missions.map((mission) => (
                      <li key={mission}>{mission}</li>
                    ))}
                  </ul>
                  <ul className="dossier__tags">
                    {item.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
          <nav className="archive__index" aria-label="Dossiers">
            <p className="archive__counter" aria-hidden="true">
              <span className="archive__current">01</span> / {String(REALISATIONS.length).padStart(2, "0")}
            </p>
            <ol>
              {REALISATIONS.map((item, i) => (
                <li key={item.code}>
                  <button type="button" className="archive__link" aria-current={i === 0 ? "true" : "false"}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {item.place}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </div>

      <div className="repertoire">
        <header className="repertoire__head">
          <p className="eyebrow">Répertoire des missions</p>
          <h3 className="repertoire__title">Autres réalisations</h3>
          <p className="repertoire__count">
            <span className="repertoire__total">{TOTAL}</span> missions répertoriées, de la copropriété parisienne aux
            ouvrages sensibles.
          </p>
        </header>
        <div className="repertoire__filters" role="group" aria-label="Filtrer par catégorie">
          {[{ id: "all", label: "Toutes", count: TOTAL }, ...REPERTOIRE.map((g) => ({ id: g.id, label: g.label, count: g.items.length }))].map(
            (option) => (
              <button
                key={option.id}
                type="button"
                className="repertoire__filter"
                aria-pressed={filter === option.id}
                onClick={() => chooseFilter(option.id)}
              >
                {option.label} <span>{option.count}</span>
              </button>
            ),
          )}
        </div>
        <ol ref={list} id="repertoire-list" className="repertoire__list">
          {ENTRIES.map((entry, i) => (
            <li key={entry.text} className="repertoire__item" hidden={!shown.has(entry.text)}>
              <span className="repertoire__index">{String(i + 1).padStart(2, "0")}</span>
              <p className="repertoire__text">{entry.text}</p>
              <span className="repertoire__category">{entry.label}</span>
            </li>
          ))}
        </ol>
        {remaining > 0 && (
          <button
            ref={more}
            type="button"
            className="button button--ghost repertoire__more"
            aria-expanded={expanded}
            aria-controls="repertoire-list"
            onClick={toggleExpanded}
          >
            {expanded ? "Réduire la liste" : `Voir les ${remaining} autres missions`}
            <span className="repertoire__more-icon" aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
