import * as THREE from "three";
import { common, output, turbo } from "@/components/experience/shaders/chunks";
import { uniforms as shared } from "@/components/experience/uniforms";

/**
 * Matériaux des "spécimens" (scènes des sections Prestations / Réalisations).
 * Ils réutilisent les uniforms partagés de la scène principale (palette, lumière, thème)
 * et ajoutent un fondu par dissolution (bord lumineux) pour passer d'un spécimen à l'autre.
 */
export type SpecimenVariant = "plain" | "steel" | "pier" | "masonry" | "slab" | "coreFace" | "beam";

const vertexShader = /* glsl */ `
${common}
uniform float uDeflect;
uniform float uHalfSpan;
uniform float uHalfDepth;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec3 vLocal;
varying float vDepth;
varying float vStress;

void main() {
  vec3 p = position;
  vec3 n = normal;
  vStress = 0.0;
#ifdef VARIANT_BEAM
  // Poutre sur deux appuis sous charge répartie : déformée normalisée (1 à mi-portée) et contraintes de flexion.
  float xi = clamp((position.x + uHalfSpan) / (2.0 * uHalfSpan), 0.0, 1.0);
  float shape = 3.2 * (xi - 2.0 * xi * xi * xi + xi * xi * xi * xi);
  float slope = 3.2 * (1.0 - 6.0 * xi * xi + 4.0 * xi * xi * xi) / (2.0 * uHalfSpan);
  p.y -= uDeflect * shape;
  float a = atan(uDeflect * slope);
  n = vec3(cos(a) * n.x + sin(a) * n.y, -sin(a) * n.x + cos(a) * n.y, n.z);
  vStress = -4.0 * xi * (1.0 - xi) * clamp(position.y / uHalfDepth, -1.0, 1.0);
#endif
  vLocal = position;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * n);
  vec4 mv = viewMatrix * world;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
${common}
${turbo}
uniform vec3 uColor;
uniform vec3 uColorLight;
uniform float uDissolve;
uniform float uEmissive;
uniform float uScanY;
uniform float uSpray;
uniform float uCarbonation;
uniform float uCoreHalf;
uniform vec2 uRebarPos;
uniform vec2 uHoleCenter;
uniform float uHoleRadius;
uniform float uStressMix;
uniform float uLoad;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec3 vLocal;
varying float vDepth;
varying float vStress;

void main() {
  float dissolveNoise = vnoise(vWorld * 3.1 + 7.0);
  float threshold = uDissolve * 1.15 - 0.08;
  if (dissolveNoise < threshold) discard;
  float edge = (1.0 - smoothstep(0.0, 0.05, dissolveNoise - threshold)) * step(0.001, uDissolve);

#ifdef VARIANT_SLAB
  if (abs(vNormalW.y) > 0.5 && distance(vLocal.xz, uHoleCenter) < uHoleRadius) discard;
#endif

  vec3 n = normalize(vNormalW);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(cameraPosition - vWorld);
  float diff = max(dot(n, uKeyDir), 0.0);
  float hemi = 0.5 + 0.5 * n.y;
  vec3 light = uKeyColor * diff + mix(uGroundLight, uSky, hemi);
  vec3 albedo = mix(uColor, uColorLight, uTheme);
  float grain = vnoise(vLocal * 6.0) * 0.6 + vnoise(vLocal * 17.0) * 0.4;

#if defined(VARIANT_MASONRY)
  // Appareil de briques à joints décalés, projeté selon la face.
  vec2 q = abs(n.z) > 0.5 ? vLocal.xy : (abs(n.x) > 0.5 ? vLocal.zy : vLocal.xz);
  vec2 b = vec2(q.x / 0.25, q.y / 0.075);
  b.x += mod(floor(b.y), 2.0) * 0.5;
  vec2 f = fract(b);
  float joint = max(1.0 - smoothstep(0.0, 0.05, f.x), 1.0 - smoothstep(0.0, 0.14, f.y));
  float tint = hash13(vec3(floor(b), 3.0));
  vec3 brick = albedo * (0.8 + 0.32 * tint) * (0.9 + 0.2 * grain);
  albedo = mix(brick, mix(albedo, vec3(0.72), 0.55), joint);
#else
  albedo *= 0.88 + 0.22 * grain;
#endif

  vec3 col = albedo * light;

#ifdef VARIANT_STEEL
  float spec = pow(max(dot(reflect(-uKeyDir, n), v), 0.0), 28.0);
  col += spec * (uTheme > 0.5 ? 0.35 : 0.6);
  col = glow(col, uScanColor, pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.25);
#endif

#ifdef VARIANT_PIER
  // Zone déjà relevée par le drone (sous la ligne de scan) : trame + fissures détectées.
  float scanned = 1.0 - smoothstep(uScanY - 0.04, uScanY + 0.04, vLocal.y);
  vec2 qp = abs(n.y) > 0.5 ? vLocal.xz : (abs(n.x) > 0.5 ? vLocal.zy : vLocal.xy);
  vec2 g = abs(fract(qp * 4.0 - 0.5) - 0.5) / fwidth(qp * 4.0);
  float grid = 1.0 - min(min(g.x, g.y), 1.0);
  col = glow(col, uScanColor, grid * 0.22 * scanned);
  float zone = smoothstep(0.5, 0.64, vnoise(vLocal * vec3(0.9, 0.45, 0.9) + 4.0));
  float ridge = abs(vnoise(vLocal * vec3(3.5, 1.1, 3.5)) - 0.5);
  float crack = (1.0 - smoothstep(0.0, 0.02, ridge)) * zone * 0.6;
  // Fissure verticale franche sur le parement avant + épaufrure à l'angle du chevêtre.
  float front = step(0.5, n.z);
  float path = 0.2 + 0.04 * sin(vLocal.y * 6.0) + 0.018 * sin(vLocal.y * 17.0);
  float vertical = (1.0 - smoothstep(0.004, 0.014, abs(vLocal.x - path))) * front;
  vertical *= smoothstep(1.3, 1.6, vLocal.y) * (1.0 - smoothstep(3.2, 3.5, vLocal.y));
  crack = max(crack, vertical);
  float spall = (1.0 - smoothstep(0.24, 0.34, distance(vLocal, vec3(1.62, 5.85, 0.85)))) * front;
  col = mix(col, col * vec3(0.55, 0.42, 0.36), spall * (0.6 + 0.4 * grain));
  col = mix(col, vec3(0.02), crack * 0.85);
  col = glow(col, uRustGlow, (crack + spall * 0.35) * scanned * 1.4);
  col = glow(col, uScanColor, (1.0 - smoothstep(0.0, 0.06, abs(vLocal.y - uScanY))) * 2.5);
#endif

#ifdef VARIANT_BEAM
  float s = clamp(0.5 + 0.5 * vStress * uLoad, 0.0, 1.0);
  float level = s * 10.0;
  float iso = 1.0 - smoothstep(0.0, fwidth(level) * 1.3, abs(fract(level + 0.5) - 0.5));
  vec3 heat = pow(turbo(s), vec3(2.2)) * (0.55 + 0.6 * diff + 0.25 * hemi) * (1.0 - 0.35 * iso);
  col = mix(col, heat, uStressMix);
#endif

#ifdef VARIANT_COREFACE
  // Face fendue de la carotte : granulats, phénolphtaléine (rose = béton sain), front de carbonatation.
  float fromTop = uCoreHalf - vLocal.y;
  float aggregate = smoothstep(0.62, 0.7, vnoise(vLocal * 95.0)) + smoothstep(0.7, 0.76, vnoise(vLocal * 41.0 + 3.0)) * 0.6;
  col *= 1.0 - clamp(aggregate, 0.0, 1.0) * 0.28;
  float sprayed = 1.0 - smoothstep(uSpray * 2.0 * uCoreHalf - 0.02, uSpray * 2.0 * uCoreHalf + 0.02, fromTop);
  float healthy = smoothstep(uCarbonation - 0.004, uCarbonation + 0.004, fromTop);
  vec3 pink = vec3(0.78, 0.04, 0.32) * (0.6 + 0.55 * diff + 0.25) * (0.85 + 0.3 * grain);
  col = mix(col, pink, sprayed * healthy * 0.88);
  col = glow(col, uScanColor, (1.0 - smoothstep(0.0, 0.004, abs(fromTop - uCarbonation))) * sprayed * 2.5);
  float bar = 1.0 - smoothstep(0.016, 0.02, distance(vLocal.xy, uRebarPos));
  col = mix(col, uRustColor * (0.7 + 0.5 * grain), bar);
  col = glow(col, uRustGlow, bar * sprayed * 0.8);
#endif

  col = glow(col, mix(uColor, uColorLight, uTheme), uEmissive);
  col = glow(col, uScanColor, edge * 1.4);
  col = mix(col, uFogColor, fogFactor(vDepth));
  gl_FragColor = vec4(col, 1.0);
  ${output}
}
`;

type SpecimenOptions = {
  color: string;
  colorLight?: string;
  dissolve: THREE.IUniform<number>;
  uniforms?: Record<string, THREE.IUniform>;
  params?: THREE.ShaderMaterialParameters;
};

export function createSpecimenMaterial(variant: SpecimenVariant, options: SpecimenOptions) {
  return new THREE.ShaderMaterial({
    defines: { [`VARIANT_${variant.toUpperCase()}`]: "" },
    uniforms: {
      ...shared,
      uColor: { value: new THREE.Color(options.color) },
      uColorLight: { value: new THREE.Color(options.colorLight ?? options.color) },
      uDissolve: options.dissolve,
      uEmissive: { value: 0 },
      ...options.uniforms,
    },
    vertexShader,
    fragmentShader,
    ...options.params,
  });
}

/** Tube "tracé" : apparition progressive (uDraw), tirets animés (uDash), couleur de scan ou d'alerte. */
const lineVertex = /* glsl */ `
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

const lineFragment = /* glsl */ `
${common}
uniform float uDraw;
uniform float uDash;
uniform float uSpeed;
uniform float uLength;
uniform float uOpacity;
uniform float uAlert;
varying vec2 vUv;
varying float vDepth;
void main() {
  if (vUv.x > uDraw) discard;
  if (uDash > 0.0 && fract((vUv.x * uLength - uTime * uSpeed) / uDash) > 0.55) discard;
  vec3 color = mix(uScanColor, uRustGlow, uAlert);
  float head = 1.0 - smoothstep(0.0, 0.04, uDraw - vUv.x);
  gl_FragColor = emissive(color, uOpacity * (1.0 + head * 1.5) * (1.0 - fogFactor(vDepth)));
  ${output}
}
`;

export function createLineMaterial(length: number, options: { dash?: number; speed?: number; alert?: boolean; opacity?: number } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uDraw: { value: 0 },
      uDash: { value: options.dash ?? 0 },
      uSpeed: { value: options.speed ?? 0 },
      uLength: { value: length },
      uOpacity: { value: options.opacity ?? 1 },
      uAlert: { value: options.alert ? 1 : 0 },
    },
    vertexShader: lineVertex,
    fragmentShader: lineFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/** Faisceau de la caméra du drone : anneaux qui défilent vers la cible. */
const beamFragment = /* glsl */ `
${common}
uniform float uOpacity;
varying vec2 vUv;
varying float vDepth;
void main() {
  float rings = smoothstep(0.8, 1.0, fract(vUv.y * 7.0 + uTime * 1.6));
  float body = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.85, 1.0, vUv.y));
  gl_FragColor = emissive(uScanColor, (0.07 + 0.45 * rings) * body * uOpacity);
  ${output}
}
`;

export function createBeamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...shared, uOpacity: { value: 1 } },
    vertexShader: lineVertex,
    fragmentShader: beamFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

/** Tube suivant une polyligne (angles vifs conservés). */
export function createPolylineTube(points: [number, number, number][], radius = 0.014) {
  const path = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < points.length - 1; i++) {
    path.add(new THREE.LineCurve3(new THREE.Vector3(...points[i]), new THREE.Vector3(...points[i + 1])));
  }
  const geometry = new THREE.TubeGeometry(path, Math.max(8, (points.length - 1) * 24), radius, 6, false);
  return { geometry, length: path.getLength() };
}

/** Les matériaux translucides suivent le thème : additifs en sombre, alpha classique en clair. */
export function applyTranslucentTheme(materials: THREE.Material[], theme: "dark" | "light") {
  const blending = theme === "light" ? THREE.NormalBlending : THREE.AdditiveBlending;
  materials.forEach((material) => {
    material.blending = blending;
  });
}
