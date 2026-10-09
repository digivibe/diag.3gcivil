import { BRAND, DELAIS, MISSION_TYPES, ZONES } from "@/lib/content";

/** Demande de diagnostic : mêmes règles côté navigateur (étape par étape) et côté serveur (app/api/devis). */
export type DevisData = {
  type: string;
  zone: string;
  delai: string;
  message: string;
  adresse: string;
  nom: string;
  email: string;
  telephone: string;
  consent: boolean;
  /** Champ piège invisible : rempli seulement par les robots. */
  website: string;
};

export type DevisField = keyof DevisData;
export type DevisErrors = Partial<Record<DevisField, string>>;

export const DEVIS_EMPTY: DevisData = {
  type: "",
  zone: "",
  delai: "",
  message: "",
  adresse: "",
  nom: "",
  email: "",
  telephone: "",
  consent: false,
  website: "",
};

/** Une étape par "niveau" de l'immeuble. */
export const DEVIS_STEPS = [
  { floor: "RDC", title: "Votre besoin", fields: ["type", "zone"] },
  { floor: "1er", title: "Votre bâtiment", fields: ["delai", "message", "adresse"] },
  { floor: "2e", title: "Vos coordonnées", fields: ["nom", "email", "telephone", "consent"] },
] as const satisfies readonly { floor: string; title: string; fields: readonly DevisField[] }[];

const MAX_LENGTH: Partial<Record<DevisField, number>> = { message: 4000, adresse: 200, nom: 120, email: 200, telephone: 30 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+\d\s().-]{6,30}$/;

const oneOf = (list: readonly string[], value: string) => list.includes(value);

/** Erreurs par champ ; `step` limite la vérification aux champs d'une étape. */
export function validateDevis(data: DevisData, step?: number): DevisErrors {
  const fields: readonly DevisField[] = step === undefined ? DEVIS_STEPS.flatMap((s) => s.fields) : DEVIS_STEPS[step].fields;
  const errors: DevisErrors = {};
  const check = (field: DevisField, ok: boolean, message: string) => {
    if (fields.includes(field) && !ok && !errors[field]) errors[field] = message;
  };
  check("type", oneOf(MISSION_TYPES.map((m) => m.value), data.type), "Choisissez un type de mission.");
  check("zone", oneOf(ZONES, data.zone), "Indiquez où se trouve le bâtiment.");
  check("delai", oneOf(DELAIS, data.delai), "Indiquez votre délai.");
  check("message", data.message.trim().length >= 20, "Décrivez la situation en quelques mots (20 caractères minimum).");
  check("nom", data.nom.trim().length >= 2, "Indiquez votre nom.");
  check("email", EMAIL.test(data.email.trim()), "Adresse e-mail invalide.");
  check("telephone", !data.telephone.trim() || PHONE.test(data.telephone.trim()), "Numéro de téléphone invalide.");
  check("consent", data.consent, "Votre accord est nécessaire pour traiter la demande.");
  for (const [field, max] of Object.entries(MAX_LENGTH) as [DevisField, number][]) {
    check(field, String(data[field]).length <= max, `${max} caractères maximum.`);
  }
  return errors;
}

/** Lecture prudente d'un corps JSON reçu par l'API : seuls les champs connus, au bon type. */
export function parseDevis(input: unknown): DevisData | null {
  if (!input || typeof input !== "object") return null;
  const source = input as Record<string, unknown>;
  const data = { ...DEVIS_EMPTY };
  for (const key of Object.keys(DEVIS_EMPTY) as DevisField[]) {
    const value = source[key];
    if (key === "consent") data.consent = value === true;
    else if (typeof value === "string") data[key] = value;
    else if (value !== undefined) return null;
  }
  return data;
}

/** Résumé texte (e-mail reçu par le bureau d'études, ou brouillon si l'envoi automatique échoue). */
export function devisText(data: DevisData) {
  const details = [`Type de mission : ${data.type}`, `Zone : ${data.zone}`, `Délai : ${data.delai}`];
  if (data.adresse.trim()) details.push(`Adresse : ${data.adresse.trim()}`);
  const contact = [data.nom, data.email, data.telephone].map((value) => value.trim()).filter(Boolean).join(" · ");
  return [details.join("\n"), data.message.trim(), contact].join("\n\n");
}

export const devisSubject = (data: DevisData) => `Demande de diagnostic – ${data.type || "nouvelle demande"}`;

export const devisMailto = (data: DevisData) =>
  `mailto:${BRAND.email}?subject=${encodeURIComponent(devisSubject(data))}&body=${encodeURIComponent(devisText(data))}`;
