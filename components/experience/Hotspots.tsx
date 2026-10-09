"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { HOTSPOTS } from "@/lib/content";
import { story } from "./story";
import { EXPLODE_GAP } from "./uniforms";

const CARD_OFFSET = 52;
const SAFE_MARGIN = 24;

/**
 * Projette les pathologies 3D à l'écran et déplace les étiquettes DOM correspondantes
 * (components/overlay/HotspotLabels.tsx) — sans racine React imbriquée dans le canvas.
 */
export function HotspotProjector() {
  const labels = useRef<HTMLElement[]>([]);
  const cardWidths = useRef<number[]>([]);
  const point = useRef(new THREE.Vector3());

  useEffect(() => {
    labels.current = Array.from(document.querySelectorAll<HTMLElement>("[data-hotspot]"));
    // Largeurs mesurées hors de la boucle de rendu (aucune lecture de layout par frame).
    const measure = () => {
      cardWidths.current = labels.current.map((label) => label.querySelector<HTMLElement>(".hotspot__card")?.offsetWidth ?? 0);
    };
    measure();
    document.fonts?.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useFrame((state) => {
    const { width, height } = state.size;
    HOTSPOTS.forEach((hotspot, i) => {
      const label = labels.current[i];
      if (!label) return;
      const visible = THREE.MathUtils.clamp(story.labels * (HOTSPOTS.length + 1) - i, 0, 1);
      if (visible <= 0) {
        label.style.opacity = "0";
        return;
      }
      const lift = story.explode * (hotspot.storey + 1) * EXPLODE_GAP;
      const p = point.current.set(hotspot.position[0], hotspot.position[1] + lift, hotspot.position[2]).project(state.camera);
      const x = (p.x * 0.5 + 0.5) * width;
      const y = (-p.y * 0.5 + 0.5) * height;
      // Hors de la zone sûre (bords, en-tête, HUD bas) : l'étiquette est masquée.
      const inside = p.z < 1 && x > SAFE_MARGIN && x < width - SAFE_MARGIN && y > height * 0.12 && y < height * 0.88;
      label.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      label.style.opacity = inside ? visible.toFixed(3) : "0";
      label.style.setProperty("--reveal", visible.toFixed(3));
      // L'étiquette passe à gauche du point seulement si elle déborderait à droite.
      label.dataset.side = x + CARD_OFFSET + (cardWidths.current[i] ?? 0) > width - SAFE_MARGIN ? "left" : "right";
    });
  });

  return null;
}
