"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRef } from "react";
import { story } from "@/components/experience/story";
import { playSound } from "@/components/sound/engine";
import { prestationsState } from "@/components/stage/state";
import { PRESTATIONS } from "@/lib/content";
import { requestDevis } from "./devis-events";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const PrestationsScene = dynamic(() => import("@/components/prestations/PrestationsScene"), { ssr: false });

/** Étiquettes projetées sur les spécimens (ancres définies dans components/prestations/*Specimen.ts). */
const LABELS = [
  { id: "fissure", code: "Désordre", text: "Fissure verticale" },
  { id: "epaufrure", code: "Désordre", text: "Épaufrure en tête de pile" },
  { id: "heb", code: "Renfort", text: "Linteau HEB sur platines" },
  { id: "charges", code: "Descente de charges", text: "Report vers les trumeaux" },
  { id: "front", code: "Essai", text: "Front de carbonatation" },
  { id: "armature", code: "Pathologie", text: "Armature corrodée" },
  { id: "fleche", code: "Déformée", text: "Flèche maximale" },
  { id: "moment", code: "Calcul", text: "Moment fléchissant maximal" },
];

function StageOverlay() {
  return (
    <div className="stage-overlay" aria-hidden="true">
      <span className="stage-overlay__corner stage-overlay__corner--tl" />
      <span className="stage-overlay__corner stage-overlay__corner--tr" />
      <span className="stage-overlay__corner stage-overlay__corner--bl" />
      <span className="stage-overlay__corner stage-overlay__corner--br" />
      {PRESTATIONS.map((item, i) => (
        <div key={item.index} className={`specimen-hud${i === 0 ? " is-active" : ""}`} data-specimen={i}>
          <p className="specimen-hud__code">
            {item.specimen.code} · Spécimen {i + 1}/{PRESTATIONS.length}
          </p>
          <p className="specimen-hud__name">{item.specimen.name}</p>
          <ol className="specimen-hud__steps">
            {item.specimen.steps.map((step, k) => (
              <li key={step} className="specimen-hud__step">
                <span>{String(k + 1).padStart(2, "0")}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      ))}
      <div className="specimen-photos">
        {PRESTATIONS.map((item, i) => (
          <figure key={item.index} className={`specimen-photo${i === 0 ? " is-active" : ""}`} data-specimen={i}>
            <Image src={item.image} alt="" fill sizes="240px" />
            <figcaption>Sur le terrain</figcaption>
          </figure>
        ))}
      </div>
      {LABELS.map((label) => (
        <div key={label.id} data-label={label.id} className="stage-label">
          <span className="stage-label__dot" />
          <span className="stage-label__leader" />
          <span className="stage-label__card">
            <span className="stage-label__code">{label.code}</span>
            <span className="stage-label__text">{label.text}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Prestations : section épinglée. Chaque prestation pilote un spécimen 3D dont l'animation
 * (inspection, percement, carottage, vérification) avance avec le scroll.
 */
export function Prestations() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = root.current!;
      const items = gsap.utils.toArray<HTMLElement>(".service", section);
      const count = PRESTATIONS.length;
      let active = -1;
      let lastStep = -1;
      // Les spécimens sont à droite du texte sur grand écran : leurs sons aussi.
      const pan = () => (window.innerWidth > 900 ? 0.4 : 0);

      // Le HUD du canvas est monté de façon différée : il est relu à chaque changement de prestation.
      const apply = (progress: number) => {
        const t = progress * count;
        prestationsState.t = t;
        const index = Math.min(count - 1, Math.floor(t));
        const local = Math.min(Math.max(t - index, 0), 1);
        const changed = index !== active;
        if (changed) {
          if (active !== -1) playSound("specimen", { index, pan: pan() });
          active = index;
          items.forEach((item, i) => item.classList.toggle("is-active", i === index));
          section.querySelectorAll<HTMLElement>("[data-specimen]").forEach((el) => {
            el.classList.toggle("is-active", Number(el.dataset.specimen) === index);
          });
        }
        items[index].style.setProperty("--progress", local.toFixed(3));
        const steps = section.querySelectorAll<HTMLElement>(`.specimen-hud[data-specimen="${index}"] .specimen-hud__step`);
        const current = Math.min(steps.length - 1, Math.floor(local * steps.length));
        // Nouvelle étape du même spécimen : bip d'instrument (le changement de spécimen a déjà son son).
        if (current !== lastStep && lastStep !== -1 && !changed) playSound("step", { index: current, pan: pan() });
        lastStep = current;
        steps.forEach((step, i) => {
          step.classList.toggle("is-done", i < current);
          step.classList.toggle("is-current", i === current);
        });
      };

      // Épinglage CSS (position: sticky) : aucun pin-spacer, le DOM géré par React reste intact.
      const trigger = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => apply(self.progress),
        onRefresh: (self) => apply(self.progress),
      });
      apply(trigger.progress);

      // Un clic sur une prestation amène le scroll au début de son segment.
      const cleanups = items.map((item, i) => {
        const button = item.querySelector<HTMLButtonElement>(".service__toggle");
        const go = () => {
          const y = trigger.start + ((i + 0.2) / count) * (trigger.end - trigger.start);
          if (story.lenis) story.lenis.scrollTo(y, { duration: 1.4 });
          else window.scrollTo({ top: y, behavior: story.reducedMotion ? "auto" : "smooth" });
        };
        button?.addEventListener("click", go);
        return () => button?.removeEventListener("click", go);
      });
      return () => cleanups.forEach((cleanup) => cleanup());
    },
    { scope: root },
  );

  return (
    <section
      id="prestations"
      ref={root}
      className="services"
      style={{ height: `${(PRESTATIONS.length + 1) * 100}svh` }}
      aria-labelledby="prestations-title"
    >
      <div className="services__pin">
        <div className="services__panel">
          <header className="services__head">
            <p className="eyebrow">Notre expertise au service de vos besoins</p>
            <h2 id="prestations-title" className="section__title services__title">
              Nos prestations
            </h2>
          </header>
          <ol className="services__list">
            {PRESTATIONS.map((item, i) => (
              <li key={item.index} className={`service${i === 0 ? " is-active" : ""}`}>
                <h3 className="service__heading">
                  <button type="button" className="service__toggle">
                    <span className="service__index">{item.index}</span>
                    <span className="service__title">{item.title}</span>
                  </button>
                </h3>
                <div className="service__detail">
                  <div className="service__inner">
                    <p className="service__audience">{item.audience}</p>
                    <p className="service__body">{item.body}</p>
                    <button type="button" className="service__cta" onClick={(event) => requestDevis(item.title, event.currentTarget)}>
                      Demander ce diagnostic <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </div>
                <span className="service__progress" aria-hidden="true" />
              </li>
            ))}
          </ol>
        </div>
        <div className="services__stage">
          <PrestationsScene className="stage-canvas" overlay={<StageOverlay />} />
        </div>
      </div>
    </section>
  );
}
