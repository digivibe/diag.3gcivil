import * as THREE from "three";
import type { StageLabels, StagePointer } from "@/components/stage/StageCanvas";

/** Couleurs des matières (sombre / clair) ; la lumière et l'accent viennent des uniforms partagés. */
export const MATTER = {
  concrete: { color: "#9ea3aa", colorLight: "#dfe2e6" },
  concreteDark: { color: "#6f747b", colorLight: "#c4c8ce" },
  brick: { color: "#8a6a5c", colorLight: "#cdb3a4" },
  steel: { color: "#56606c", colorLight: "#7d8794" },
  drone: { color: "#2b3038", colorLight: "#3b414b" },
  shell: { color: "#c9ced6", colorLight: "#f1f2f4" },
  hole: { color: "#2a2d33", colorLight: "#8f949b" },
} as const;

export type SpecimenFrame = {
  /** Progression locale du spécimen (0 → 1), pilotée par le scroll. */
  p: number;
  visibility: number;
  time: number;
  delta: number;
  pointer: StagePointer;
  labels: StageLabels;
};

/** Modèles Blender chargés par la scène et transmis aux fabriques de spécimens. */
export type StageAssets = {
  drone: THREE.Object3D;
  heb: THREE.Object3D;
};

export type Specimen = {
  root: THREE.Group;
  /** Matériaux translucides dont le mode de fusion suit le thème. */
  translucent: THREE.Material[];
  update(frame: SpecimenFrame): void;
  dispose(): void;
};

/** Boîte alignée sur les axes, géométrie translatée : coordonnées locales = coordonnées du spécimen. */
export function box(min: [number, number, number], max: [number, number, number], material: THREE.Material) {
  const size = max.map((v, i) => v - min[i]) as [number, number, number];
  const geometry = new THREE.BoxGeometry(...size);
  geometry.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  return new THREE.Mesh(geometry, material);
}

/** Flèche (fût + pointe) dirigée vers -Y, pointe à l'origine du groupe. */
export function arrow(material: THREE.Material, length = 0.5, radius = 0.012) {
  const group = new THREE.Group();
  const tipHeight = Math.min(0.13, length * 0.4);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(radius * 4, tipHeight, 12), material);
  tip.rotation.x = Math.PI;
  tip.position.y = tipHeight / 2;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length - tipHeight, 8), material);
  shaft.position.y = tipHeight + (length - tipHeight) / 2;
  group.add(tip, shaft);
  return group;
}

/**
 * Clone un modèle exporté de Blender (scripts/blender/stage_assets.py) et remplace ses matériaux
 * par les shaders du site, d'après le nom du matériau Blender. La géométrie reste partagée avec le cache GLTF.
 */
export function adoptModel(source: THREE.Object3D, materials: Record<string, THREE.Material>, fallback: THREE.Material) {
  const model = source.clone(true);
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const name = (mesh.material as THREE.Material).name;
    mesh.material = materials[name] ?? fallback;
    mesh.userData.sharedGeometry = true;
  });
  return model;
}

export function disposeTree(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry && !mesh.userData.sharedGeometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((m) => materials.add(m));
    else if (material) materials.add(material);
  });
  materials.forEach((material) => material.dispose());
}

/** Début de frame commun : fondu par dissolution et masquage complet hors de son segment. */
export function applyVisibility(root: THREE.Object3D, dissolve: { value: number }, visibility: number) {
  dissolve.value = 1 - visibility;
  root.visible = visibility > 0.001;
}

export function setLabel(labels: StageLabels, id: string, position: THREE.Vector3, visible: number) {
  const entry = labels.get(id);
  if (entry) {
    entry.position.copy(position);
    entry.visible = visible;
  } else {
    labels.set(id, { position: position.clone(), visible });
  }
}

export const ease = {
  out: (x: number) => 1 - Math.pow(1 - x, 3),
  inOut: (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
};
