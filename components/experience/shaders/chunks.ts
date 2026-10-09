import { HOTSPOTS } from "@/lib/content";

export const HOT_COUNT = HOTSPOTS.length;

/** Uniforms et fonctions partagés par tous les matériaux de la scène (inclus dans les deux étages). */
export const common = /* glsl */ `
#define HOT_COUNT ${HOT_COUNT}
uniform float uTime;
uniform float uIntro;
uniform float uSolidY;
uniform float uXrayY;
uniform float uLens;
uniform float uCorrosion;
uniform float uRepair;
uniform float uFem;
uniform float uExplode;
uniform float uGap;
uniform vec4 uHot[HOT_COUNT];
uniform float uTheme;
uniform vec3 uScanColor;
uniform vec3 uRustColor;
uniform vec3 uRustGlow;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform vec3 uKeyDir;
uniform vec3 uKeyColor;
uniform vec3 uSky;
uniform vec3 uGroundLight;
uniform vec3 uConcrete;
uniform float uStoreyH;
uniform float uTop;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), f.x);
  float b = mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x);
  float c = mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x);
  float d = mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}

float fogFactor(float depth) {
  return 1.0 - exp(-uFogDensity * uFogDensity * depth * depth);
}

/** Thème sombre : lumière additive (bloom). Thème clair : encre mélangée sur le fond. */
vec3 glow(vec3 base, vec3 color, float k) {
  return uTheme > 0.5 ? mix(base, color, clamp(k * 0.55, 0.0, 1.0)) : base + color * k;
}

/** Sortie des matériaux translucides : additif en sombre, alpha classique en clair. */
vec4 emissive(vec3 color, float intensity) {
  return uTheme > 0.5 ? vec4(color, clamp(intensity, 0.0, 1.0)) : vec4(color * intensity, 1.0);
}

/** 1 à l'intérieur d'une "loupe rayons X" ouverte autour d'une pathologie. */
float lensMask(vec3 p) {
  float m = 0.0;
  for (int i = 0; i < HOT_COUNT; i++) {
    m = max(m, step(distance(p, uHot[i].xyz), uHot[i].w * 0.62 * uLens));
  }
  return m;
}

bool isXrayed(vec3 p) {
  return p.y > uXrayY || lensMask(p) > 0.5;
}

/** Vue éclatée : chaque niveau monte de (niveau + 1) × écart ; le radier (-1) reste en place. */
vec3 explodeOffset(float storey) {
  return vec3(0.0, uExplode * max(storey + 1.0, 0.0) * uGap, 0.0);
}
`;

/** Approximation polynomiale de la palette "Turbo" (Google), utilisée pour la carte d'efforts. */
export const turbo = /* glsl */ `
vec3 turbo(float x) {
  const vec4 kr4 = vec4(0.13572138, 4.61539260, -42.66032258, 132.13108234);
  const vec4 kg4 = vec4(0.09140261, 2.19418839, 4.84296658, -14.18503333);
  const vec4 kb4 = vec4(0.10667330, 12.64194608, -60.58204836, 110.36276771);
  const vec2 kr2 = vec2(-152.94239396, 59.28637943);
  const vec2 kg2 = vec2(4.27729857, 2.82956604);
  const vec2 kb2 = vec2(-89.90310912, 27.34824973);
  x = clamp(x, 0.0, 1.0);
  vec4 v4 = vec4(1.0, x, x * x, x * x * x);
  vec2 v2 = v4.zw * v4.z;
  return vec3(
    dot(v4, kr4) + dot(v2, kr2),
    dot(v4, kg4) + dot(v2, kg2),
    dot(v4, kb4) + dot(v2, kb2)
  );
}
`;

export const output = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;
