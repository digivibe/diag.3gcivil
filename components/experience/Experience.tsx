"use client";

import dynamic from "next/dynamic";
import { HotspotLabels } from "@/components/overlay/HotspotLabels";
import { Hud } from "@/components/overlay/Hud";
import { Loader } from "@/components/overlay/Loader";
import { ScrollDirector } from "./ScrollDirector";

// La scène WebGL n'existe que côté client : le HTML rendu par le serveur reste lisible (SEO, sans JS).
const Scene = dynamic(() => import("./Scene"), { ssr: false });

export function Experience() {
  return (
    <>
      <div className="webgl" aria-hidden="true">
        <Scene />
      </div>
      <HotspotLabels />
      <ScrollDirector />
      <Hud />
      <Loader />
    </>
  );
}
