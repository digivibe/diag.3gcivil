/**
 * Petits sons d'interface synthétisés en direct (Web Audio) : aucun fichier à charger, et chaque son
 * varie avec son contexte (chapitre, prestation, vitesse de défilement, position du pointeur).
 *
 * Les navigateurs n'autorisent le son qu'après un premier geste (clic, touche) : le contexte audio est
 * créé à ce moment-là, sauf si le visiteur a coupé le son (préférence mémorisée).
 * Aucune dépendance : le module peut aussi rendre ses sons dans un OfflineAudioContext (tests de niveau).
 */

export const SOUND_STORAGE_KEY = "3gcivil-sound";

export type SoundName =
  | "hover"
  | "click"
  | "confirm"
  | "chapter"
  | "specimen"
  | "step"
  | "ping"
  | "flip"
  | "expand"
  | "collapse"
  | "switch"
  | "open"
  | "close"
  | "lens"
  | "on"
  | "off"
  | "enter"
  | "door"
  | "exit"
  | "success"
  | "error";

export type SoundOptions = {
  /** Rang (chapitre, prestation, étape…) : choisit la note dans la gamme. */
  index?: number;
  /** Vitesse normalisée (-1 → 1) pour les sons de mouvement. */
  velocity?: number;
  /** Variante de timbre (0 ou 1). */
  variant?: number;
  /** Position stéréo (-1 gauche → 1 droite), en général celle du pointeur. */
  pan?: number;
};

/** État affiché par le bouton : coupé, en attente du premier geste, actif. */
export type SoundState = "off" | "armed" | "on";

export const MASTER_GAIN = 1.4;

/** Ré majeur pentatonique sur deux octaves (Hz) : toutes les notes sonnent juste ensemble. */
const SCALE = [587.33, 659.25, 739.99, 880, 987.77, 1174.66, 1318.51, 1479.98, 1760, 1975.53];

/** Intervalle minimal entre deux occurrences d'un même son (s) : un défilement rapide donne un arpège, pas une rafale. */
const MIN_GAP: Partial<Record<SoundName, number>> = {
  hover: 0.05,
  step: 0.07,
  chapter: 0.12,
  specimen: 0.14,
  flip: 0.08,
  ping: 0.1,
  lens: 0.25,
  error: 0.3,
};

type Graph = { context: BaseAudioContext; dry: GainNode; wet: GainNode; noise: AudioBuffer };

const note = (step: number) => {
  const octave = Math.floor(step / SCALE.length);
  return SCALE[step - octave * SCALE.length] * 2 ** octave;
};

/** Réponse impulsionnelle synthétique (bruit à décroissance exponentielle) : une petite salle claire. */
function impulse(context: BaseAudioContext, seconds: number, decay: number) {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
  }
  return buffer;
}

/** Bus de sortie (direct + réverbération) et bruit blanc partagé, branchés sur `destination`. */
export function createGraph(context: BaseAudioContext, destination: AudioNode): Graph {
  const dry = context.createGain();
  dry.connect(destination);
  const reverb = context.createConvolver();
  reverb.buffer = impulse(context, 1.8, 3);
  const wet = context.createGain();
  wet.gain.value = 0.8;
  wet.connect(reverb).connect(destination);
  const noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return { context, dry, wet, noise };
}

/** Entrée d'une voix : position stéréo, puis départ direct + envoi vers la réverbération. */
function voice(g: Graph, send: number, pan = 0) {
  const input = g.context.createGain();
  let node: AudioNode = input;
  if (pan && typeof g.context.createStereoPanner === "function") {
    const panner = g.context.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    node = input.connect(panner);
  }
  node.connect(g.dry);
  if (send > 0) {
    const amount = g.context.createGain();
    amount.gain.value = send;
    node.connect(amount).connect(g.wet);
  }
  return input;
}

/** Enveloppe percussive : attaque courte, décroissance exponentielle. */
function envelope(param: AudioParam, t: number, peak: number, attack: number, decay: number) {
  param.setValueAtTime(0.0001, t);
  param.exponentialRampToValueAtTime(peak, t + attack);
  param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

type ToneOptions = {
  freq: number;
  /** Fréquence d'arrivée (glissando). */
  to?: number;
  type?: OscillatorType;
  gain: number;
  attack?: number;
  decay: number;
  send?: number;
  pan?: number;
  /** Décalage de départ (s). */
  at?: number;
};

function tone(g: Graph, t0: number, o: ToneOptions) {
  const t = t0 + (o.at ?? 0);
  const attack = o.attack ?? 0.004;
  const osc = g.context.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + attack + o.decay * 0.8);
  const amp = g.context.createGain();
  envelope(amp.gain, t, o.gain, attack, o.decay);
  osc.connect(amp).connect(voice(g, o.send ?? 0.12, o.pan));
  osc.start(t);
  osc.stop(t + attack + o.decay + 0.05);
}

/** Cloche FM : rapport inharmonique 3,5 → timbre métallique clair qui s'éteint en douceur. */
function bell(g: Graph, t0: number, freq: number, gain: number, decay: number, pan = 0, send = 0.35, at = 0) {
  const t = t0 + at;
  const carrier = g.context.createOscillator();
  carrier.frequency.value = freq;
  const modulator = g.context.createOscillator();
  modulator.frequency.value = freq * 3.5;
  const depth = g.context.createGain();
  depth.gain.setValueAtTime(freq * 1.6, t);
  depth.gain.exponentialRampToValueAtTime(freq * 0.05, t + decay * 0.6);
  modulator.connect(depth).connect(carrier.frequency);
  const amp = g.context.createGain();
  envelope(amp.gain, t, gain, 0.003, decay);
  carrier.connect(amp).connect(voice(g, send, pan));
  for (const osc of [carrier, modulator]) {
    osc.start(t);
    osc.stop(t + decay + 0.1);
  }
}

type HissOptions = {
  freq: number;
  to?: number;
  type?: BiquadFilterType;
  q?: number;
  gain: number;
  attack?: number;
  decay: number;
  send?: number;
  pan?: number;
};

/** Souffle : bruit blanc filtré (balayage optionnel du filtre). */
function hiss(g: Graph, t: number, o: HissOptions) {
  const attack = o.attack ?? 0.005;
  const duration = attack + o.decay + 0.05;
  const source = g.context.createBufferSource();
  source.buffer = g.noise;
  const filter = g.context.createBiquadFilter();
  filter.type = o.type ?? "bandpass";
  filter.Q.value = o.q ?? 1;
  filter.frequency.setValueAtTime(o.freq, t);
  if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, t + attack + o.decay);
  const amp = g.context.createGain();
  envelope(amp.gain, t, o.gain, attack, o.decay);
  source.connect(filter).connect(amp).connect(voice(g, o.send ?? 0.1, o.pan));
  source.start(t, Math.random() * Math.max(0, g.noise.duration - duration));
  source.stop(t + duration);
}

/** Bibliothèque des sons ; `t` = instant de départ dans le contexte audio. */
export function synth(g: Graph, name: SoundName, t: number, { index = 0, velocity = 0, variant = 0, pan = 0 }: SoundOptions = {}) {
  switch (name) {
    case "hover": // tic bref et feutré, légèrement différent à chaque survol
      tone(g, t, { freq: (variant ? 3100 : 2500) * (1 + (Math.random() - 0.5) * 0.04), gain: 0.022, attack: 0.002, decay: 0.03, send: 0.04, pan });
      break;
    case "click": // clic net : transitoire + deux partiels
      hiss(g, t, { type: "highpass", freq: 5000, gain: 0.035, attack: 0.001, decay: 0.012, send: 0, pan });
      tone(g, t, { freq: 1320, gain: 0.06, decay: 0.07, send: 0.12, pan });
      tone(g, t, { freq: 660, type: "triangle", gain: 0.045, decay: 0.09, send: 0.08, pan });
      break;
    case "confirm": // arpège montant : appel à l'action
      [0, 2, 4].forEach((step, k) => bell(g, t, note(step + 3), 0.07, 0.6, pan, 0.4, k * 0.06));
      break;
    case "chapter": // carillon du chapitre (la note monte avec l'histoire) + balayage de scan
      bell(g, t, note(index + 2), 0.085, 1.2, pan, 0.45);
      bell(g, t, note(index + 2) / 2, 0.035, 0.9, -pan, 0.45, 0.04);
      hiss(g, t, { freq: 500, to: 3600, q: 2.5, gain: 0.03, attack: 0.12, decay: 0.28, send: 0.3, pan });
      break;
    case "specimen": // changement de spécimen : note grave + petit servo
      bell(g, t, note(index * 2) / 2, 0.075, 1, pan, 0.4);
      tone(g, t, { freq: 140, to: 260, type: "triangle", gain: 0.03, attack: 0.02, decay: 0.16, send: 0.05, pan });
      break;
    case "step": // relevé d'instrument : bip numérique double
      tone(g, t, { freq: note(index + 5), type: "triangle", gain: 0.028, attack: 0.002, decay: 0.045, send: 0.15, pan });
      tone(g, t, { freq: note(index + 5) * 2, gain: 0.012, attack: 0.002, decay: 0.03, send: 0.1, pan, at: 0.045 });
      break;
    case "ping": {
      // pathologie détectée : alerte douce, deux tons descendants (une quarte)
      const freq = note(index + 6);
      tone(g, t, { freq, gain: 0.05, decay: 0.12, send: 0.45, pan });
      tone(g, t, { freq: freq * 0.75, gain: 0.045, decay: 0.3, send: 0.5, pan, at: 0.1 });
      break;
    }
    case "flip": {
      // dossier qui passe : souffle filtré, plus vif si l'on feuillette vite
      const v = Math.min(Math.max(Math.abs(velocity), 0.25), 1);
      hiss(g, t, { freq: 900, to: 3200 + 1800 * v, q: 0.9, gain: 0.035 + 0.045 * v, attack: 0.012, decay: 0.1 + 0.08 * v, send: 0.12, pan });
      tone(g, t, { freq: 120, to: 80, gain: 0.05, decay: 0.09, send: 0, pan });
      break;
    }
    case "expand":
      tone(g, t, { freq: 440, to: 880, type: "triangle", gain: 0.05, attack: 0.01, decay: 0.16, send: 0.2, pan });
      bell(g, t, note(7), 0.04, 0.5, pan, 0.4, 0.12);
      break;
    case "collapse":
      tone(g, t, { freq: 880, to: 440, type: "triangle", gain: 0.05, attack: 0.01, decay: 0.16, send: 0.2, pan });
      break;
    case "switch": // interrupteur (thème) : clac mécanique, plus aigu vers le clair
      hiss(g, t, { type: "highpass", freq: 3500, gain: 0.05, attack: 0.001, decay: 0.015, send: 0.05, pan });
      tone(g, t, { freq: 180, gain: 0.05, decay: 0.05, send: 0, pan });
      tone(g, t, { freq: variant ? 1568 : 1046.5, gain: 0.045, decay: 0.1, send: 0.2, pan, at: 0.018 });
      break;
    case "open":
      tone(g, t, { freq: 620, to: 930, gain: 0.04, attack: 0.006, decay: 0.12, send: 0.2, pan });
      break;
    case "close":
      tone(g, t, { freq: 930, to: 620, gain: 0.035, attack: 0.006, decay: 0.1, send: 0.15, pan });
      break;
    case "lens": // loupe d'inspection : glissando doux
      tone(g, t, { freq: 700, to: 1400, gain: 0.025, attack: 0.03, decay: 0.2, send: 0.4, pan });
      break;
    case "on":
      [0, 2, 4, 7].forEach((step, k) => bell(g, t, note(step), 0.06, 0.7, pan, 0.45, k * 0.07));
      break;
    case "off":
      [4, 0].forEach((step, k) => bell(g, t, note(step), 0.05, 0.4, pan, 0.3, k * 0.08));
      break;
    case "enter": // ouverture du formulaire : souffle qui monte avec le cercle, note grave posée dessous
      hiss(g, t, { freq: 320, to: 2600, q: 1.4, gain: 0.05, attack: 0.45, decay: 0.55, send: 0.35, pan });
      bell(g, t, note(0) / 2, 0.045, 1.4, pan, 0.5, 0.3);
      break;
    case "door": // porte cochère : déclic du pêne, puis le battant lourd qui s'ouvre sur le hall
      hiss(g, t, { type: "highpass", freq: 3800, gain: 0.05, attack: 0.001, decay: 0.02, send: 0.1, pan });
      tone(g, t, { freq: 920, gain: 0.03, attack: 0.001, decay: 0.03, send: 0.15, pan });
      tone(g, t, { freq: 72, to: 50, gain: 0.09, attack: 0.04, decay: 0.45, send: 0.2, pan, at: 0.08 });
      hiss(g, t + 0.1, { type: "lowpass", freq: 520, to: 260, q: 0.7, gain: 0.07, attack: 0.25, decay: 1.1, send: 0.6, pan });
      break;
    case "exit": // fermeture : le souffle redescend
      hiss(g, t, { freq: 2600, to: 300, q: 1.4, gain: 0.08, attack: 0.12, decay: 0.65, send: 0.3, pan });
      break;
    case "success": // demande envoyée : arpège majeur montant et scintillement
      [0, 2, 4, 7, 9].forEach((step, k) => bell(g, t, note(step + 3), 0.06, 0.9, pan, 0.5, k * 0.075));
      hiss(g, t + 0.3, { type: "highpass", freq: 7000, gain: 0.012, attack: 0.3, decay: 1.2, send: 0.6, pan });
      break;
    case "error": // champ à compléter : deux notes douces descendantes
      tone(g, t, { freq: 330, type: "triangle", gain: 0.05, decay: 0.12, send: 0.15, pan });
      tone(g, t, { freq: 247, type: "triangle", gain: 0.05, decay: 0.2, send: 0.15, pan, at: 0.11 });
      break;
  }
}

/* ───────────────────────── Moteur du site (contexte audio réel) ───────────────────────── */

const hasWindow = typeof window !== "undefined";

type Engine = {
  context: AudioContext;
  graph: Graph;
  master: GainNode;
  /** Couche "air" : souffle filtré qui suit la vitesse de défilement, muet à l'arrêt. */
  air: { gain: GainNode; filter: BiquadFilterNode; level: number };
};

let engine: Engine | null = null;
let resuming = false;
let enabled = readPreference();
const listeners = new Set<() => void>();
const lastPlayed = new Map<SoundName, number>();

function readPreference() {
  if (!hasWindow) return true;
  try {
    return localStorage.getItem(SOUND_STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

const notify = () => listeners.forEach((listener) => listener());

export function subscribeSound(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSoundState(): SoundState {
  if (!enabled) return "off";
  return engine?.context.state === "running" ? "on" : "armed";
}

function createEngine(): Engine | null {
  const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  const context = new Context({ latencyHint: "interactive" });
  context.addEventListener("statechange", notify);
  const master = context.createGain();
  master.gain.value = MASTER_GAIN;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.ratio.value = 8;
  master.connect(limiter).connect(context.destination);
  const graph = createGraph(context, master);

  const source = context.createBufferSource();
  source.buffer = graph.noise;
  source.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 420;
  filter.Q.value = 0.7;
  const gain = context.createGain();
  gain.gain.value = 0;
  source.connect(filter).connect(gain).connect(graph.dry);
  source.start();
  return { context, graph, master, air: { gain, filter, level: 0 } };
}

/** À appeler pendant un geste de l'utilisateur : crée ou relance le contexte audio. */
export function unlockSound() {
  if (!hasWindow || !enabled) return;
  engine ??= createEngine();
  if (!engine || engine.context.state === "running" || resuming) return;
  resuming = true;
  engine.context
    .resume()
    .catch(() => {})
    .finally(() => {
      resuming = false;
      notify();
    });
}

export function setSoundEnabled(next: boolean) {
  enabled = next;
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, next ? "on" : "off");
  } catch {
    // Stockage indisponible (navigation privée) : le choix vaut pour la session.
  }
  if (next) {
    unlockSound();
    if (engine) {
      const t = engine.context.currentTime;
      engine.master.gain.cancelScheduledValues(t);
      engine.master.gain.setTargetAtTime(MASTER_GAIN, t, 0.02);
    }
    playSound("on");
  } else if (engine) {
    // Petit signal de confirmation, puis fondu et mise en veille du contexte.
    const { context, graph, master } = engine;
    synth(graph, "off", context.currentTime + 0.005);
    master.gain.setTargetAtTime(0, context.currentTime + 0.25, 0.06);
    window.setTimeout(() => {
      if (!enabled) engine?.context.suspend().catch(() => {});
    }, 700);
  }
  notify();
}

/** Onglet masqué : le contexte est mis en veille, puis relancé au retour (geste déjà accordé). */
export function pauseSound(hidden: boolean) {
  if (!engine) return;
  if (hidden) engine.context.suspend().catch(() => {});
  else if (enabled) engine.context.resume().catch(() => {});
}

export function playSound(name: SoundName, options?: SoundOptions) {
  if (!engine || !enabled) return;
  const { context, graph } = engine;
  if (context.state !== "running" && !resuming) return;
  const t = context.currentTime;
  const gap = MIN_GAP[name];
  if (gap && t - (lastPlayed.get(name) ?? -Infinity) < gap) return;
  lastPlayed.set(name, t);
  synth(graph, name, t + 0.005, options);
}

/** Vitesse de défilement normalisée (-1 → 1, signe = sens) : volume et brillance du souffle. */
export function setMotion(velocity: number) {
  if (!engine || engine.context.state !== "running") return;
  const { context, air } = engine;
  const speed = Math.min(Math.abs(velocity), 1);
  const level = enabled ? speed * speed * 0.09 : 0;
  if (Math.abs(level - air.level) < 0.0005) return;
  air.level = level;
  const t = context.currentTime;
  air.gain.gain.setTargetAtTime(level, t, 0.09);
  air.filter.frequency.setTargetAtTime((420 + speed * 2400) * (velocity < 0 ? 0.82 : 1), t, 0.12);
}
