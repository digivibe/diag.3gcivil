"use client";

import { useGLTF, useTexture } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { common, output } from "@/components/experience/shaders/chunks";
import { uniforms as shared } from "@/components/experience/uniforms";
import { adoptModel } from "@/components/prestations/parts";
import { playSound } from "@/components/sound/engine";
import { createSpecimenMaterial } from "@/components/stage/shaders";
import { StageCanvas, useStagePointer } from "@/components/stage/StageCanvas";
import { StageGround } from "@/components/stage/StageGround";
import { archiveState } from "@/components/stage/state";
import { REALISATIONS } from "@/lib/content";

/** Dossier modélisé dans Blender (coins arrondis, onglet, chants biseautés) : scripts/blender/stage_assets.py. */
const DOSSIER_URL = "/models/dossier.glb";
const PHOTO_W = 3.06;
const PHOTO_H = 2.06;

const photoVertex = /* glsl */ `
${common}
varying vec2 vUv;
varying float vDepth;
void main() {
  vUv = uv;
  vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

/**
 * Face photo d'un dossier : image en "cover", désaturée tant qu'elle n'est pas active,
 * révélée par une ligne de scan, aberration chromatique liée à la vitesse,
 * loupe d'inspection sous le pointeur.
 */
const photoFragment = /* glsl */ `
${common}
uniform sampler2D uMap;
uniform float uImageAspect;
uniform float uPlaneAspect;
uniform float uActive;
uniform float uReveal;
uniform float uVelocity;
uniform vec2 uPointer;
uniform float uLoupe;
varying vec2 vUv;
varying float vDepth;

vec2 cover(vec2 uv) {
  vec2 scale = uImageAspect > uPlaneAspect ? vec2(uPlaneAspect / uImageAspect, 1.0) : vec2(1.0, uImageAspect / uPlaneAspect);
  return (uv - 0.5) * scale + 0.5;
}

void main() {
  vec2 box = vec2(uPlaneAspect, 1.0) * 0.5;
  vec2 q = abs(vUv - 0.5) * vec2(uPlaneAspect, 1.0) - (box - 0.035);
  if (length(max(q, 0.0)) > 0.035) discard;
  vec2 d = (vUv - uPointer) * vec2(uPlaneAspect, 1.0);
  float r = length(d);
  float lens = uLoupe * (1.0 - smoothstep(0.205, 0.215, r));
  vec2 uv = cover(mix(vUv, uPointer + (vUv - uPointer) * 0.5, lens));
  float shift = clamp(uVelocity, -1.0, 1.0) * 0.006;
  vec3 col = vec3(texture2D(uMap, uv + vec2(shift, 0.0)).r, texture2D(uMap, uv).g, texture2D(uMap, uv - vec2(shift, 0.0)).b);

  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  vec3 idle = mix(vec3(lum), col, 0.12) * (uTheme > 0.5 ? 0.92 : 0.42);
  col = mix(idle, col, uActive);

  // Révélation par balayage du haut vers le bas, trame technique sous la ligne.
  float y = 1.0 - vUv.y;
  float revealed = step(y, uReveal * 1.04);
  vec2 g = abs(fract(vUv * vec2(uPlaneAspect, 1.0) * 14.0 - 0.5) - 0.5) / fwidth(vUv * vec2(uPlaneAspect, 1.0) * 14.0);
  float grid = 1.0 - min(min(g.x, g.y), 1.0);
  vec3 blueprint = glow(idle * 0.6, uScanColor, grid * 0.35);
  col = mix(blueprint, col, revealed);
  col = glow(col, uScanColor, (1.0 - smoothstep(0.0, 0.012, abs(y - uReveal * 1.04))) * step(uReveal, 0.999) * 3.0);

  col = glow(col, uScanColor, (1.0 - smoothstep(0.0, 0.006, abs(r - 0.21))) * uLoupe * 2.0);
  vec2 e = min(vUv, 1.0 - vUv) * vec2(uPlaneAspect, 1.0);
  col *= 0.82 + 0.18 * smoothstep(0.0, 0.25, min(e.x, e.y));
  col = mix(col, uFogColor, fogFactor(vDepth));
  gl_FragColor = vec4(col, 1.0);
  ${output}
}
`;

function createCards(textures: THREE.Texture[], dossier: THREE.Object3D) {
  const geometry = new THREE.PlaneGeometry(PHOTO_W, PHOTO_H);
  const paper = createSpecimenMaterial("plain", { color: "#20252d", colorLight: "#f3f4f6", dissolve: { value: 0 } });
  const edge = createSpecimenMaterial("plain", { color: "#5fd4ff", colorLight: "#2337c6", dissolve: { value: 0 } });
  edge.uniforms.uEmissive.value = 0.6;
  return textures.map((texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const image = texture.image as { width: number; height: number };
    const photo = new THREE.ShaderMaterial({
      uniforms: {
        ...shared,
        uMap: { value: texture },
        uImageAspect: { value: image.width / image.height },
        uPlaneAspect: { value: PHOTO_W / PHOTO_H },
        uActive: { value: 0 },
        uReveal: { value: 0 },
        uVelocity: { value: 0 },
        uPointer: { value: new THREE.Vector2(0.5, 0.5) },
        uLoupe: { value: 0 },
      },
      vertexShader: photoVertex,
      fragmentShader: photoFragment,
    });
    const group = new THREE.Group();
    group.add(adoptModel(dossier, { dossier_body: paper, dossier_edge: edge }, paper));
    // La face photo est rattachée au dossier dans le JSX (<primitive> imbriqué) : un <primitive>
    // monté ailleurs la reparenterait et la laisserait à l'origine au lieu de suivre le dossier.
    const face = new THREE.Mesh(geometry, photo);
    face.position.z = 0.004;
    return { mesh: group, face, photo, lensTarget: 0 };
  });
}

/** Position d'un dossier selon son écart au dossier courant : pile derrière, envol une fois consulté. */
function layoutCard(object: THREE.Object3D, offset: number, time: number, index: number) {
  if (offset >= 0) {
    const o = offset;
    object.position.set(1.15 + o * 0.62, 0.15 + o * 0.34, -o * 1.15);
    object.rotation.set(0.04, -0.24 - o * 0.05, 0);
    object.scale.setScalar(1 - Math.min(o, 4) * 0.06);
  } else {
    const q = -offset;
    object.position.set(1.15 - q * 5.4, 0.15 + q * 1.1 + q * q * 1.4, q * 1.8);
    object.rotation.set(-0.3 * q, -0.24 + 0.75 * q, 0.38 * q);
    object.scale.setScalar(1);
  }
  object.position.y += Math.sin(time * 0.8 + index * 1.3) * 0.025;
  object.visible = offset > -1.35 && offset < 4.5;
}

type Card = ReturnType<typeof createCards>[number];

function updateDeck(cards: Card[], time: number, delta: number, pointer: { x: number; y: number }) {
  const t = archiveState.t;
  cards.forEach((card, i) => {
    const offset = i - t;
    layoutCard(card.mesh, offset, time, i);
    const active = 1 - Math.min(Math.abs(offset) * 1.6, 1);
    // Inclinaison au pointeur du dossier actif.
    card.mesh.rotation.x += -pointer.y * 0.07 * active;
    card.mesh.rotation.y += pointer.x * 0.1 * active;
    const u = card.photo.uniforms;
    u.uActive.value = active;
    u.uReveal.value = THREE.MathUtils.clamp(1 - offset * 2.2, 0, 1);
    u.uVelocity.value = THREE.MathUtils.damp(u.uVelocity.value, archiveState.velocity, 6, delta);
    u.uLoupe.value = THREE.MathUtils.damp(u.uLoupe.value, card.lensTarget * active, 8, delta);
  });
}

function Deck() {
  const textures = useTexture(REALISATIONS.map((item) => item.image));
  const dossier = useGLTF(DOSSIER_URL);
  const pointer = useStagePointer();
  const cards = useMemo(() => createCards(textures, dossier.scene), [textures, dossier]);

  useEffect(
    () => () => {
      cards.forEach(({ photo }) => photo.dispose());
      cards[0]?.face.geometry.dispose();
    },
    [cards],
  );

  useFrame((state, delta) => updateDeck(cards, state.clock.elapsedTime, Math.min(delta, 1 / 20), pointer));

  const onMove = (index: number) => (event: ThreeEvent<PointerEvent>) => {
    if (!event.uv) return;
    cards[index].photo.uniforms.uPointer.value.copy(event.uv);
    // La loupe ne s'ouvre que sur le dossier consulté : petit glissando à son ouverture.
    if (cards[index].lensTarget === 0 && index === Math.round(archiveState.t)) playSound("lens", { pan: event.pointer.x * 0.6 });
    setLensTarget(cards[index], 1);
  };
  const onLeave = (index: number) => () => setLensTarget(cards[index], 0);

  return (
    <group position={[0, 0, 0]}>
      {cards.map((card, i) => (
        <primitive key={i} object={card.mesh}>
          <primitive object={card.face} onPointerMove={onMove(i)} onPointerOut={onLeave(i)} />
        </primitive>
      ))}
    </group>
  );
}

function setLensTarget(card: Card, value: number) {
  card.lensTarget = value;
}

function ArchiveCamera() {
  const pointer = useStagePointer();
  useFrame((state, delta) => {
    const { width, height } = state.size;
    const portrait = width / height < 0.9;
    const camera = state.camera as THREE.PerspectiveCamera;
    const k = 1 - Math.exp(-Math.min(delta, 1 / 20) * 3);
    camera.position.x += (1.0 + pointer.x * 0.25 - camera.position.x) * k;
    camera.position.y += (0.6 + pointer.y * 0.15 - camera.position.y) * k;
    camera.position.z = portrait ? 10.5 : 7.8;
    camera.lookAt(1.15, 0.2, -0.6);
    // Décalage optique : la pile se cale à droite du texte (centrée sur mobile, texte dessous).
    camera.setViewOffset(width, height, portrait ? 0 : -0.19 * width, portrait ? 0.12 * height : 0, width, height);
  });
  return null;
}

export default function ArchiveScene({ className }: { className?: string }) {
  return (
    <StageCanvas className={className} camera={{ position: [1.0, 0.6, 7.8], fov: 34 }}>
      <ArchiveCamera />
      <StageGround y={-1.6} />
      <Deck />
    </StageCanvas>
  );
}

useTexture.preload(REALISATIONS.map((item) => item.image));
useGLTF.preload(DOSSIER_URL);
