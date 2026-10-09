"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { useRef } from "react";
import { REALISATIONS } from "@/lib/content";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Réalisations : section épinglée, le scroll vertical fait défiler les projets à l'horizontale. */
export function Realisations() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
        const section = root.current!;
        const track = section.querySelector<HTMLElement>(".realisations__track")!;
        const distance = () => track.scrollWidth - window.innerWidth;
        const slide = gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: true,
            invalidateOnRefresh: true,
          },
        });
        gsap.utils.toArray<HTMLElement>(".realisation", section).forEach((card) => {
          gsap.fromTo(
            card.querySelector(".realisation__image img"),
            { xPercent: -6, scale: 1.18 },
            {
              xPercent: 6,
              scale: 1.18,
              ease: "none",
              scrollTrigger: { trigger: card, containerAnimation: slide, start: "left right", end: "right left", scrub: true },
            },
          );
        });
      });
    },
    { scope: root },
  );

  return (
    <section id="realisations" ref={root} className="section realisations" aria-labelledby="realisations-title">
      <div className="realisations__track">
        <header className="realisations__intro">
          <p className="eyebrow">La rigueur, l’expertise et l’innovation</p>
          <h2 id="realisations-title" className="section__title">
            Nos réalisations
          </h2>
          <p className="realisations__lead">
            Ouvrages d’art, sites nucléaires, copropriétés : des missions menées en environnement contraint ou
            sensible.
          </p>
        </header>
        {REALISATIONS.map((item, i) => (
          <article key={item.title} className="realisation">
            <div className="realisation__image">
              <Image src={item.image} alt={item.title} fill sizes="(max-width: 900px) 92vw, 46vw" />
            </div>
            <div className="realisation__meta">
              <span className="realisation__index">{String(i + 1).padStart(2, "0")}</span>
              <ul className="realisation__tags">
                {item.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            </div>
            <h3 className="realisation__title">{item.title}</h3>
            <p className="realisation__client">{item.client}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
