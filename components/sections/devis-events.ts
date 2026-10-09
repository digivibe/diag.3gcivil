/** Évènement qui ouvre le formulaire de demande (components/devis/Devis.tsx), mission présélectionnée en option. */
export const DEVIS_OPEN_EVENT = "devis:open";

export type DevisOpen = {
  /** Type de mission présélectionné (valeur de MISSION_TYPES). */
  type?: string;
  /** Élément d'origine : la transition part de lui, et le focus y revient à la fermeture. */
  from?: HTMLElement | null;
};

export function requestDevis(type?: string, from?: HTMLElement | null) {
  window.dispatchEvent(new CustomEvent<DevisOpen>(DEVIS_OPEN_EVENT, { detail: { type, from } }));
}
