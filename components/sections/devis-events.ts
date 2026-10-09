import { scrollToTarget } from "@/components/experience/story";

/** Évènement DOM écouté par le formulaire de demande pour présélectionner un type de mission. */
export const DEVIS_PREFILL_EVENT = "devis:prefill";

export type DevisPrefill = { type: string };

export function requestDevis(type: string) {
  window.dispatchEvent(new CustomEvent<DevisPrefill>(DEVIS_PREFILL_EVENT, { detail: { type } }));
  scrollToTarget("#contact");
}
