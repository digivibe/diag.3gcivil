"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { createContext, Suspense, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { Effects } from "@/components/experience/Effects";
import { currentTheme, on, type Theme } from "@/components/experience/story";
import { THEMES, applyThemeUniforms } from "@/components/experience/uniforms";

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

/** Déplace les étiquettes DOM [data-label] du calque sur leurs ancres 3D. */
function LabelProjector() {
  const labels = useStageLabels();
  const elements = useRef<Map<string, HTMLElement>>(new Map());
  const point = useRef(new THREE.Vector3());

  useFrame((state) => {
    const container = state.gl.domElement.closest("[data-stage]");
    if (!container) return;
    if (elements.current.size === 0) {
      container.querySelectorAll<HTMLElement>("[data-label]").forEach((el) => elements.current.set(el.dataset.label!, el));
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
      el.dataset.side = x > width * 0.62 ? "left" : "right";
    });
  });

  return null;
}
