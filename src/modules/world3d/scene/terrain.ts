/**
 * Paisagem do mundo 3D: relevo, chão de cada área, trilhas entre as áreas,
 * grama que balança, flores silvestres, cerca da horta, pedras, céu, névoa e
 * nuvens. Tudo gerado por código (nenhum arquivo externo).
 */
import * as THREE from 'three';
import { WORLD_BOUNDS, ZONES } from './layout';

// ---------- ruído simples (determinístico) ----------

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

/** Ruído de valor 2D em [0, 1]. */
export function noise2(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

export function fbm(x: number, y: number): number {
  return noise2(x, y) * 0.55 + noise2(x * 2.1, y * 2.1) * 0.3 + noise2(x * 4.3, y * 4.3) * 0.15;
}

/** Gerador pseudoaleatório com semente (a paisagem é sempre igual). */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------- relevo ----------

type Rect = { cx: number; cz: number; w: number; d: number };

/** Distância até o retângulo de uma área (0 dentro). */
function zoneDistance(x: number, z: number, zone: Rect) {
  const dx = Math.max(0, Math.abs(x - zone.cx) - zone.w / 2);
  const dz = Math.max(0, Math.abs(z - zone.cz) - zone.d / 2);
  return Math.sqrt(dx * dx + dz * dz);
}

export function heightAt(x: number, z: number): number {
  const gentle = (fbm(x * 0.07 + 3, z * 0.07 + 7) - 0.5) * 0.9;
  const b = WORLD_BOUNDS;
  const dx = Math.max(0, x < b.minX ? b.minX - x : x - b.maxX);
  const dz = Math.max(0, z < b.minZ ? b.minZ - z : z - b.maxZ);
  const out = Math.sqrt(dx * dx + dz * dz);
  // na frente (de onde a câmera olha) o terreno sobe bem menos, para não tapar a vista
  const front = z > b.maxZ ? 0.25 : 1;
  const hills = out > 0 ? Math.min(1, out / 22) ** 1.5 * (6 + fbm(x * 0.04, z * 0.04) * 10) * front : 0;
  // a área da água fica numa baixada suave
  const w = ZONES.water;
  const dip = Math.exp(-(((x - w.cx) / 11) ** 2) - ((z - w.cz) / 9) ** 2) * 0.7;
  return gentle + hills - dip;
}

// ---------- chão de cada área ----------

const GRASS_LOW = new THREE.Color(0x4f7d35);
const GRASS_HIGH = new THREE.Color(0x86a84a);
const GRASS_DRY = new THREE.Color(0xa7a257);
const SOIL = new THREE.Color(0x6e4f33);
const SAND = new THREE.Color(0xb9a57a);
const GRAVEL = new THREE.Color(0xa59f92);
const MEADOW = new THREE.Color(0x7fae4d);

/** Vale 1 no miolo da área e cai suave até a borda (com contorno irregular). */
function patch(x: number, z: number, zone: Rect, shrink: number) {
  const inner = { ...zone, w: zone.w - shrink * 2, d: zone.d - shrink * 2 };
  const dist = zoneDistance(x, z, inner) + (fbm(x * 0.3, z * 0.3) - 0.5) * 2.2;
  return THREE.MathUtils.clamp(1 - dist / 2.5, 0, 1);
}

export function buildTerrain(): THREE.Mesh {
  const size = 230;
  const seg = 150;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -12);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    const p = fbm(x * 0.21 + 11, z * 0.21 - 4);
    c.copy(GRASS_LOW).lerp(GRASS_HIGH, Math.min(1, p * 1.2));
    if (p > 0.68) c.lerp(GRASS_DRY, (p - 0.68) * 1.6);
    c.lerp(MEADOW, patch(x, z, ZONES.pollinators, 1) * 0.5);
    c.lerp(SOIL, patch(x, z, ZONES.garden, 2.5) * 0.85);
    c.lerp(SAND, patch(x, z, ZONES.water, 3) * 0.35);
    c.lerp(GRAVEL, patch(x, z, ZONES.community, 4) * 0.35);
    c.multiplyScalar(0.92 + hash(x, z) * 0.12);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  mesh.receiveShadow = true;
  mesh.name = 'terreno';
  return mesh;
}

// ---------- trilhas entre as áreas ----------

const PATHS: [number, number][][] = [
  // da frente, passando pelo centro, até o fundo (entre polinizadores e comunitária)
  [
    [3.4, 18],
    [3.1, 9],
    [2.9, 3],
    [1.5, -2],
    [0.6, -8],
    [0.2, -16],
    [0, -26],
    [0, -34],
  ],
  // centro → água
  [
    [3, 2],
    [10, 1],
    [16, -1],
    [21, -2],
  ],
  // centro → horta
  [
    [-1, 1],
    [-9, 0.5],
    [-16, -1],
    [-21, -2],
  ],
];

export function pathPoints(): THREE.Vector3[][] {
  return PATHS.map((line) => new THREE.CatmullRomCurve3(line.map(([x, z]) => new THREE.Vector3(x, 0, z))).getSpacedPoints(90));
}

export function buildPaths(): THREE.Group {
  const group = new THREE.Group();
  const width = 1.05;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  const c = new THREE.Color();
  for (const points of pathPoints()) {
    const verts: number[] = [];
    const colors: number[] = [];
    const index: number[] = [];
    points.forEach((pt, i) => {
      const next = points[Math.min(points.length - 1, i + 1)];
      const prev = points[Math.max(0, i - 1)];
      const dir = next.clone().sub(prev).setY(0).normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      const w = width * (0.85 + noise2(i * 0.3, pt.x) * 0.35);
      for (const sgn of [-1, 1]) {
        const x = pt.x + side.x * w * sgn;
        const z = pt.z + side.z * w * sgn;
        verts.push(x, heightAt(x, z) + 0.06, z);
        c.setHex(0x9c7a52).multiplyScalar(0.9 + hash(x, z) * 0.18);
        colors.push(c.r, c.g, c.b);
      }
      if (i < points.length - 1) {
        const a = i * 2;
        index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.name = 'trilhas';
  return group;
}

// ---------- grama (instâncias) com vento no shader ----------

export interface Wind {
  uniforms: { uTime: { value: number } };
}

export interface Circle {
  x: number;
  z: number;
  r: number;
}

/** Lugares sem grama: as trilhas (a terra arada da horta é tratada à parte). */
export function staticAvoidance(): Circle[] {
  const out: Circle[] = [];
  for (const points of pathPoints()) {
    for (let i = 0; i < points.length; i += 3) out.push({ x: points[i].x, z: points[i].z, r: 1.25 });
  }
  return out;
}

function insideSoil(x: number, z: number) {
  return patch(x, z, ZONES.garden, 2.5) > 0.6;
}

export function buildGrass(count: number, avoid: Circle[], wind: Wind): THREE.InstancedMesh {
  const b = WORLD_BOUNDS;
  return buildGrassField(
    count,
    (rand) => {
      const x = b.minX - 4 + rand() * (b.maxX - b.minX + 8);
      const z = b.minZ - 4 + rand() * (b.maxZ - b.minZ + 14);
      if (insideSoil(x, z)) return null;
      if (avoid.some((a) => (a.x - x) ** 2 + (a.z - z) ** 2 < a.r * a.r)) return null;
      return { x, z };
    },
    heightAt,
    wind,
  );
}

/**
 * Campo de grama (lâminas instanciadas que balançam no shader). `sample` sorteia um
 * ponto (ou devolve null para "aqui não"); `height` dá a altura do chão.
 */
export function buildGrassField(
  count: number,
  sample: (rand: () => number) => { x: number; z: number } | null,
  height: (x: number, z: number) => number,
  wind: Wind,
  seed = 7,
): THREE.InstancedMesh {
  const blade = new THREE.PlaneGeometry(0.07, 0.55, 1, 3);
  const bp = blade.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < bp.count; i++) {
    const y = bp.getY(i) + 0.275; // base no chão
    const taper = 1 - y / 0.55;
    bp.setX(i, bp.getX(i) * taper);
    bp.setY(i, y);
    bp.setZ(i, y * y * 0.25); // leve curvatura
  }
  blade.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wind.uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 base = instanceMatrix[3].xz;
          float sway = sin(uTime * 1.6 + base.x * 0.35 + base.y * 0.25) * 0.5 + sin(uTime * 2.7 + base.x) * 0.2;
          transformed.x += sway * position.y * position.y * 0.35;
          transformed.z += sway * position.y * position.y * 0.2;
        #endif`,
      );
  };

  const mesh = new THREE.InstancedMesh(blade, material, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const e = new THREE.Euler();
  const color = new THREE.Color();
  const rand = rng(seed);
  let placed = 0;
  for (let tries = 0; placed < count && tries < count * 5; tries++) {
    const pt = sample(rand);
    if (!pt) continue;
    p.set(pt.x, height(pt.x, pt.z) - 0.02, pt.z);
    q.setFromEuler(e.set(0, rand() * Math.PI * 2, 0));
    s.set(1, 0.6 + rand() * 0.9, 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(placed, m);
    color.setHSL(0.24 + rand() * 0.06, 0.45 + rand() * 0.2, 0.28 + rand() * 0.14);
    mesh.setColorAt(placed, color);
    placed++;
  }
  mesh.count = placed;
  mesh.receiveShadow = true;
  mesh.name = 'grama';
  return mesh;
}

// ---------- decoração fixa das áreas ----------

/** Florzinhas silvestres espalhadas no jardim dos polinizadores. */
export function buildWildflowers(count: number): THREE.InstancedMesh {
  const geo = new THREE.SphereGeometry(0.07, 6, 4);
  geo.scale(1, 0.6, 1);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.7 }), count);
  const z = ZONES.pollinators;
  const rand = rng(99);
  const m = new THREE.Matrix4();
  const color = new THREE.Color();
  const palette = [0xf7d046, 0xf29bb5, 0xb58cf2, 0xffffff, 0xf2784b];
  for (let i = 0; i < count; i++) {
    const x = z.cx + (rand() - 0.5) * (z.w + 4);
    const zz = z.cz + (rand() - 0.5) * (z.d + 4);
    m.makeTranslation(x, heightAt(x, zz) + 0.28 + rand() * 0.25, zz);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, color.setHex(palette[Math.floor(rand() * palette.length)]));
  }
  mesh.name = 'flores-silvestres';
  return mesh;
}

/** Cerca baixa de madeira em volta da horta, com uma abertura para a trilha. */
export function buildGardenFence(): THREE.Group {
  const g = new THREE.Group();
  const z = ZONES.garden;
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.95 });
  const hw = z.w / 2 + 0.6;
  const hd = z.d / 2 + 0.6;
  const corners: [number, number][] = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
  const gate = (side: number, zz: number) => side === 1 && Math.abs(zz - z.cz) < 1.8;
  for (let s = 0; s < 4; s++) {
    const [ax, az] = corners[s];
    const [bx, bz] = corners[(s + 1) % 4];
    const posts = Math.round(Math.hypot(bx - ax, bz - az) / 2.2);
    for (let i = 0; i <= posts; i++) {
      const x = z.cx + ax + ((bx - ax) * i) / posts;
      const zz = z.cz + az + ((bz - az) * i) / posts;
      if (gate(s, zz)) continue;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), wood);
      post.position.set(x, heightAt(x, zz) + 0.4, zz);
      post.castShadow = true;
      g.add(post);
      if (i === posts) continue;
      const nx = z.cx + ax + ((bx - ax) * (i + 1)) / posts;
      const nz = z.cz + az + ((bz - az) * (i + 1)) / posts;
      if (gate(s, nz)) continue;
      const rail = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(nx - x, nz - zz), 0.07, 0.05), wood);
      rail.position.set((x + nx) / 2, heightAt(x, zz) + 0.55, (zz + nz) / 2);
      rail.rotation.y = -Math.atan2(nz - zz, nx - x);
      rail.castShadow = true;
      g.add(rail);
    }
  }
  g.name = 'cerca-horta';
  return g;
}

export function buildRocks(): THREE.Group {
  const group = new THREE.Group();
  const rand = rng(21);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8d8a82, roughness: 0.95 });
  const b = WORLD_BOUNDS;
  for (let i = 0; i < 26; i++) {
    const geo = new THREE.DodecahedronGeometry(0.3 + rand() * 0.6, 1);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < pos.count; v++) {
      const k = 0.8 + noise2(pos.getX(v) * 3 + i, pos.getZ(v) * 3) * 0.4;
      pos.setXYZ(v, pos.getX(v) * k, pos.getY(v) * k * 0.65, pos.getZ(v) * k);
    }
    geo.computeVertexNormals();
    const rock = new THREE.Mesh(geo, mat);
    // nas bordas do mundo, entre a grama e as colinas
    const side = Math.floor(rand() * 3);
    const x = side === 0 ? b.minX - 1 - rand() * 4 : side === 1 ? b.maxX + 1 + rand() * 4 : b.minX + rand() * (b.maxX - b.minX);
    const z = side === 2 ? b.minZ - 1 - rand() * 4 : b.minZ + rand() * (b.maxZ - b.minZ);
    rock.position.set(x, heightAt(x, z), z);
    rock.rotation.y = rand() * Math.PI;
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }
  return group;
}

// ---------- céu e nuvens ----------

export function buildSky(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(300, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x3f86d6) },
      horizon: { value: new THREE.Color(0xd9ecf6) },
    },
    vertexShader: `varying vec3 vPos; void main() { vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 vPos;
      void main() { float h = clamp(vPos.y * 1.6, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.7)), 1.0); }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.name = 'ceu';
  return sky;
}

export function buildClouds(): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  const rand = rng(5);
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group();
    const puffs = 4 + Math.floor(rand() * 4);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(2 + rand() * 2.2, 2), mat);
      puff.position.set(p * 2.4 - puffs, rand() * 1.1, (rand() - 0.5) * 2.5);
      puff.scale.y = 0.6;
      cloud.add(puff);
    }
    cloud.position.set(-110 + rand() * 220, 38 + rand() * 16, -120 + rand() * 90);
    cloud.userData.speed = 0.3 + rand() * 0.4;
    group.add(cloud);
  }
  group.name = 'nuvens';
  return group;
}
