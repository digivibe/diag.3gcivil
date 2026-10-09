import { common, output, turbo } from "./chunks";

const structureVertex = /* glsl */ `
${common}
attribute float aStorey;
attribute float aKind;
varying vec3 vRest;
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vKind;
varying float vStorey;
varying float vDepth;

void main() {
  vRest = position;
  vKind = aKind;
  vStorey = aStorey;
  vec4 world = modelMatrix * vec4(position + explodeOffset(aStorey), 1.0);
  vWorld = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 mv = viewMatrix * world;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const structureVaryings = /* glsl */ `
varying vec3 vRest;
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vKind;
varying float vStorey;
varying float vDepth;
`;

/**
 * Béton opaque : coupes hachurées, rouille, fissures, carte d'efforts (éléments finis).
 * Deux variantes : avec coupes (discard, double face) pendant les scans,
 * sans coupe (simple face, early-Z préservé) le reste du temps.
 */
export const concreteShader = (cuts: boolean) => ({
  vertexShader: structureVertex,
  fragmentShader: /* glsl */ `
${cuts ? "#define USE_CUTS" : ""}
${common}
${turbo}
${structureVaryings}

vec3 femColor(vec3 p) {
  vec2 f = fract(vec2((p.x + 7.5) / 5.0, (p.z + 4.5) / 4.5));
  vec2 e = min(f, 1.0 - f);
  float s;
  if ((vKind > 0.5 && vKind < 1.5) || vKind > 5.5) {
    // Dalles et balcons : flexion en travée + moments sur appuis.
    float span = sin(3.14159 * f.x) * sin(3.14159 * f.y);
    float support = (1.0 - smoothstep(0.0, 0.2, e.x)) * (1.0 - smoothstep(0.0, 0.2, e.y));
    s = 0.12 + 0.62 * span + 0.6 * support;
  } else if (vKind > 2.5 && vKind < 3.5) {
    s = 0.25 + 0.65 * sin(3.14159 * f.x);
  } else if (vKind > 3.5 && vKind < 4.5) {
    s = 0.25 + 0.65 * sin(3.14159 * f.y);
  } else {
    // Poteaux et voiles : effort normal croissant vers le bas.
    s = 0.3 + 0.6 * (1.0 - clamp(p.y / uTop, 0.0, 1.0));
  }
  s = clamp(s * (0.82 + 0.3 * (1.0 - vStorey / 5.0)), 0.0, 1.0);
  float level = s * 9.0;
  float iso = 1.0 - smoothstep(0.0, fwidth(level) * 1.4, abs(fract(level + 0.5) - 0.5));
  vec3 heat = mix(pow(turbo(s), vec3(2.2)), vec3(0.35), 0.12);
  return heat * (1.0 - 0.5 * iso);
}

void main() {
  vec3 p = vRest;
#ifdef USE_CUTS
  if (p.y > uSolidY || isXrayed(p)) discard;
  bool front = gl_FrontFacing;
#else
  bool front = true;
#endif

  vec3 n = normalize(vNormalW);
  vec3 v = normalize(cameraPosition - vWorld);
  vec3 col;

  if (front) {
    float grain = vnoise(p * 1.7) * 0.65 + vnoise(p * 4.1) * 0.35;
    vec3 albedo = uConcrete * (0.86 + 0.24 * grain);
    if (vKind < 0.5) albedo *= 0.62;
    else if (vKind > 1.5 && vKind < 2.5) albedo *= 0.94;
    else if (vKind > 4.5 && vKind < 5.5) albedo *= 0.86;

    // Occlusion de contact bon marché : pieds et têtes de poteaux, sous-faces.
    float ao = 1.0;
    if (abs(n.y) < 0.5) {
      float h = mod(p.y, uStoreyH);
      ao = mix(0.5, 1.0, smoothstep(0.0, 1.1, h));
      ao *= mix(0.7, 1.0, smoothstep(0.0, 0.6, uStoreyH - 0.26 - h));
    } else if (n.y < -0.5) {
      ao = 0.55;
    }

    float diff = max(dot(n, uKeyDir), 0.0);
    float hemi = 0.5 + 0.5 * n.y;
    vec3 light = uKeyColor * diff + mix(uGroundLight, uSky, hemi);
    float rim = pow(1.0 - max(dot(n, v), 0.0), 4.0);
    col = glow(albedo * light * ao, uScanColor, rim * 0.05);

    if (uFem > 0.001 && vKind > 0.5) {
      col = mix(col, femColor(p) * (0.45 + 0.6 * diff + 0.25 * hemi), uFem);
    }

    float corrosion = uCorrosion * (1.0 - uRepair);
    float flash = uRepair * (1.0 - uRepair) * 4.0;
    for (int i = 0; i < HOT_COUNT; i++) {
      vec3 d = p - uHot[i].xyz;
      float r = uHot[i].w;
      float near = 1.0 - smoothstep(r * 0.3, r * 1.7, length(d));
      if (near <= 0.0) continue;
      float nz = vnoise(p * 3.1 + float(i) * 7.3);
      // Coulure de rouille étirée vers le bas.
      vec3 ds = vec3(d.x, d.y > 0.0 ? d.y * 1.9 : d.y * 0.42, d.z);
      float stain = 1.0 - smoothstep(r * 0.25, r * 1.3, length(ds) + (nz - 0.5) * 0.6 * r);
      col = mix(col, uRustColor * (0.35 + 0.5 * nz) * (0.55 + 0.6 * diff), stain * corrosion * 0.92);
      float ridge = abs(vnoise(p * vec3(2.6, 6.5, 2.6) + float(i) * 3.7) - 0.5);
      float crack = (1.0 - smoothstep(0.0, 0.03, ridge)) * near;
      col = mix(col, vec3(0.02), crack * corrosion * 0.9);
      col = glow(col, uRustGlow, crack * corrosion * (0.55 + 0.45 * sin(uTime * 3.0 + float(i) * 1.7)));
      col = glow(col, uScanColor, near * flash * 0.6);
    }
  } else {
    // Face arrière vue à travers une coupe : remplissage hachuré façon plan de coupe.
    float hatch = smoothstep(0.75, 0.8, fract((p.x + p.y + p.z) * 7.0));
    vec3 cap = uTheme > 0.5 ? uConcrete * 0.82 : vec3(0.05, 0.07, 0.09);
    col = mix(cap, uScanColor * (uTheme > 0.5 ? 1.0 : 0.55), hatch * 0.6 + 0.15);
  }

#ifdef USE_CUTS
  if (uLens > 0.001) {
    for (int i = 0; i < HOT_COUNT; i++) {
      float r = uHot[i].w * 0.62 * uLens;
      float ring = 1.0 - smoothstep(0.0, 0.045, abs(distance(p, uHot[i].xyz) - r));
      col = glow(col, mix(uScanColor, uRustGlow, 0.35), ring * 2.2);
    }
  }
  float band = (1.0 - smoothstep(0.0, 0.14, abs(p.y - uSolidY))) + (1.0 - smoothstep(0.0, 0.14, abs(p.y - uXrayY)));
  col = glow(col, uScanColor, band * 3.0);
#endif

  col = mix(col, uFogColor, fogFactor(vDepth));
  gl_FragColor = vec4(col, 1.0);
  ${output}
}
`,
});

/** Enveloppe "rayons X" : fresnel + trame technique, visible là où le béton est scanné. */
export const shellShader = {
  vertexShader: structureVertex,
  fragmentShader: /* glsl */ `
${common}
${structureVaryings}

void main() {
  vec3 p = vRest;
  if (p.y > uSolidY || !isXrayed(p)) discard;

  vec3 n = normalize(vNormalW);
  vec3 v = normalize(cameraPosition - vWorld);
  float fresnel = pow(1.0 - abs(dot(n, v)), 2.2);
  vec2 q = abs(n.y) > 0.5 ? p.xz : (abs(n.x) > 0.5 ? p.zy : p.xy);
  vec2 gq = q * 2.0;
  vec2 gd = abs(fract(gq - 0.5) - 0.5) / fwidth(gq);
  float grid = 1.0 - min(min(gd.x, gd.y), 1.0);

  float intensity = 0.028 + 0.42 * fresnel + 0.06 * grid;
  float rust = 0.0;
  for (int i = 0; i < HOT_COUNT; i++) {
    rust = max(rust, 1.0 - smoothstep(0.0, uHot[i].w * 1.2, distance(p, uHot[i].xyz)));
  }
  rust *= uCorrosion * (1.0 - uRepair);
  vec3 col = mix(uScanColor, uRustGlow, rust * 0.6);
  intensity += rust * 0.12 + (1.0 - smoothstep(0.0, 0.18, abs(p.y - uXrayY))) * 1.5;
  intensity *= (1.0 - fogFactor(vDepth)) * (uTheme > 0.5 ? 1.25 : 1.0);
  gl_FragColor = emissive(col, intensity);
  ${output}
}
`,
};

/** Arêtes : plan "blueprint" avant matérialisation, lignes de scan en mode rayons X. */
export const edgesShader = {
  vertexShader: /* glsl */ `
${common}
attribute float aStorey;
varying vec3 vRest;
varying float vDepth;

void main() {
  vRest = position;
  vec4 mv = viewMatrix * modelMatrix * vec4(position + explodeOffset(aStorey), 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`,
  fragmentShader: /* glsl */ `
${common}
varying vec3 vRest;
varying float vDepth;

void main() {
  vec3 p = vRest;
  bool light = uTheme > 0.5;
  vec3 col = uScanColor;
  float k;
  if (p.y > uSolidY) k = (light ? 0.38 : 0.2) * uIntro;
  else if (isXrayed(p)) k = light ? 0.8 : 0.75;
  else {
    col = light ? vec3(0.06, 0.08, 0.14) : vec3(1.0);
    k = light ? 0.32 : 0.07;
  }
  float band = 1.0 - smoothstep(0.0, 0.35, abs(p.y - uSolidY));
  col = mix(col, uScanColor, clamp(band, 0.0, 1.0));
  k += band * (light ? 0.6 : 2.5);
  gl_FragColor = emissive(col, k * (1.0 - fogFactor(vDepth)));
  ${output}
}
`,
};

/** Armatures : acier sombre, liseré de scan, rouille incandescente autour des pathologies. */
export const rebarShader = {
  vertexShader: structureVertex,
  fragmentShader: /* glsl */ `
${common}
${structureVaryings}

void main() {
  vec3 p = vRest;
  if (p.y > uSolidY || !isXrayed(p)) discard;

  vec3 n = normalize(vNormalW);
  vec3 v = normalize(cameraPosition - vWorld);
  float diff = max(dot(n, uKeyDir), 0.0);
  float spec = pow(max(dot(reflect(-uKeyDir, n), v), 0.0), 24.0);
  float fresnel = pow(1.0 - abs(dot(n, v)), 2.0);
  vec3 col = vec3(0.3, 0.32, 0.35) * (0.22 + 0.9 * diff) + spec * 0.5;
  col = glow(col, uScanColor, 0.22 + 0.8 * fresnel);

  float corrosion = uCorrosion * (1.0 - uRepair);
  float rust = 0.0;
  for (int i = 0; i < HOT_COUNT; i++) {
    rust = max(rust, 1.0 - smoothstep(uHot[i].w * 0.15, uHot[i].w * 1.1, distance(p, uHot[i].xyz)));
  }
  float nz = vnoise(p * 30.0);
  rust *= smoothstep(0.25, 0.7, nz + rust * 0.5);
  col = mix(col, uRustColor * (0.5 + 0.5 * nz), rust * corrosion);
  col = glow(col, uRustGlow, rust * corrosion * (1.2 + 0.8 * sin(uTime * 4.0 + p.y * 3.0)));
  col = glow(col, uScanColor, rust * uRepair * (1.0 - uRepair) * 6.0);
  col = glow(col, uScanColor, (1.0 - smoothstep(0.0, 0.15, abs(p.y - uXrayY))) * 3.0);

  col = mix(col, uFogColor, fogFactor(vDepth));
  gl_FragColor = vec4(col, 1.0);
  ${output}
}
`,
};

/** Nuage de points du relevé : les points convergent à l'intro puis disparaissent sous le front de matérialisation. */
export const pointsShader = {
  vertexShader: /* glsl */ `
${common}
uniform float uPointSize;
uniform float uPixelRatio;
attribute float aStorey;
attribute float aRand;
attribute vec3 aScatter;
varying float vAlpha;
varying float vBand;
varying float vHeight;
varying float vDepth;

void main() {
  vec3 rest = position;
  float delay = aRand * 0.35 + clamp(rest.y / uTop, 0.0, 1.0) * 0.45;
  float t = clamp((uIntro * 1.25 - delay) / 0.45, 0.0, 1.0);
  t = 1.0 - pow(1.0 - t, 3.0);
  vec3 p = mix(rest + aScatter, rest, t) + explodeOffset(aStorey);
  vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  float above = smoothstep(uSolidY - 0.02, uSolidY + 0.25, rest.y);
  vBand = 1.0 - smoothstep(0.0, 0.8, abs(rest.y - uSolidY));
  float scanline = 0.55 + 0.45 * smoothstep(0.2, 0.9, abs(sin(rest.y * 18.0)));
  vAlpha = above * t * scanline * (0.6 + 0.4 * sin(uTime * 1.7 + aRand * 31.0));
  vHeight = rest.y / uTop;
  vDepth = -mv.z;
  gl_PointSize = uPointSize * uPixelRatio * (0.55 + aRand * 0.9) * (1.0 + vBand * 1.5) / vDepth;
}
`,
  fragmentShader: /* glsl */ `
${common}
varying float vAlpha;
varying float vBand;
varying float vHeight;
varying float vDepth;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d) * vAlpha;
  if (a < 0.01) discard;
  bool light = uTheme > 0.5;
  vec3 low = light ? uScanColor * 0.55 : vec3(0.08, 0.2, 0.9);
  vec3 col = mix(low, uScanColor, clamp(vHeight * 1.2, 0.0, 1.0));
  col = mix(col, light ? uScanColor : vec3(1.0), vBand * 0.6);
  float intensity = a * (light ? 0.85 + vBand : 0.75 + vBand * 3.0) * (1.0 - fogFactor(vDepth));
  gl_FragColor = emissive(col, intensity);
  ${output}
}
`,
};

/** Sol technique : trame métrique, trame 5 m et onde de scan radiale. */
export const groundShader = {
  vertexShader: /* glsl */ `
${common}
varying vec3 vWorld;
varying float vDepth;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mv = viewMatrix * world;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`,
  fragmentShader: /* glsl */ `
${common}
uniform vec3 uBaseColor;
varying vec3 vWorld;
varying float vDepth;

float gridLine(vec2 p) {
  vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
  return 1.0 - min(min(g.x, g.y), 1.0);
}

void main() {
  vec2 p = vWorld.xz;
  float r = length(p * vec2(1.0, 1.25));
  float fade = (1.0 - smoothstep(12.0, 75.0, r)) * uIntro * (uTheme > 0.5 ? 2.2 : 1.0);
  vec3 col = glow(uBaseColor, uScanColor, (gridLine(p) * 0.035 + gridLine(p / 5.0) * 0.1) * fade);

  float wave = mod(uTime * 7.0, 80.0);
  float ring = (1.0 - smoothstep(0.0, 1.4, abs(r - wave))) * (1.0 - wave / 80.0);
  col = glow(col, uScanColor, ring * 0.16 * fade);

  // Empreinte lumineuse sous le bâtiment.
  vec2 q = abs(p) - vec2(9.6, 6.6);
  col = glow(col, uScanColor, (1.0 - smoothstep(0.0, 3.5, length(max(q, 0.0)))) * 0.03 * fade);

  col = mix(col, uFogColor, fogFactor(vDepth));
  gl_FragColor = vec4(col, 1.0);
  ${output}
}
`,
};
