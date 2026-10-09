import * as THREE from "three";
import { createLineMaterial, createPolylineTube, createSpecimenMaterial } from "@/components/stage/shaders";
import { phase } from "@/components/stage/state";
import { MATTER, adoptModel, applyVisibility, arrow, box, disposeTree, ease, setLabel, type Specimen, type StageAssets } from "./parts";

/**
 * 02 — Ouverture dans un mur porteur, dans l'ordre du chantier :
 * implantation, pose du linteau HEB sur platines, dépose de la maçonnerie, report des charges.
 */
export function createOpeningSpecimen(assets: StageAssets): Specimen {
  const root = new THREE.Group();
  const dissolve = { value: 1 };
  const blockDissolve = { value: 0 };
  const masonry = createSpecimenMaterial("masonry", { ...MATTER.brick, dissolve });
  const block = createSpecimenMaterial("masonry", { ...MATTER.brick, dissolve: blockDissolve });
  const concrete = createSpecimenMaterial("plain", { ...MATTER.concrete, dissolve });
  const steel = createSpecimenMaterial("steel", { ...MATTER.steel, dissolve });
  const accent = createSpecimenMaterial("plain", { color: "#5fd4ff", colorLight: "#2337c6", dissolve });
  accent.uniforms.uEmissive.value = 0.9;

  const t = 0.18;
  root.add(box([-3.7, -0.25, -1.1], [3.7, 0, 1.1], concrete));
  root.add(box([-3.7, 3.4, -1.1], [3.7, 3.65, 1.1], concrete));
  root.add(box([-3.2, 0, -t], [-1.2, 3.4, t], masonry));
  root.add(box([1.2, 0, -t], [3.2, 3.4, t], masonry));
  root.add(box([-1.2, 2.3, -t], [1.2, 3.4, t], masonry));
  const removed = box([-1.2, 0, -t], [1.2, 2.3, t], block);
  root.add(removed);

  // Linteau HEB 300 modélisé dans Blender (heb.glb) : congés, raidisseurs, platines, tiges d'ancrage.
  const anchorSteel = createSpecimenMaterial("steel", { color: "#8a929c", colorLight: "#9aa2ac", dissolve });
  const lintel = new THREE.Group();
  lintel.add(adoptModel(assets.heb, { steel, anchor: anchorSteel }, steel));
  lintel.position.set(0, 2.45, t + 0.15);
  root.add(lintel);

  // Implantation de l'ouverture (pointillés d'alerte) et chemins de descente des charges.
  const z = t + 0.34;
  const outline = createPolylineTube([[-1.2, 0.02, t + 0.01], [-1.2, 2.3, t + 0.01], [1.2, 2.3, t + 0.01], [1.2, 0.02, t + 0.01]], 0.012);
  const outlineMaterial = createLineMaterial(outline.length, { dash: 0.14, speed: 0.15, alert: true });
  root.add(new THREE.Mesh(outline.geometry, outlineMaterial));
  const paths = [
    [[-2.6, 3.4, z], [-2.6, 0.05, z]],
    [[2.6, 3.4, z], [2.6, 0.05, z]],
    [[-0.5, 3.4, z], [-0.5, 2.65, z], [-1.48, 2.65, z], [-1.48, 0.05, z]],
    [[0.5, 3.4, z], [0.5, 2.65, z], [1.48, 2.65, z], [1.48, 0.05, z]],
  ] as [number, number, number][][];
  const pathMaterials = paths.map((points) => {
    const tube = createPolylineTube(points, 0.016);
    const material = createLineMaterial(tube.length, { dash: 0.16, speed: 0.5 });
    root.add(new THREE.Mesh(tube.geometry, material));
    return material;
  });

  // Charges réparties sur le plancher haut.
  const loads = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const a = arrow(accent, 0.55, 0.011);
    a.position.set(-3 + i * 0.75, 3.68, 0.2);
    loads.add(a);
  }
  root.add(loads);

  const anchor = new THREE.Vector3();

  return {
    root,
    translucent: [outlineMaterial, ...pathMaterials],
    update({ p, time, labels, visibility }) {
      applyVisibility(root, dissolve, visibility);
      outlineMaterial.uniforms.uDraw.value = phase(p, 0.0, 0.18);
      outlineMaterial.uniforms.uOpacity.value = visibility * (1 - phase(p, 0.6, 0.8));
      const slide = ease.out(phase(p, 0.2, 0.48));
      lintel.position.x = (1 - slide) * 7;
      lintel.visible = slide > 0.001;
      blockDissolve.value = Math.max(dissolve.value, ease.inOut(phase(p, 0.5, 0.76)));
      removed.visible = blockDissolve.value < 0.999;
      const load = ease.out(phase(p, 0.74, 0.86));
      loads.children.forEach((child, i) => {
        child.scale.set(1, Math.max(load, 0.001), 1);
        child.position.y = 3.68 + Math.sin(time * 3 + i * 0.7) * 0.02 * load;
      });
      loads.visible = load > 0.001;
      pathMaterials.forEach((material) => {
        material.uniforms.uDraw.value = ease.out(phase(p, 0.8, 1));
        material.uniforms.uOpacity.value = visibility;
      });
      setLabel(labels, "heb", anchor.set(0.4, 2.62, t + 0.32), phase(p, 0.42, 0.52) * visibility);
      setLabel(labels, "charges", anchor.set(-0.5, 3.05, z), phase(p, 0.86, 0.95) * visibility);
    },
    dispose() {
      disposeTree(root);
    },
  };
}
