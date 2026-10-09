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
    specimen: {
      code: "SPC-01",
      name: "Inspection d’une pile d’ouvrage par drone",
      steps: ["Vol d’inspection", "Relevé de la pile", "Désordres localisés"],
    },
  },
  {
    index: "02",
    title: "Étude structure",
    audience: "Ouverture · extension · surélévation · RSO",
    body: "Notes de calcul et études d’exécution : percements de murs porteurs, reprises en sous-œuvre, surélévations.",
    image: "/images/prestation-etude.webp",
    specimen: {
      code: "SPC-02",
      name: "Ouverture dans un mur porteur",
      steps: ["Implantation", "Pose du linteau HEB", "Dépose de la maçonnerie", "Report des charges"],
    },
  },
  {
    index: "03",
    title: "Expertise bâtiment",
    audience: "Amiable · contradictoire · litiges · malfaçons",
    body: "Un avis technique indépendant pour documenter une malfaçon, une non-conformité ou une dégradation progressive.",
    image: "/images/prestation-expertise.webp",
    specimen: {
      code: "SPC-03",
      name: "Carottage et test de carbonatation",
      steps: ["Prélèvement", "Fendage de la carotte", "Phénolphtaléine", "Front de carbonatation"],
    },
  },
  {
    index: "04",
    title: "Appui technique",
    audience: "Conseil · contre-expertise",
    body: "Un accompagnement du diagnostic initial à la phase travaux, aux côtés des maîtres d’ouvrage et des syndics.",
    image: "/images/prestation-appui.webp",
    specimen: {
      code: "SPC-04",
      name: "Vérification d’une poutre sous charge",
      steps: ["Mise en charge", "Déformée", "Contraintes", "Moment fléchissant"],
    },
  },
] as const;

export const REALISATIONS = [
  {
    code: "DOS-01",
    title: "Inspections détaillées et surveillance d’ouvrages d’art",
    client: "Département de Meurthe-et-Moselle · Ville de Châlons-en-Champagne · Autoroutes A8, A51, A52, A57",
    place: "Grand Est · Provence-Alpes-Côte d’Azur",
    tags: ["Diagnostic", "Surveillance", "IQOA"],
    missions: [
      "Rédaction de rapports d’inspections détaillées.",
      "Classification selon la méthode IQOA.",
      "Établissement de programmes sur mesure de surveillance périodique ou renforcée.",
    ],
    image: "/images/realisation-ouvrages-art.webp",
  },
  {
    code: "DOS-02",
    title: "Diagnostics et études de réparation",
    client: "CEA — Commissariat à l’énergie atomique et aux énergies alternatives",
    place: "Site nucléaire",
    tags: ["Diagnostic", "Réparation"],
    missions: [
      "Diagnostic de l’état des puits et des alvéoles d’entreposage de fûts de déchets radioactifs ou contaminés.",
      "Proposition de mesures de renforcement provisoire en amont du démantèlement définitif.",
      "Note de scénario pour la déconstruction des puits, intégrant les contraintes techniques et environnementales.",
    ],
    image: "/images/realisation-cea.webp",
  },
  {
    code: "DOS-03",
    title: "Diagnostic et justification de la tenue d’ouvrages",
    client: "CEA & Quatorze IG",
    place: "Ouvrages souterrains",
    tags: ["Diagnostic", "Justification"],
    missions: [
      "Diagnostics et études de portance des galeries souterraines.",
      "Diagnostics et justification de la tenue de la chaîne blindée.",
    ],
    image: "/images/realisation-justification.webp",
  },
  {
    code: "DOS-04",
    title: "Inspection par drone des appuis d’un ouvrage majeur",
    client: "Viaduc de l’axe national N01, entre Berne et Neuchâtel",
    place: "Suisse",
    tags: ["Inspection", "Drone"],
    missions: [
      "Inspection de plus de 70 appuis d’un viaduc.",
      "Inspection visuelle assistée par drone, en partenariat, pour évaluer l’état structurel des appuis.",
    ],
    image: "/images/realisation-drone-viaduc.webp",
  },
  {
    code: "DOS-05",
    title: "Assistance technique et gestion de situation de litige",
    client: "Le Patio",
    place: "Bondy (93)",
    tags: ["Assistance", "Litige"],
    missions: [
      "Inspection technique détaillée, détection de défaillances critiques et mesures conservatoires.",
      "Assistance à la coordination de travaux conservatoires après sinistre et litige post-réception.",
      "Pilotage des interventions d’urgence et accompagnement du syndic face aux parties prenantes.",
    ],
    image: "/images/realisation-patio-bondy.webp",
  },
] as const;

/** Répertoire complet repris du site actuel ("Autres réalisations"). */
export const REPERTOIRE = [
  {
    id: "constructions",
    label: "Constructions & réhabilitations",
    items: [
      "Conception et dimensionnement du hangar AWAC de 5 000 m² — BA d’Avord (structure métallique, massifs de fondation, couverture, bardage).",
      "Conception et dimensionnement de la surélévation en structure métallique du bâtiment DGAC — Aéroport de Nantes Saint-Brévin.",
      "Études d’exécution pour la création d’un escalier BA et d’ouvertures (7 m sur refends + 2,50 m en façade) — Rue Bonaparte / Place du Québec, Paris 6e.",
      "Études d’exécution pour la surélévation de 2 étages — 10 rue d’Enghien, Paris 10e (charpente, planchers mixtes, fondations).",
      "Réhabilitation lourde — 16 rue Lalo, Paris 16e (reprises en sous-œuvre, parkings, monte-voiture, ascenseur extérieur).",
      "Renforcement des poutres BA et études d’exécution — École Notre-Dame des Oiseaux, Paris 16e.",
      "Conception et dimensionnement d’une couverture en gradins (5 kN/m²) — Amphithéâtre romain, Vosges.",
      "Conception et dimensionnement de nouveaux planchers BA et remise en état de trumeaux — Manufacture de Dijonval, Sedan.",
      "Suppression de palées de stabilité et création d’un plancher intermédiaire — Nef industrielle transformée en garage, Pantin.",
      "Diagnostic et renforcement planchers + fondations — Inspection générale des services, rue Cambacérès, Paris 8e.",
      "Ouvertures dans murs porteurs avec renforts (HEB, platines, ancrages).",
      "Reprises en sous-œuvre sous façades et refends, phasages d’exécution.",
      "Dallages industriels : vérification des charges concentrées, radiers, joints.",
      "Escaliers BA neufs et renforcement d’escaliers existants.",
      "Murs de soutènement (BA, gabions) et calculs de poussée des terres.",
    ],
  },
  {
    id: "infrastructures",
    label: "Infrastructures & ouvrages d’art",
    items: [
      "Conception et dimensionnement d’ouvrages pyrotechniques (dépôts de munitions, hangars missiles, massifs supports) sur bases aériennes.",
      "Contrôle technique de plans et notes de calcul — bâtiments pyrotechniques et classiques.",
      "Bâtiment de conditionnement missile — résistance aux explosions intérieures et extérieures (Île Longue, Brest).",
      "Bâtiment de stockage missiles — résistance aux explosions + mur de soutènement de 10 m en gabions (presqu’île de Guenvenez, Brest).",
      "Mur anti-souffle et anti-éclats — éléments préfabriqués BA connectés.",
      "Études de dangers — fuites de kérosène sur avions et camions ravitailleurs, détermination des zones de danger.",
      "Vérification de la résistance d’une chaufferie à une explosion de gaz naturel.",
      "Vérification de voûtes de métro sous charges de chantier et de grues.",
      "Vérification de ponts en maçonnerie sous convois exceptionnels (RER lignes A et B).",
      "Diagnostics structurels d’escaliers métalliques — stations aériennes de la ligne 6 du métro (remplacements).",
      "Vérification de la stabilité des tabliers du viaduc de Rueil, dispositif anti-déraillement et préconisations de réparation.",
      "Vérifications d’ouvrages BA, CM, mixtes et BP — ligne B du RER sous passage de grue ferroviaire.",
      "Vérification du dallage de la station Galliéni sous charges concentrées.",
      "Analyse de fissurations de parois verticales en tranchée — rue Haxo, Paris 20e (gradient thermique).",
      "Contrôle technique de plans et notes de calcul — liaison RER / station ligne 1, Porte Maillot.",
      "Reconnaissance et vérification d’une passerelle en arc (tirants BA) — Massy-Palaiseau, décision de fermeture au public.",
    ],
  },
] as const;

/** Formulaire de demande : valeurs envoyées telles quelles à l'API (champs "type" et "zone"). */
export const MISSION_TYPES = [
  ...PRESTATIONS.map((item) => ({ value: item.title, hint: item.audience })),
  { value: "Autre / je ne sais pas encore", hint: "Nous qualifions votre besoin ensemble" },
] as const;

export const ZONES = [
  "Paris",
  "Hauts-de-Seine (92)",
  "Seine-Saint-Denis (93)",
  "Val-de-Marne (94)",
  "Grande couronne",
  "Hors Île-de-France",
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
