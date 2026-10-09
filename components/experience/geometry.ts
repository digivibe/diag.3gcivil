import * as THREE from "three";
import building from "./building.json";

type Vec3 = [number, number, number];

export const KIND = { raft: 0, slab: 1, column: 2, beamX: 3, beamZ: 4, core: 5, balcony: 6, parapet: 7 } as const;
const REBAR_KIND = { bar: 0, tie: 1, mesh: 2 } as const;

// Faces d'une boîte : normale + coins (0 = min, 1 = max), ordonnés CCW vus de l'extérieur.
const BOX_FACES: { normal: Vec3; corners: Vec3[] }[] = [
  { normal: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { normal: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { normal: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { normal: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { normal: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];

// Repères directs (b, c, a) pour orienter les prismes le long de l'axe a.
const PRISM_FRAMES: [number, number][] = [
  [1, 2],
  [2, 0],
  [0, 1],
];

class MeshBuilder {
  private positions: number[] = [];
  private normals: number[] = [];
  private storeys: number[] = [];
  private kinds: number[] = [];
  private indices: number[] = [];
  private edgePositions: number[] = [];
  private edgeStoreys: number[] = [];

  box(min: Vec3, max: Vec3, storey: number, kind: number) {
    const pick = (c: Vec3): Vec3 => [c[0] ? max[0] : min[0], c[1] ? max[1] : min[1], c[2] ? max[2] : min[2]];
    for (const face of BOX_FACES) {
      const base = this.positions.length / 3;
      for (const corner of face.corners) this.vertex(pick(corner), face.normal, storey, kind);
      this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    for (let axis = 0; axis < 3; axis++) {
      for (const u of [0, 1]) {
        for (const v of [0, 1]) {
          const a: Vec3 = [0, 0, 0];
          const [b, c] = PRISM_FRAMES[axis];
          a[b] = u;
          a[c] = v;
          const end: Vec3 = [...a];
          end[axis] = 1;
          this.edgePositions.push(...pick(a), ...pick(end));
          this.edgeStoreys.push(storey, storey);
        }
      }
    }
  }

  /** Prisme à `sides` faces (normales lissées) de rayon `radius`, le long de l'axe `axis`. */
  prism(axis: 0 | 1 | 2, from: number, to: number, center: Vec3, radius: number, sides: number, storey: number, kind: number) {
    const [b, c] = PRISM_FRAMES[axis];
    const base = this.positions.length / 3;
    for (const along of [from, to]) {
      for (let k = 0; k < sides; k++) {
        const angle = ((k + 0.5) / sides) * Math.PI * 2;
        const normal: Vec3 = [0, 0, 0];
        normal[b] = Math.cos(angle);
        normal[c] = Math.sin(angle);
        const p: Vec3 = [center[0] + normal[0] * radius, center[1] + normal[1] * radius, center[2] + normal[2] * radius];
        p[axis] = along;
        this.vertex(p, normal, storey, kind);
      }
    }
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      this.indices.push(base + k, base + k1, base + sides + k1, base + k, base + sides + k1, base + sides + k);
    }
  }

  private vertex(p: Vec3, n: Vec3, storey: number, kind: number) {
    this.positions.push(p[0], p[1], p[2]);
    this.normals.push(n[0], n[1], n[2]);
    this.storeys.push(storey);
    this.kinds.push(kind);
  }

  geometry() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute("aStorey", new THREE.Float32BufferAttribute(this.storeys, 1));
    geometry.setAttribute("aKind", new THREE.Float32BufferAttribute(this.kinds, 1));
    geometry.setIndex(this.indices);
    geometry.computeBoundingSphere();
    return geometry;
  }

  edges() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.edgePositions, 3));
    geometry.setAttribute("aStorey", new THREE.Float32BufferAttribute(this.edgeStoreys, 1));
    return geometry;
  }
}

class RebarBuilder {
  readonly mesh = new MeshBuilder();

  bar(axis: 0 | 1 | 2, from: number, to: number, center: Vec3, radius: number, storey: number, kind: number = REBAR_KIND.bar) {
    this.mesh.prism(axis, from, to, center, radius, kind === REBAR_KIND.bar ? 6 : 4, storey, kind);
  }

  /** Cadre rectangulaire perpendiculaire à `normalAxis`, centré sur `center`, demi-tailles (h1, h2) dans le repère (b, c). */
  tie(normalAxis: 0 | 1 | 2, center: Vec3, h1: number, h2: number, radius: number, storey: number) {
    const [b, c] = PRISM_FRAMES[normalAxis];
    for (const side of [-1, 1]) {
      const alongB: Vec3 = [...center];
      alongB[c] += side * h2;
      this.bar(b as 0 | 1 | 2, center[b] - h1 - radius, center[b] + h1 + radius, alongB, radius, storey, REBAR_KIND.tie);
      const alongC: Vec3 = [...center];
      alongC[b] += side * h1;
      this.bar(c as 0 | 1 | 2, center[c] - h2 - radius, center[c] + h2 + radius, alongC, radius, storey, REBAR_KIND.tie);
    }
  }
}

function range(from: number, to: number, step: number) {
  const values: number[] = [];
  for (let v = from; v <= to + 1e-6; v += step) values.push(v);
  return values;
}

/** Ossature béton armé générée à partir de building.json (même source que la maquette Blender). */
export function createStructure() {
  const b = building;
  const { storeys: count, storeyHeight: H, slabThickness: t, columnsX: xs, columnsZ: zs } = b;
  const c = b.columnSize / 2;
  const hw = b.beamWidth / 2;
  const x0 = xs[0] - b.slabOverhang;
  const x1 = xs[xs.length - 1] + b.slabOverhang;
  const z0 = zs[0] - b.slabOverhang;
  const z1 = zs[zs.length - 1] + b.slabOverhang;
  const concrete = new MeshBuilder();
  const rebar = new RebarBuilder();

  const m = b.raft.margin;
  concrete.box([xs[0] - m, -b.raft.thickness, zs[0] - m], [xs[xs.length - 1] + m, 0, zs[zs.length - 1] + m], -1, KIND.raft);

  for (let s = 0; s < count; s++) {
    const yb = s * H;
    const yt = (s + 1) * H;
    const ys = yt - t;
    const yBeam = yt - b.beamDepth;

    // Poteaux : 4 filants + cadres tous les 20 cm.
    const inset = c - 0.05;
    for (const x of xs) {
      for (const z of zs) {
        concrete.box([x - c, yb, z - c], [x + c, ys, z + c], s, KIND.column);
        for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          rebar.bar(1, yb + 0.05, yt - 0.04, [x + dx * inset, 0, z + dz * inset], 0.014, s);
        }
        for (const y of range(yb + 0.12, ys - 0.08, 0.2)) rebar.tie(1, [x, y, z], inset + 0.02, inset + 0.02, 0.006, s);
      }
    }

    // Poutres : 2 filants haut + 2 bas, étriers tous les 22 cm.
    const bi = hw - 0.045;
    const yBot = yBeam + 0.05;
    const yTop = yt - 0.05;
    const yMid = (yBot + yTop) / 2;
    const half = (yTop - yBot) / 2 + 0.012;
    for (const z of zs) {
      for (let i = 0; i < xs.length - 1; i++) {
        concrete.box([xs[i] + c, yBeam, z - hw], [xs[i + 1] - c, ys, z + hw], s, KIND.beamX);
        for (const dz of [-bi, bi]) {
          for (const y of [yBot, yTop]) rebar.bar(0, xs[i] - c * 0.6, xs[i + 1] + c * 0.6, [0, y, z + dz], 0.012, s);
        }
        for (const x of range(xs[i] + c + 0.1, xs[i + 1] - c - 0.1, 0.22)) rebar.tie(0, [x, yMid, z], half, bi + 0.014, 0.006, s);
      }
    }
    for (const x of xs) {
      for (let i = 0; i < zs.length - 1; i++) {
        concrete.box([x - hw, yBeam, zs[i] + c], [x + hw, ys, zs[i + 1] - c], s, KIND.beamZ);
        for (const dx of [-bi, bi]) {
          for (const y of [yBot, yTop]) rebar.bar(2, zs[i] - c * 0.6, zs[i + 1] + c * 0.6, [x + dx, y, 0], 0.012, s);
        }
        for (const z of range(zs[i] + c + 0.1, zs[i + 1] - c - 0.1, 0.22)) rebar.tie(2, [x, yMid, z], bi + 0.014, half, 0.006, s);
      }
    }

    // Dalle + treillis inférieur maille 30 cm.
    concrete.box([x0, ys, z0], [x1, yt, z1], s, KIND.slab);
    const yr = ys + 0.035;
    for (const z of range(z0 + 0.15, z1 - 0.15, 0.3)) rebar.bar(0, x0 + 0.05, x1 - 0.05, [0, yr, z], 0.006, s, REBAR_KIND.mesh);
    for (const x of range(x0 + 0.15, x1 - 0.15, 0.3)) rebar.bar(2, z0 + 0.05, z1 - 0.05, [x, yr + 0.012, 0], 0.006, s, REBAR_KIND.mesh);

    // Noyau (cage d'escalier / ascenseur) : voiles + armatures verticales et horizontales.
    const core = b.core;
    const cx0 = core.x - core.width / 2;
    const cx1 = core.x + core.width / 2;
    const cz0 = core.z - core.depth / 2;
    const cz1 = core.z + core.depth / 2;
    const w = core.wall;
    const walls: [Vec3, Vec3][] = [
      [[cx0, yb, cz0], [cx1, ys, cz0 + w]],
      [[cx0, yb, cz0 + w], [cx0 + w, ys, cz1 - w]],
      [[cx1 - w, yb, cz0 + w], [cx1, ys, cz1 - w]],
      [[cx0, yb, cz1 - w], [core.x - core.door / 2, ys, cz1]],
      [[core.x + core.door / 2, yb, cz1 - w], [cx1, ys, cz1]],
      [[core.x - core.door / 2, yb + 2.2, cz1 - w], [core.x + core.door / 2, ys, cz1]],
    ];
    for (const [min, max] of walls) {
      concrete.box(min, max, s, KIND.core);
      const alongX = max[0] - min[0] > max[2] - min[2];
      const mid = alongX ? (min[2] + max[2]) / 2 : (min[0] + max[0]) / 2;
      const [a0, a1] = alongX ? [min[0], max[0]] : [min[2], max[2]];
      for (const u of range(a0 + 0.1, a1 - 0.1, 0.3)) {
        rebar.bar(1, min[1] + 0.05, max[1] + 0.2, alongX ? [u, 0, mid] : [mid, 0, u], 0.007, s, REBAR_KIND.mesh);
      }
      for (const y of range(min[1] + 0.15, max[1] - 0.1, 0.3)) {
        rebar.bar(alongX ? 0 : 2, a0 + 0.05, a1 - 0.05, alongX ? [0, y, mid] : [mid, y, 0], 0.006, s, REBAR_KIND.mesh);
      }
    }

    if (s < count - 1) {
      // Balcons en porte-à-faux + garde-corps béton.
      const bal = b.balcony;
      const bz1 = z1 + bal.depth;
      const pt = bal.parapetThickness;
      concrete.box([bal.fromX, ys, z1], [bal.toX, yt, bz1], s, KIND.balcony);
      concrete.box([bal.fromX, yt, bz1 - pt], [bal.toX, yt + bal.parapetHeight, bz1], s, KIND.parapet);
      concrete.box([bal.fromX, yt, z1], [bal.fromX + pt, yt + bal.parapetHeight, bz1 - pt], s, KIND.parapet);
      concrete.box([bal.toX - pt, yt, z1], [bal.toX, yt + bal.parapetHeight, bz1 - pt], s, KIND.parapet);
      for (const z of range(z1 + 0.1, bz1 - 0.08, 0.3)) rebar.bar(0, bal.fromX + 0.05, bal.toX - 0.05, [0, yr, z], 0.006, s, REBAR_KIND.mesh);
      for (const x of range(bal.fromX + 0.15, bal.toX - 0.15, 0.3)) rebar.bar(2, z1 - 0.6, bz1 - 0.05, [x, yr + 0.012, 0], 0.006, s, REBAR_KIND.mesh);
    } else {
      // Acrotère en toiture.
      const ah = 0.7;
      const at = 0.15;
      concrete.box([x0, yt, z0], [x1, yt + ah, z0 + at], s, KIND.parapet);
      concrete.box([x0, yt, z1 - at], [x1, yt + ah, z1], s, KIND.parapet);
      concrete.box([x0, yt, z0 + at], [x0 + at, yt + ah, z1 - at], s, KIND.parapet);
      concrete.box([x1 - at, yt, z0 + at], [x1, yt + ah, z1 - at], s, KIND.parapet);
    }
  }

  return { concrete: concrete.geometry(), edges: concrete.edges(), rebar: rebar.mesh.geometry() };
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Échantillonne `count` points à la surface du béton (pondéré par l'aire, faces verticales favorisées). */
export function samplePointCloud(source: THREE.BufferGeometry, count: number) {
  const random = mulberry32(3);
  const position = source.getAttribute("position");
  const normal = source.getAttribute("normal");
  const storey = source.getAttribute("aStorey");
  const index = source.getIndex()!;
  const triangles = index.count / 3;
  const cdf = new Float64Array(triangles);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let total = 0;
  for (let i = 0; i < triangles; i++) {
    a.fromBufferAttribute(position, index.getX(i * 3));
    b.fromBufferAttribute(position, index.getX(i * 3 + 1));
    c.fromBufferAttribute(position, index.getX(i * 3 + 2));
    const area = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
    const vertical = Math.abs(normal.getY(index.getX(i * 3))) < 0.5;
    total += area * (vertical ? 1 : 0.55);
    cdf[i] = total;
  }

  const points = new Float32Array(count * 3);
  const storeys = new Float32Array(count);
  const rands = new Float32Array(count);
  const scatter = new Float32Array(count * 3);
  const p = new THREE.Vector3();
  const dir = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const target = random() * total;
    let lo = 0;
    let hi = triangles - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    a.fromBufferAttribute(position, index.getX(lo * 3));
    b.fromBufferAttribute(position, index.getX(lo * 3 + 1));
    c.fromBufferAttribute(position, index.getX(lo * 3 + 2));
    let u = random();
    let v = random();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    p.copy(a).addScaledVector(b.sub(a), u).addScaledVector(c.sub(a), v);
    points.set([p.x, p.y, p.z], i * 3);
    storeys[i] = storey.getX(index.getX(lo * 3));
    rands[i] = random();
    dir.set(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize().multiplyScalar(8 + random() * 22);
    scatter.set([dir.x, dir.y + 4, dir.z], i * 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(points, 3));
  geometry.setAttribute("aStorey", new THREE.BufferAttribute(storeys, 1));
  geometry.setAttribute("aRand", new THREE.BufferAttribute(rands, 1));
  geometry.setAttribute("aScatter", new THREE.BufferAttribute(scatter, 3));
  return geometry;
}
