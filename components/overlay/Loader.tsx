"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { emit, on } from "@/components/experience/story";

/** Écran d'initialisation : attend que la scène WebGL ait rendu ses premières images. */
export function Loader() {
  const root = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const state = { value: 0 };
      const render = () => {
        if (counter.current) counter.current.textContent = String(Math.round(state.value)).padStart(3, "0");
        if (bar.current) bar.current.style.transform = `scaleX(${state.value / 100})`;
      };
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        gsap.to(state, {
          value: 100,
          duration: 0.45,
          ease: "power2.out",
          onUpdate: render,
          onComplete: () => {
            root.current?.classList.add("is-done");
            emit("intro", undefined);
          },
        });
      };
      const warmup = gsap.to(state, { value: 88, duration: 1.8, ease: "power2.out", onUpdate: render });
      const offReady = on("ready", () => warmup.then(finish));
      // Filet de sécurité : sans WebGL, le contenu reste accessible.
      const fallback = gsap.delayedCall(9, finish);
      return () => {
        offReady();
        fallback.kill();
      };
    },
    { scope: root },
  );

  return (
    <div ref={root} className="loader" role="status" aria-live="polite">
      <div className="loader__inner">
        <LogoMark className="loader__logo" />
        <p className="loader__label">
          Initialisation du relevé <span ref={counter} className="loader__count">000</span>
        </p>
        <span className="loader__track">
          <span ref={bar} className="loader__bar" />
        </span>
      </div>
    </div>
  );
}
