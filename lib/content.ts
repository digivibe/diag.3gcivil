// Contenu éditorial — repris du site actuel (diagnostic.groupe3g.fr) et adapté à la narration 3D.

export const BRAND = {
  name: "3G CIVIL",
  baseline: "Bureau d'études structure",
  url: "https://diagnostic.groupe3g.fr",
  phone: "06 67 20 80 52",
  phoneHref: "tel:+33667208052",
  whatsappHref: "https://wa.me/33667208052",
  email: "hello@3gcivil.com",
  address: "22 rue Chalgrin, 75016 Paris",
  hours: "Lundi – samedi · 9 h – 18 h",
  legalHref: "https://groupe3g.fr/mentions-legales",
  privacyHref: "https://diagnostic.groupe3g.fr/politique-de-confidentialite.html",
} as const;

export type ChapterId =
  | "hero"
  | "inspection"
  | "analyse"
  | "pathologies"
  | "modelisation"
  | "rapport";

export type Chapter = {
  id: ChapterId;
  index: string;
  label: string;
  /** Hauteur de la section en vh : 100 vh d'entrée (mouvement caméra) + le reste en "hold" (effet du chapitre). */
  height: number;
  align: "left" | "right";
  kicker: string;
  title: string;
  body: string;
  tags: string[];
};

export const CHAPTERS: Chapter[] = [
  {
    id: "hero",
    index: "00",
    label: "Accueil",
    height: 160,
    align: "left",
    kicker: "Diagnostics & inspections techniques · Paris & Île-de-France",
    title: "Bureau d’études structure à Paris",
    body: "Fissures, désordres, instabilités ? Intervention rapide et rapport sous 72 h.",
    tags: [],
  },
  {
    id: "inspection",
    index: "01",
    label: "Inspection",
    height: 230,
    align: "right",
    kicker: "01 — Inspection",
    title: "Tout commence sur le terrain.",
    body: "Inspection détaillée sur site, relevé des désordres, inspection visuelle assistée par drone pour les ouvrages difficiles d’accès : nous documentons l’état réel de votre bâtiment.",
    tags: ["Inspection détaillée", "Relevé des désordres", "Drone"],
  },
  {
    id: "analyse",
    index: "02",
    label: "Analyse",
    height: 230,
    align: "left",
    kicker: "02 — Analyse structurelle",
    title: "Lire ce que le béton cache.",
    body: "Porteurs, armatures, conception d’origine : nous analysons la structure telle qu’elle a été pensée, y compris selon les règlements anciens (BAEL, CCBA 68, CM 66…) indispensables pour comprendre les ouvrages existants.",
    tags: ["Béton armé", "Maçonnerie", "Métal"],
  },
  {
    id: "pathologies",
    index: "03",
    label: "Pathologies",
    height: 250,
    align: "left",
    kicker: "03 — Recherche des causes",
    title: "Traiter la cause, pas le symptôme.",
    body: "Corrosion des armatures, éclatement du béton, fissuration : nous localisons chaque pathologie et remontons à son origine pour qu’elle ne réapparaisse pas.",
    tags: ["Corrosion", "Éclatement", "Fissuration"],
  },
  {
    id: "modelisation",
    index: "04",
    label: "Modélisation",
    height: 230,
    align: "right",
    kicker: "04 — Modélisation & vérification",
    title: "Calculer avant de décider.",
    body: "Simulation numérique par éléments finis, recalcul des capacités portantes, vérification de la stabilité : chaque niveau est vérifié avant toute ouverture, extension ou surélévation.",
    tags: ["Éléments finis", "Capacité portante", "Stabilité"],
  },
  {
    id: "rapport",
    index: "05",
    label: "Rapport",
    height: 200,
    align: "left",
    kicker: "05 — Rapport & préconisations",
    title: "Un rapport sous 72 h.",
    body: "Préconisations de réparation ou de renforcement, mesures conservatoires, priorisation des travaux : un document clair, utilisable en assemblée générale comme en procédure, et un accompagnement jusqu’en phase travaux.",
    tags: ["Préconisations", "Mesures conservatoires", "Suivi de travaux"],
  },
];

export const HOTSPOTS = [
  { id: "corrosion", label: "Corrosion des armatures", code: "BALCON · R+3", position: [-3.0, 9.45, 6.72], radius: 0.95, storey: 2 },
  { id: "fissure", label: "Fissuration", code: "POTEAU P7 · R+2", position: [2.5, 7.9, 4.71], radius: 0.75, storey: 2 },
  { id: "eclatement", label: "Éclatement du béton", code: "POUTRE F2 · R+2", position: [-0.6, 5.95, 4.62], radius: 0.8, storey: 1 },
  { id: "pied", label: "Pied de poteau dégradé", code: "POTEAU P12 · RDC", position: [7.5, 0.55, 4.71], radius: 0.7, storey: 0 },
] as const;

export const PRESTATIONS = [
  {
    index: "01",
    title: "Inspection & diagnostic structure",
    audience: "Architectes · syndics · copropriétés",
    body: "État des lieux de la structure, analyse des fissures, vérification des porteurs et contrôle de stabilité.",
    image: "/images/prestation-inspection.webp",
  },
  {
    index: "02",
    title: "Étude structure",
    audience: "Ouverture · extension · surélévation · RSO",
    body: "Notes de calcul et études d’exécution : percements de murs porteurs, reprises en sous-œuvre, surélévations.",
    image: "/images/prestation-etude.webp",
  },
  {
    index: "03",
    title: "Expertise bâtiment",
    audience: "Amiable · contradictoire · litiges · malfaçons",
    body: "Un avis technique indépendant pour documenter une malfaçon, une non-conformité ou une dégradation progressive.",
    image: "/images/prestation-expertise.webp",
  },
  {
    index: "04",
    title: "Appui technique",
    audience: "Conseil · contre-expertise",
    body: "Un accompagnement du diagnostic initial à la phase travaux, aux côtés des maîtres d’ouvrage et des syndics.",
    image: "/images/prestation-appui.webp",
  },
] as const;

export const REALISATIONS = [
  {
    title: "Inspections détaillées et surveillance d’ouvrages d’art",
    client: "Département de Meurthe-et-Moselle · Ville de Châlons-en-Champagne · Autoroutes A8, A51, A52, A57",
    tags: ["Diagnostic", "Surveillance", "IQOA"],
    image: "/images/realisation-ouvrages-art.webp",
  },
  {
    title: "Diagnostics et études de réparation",
    client: "CEA — Commissariat à l’énergie atomique et aux énergies alternatives",
    tags: ["Diagnostic", "Réparation"],
    image: "/images/realisation-cea.webp",
  },
  {
    title: "Diagnostic et justification de la tenue d’ouvrages",
    client: "CEA & Quatorze IG",
    tags: ["Diagnostic", "Justification"],
    image: "/images/realisation-justification.webp",
  },
  {
    title: "Inspection par drone des appuis d’un ouvrage majeur",
    client: "Suisse · plus de 70 appuis d’un viaduc de l’axe N01, entre Berne et Neuchâtel",
    tags: ["Inspection", "Drone"],
    image: "/images/realisation-drone-viaduc.webp",
  },
  {
    title: "Assistance technique et gestion de situation de litige",
    client: "Le Patio — Bondy (93)",
    tags: ["Assistance", "Litige"],
    image: "/images/realisation-patio-bondy.webp",
  },
] as const;

export const FAQ = [
  {
    q: "Quand faut-il faire un diagnostic structure ?",
    a: "Un diagnostic structure est recommandé lorsqu’on observe des fissures, affaissements, ou déformations suspectes. Il est aussi indispensable avant des travaux impactant la structure (ouverture, extension, surélévation). Il permet d’évaluer la stabilité et les risques.",
  },
  {
    q: "Qu’est-ce qu’un DTG (Diagnostic Technique Global) ?",
    a: "Le DTG est un état des lieux technique complet d’une copropriété : structure, équipements, sécurité, performance énergétique. Il est obligatoire en cas de mise en copropriété d’un immeuble de plus de 10 ans ou si l’AG des copropriétaires le décide.",
  },
  {
    q: "Qu’est-ce qu’un PPT (Plan Pluriannuel de Travaux) ?",
    a: "Le PPT est un document qui planifie les travaux nécessaires dans une copropriété sur 10 ans. Il devient obligatoire à partir de 2023, selon la taille de la copropriété. Il repose souvent sur un DTG ou un audit technique.",
  },
  {
    q: "Quels diagnostics sont obligatoires pour une copropriété ?",
    a: "Selon la réglementation, les copropriétés doivent réaliser certains diagnostics : DTG, PPT, DPE collectif, diagnostic amiante parties communes, etc. Ces obligations varient selon l’âge du bâtiment, sa taille et les équipements en place.",
  },
  {
    q: "Intervenez-vous en phase avant-projet ?",
    a: "Oui, nous accompagnons les architectes et maîtres d’œuvre dès la phase d’avant-projet. Nous réalisons des études de faisabilité, notes de calcul préliminaires et apportons des préconisations techniques adaptées à chaque cas.",
  },
  {
    q: "En combien de temps puis-je recevoir un devis ?",
    a: "Vous recevez un devis personnalisé sous 24 à 48 h ouvrées après votre demande. Un échange téléphonique peut être organisé si besoin pour affiner votre besoin.",
  },
  {
    q: "Un diagnostic structure peut-il servir en cas de litige ou malfaçon ?",
    a: "Oui, un diagnostic structurel indépendant peut apporter un éclairage technique objectif en cas de désaccord entre copropriétaires, avec une entreprise ou un maître d’œuvre. Il peut documenter une malfaçon, une non-conformité ou une dégradation progressive, et servir de base dans une procédure amiable ou judiciaire.",
  },
  {
    q: "Quelle est la différence entre un diagnostic structurel et une expertise judiciaire ?",
    a: "Le diagnostic structurel est une mission technique rapide, menée par un ingénieur indépendant, sans cadre juridique imposé. L’expertise judiciaire est ordonnée par un tribunal dans un cadre contentieux. Nos diagnostics peuvent cependant être utilisés en amont pour orienter ou anticiper une action judiciaire.",
  },
  {
    q: "Dans quelles zones géographiques intervenez-vous ?",
    a: "Nous intervenons dans toute l’Île-de-France, notamment à Paris, Boulogne-Billancourt, Nanterre, Vincennes, Créteil, Saint-Denis, Montreuil, Neuilly-sur-Seine, Cergy et Versailles.",
  },
] as const;
