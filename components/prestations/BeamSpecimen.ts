import * as THREE from "three";
import { createLineMaterial, createPolylineTube, createSpecimenMaterial } from "@/components/stage/shaders";
import { phase } from "@/components/stage/state";
import { MATTER, applyVisibility, arrow, box, disposeTree, ease, setLabel, type Specimen } from "./parts";

const SPAN = 5.4;
const DEPTH = 0.5;
const WIDTH = 0.35;
const AXIS_Y = 1.25;
const MAX_DEFLECTION = 0.3;
const DIAGRAM_Y = 0.5;
const DIAGRAM_SCALE = 0.36;
/** Devant les massifs d'appui, pour que le diagramme ne soit pas masqué. */
const DIAGRAM_Z = 0.34;

/** Déformée normalisée d'une poutre sur deux appuis sous charge répartie (1 à mi-portée). */
const shape = (xi: number) => 3.2 * (xi - 2 * xi ** 3 + xi ** 4);

/**
 * 04 — Vérification d'une poutre : mise en charge, déformée exagérée, contraintes
 * (compression en haut, traction en bas) et diagramme du moment fléchissant.
 */
export function createBeamSpecimen(): Specimen {
  const root = new THREE.Group();
  const dissolve = { value: 1 };
  const deflect = { value: 0 };
  const stressMix = { value: 0 };
  const load = { value: 0 };
  const beamMaterial = createSpecimenMaterial("beam", {
    ...MATTER.concrete,
    dissolve,
    uniforms: {
      uDeflect: deflect,
      uHalfSpan: { value: SPAN / 2 },
      uHalfDepth: { value: DEPTH / 2 },
      uStressMix: stressMix,
      uLoad: load,
    },
  });
  const concrete = createSpecimenMaterial("plain", { ...MATTER.concreteDark, dissolve });
  const steel = createSpecimenMaterial("steel", { ...MATTER.steel, dissolve });
  const accent = createSpecimenMaterial("plain", { color: "#5fd4ff", colorLight: "#2337c6", dissolve });
  accent.uniforms.uEmissive.value = 0.9;

  const beam = new THREE.Mesh(new THREE.BoxGeometry(SPAN, DEPTH, WIDTH, 108, 8, 1), beamMaterial);
  beam.position.y = AXIS_Y;
  root.add(beam);

  for (const sx of [-1, 1]) {
    const x = sx * (SPAN / 2 - 0.1);
    root.add(box([x - 0.3, 0, -0.3], [x + 0.3, 0.72, 0.3], concrete));
    const support = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.28, 4), steel);
    support.position.set(x, 0.72 + 0.14, 0);
    support.rotation.y = Math.PI / 4;
    root.add(support);
  }

  // Contour non déformé (référence) et diagramme du moment fléchissant.
  const top = AXIS_Y + DEPTH / 2;
  const bottom = AXIS_Y - DEPTH / 2;
  const front = WIDTH / 2 + 0.01;
  const outline = createPolylineTube(
    [[-SPAN / 2, bottom, front], [SPAN / 2, bottom, front], [SPAN / 2, top, front], [-SPAN / 2, top, front], [-SPAN / 2, bottom, front]],
    0.008,
  );
  const outlineMaterial = createLineMaterial(outline.length, { dash: 0.1, speed: 0.08, opacity: 0.55 });
  outlineMaterial.uniforms.uDraw.value = 1;
  root.add(new THREE.Mesh(outline.geometry, outlineMaterial));

  const diagram = new THREE.Group();
  diagram.position.y = DIAGRAM_Y;
  const samples = 64;
  const curve: [number, number, number][] = [];
  const fillPositions: number[] = [];
  const fillUvs: number[] = [];
  for (let i = 0; i <= samples; i++) {
    const xi = i / samples;
    const x = -SPAN / 2 + xi * SPAN;
    const m = -4 * xi * (1 - xi) * DIAGRAM_SCALE;
    curve.push([x, m, DIAGRAM_Z]);
    fillPositions.push(x, 0, DIAGRAM_Z, x, m, DIAGRAM_Z);
    fillUvs.push(xi, 0, xi, 1);
  }
  const curveTube = createPolylineTube(curve, 0.012);
  const curveMaterial = createLineMaterial(curveTube.length, { opacity: 1 });
  diagram.add(new THREE.Mesh(curveTube.geometry, curveMaterial));
  const baseline = createPolylineTube([[-SPAN / 2, 0, DIAGRAM_Z], [SPAN / 2, 0, DIAGRAM_Z]], 0.006);
  const baselineMaterial = createLineMaterial(baseline.length, { opacity: 0.6 });
  diagram.add(new THREE.Mesh(baseline.geometry, baselineMaterial));
  const fillGeometry = new THREE.BufferGeometry();
  fillGeometry.setAttribute("position", new THREE.Float32BufferAttribute(fillPositions, 3));
  fillGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(fillUvs, 2));
  const fillIndex: number[] = [];
  for (let i = 0; i < samples; i++) fillIndex.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  fillGeometry.setIndex(fillIndex);
  const fillMaterial = createLineMaterial(SPAN, { opacity: 0.14 });
  fillMaterial.side = THREE.DoubleSide;
  diagram.add(new THREE.Mesh(fillGeometry, fillMaterial));
  root.add(diagram);

  const arrows: THREE.Group[] = [];
  for (let i = 0; i < 12; i++) {
    const a = arrow(accent, 0.6, 0.011);
    arrows.push(a);
    root.add(a);
  }

  const anchor = new THREE.Vector3();

  return {
    root,
    translucent: [outlineMaterial, curveMaterial, baselineMaterial, fillMaterial],
    update({ p, time, labels, visibility }) {
      applyVisibility(root, dissolve, visibility);
      load.value = ease.out(phase(p, 0.0, 0.3));
      deflect.value = MAX_DEFLECTION * ease.inOut(phase(p, 0.2, 0.6));
      stressMix.value = ease.inOut(phase(p, 0.35, 0.7));
      arrows.forEach((a, i) => {
        const xi = (i + 0.5) / arrows.length;
        const x = -SPAN / 2 + xi * SPAN;
        a.position.set(x, top + 0.02 - deflect.value * shape(xi) + Math.sin(time * 3 + i) * 0.015 * load.value, 0);
        a.scale.set(1, Math.max(load.value, 0.001), 1);
        a.visible = load.value > 0.001;
      });
      outlineMaterial.uniforms.uOpacity.value = 0.55 * visibility * phase(deflect.value, 0.02, 0.1);
      const draw = ease.out(phase(p, 0.6, 0.95));
      [curveMaterial, baselineMaterial, fillMaterial].forEach((material) => {
        material.uniforms.uDraw.value = draw;
      });
      curveMaterial.uniforms.uOpacity.value = visibility;
      baselineMaterial.uniforms.uOpacity.value = 0.6 * visibility;
      fillMaterial.uniforms.uOpacity.value = 0.14 * visibility;
      setLabel(labels, "fleche", anchor.set(0, bottom - deflect.value - 0.03, front), phase(p, 0.5, 0.62) * visibility);
      setLabel(labels, "moment", anchor.set(0, DIAGRAM_Y - DIAGRAM_SCALE - 0.02, DIAGRAM_Z), phase(p, 0.88, 0.97) * visibility);
    },
    dispose() {
      disposeTree(root);
    },
  };
}
