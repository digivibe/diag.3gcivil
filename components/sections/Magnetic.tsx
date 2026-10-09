"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef, type ReactNode } from "react";

gsap.registerPlugin(useGSAP);

/** Effet "aimant" : l'élément est attiré par le curseur puis revient avec un rebond élastique. */
export function Magnetic({ children, strength = 0.35 }: { children: ReactNode; strength?: number }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    (_, contextSafe) => {
      const el = root.current!;
      if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches || !contextSafe) return;
      const xTo = gsap.quickTo(el, "x", { duration: 0.8, ease: "elastic.out(1, 0.4)" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.8, ease: "elastic.out(1, 0.4)" });
      const move = contextSafe((event: PointerEvent) => {
        const bounds = el.getBoundingClientRect();
        xTo((event.clientX - (bounds.left + bounds.width / 2)) * strength);
        yTo((event.clientY - (bounds.top + bounds.height / 2)) * strength);
      });
      const leave = contextSafe(() => {
        xTo(0);
        yTo(0);
      });
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerleave", leave);
      return () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerleave", leave);
      };
    },
    { scope: root },
  );

  return (
    <div ref={root} className="magnetic">
      {children}
    </div>
  );
}
