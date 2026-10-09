"use client";

import { useSyncExternalStore } from "react";
import { getSoundState, setSoundEnabled, subscribeSound, type SoundState } from "@/components/sound/engine";

/**
 * Bouton son de l'en-tête. Barres animées quand le son joue ; barres figées tant que le navigateur
 * attend un premier geste ("armed") ; trait plat quand le visiteur l'a coupé (choix mémorisé).
 */
export function SoundToggle() {
  const state = useSyncExternalStore<SoundState>(subscribeSound, getSoundState, () => "armed");
  const playing = state === "on";

  return (
    <button
      type="button"
      className="sound-toggle"
      data-state={state}
      data-sound="none"
      onClick={() => setSoundEnabled(!playing)}
      aria-pressed={playing}
      aria-label={playing ? "Couper le son" : "Activer le son"}
      title={playing ? "Couper le son" : "Activer le son"}
    >
      <span className="sound-toggle__bars" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
    </button>
  );
}
