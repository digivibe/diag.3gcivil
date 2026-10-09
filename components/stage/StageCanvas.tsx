"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { createContext, Suspense, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { Effects } from "@/components/experience/Effects";
import { currentTheme, on, type Theme } from "@/components/experience/story";
import { THEMES, advanceTime, applyThemeUniforms } from "@/components/experience/uniforms";

export type StagePointer = { x: number; y: number; u: number; v: number; inside: boolean };
/** Positions écran (0 → 1) et visibilité des étiquettes, écrites par les spécimens à chaque frame. */
export type StageLabels = Map<string, { position: THREE.Vector3; visible: number }>;

const createPointer = (): StagePointer => ({ x: 0, y: 0, u: 0.5, v: 0.5, inside: false });

/** Pointeur normalisé relatif à la zone (u, v : 0 → 1 ; x, y : -1 → 1). */
function trackPointer(pointer: StagePointer, event: PointerEvent, bounds: DOMRect) {
  pointer.u = (event.clientX - bounds.left) / bounds.width;
  pointer.v = 1 - (event.clientY - bounds.top) / bounds.height;
  pointer.x = pointer.u * 2 - 1;
  pointer.y = pointer.v * 2 - 1;
  pointer.inside = pointer.u >= 0 && pointer.u <= 1 && pointer.v >= 0 && pointer.v <= 1;
}

const PointerContext = createContext<StagePointer>(createPointer());
const LabelsContext = createContext<StageLabels>(new Map());

export const useStagePointer = () => useContext(PointerContext);
export const useStageLabels = () => useContext(LabelsContext);

type Props = {
  className?: string;
  camera: { position: [number, number, number]; fov: number };
  /** Calque DOM superposé (étiquettes [data-label], HUD…). */
  overlay?: ReactNode;
  children: ReactNode;
};

/**
 * Canvas d'une section : monté à l'approche de l'écran, boucle de rendu coupée hors écran,
 * thème synchronisé, pointeur relatif à la zone. Un seul contexte WebGL travaille à la fois.
 */
export function StageCanvas({ className, camera, overlay, children }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [pointer] = useState(createPointer);
  const [labels] = useState<StageLabels>(() => new Map());
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(
    () =>
      on("theme", (next) => {
        applyThemeUniforms(next);
        setTheme(next);
      }),
    [],
  );

  useEffect(() => {
    const element = host.current!;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setActive(entry.isIntersecting);
        if (entry.isIntersecting) setMounted(true);
      },
      { rootMargin: "60% 0px" },
    );
    observer.observe(element);
    const move = (event: PointerEvent) => trackPointer(pointer, event, element.getBoundingClientRect());
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("pointermove", move);
    };
  }, [pointer]);

  return (
    <div ref={host} className={className} data-stage>
      {mounted && (
        <Canvas
          frameloop={active ? "always" : "never"}
          dpr={[0.75, 1.5]}
          camera={{ near: 0.05, far: 200, ...camera }}
          gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
          aria-hidden="true"
        >
          <color attach="background" args={[THEMES[theme].background]} />
          <PointerContext.Provider value={pointer}>
            <LabelsContext.Provider value={labels}>
              <Suspense fallback={null}>
                <TimeDriver />
                {children}
                <LabelProjector />
                <Effects theme={theme} smaa={false} />
              </Suspense>
            </LabelsContext.Provider>
          </PointerContext.Provider>
        </Canvas>
      )}
      {overlay}
    </div>
  );
}

/** La boucle de l'histoire est coupée hors de l'écran : chaque canvas de section fait aussi avancer uTime. */
function TimeDriver() {
  useFrame(() => advanceTime());
  return null;
}

/** Décalage de la carte par rapport au point (.stage-label__card { left: 44px }) et marge au bord. */
const CARD_OFFSET = 44;
const SAFE_MARGIN = 16;

/** Déplace les étiquettes DOM [data-label] du calque sur leurs ancres 3D. */
function LabelProjector() {
  const labels = useStageLabels();
  const elements = useRef<Map<string, HTMLElement>>(new Map());
  const cardWidths = useRef<Map<string, number>>(new Map());
  const point = useRef(new THREE.Vector3());

  // Largeurs relues après un redimensionnement (aucune lecture de layout par frame).
  useEffect(() => {
    const reset = () => elements.current.clear();
    window.addEventListener("resize", reset);
    return () => window.removeEventListener("resize", reset);
  }, []);

  useFrame((state) => {
    const container = state.gl.domElement.closest("[data-stage]");
    if (!container) return;
    if (elements.current.size === 0) {
      container.querySelectorAll<HTMLElement>("[data-label]").forEach((el) => {
        elements.current.set(el.dataset.label!, el);
        cardWidths.current.set(el.dataset.label!, el.querySelector<HTMLElement>(".stage-label__card")?.offsetWidth ?? 0);
      });
    }
    const { width, height } = state.size;
    elements.current.forEach((el, id) => {
      const anchor = labels.get(id);
      if (!anchor || anchor.visible <= 0.01) {
        el.style.opacity = "0";
        return;
      }
      const p = point.current.copy(anchor.position).project(state.camera);
      const x = (p.x * 0.5 + 0.5) * width;
      const y = (-p.y * 0.5 + 0.5) * height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.opacity = p.z > 1 ? "0" : anchor.visible.toFixed(3);
      el.style.setProperty("--reveal", anchor.visible.toFixed(3));
      // À droite du point si la carte tient, sinon du côté qui a le plus de place ;
      // si elle ne tient d'aucun côté (écran étroit), elle est décalée vers l'intérieur.
      const span = CARD_OFFSET + (cardWidths.current.get(id) ?? 0);
      const roomRight = width - x - SAFE_MARGIN;
      const roomLeft = x - SAFE_MARGIN;
      const right = roomRight >= span || roomRight >= roomLeft;
      const overflow = Math.max(0, span - (right ? roomRight : roomLeft));
      el.dataset.side = right ? "right" : "left";
      el.style.setProperty("--nudge", `${(right ? -overflow : overflow).toFixed(1)}px`);
    });
  });

  return null;
}
