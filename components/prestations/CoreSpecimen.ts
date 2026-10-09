import * as THREE from "three";
import { createSpecimenMaterial } from "@/components/stage/shaders";
import { phase } from "@/components/stage/state";
import { MATTER, applyVisibility, box, disposeTree, ease, setLabel, type Specimen } from "./parts";

const RADIUS = 0.21;
const HEIGHT = 0.42;
const SLAB_TOP = 0.35;
const HOLE: [number, number] = [0.5, 0.3];
/** Profondeur carbonatée depuis la face exposée, et position de l'armature (dans la zone carbonatée). */
const CARBONATION = 0.085;
const REBAR_FROM_TOP = 0.07;

/**
 * 03 — Carottage et test de carbonatation : la carotte sort de la dalle, se fend,
 * la phénolphtaléine colore en rose le béton sain ; la zone carbonatée reste grise.
 */
export function createCoreSpecimen(): Specimen {
  const root = new THREE.Group();
  const dissolve = { value: 1 };
  const spray = { value: 0 };
  const slab = createSpecimenMaterial("slab", {
    ...MATTER.concrete,
    dissolve,
    uniforms: { uHoleCenter: { value: new THREE.Vector2(...HOLE) }, uHoleRadius: { value: RADIUS + 0.012 } },
  });
  slab.side = THREE.DoubleSide;
  const hole = createSpecimenMaterial("plain", { ...MATTER.hole, dissolve, params: { side: THREE.BackSide } });
  const skin = createSpecimenMaterial("plain", { ...MATTER.concrete, dissolve, params: { side: THREE.DoubleSide } });

  root.add(box([-2.1, 0, -1.4], [2.1, SLAB_TOP, 1.4], slab));
  const holeWall = new THREE.Mesh(new THREE.CylinderGeometry(RADIUS + 0.012, RADIUS + 0.012, SLAB_TOP, 40, 1, true), hole);
  holeWall.position.set(HOLE[0], SLAB_TOP / 2, HOLE[1]);
  root.add(holeWall);

  // Carotte en deux demi-cylindres ; chaque face fendue porte le test (shader "coreFace").
  const core = new THREE.Group();
  const halves = [0, 1].map((side) => {
    const half = new THREE.Group();
    const thetaStart = side === 0 ? 0 : Math.PI;
    half.add(new THREE.Mesh(new THREE.CylinderGeometry(RADIUS, RADIUS, HEIGHT, 40, 1, true, thetaStart, Math.PI), skin));
    for (const y of [-HEIGHT / 2, HEIGHT / 2]) {
      const cap = new THREE.Mesh(new THREE.CircleGeometry(RADIUS, 24, 0, Math.PI), skin);
      cap.rotation.set(-Math.PI / 2, 0, side === 0 ? -Math.PI / 2 : Math.PI / 2);
      cap.position.y = y;
      half.add(cap);
    }
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(RADIUS * 2, HEIGHT),
      createSpecimenMaterial("coreFace", {
        ...MATTER.concrete,
        dissolve,
        uniforms: {
          uSpray: spray,
          uCarbonation: { value: CARBONATION },
          uCoreHalf: { value: HEIGHT / 2 },
          uRebarPos: { value: new THREE.Vector2(side === 0 ? 0.06 : -0.06, HEIGHT / 2 - REBAR_FROM_TOP) },
        },
        params: { side: THREE.DoubleSide },
      }),
    );
    face.rotation.y = side === 0 ? -Math.PI / 2 : Math.PI / 2;
    half.add(face);
    core.add(half);
    return { group: half, face };
  });
  root.add(core);

  const anchor = new THREE.Vector3();

  return {
    root,
    translucent: [],
    update({ p, time, labels, visibility }) {
      applyVisibility(root, dissolve, visibility);
      // Extraction, puis ouverture "en livre" face à la caméra, puis pulvérisation.
      const lift = ease.out(phase(p, 0.0, 0.32));
      const open = ease.inOut(phase(p, 0.3, 0.52));
      core.position.set(HOLE[0], SLAB_TOP - HEIGHT / 2 + lift * 0.95, HOLE[1]);
      core.rotation.y = (1 - open) * (time * 0.25 + lift * 1.2) + open * 0.55;
      halves.forEach(({ group }, side) => {
        const dir = side === 0 ? 1 : -1;
        group.position.x = dir * open * 0.3;
        group.rotation.y = dir * open * Math.PI * 0.42;
      });
      spray.value = ease.inOut(phase(p, 0.52, 0.8));

      const reveal = phase(p, 0.8, 0.92) * visibility;
      halves[0].face.localToWorld(anchor.set(-RADIUS * 0.4, HEIGHT / 2 - CARBONATION, 0));
      setLabel(labels, "front", anchor, reveal);
      halves[1].face.localToWorld(anchor.set(-0.06, HEIGHT / 2 - REBAR_FROM_TOP, 0));
      setLabel(labels, "armature", anchor, phase(p, 0.86, 0.96) * visibility);
    },
    dispose() {
      disposeTree(root);
    },
  };
}
