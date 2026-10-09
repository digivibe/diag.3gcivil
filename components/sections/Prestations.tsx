"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { useRef, useSyncExternalStore } from "react";
import { PRESTATIONS } from "@/lib/content";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const FINE_POINTER = "(hover: hover) and (pointer: fine)";
const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(FINE_POINTER);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
/** true côté serveur : les vignettes tactiles ne sont ajoutées qu'après hydratation, si besoin. */
const useFinePointer = () => useSyncExternalStore(subscribe, () => window.matchMedia(FINE_POINTER).matches, () => true);

/** Liste des prestations : l'image suit le curseur au survol (desktop), vignette en ligne au tactile. */
export function Prestations() {
  const root = useRef<HTMLElement>(null);
  const finePointer = useFinePointer();

  useGSAP(
    (_, contextSafe) => {
      const section = root.current!;
      const preview = section.querySelector<HTMLElement>(".prestations__preview")!;
      const images = gsap.utils.toArray<HTMLElement>(".prestations__frame", section);
      const items = gsap.utils.toArray<HTMLElement>(".prestation", section);

      gsap.from(items, {
        y: 40,
        autoAlpha: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.08,
        scrollTrigger: { trigger: section.querySelector(".prestations__list"), start: "top 80%" },
      });

      if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches || !contextSafe) return;

      const xTo = gsap.quickTo(preview, "x", { duration: 0.7, ease: "power3" });
      const yTo = gsap.quickTo(preview, "y", { duration: 0.7, ease: "power3" });
      const rotate = gsap.quickTo(preview, "rotation", { duration: 0.9, ease: "power3" });
      let lastX = 0;

      const move = contextSafe((event: PointerEvent) => {
        const bounds = section.getBoundingClientRect();
        xTo(event.clientX - bounds.left);
        yTo(event.clientY - bounds.top);
        rotate(gsap.utils.clamp(-8, 8, (event.clientX - lastX) * 0.4));
        lastX = event.clientX;
      });
      const show = contextSafe((index: number) => {
        images.forEach((image, i) =>
          gsap.to(image, { autoAlpha: i === index ? 1 : 0, scale: i === index ? 1 : 1.15, duration: 0.6, ease: "power3.out" }),
        );
        gsap.to(preview, { autoAlpha: 1, scale: 1, duration: 0.5, ease: "power3.out" });
      });
      const hide = contextSafe(() => gsap.to(preview, { autoAlpha: 0, scale: 0.8, duration: 0.4, ease: "power3.in" }));

      const list = section.querySelector<HTMLElement>(".prestations__list")!;
      const listeners = items.map((item, i) => {
        const enter = () => show(i);
        item.addEventListener("pointerenter", enter);
        return () => item.removeEventListener("pointerenter", enter);
      });
      section.addEventListener("pointermove", move);
      list.addEventListener("pointerleave", hide);
      return () => {
        listeners.forEach((off) => off());
        section.removeEventListener("pointermove", move);
        list.removeEventListener("pointerleave", hide);
      };
    },
    { scope: root },
  );

  return (
    <section id="prestations" ref={root} className="section prestations" aria-labelledby="prestations-title">
      <header className="section__head">
        <p className="eyebrow">Notre expertise au service de vos besoins</p>
        <h2 id="prestations-title" className="section__title">
          Nos prestations
        </h2>
      </header>
      <ol className="prestations__list">
        {PRESTATIONS.map((item) => (
          <li key={item.index} className="prestation">
            <span className="prestation__index">{item.index}</span>
            <div className="prestation__main">
              <h3 className="prestation__title">{item.title}</h3>
              <p className="prestation__audience">{item.audience}</p>
            </div>
            <p className="prestation__body">{item.body}</p>
            {!finePointer && (
              <div className="prestation__thumb">
                <Image src={item.image} alt="" fill sizes="100vw" />
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="prestations__preview" aria-hidden="true">
        {PRESTATIONS.map((item) => (
          <div key={item.index} className="prestations__frame">
            <Image src={item.image} alt="" fill sizes="420px" />
          </div>
        ))}
      </div>
    </section>
  );
}
