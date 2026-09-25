/**
 * Peças comuns dos modelos do mundo 3D: materiais, copas orgânicas, troncos,
 * flores, água animada e anéis de destaque.
 *
 * Marcas em `userData` que a cena anima (quando há movimento):
 *   sway    balança com o vento        orbit  voa em círculos ({ r, h, speed })
 *   flap    asas batendo               graze  cabeça pastando
 *   tail    rabo balançando            hop    pulinhos
 *   wiggle  lagarta se mexendo         ripple onda se abrindo na água
 *   pulse   anel de destaque pulsando
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { noise2 } from '../terrain';

export { rng } from '../terrain';

export const MAT = {
  bark: new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 }),
  barkDark: new THREE.MeshStandardMaterial({ color: 0x4d3522, roughness: 1 }),
  stem: new THREE.MeshStandardMaterial({ color: 0x4a7a2c, roughness: 0.9 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x5e9a3a, roughness: 0.8, side: THREE.DoubleSide }),
  wood: new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.95 }),
  woodLight: new THREE.MeshStandardMaterial({ color: 0xb08a5c, roughness: 0.9 }),
  soil: new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 1 }),
  soilWet: new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.95 }),
  stone: new THREE.MeshStandardMaterial({ color: 0xa8a49a, roughness: 0.9 }),
  paving: new THREE.MeshStandardMaterial({ color: 0xc9c2b2, roughness: 0.9 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x9aa3ab, roughness: 0.35, metalness: 0.8 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2b2522, roughness: 0.9 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.9 }),
  terracotta: new THREE.MeshStandardMaterial({ color: 0xc0643a, roughness: 0.85 }),
};

const colorCache = new Map<number, THREE.MeshStandardMaterial>();
/** Material de cor sólida, compartilhado por cor. */
export function solid(color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  if (Object.keys(extra).length) return new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
  let m = colorCache.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    colorCache.set(color, m);
  }
  return m;
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

export function shadow<T extends THREE.Object3D>(o: T): T {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh && !m.userData.noShadow) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return o;
}

/** Copa irregular: esfera deformada por ruído, mais clara em cima, mais escura embaixo. */
export function foliage(radius: number, dark: number, light: number, seed: number, detail = 2): THREE.Mesh {
  const base = new THREE.IcosahedronGeometry(radius, detail + 1);
  base.deleteAttribute('normal');
  base.deleteAttribute('uv');
  const geo = mergeVertices(base); // vértices unidos → normais suaves
  base.dispose();
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const cDark = new THREE.Color(dark);
  const cLight = new THREE.Color(light);
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    const k = 1 + (noise2(n.x * 2.2 + seed, n.z * 2.2 + n.y * 1.7) - 0.5) * 0.45;
    v.multiplyScalar(k);
    v.y *= 0.88;
    pos.setXYZ(i, v.x, v.y, v.z);
    const t = THREE.MathUtils.clamp((n.y + 1) / 2 + (noise2(n.x * 5 + seed, n.z * 5) - 0.5) * 0.35, 0, 1);
    c.copy(cDark).lerp(cLight, t);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
}

/** Tronco que afina e entorta um pouco. */
export function trunk(height: number, radius: number, seed: number, mat = MAT.bark): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(radius * 0.55, radius, height, 9, 6);
  geo.translate(0, height / 2, 0);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / height;
    pos.setX(i, pos.getX(i) + Math.sin(y * 2.4 + seed) * 0.08 * y);
    pos.setZ(i, pos.getZ(i) + Math.cos(y * 1.9 + seed) * 0.06 * y);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

/** Copa feita de várias "nuvens" de folhas, que balança com o vento. */
export function crown(group: THREE.Group, blobs: [number, number, number, number][], dark: number, light: number, seed: number) {
  const top = new THREE.Group();
  blobs.forEach(([x, y, z, r], i) => {
    const f = foliage(r, dark, light, seed + i * 3.1);
    f.position.set(x, y, z);
    top.add(f);
  });
  top.userData.sway = true;
  group.add(top);
  return top;
}

export function tree(seed: number, size = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(trunk(2.2 * size, 0.16 * size, seed));
  crown(
    g,
    [
      [0, 2.6 * size, 0, 0.95 * size],
      [0.55 * size, 2.3 * size, 0.25 * size, 0.7 * size],
      [-0.5 * size, 2.35 * size, -0.2 * size, 0.72 * size],
      [0.05 * size, 3.15 * size, 0.1 * size, 0.62 * size],
    ],
    0x2d6124,
    0x7cb24c,
    seed,
  );
  return g;
}

/** Anel suave no chão: marca itens raros e marcos especiais. */
export function glowRing(radius: number, color: number): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.8, radius, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  ring.userData.pulse = true;
  ring.userData.noShadow = true;
  return ring;
}

export const PETALS = [0xf06f9b, 0xf7a8c4, 0xfbd34d, 0xc08cf2, 0xffffff, 0xf2784b];

export function flowerHead(color: number, rand: () => number, size = 1, petals = 6): THREE.Group {
  const head = new THREE.Group();
  const petalMat = solid(color);
  for (let i = 0; i < petals; i++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.075 * size, 8, 5), petalMat);
    petal.scale.set(1, 0.3, 0.55);
    const a = (i / petals) * Math.PI * 2 + rand() * 0.2;
    petal.position.set(Math.cos(a) * 0.075 * size, 0, Math.sin(a) * 0.075 * size);
    petal.rotation.y = -a;
    head.add(petal);
  }
  head.add(mesh(new THREE.SphereGeometry(0.045 * size, 8, 6), solid(0xf5b700), 0, 0.02 * size, 0));
  return head;
}

export function flowerStem(height: number, color: number, rand: () => number, size = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.014 * size, 0.02 * size, height, 5), MAT.stem, 0, height / 2, 0));
  const leaf = mesh(new THREE.SphereGeometry(0.08 * size, 8, 5), MAT.stem, 0.05 * size, height * 0.4, 0);
  leaf.scale.set(1, 0.15, 0.45);
  leaf.rotation.z = -0.5;
  g.add(leaf);
  const head = flowerHead(color, rand, size);
  head.position.y = height;
  head.rotation.set((rand() - 0.5) * 0.4, 0, (rand() - 0.5) * 0.4);
  g.add(head);
  return g;
}

/** Uma folha larga (plana e curvada), usada como apoio de insetos e em hortaliças. */
export function broadLeaf(length: number, color: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(length / 2, 14, 8);
  geo.scale(1, 0.12, 0.5);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (length / 2);
    pos.setY(i, pos.getY(i) + x * x * length * 0.12);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, solid(color, { roughness: 0.7, side: THREE.DoubleSide }));
}

// ---------- água ----------

export const waterClock = { uniforms: { uTime: { value: 0 } } };

let waterMat: THREE.MeshStandardMaterial | null = null;
/** Água com reflexo do céu e ondinhas (movimento no shader). */
export function waterMaterial(): THREE.MeshStandardMaterial {
  if (waterMat) return waterMat;
  waterMat = new THREE.MeshStandardMaterial({
    color: 0x2c6f9c,
    roughness: 0.06,
    metalness: 0.15,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });
  waterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterClock.uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 wp = modelMatrix * vec4(position, 1.0);
        transformed.y += sin(wp.x * 1.3 + uTime * 1.4) * 0.025 + cos(wp.z * 1.7 + uTime * 1.1) * 0.02;`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        vec4 wpn = modelMatrix * vec4(position, 1.0);
        objectNormal = normalize(vec3(-cos(wpn.x * 1.3 + uTime * 1.4) * 0.05, 1.0, sin(wpn.z * 1.7 + uTime * 1.1) * 0.05));`,
      );
  };
  return waterMat;
}

/** Superfície de água com contorno irregular (lago, poça, nascente). */
export function waterDisc(radius: number, seed: number, stretch = 1): THREE.Mesh {
  const shape = new THREE.Shape();
  const n = 48;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = radius * (0.85 + noise2(Math.cos(a) * 1.5 + seed, Math.sin(a) * 1.5) * 0.3);
    const x = Math.cos(a) * r * stretch;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const geo = new THREE.ShapeGeometry(shape, 24);
  geo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(geo, waterMaterial());
  water.userData.noShadow = true;
  water.receiveShadow = true;
  return water;
}

/** Anel de onda que se abre e some (em loop). */
export function ripple(radius: number, delay: number): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.userData.ripple = { radius, delay };
  ring.userData.noShadow = true;
  return ring;
}

/** Pedrinhas em volta de um ponto (contorno de lago, canteiro, fonte). */
export function stoneRing(radius: number, count: number, size = 0.12, stretch = 1): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const s = mesh(new THREE.DodecahedronGeometry(size * (0.8 + ((i * 37) % 10) / 20), 0), MAT.stone, Math.cos(a) * radius * stretch, size * 0.4, Math.sin(a) * radius);
    s.rotation.set(i, i * 2, 0);
    g.add(s);
  }
  return g;
}
