import * as THREE from "three";
import { createBeamMaterial, createSpecimenMaterial } from "@/components/stage/shaders";
import { phase } from "@/components/stage/state";
import { MATTER, adoptModel, applyVisibility, box, disposeTree, ease, setLabel, type Specimen, type StageAssets } from "./parts";

/** 01 — Inspection d'une pile d'ouvrage par drone (cf. réalisation du viaduc de la N01). */
export function createDroneSpecimen(assets: StageAssets): Specimen {
  const root = new THREE.Group();
  const dissolve = { value: 1 };
  const scanY = { value: 0 };
  const concrete = createSpecimenMaterial("plain", { ...MATTER.concrete, dissolve });
  const pier = createSpecimenMaterial("pier", { ...MATTER.concrete, dissolve, uniforms: { uScanY: scanY } });
  const steel = createSpecimenMaterial("steel", { ...MATTER.steel, dissolve });

  // Pile : semelle enterrée, fût, chevêtre, appareils d'appui, amorce de tablier.
  root.add(box([-1.2, -0.4, -1.2], [1.2, 0, 1.2], concrete));
  root.add(box([-0.65, 0, -0.65], [0.65, 5.6, 0.65], pier));
  root.add(box([-1.9, 5.6, -0.85], [1.9, 6.4, 0.85], pier));
  root.add(box([-1.35, 6.4, -0.3], [-0.85, 6.52, 0.3], steel));
  root.add(box([0.85, 6.4, -0.3], [1.35, 6.52, 0.3], steel));
  root.add(box([-2.7, 6.52, -1.3], [2.7, 7.07, 1.3], concrete));

  // Drone modélisé dans Blender (drone.glb) ; matériaux remplacés par ceux du site, d'après leur nom.
  const body = createSpecimenMaterial("steel", { ...MATTER.drone, dissolve });
  const shell = createSpecimenMaterial("plain", { ...MATTER.shell, dissolve });
  const blade = createSpecimenMaterial("steel", { color: "#1d2128", colorLight: "#2b3038", dissolve });
  const led = createSpecimenMaterial("plain", { color: "#ff6a1f", colorLight: "#e2531a", dissolve });
  led.uniforms.uEmissive.value = 1.6;
  const lens = createSpecimenMaterial("plain", { color: "#5fd4ff", colorLight: "#2337c6", dissolve });
  lens.uniforms.uEmissive.value = 1.2;
  const drone = new THREE.Group();
  const model = adoptModel(
    assets.drone,
    { drone_body: body, drone_shell: shell, drone_prop: blade, drone_led: led, drone_lens: lens },
    body,
  );
  drone.add(model);
  const props: THREE.Object3D[] = [];
  model.traverse((object) => {
    if (object.name.startsWith("prop_")) props.push(object);
  });
  // Disques translucides : suggèrent le flou de rotation des hélices.
  const blurMaterial = new THREE.MeshBasicMaterial({ color: "#9fdcff", transparent: true, opacity: 0.12, depthWrite: false });
  props.forEach((prop) => {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.135, 32), blurMaterial);
    disc.rotation.x = -Math.PI / 2;
    disc.position.copy(prop.position);
    model.add(disc);
  });
  drone.scale.setScalar(1.5);

  // Faisceau de la caméra vers la pile (pointe sur le drone, base sur le parement).
  const beamLength = 1.0;
  const beamGeometry = new THREE.CylinderGeometry(0.03, 0.62, beamLength, 32, 1, true);
  beamGeometry.rotateX(-Math.PI / 2);
  beamGeometry.translate(0, 0, beamLength / 2);
  const beamMaterial = createBeamMaterial();
  const beam = new THREE.Mesh(beamGeometry, beamMaterial);
  beam.position.set(0, -0.065, 0.17);
  drone.add(beam);
  root.add(drone);

  const target = new THREE.Vector3();
  const anchor = new THREE.Vector3();

  return {
    root,
    translucent: [beamMaterial],
    update({ p, time, delta, labels, visibility }) {
      applyVisibility(root, dissolve, visibility);
      // Le drone tourne autour de la pile en montant : la ligne de scan suit sa hauteur.
      const k = ease.inOut(phase(p, 0.05, 0.95));
      const angle = 0.95 - k * 2.3 + Math.sin(time * 0.35) * 0.04;
      const radius = 2.45;
      const y = 0.9 + k * 5.1 + Math.sin(time * 1.8) * 0.04;
      drone.position.set(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
      drone.lookAt(target.set(0, y, 0));
      drone.rotateZ(Math.sin(time * 1.3) * 0.05);
      props.forEach((prop, i) => {
        prop.rotation.y += delta * (i % 2 === 0 ? 17 : -17);
      });
      beamMaterial.uniforms.uOpacity.value = visibility * (0.4 + 0.6 * phase(p, 0.03, 0.12));
      scanY.value = y - 0.15;

      const crackSeen = phase(scanY.value, 2.2, 2.6) * phase(p, 0.2, 0.3);
      const spallSeen = phase(scanY.value, 5.5, 5.8) * phase(p, 0.75, 0.85);
      setLabel(labels, "fissure", anchor.set(0.2, 2.5, 0.66), crackSeen * visibility);
      setLabel(labels, "epaufrure", anchor.set(1.62, 5.85, 0.86), spallSeen * visibility);
    },
    dispose() {
      disposeTree(root);
    },
  };
}
