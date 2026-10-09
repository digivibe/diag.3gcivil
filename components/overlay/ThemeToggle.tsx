"use client";

import { useSyncExternalStore } from "react";
import { currentTheme, emit, on, type Theme } from "@/components/experience/story";
import { THEME_STORAGE_KEY } from "@/lib/theme";

const subscribe = (onChange: () => void) => on("theme", onChange);

/** Bascule sombre / gris clair, mémorisée ; la scène 3D écoute l'évènement "theme". */
export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme>(subscribe, currentTheme, () => "dark");
  const next: Theme = theme === "dark" ? "light" : "dark";

  const toggle = () => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Stockage indisponible (navigation privée) : le choix vaut pour la session.
    }
    emit("theme", next);
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      data-sound="switch"
      onClick={toggle}
      aria-pressed={theme === "light"}
      aria-label={theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre"}
      title={theme === "dark" ? "Thème clair" : "Thème sombre"}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-toggle__icon">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" />
      </svg>
    </button>
  );
}
