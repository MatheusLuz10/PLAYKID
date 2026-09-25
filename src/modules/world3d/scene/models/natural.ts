/** 🌳 Área natural: broto, arbusto, árvores, pinheiro especial, flores, canteiro e pastagem. */
import * as THREE from 'three';
import { noise2 } from '../terrain';
import { crown, flowerStem, glowRing, MAT, mesh, PETALS, rng, solid, tree, trunk } from './common';

function sprout(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.5, 6), MAT.stem, 0, 0.25, 0));
  for (const side of [-1, 1]) {
    const leaf = mesh(new THREE.SphereGeometry(0.16, 10, 6), solid(0x78b84a), side * 0.13, 0.46, 0);
    leaf.scale.set(1, 0.18, 0.55);
    leaf.rotation.z = side * 0.45;
    g.add(leaf);
  }
  const mound = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), MAT.soil);
  mound.scale.y = 0.3;
  g.add(mound);
  g.userData.sway = true;
  g.scale.setScalar(1.4);
  return g;
}

function bush(): THREE.Group {
  const g = new THREE.Group();
  crown(
    g,
    [
      [0, 0.45, 0, 0.62],
      [0.55, 0.35, 0.2, 0.48],
      [-0.5, 0.38, 0.1, 0.52],
      [0.1, 0.35, -0.5, 0.46],
      [0.05, 0.8, 0.05, 0.42],
    ],
    0x2f5a22,
    0x6fa043,
    4,
  );
  return g;
}

function largeTree(): THREE.Group {
  const g = new THREE.Group();
  g.add(trunk(3.4, 0.42, 3, MAT.barkDark));
  for (const [rz, ry, len] of [
    [0.9, 0.4, 1.6],
    [-0.8, 2.4, 1.5],
    [0.7, 4.2, 1.3],
  ] as const) {
    const branch = trunk(len, 0.14, rz * 5, MAT.barkDark);
    branch.position.y = 2.6;
    branch.rotation.set(0, ry, rz);
    g.add(branch);
  }
  crown(
    g,
    [
      [0, 4.6, 0, 1.7],
      [1.5, 4.0, 0.4, 1.3],
      [-1.4, 4.1, -0.3, 1.35],
      [0.3, 4.0, 1.4, 1.2],
      [-0.2, 4.1, -1.4, 1.25],
      [0.2, 5.5, 0.1, 1.15],
    ],
    0x264f1d,
    0x6e9f3f,
    9,
  );
  return g;
}

export function conifer(ring = true): THREE.Group {
  const g = new THREE.Group();
  g.add(trunk(1.4, 0.2, 5, MAT.barkDark));
  const top = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const r = 1.55 - i * 0.26;
    const geo = new THREE.ConeGeometry(r, 1.5, 14, 3);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const light = new THREE.Color(0x4f8a55);
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v);
      const z = pos.getZ(v);
      const k = 1 + (noise2(x * 3 + i, z * 3) - 0.5) * 0.3;
      pos.setX(v, x * k);
      pos.setZ(v, z * k);
      c.setHex(0x1f4a2c).lerp(light, ((pos.getY(v) + 0.75) / 1.5) * 0.7 + noise2(x * 6, z * 6) * 0.3);
      colors.set([c.r, c.g, c.b], v * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    top.add(mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), 0, 1.7 + i * 0.85, 0));
  }
  top.userData.sway = true;
  g.add(top);
  if (ring) g.add(glowRing(1.9, 0xb98cff));
  return g;
}

export function flowerCluster(seed: number, colors = [0xf06f9b, 0xf7a8c4], count = 5, spread = 0.6): THREE.Group {
  const g = new THREE.Group();
  const rand = rng(seed);
  for (let i = 0; i < count; i++) {
    const f = flowerStem(0.45 + rand() * 0.3, colors[i % colors.length], rand);
    f.position.set((rand() - 0.5) * spread, 0, (rand() - 0.5) * spread);
    g.add(f);
  }
  g.userData.sway = true;
  g.scale.setScalar(1.3);
  return g;
}

export function planterBox(w: number, d: number, flowers: number, seed: number, palette = PETALS): THREE.Group {
  const g = new THREE.Group();
  for (const [x, z, sx, sz] of [
    [0, d / 2, w + 0.12, 0.12],
    [0, -d / 2, w + 0.12, 0.12],
    [w / 2, 0, 0.12, d],
    [-w / 2, 0, 0.12, d],
  ]) {
    g.add(mesh(new THREE.BoxGeometry(sx, 0.22, sz), MAT.wood, x, 0.11, z));
  }
  g.add(mesh(new THREE.BoxGeometry(w, 0.16, d), MAT.soil, 0, 0.08, 0));
  const bloom = new THREE.Group();
  const rand = rng(seed);
  for (let i = 0; i < flowers; i++) {
    const f = flowerStem(0.3 + rand() * 0.35, palette[Math.floor(rand() * palette.length)], rand);
    f.position.set((rand() - 0.5) * (w - 0.3), 0.16, (rand() - 0.5) * (d - 0.25));
    bloom.add(f);
  }
  bloom.userData.sway = true;
  g.add(bloom);
  return g;
}

export function cowModel(): THREE.Group {
  const g = new THREE.Group();
  const hide = MAT.white;
  const pink = solid(0xe8a3a0);
  const body = mesh(new THREE.CapsuleGeometry(0.46, 1.0, 6, 14), hide, 0, 1.02, 0);
  body.rotation.z = Math.PI / 2;
  g.add(body);
  const rand = rng(4);
  for (let i = 0; i < 6; i++) {
    const a = rand() * Math.PI * 2;
    const s = mesh(new THREE.SphereGeometry(0.2 + rand() * 0.14, 10, 6), MAT.dark, -0.5 + rand() * 1.0, 1.02 + Math.sin(a) * 0.4, Math.cos(a) * 0.4);
    s.scale.set(1, 0.9, 0.35);
    s.lookAt(new THREE.Vector3(s.position.x, 1.02, 0));
    g.add(s);
  }
  for (const [x, z] of [
    [0.55, 0.24],
    [0.55, -0.24],
    [-0.55, 0.24],
    [-0.55, -0.24],
  ]) {
    g.add(mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.72, 8), hide, x, 0.36, z));
    g.add(mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.1, 8), MAT.dark, x, 0.05, z));
  }
  const udder = mesh(new THREE.SphereGeometry(0.16, 10, 8), pink, -0.25, 0.62, 0);
  udder.scale.y = 0.7;
  g.add(udder);

  const head = new THREE.Group();
  const skull = mesh(new THREE.SphereGeometry(0.3, 14, 10), hide);
  skull.scale.set(1.25, 1, 0.9);
  head.add(skull);
  const muzzle = mesh(new THREE.SphereGeometry(0.2, 12, 8), pink, 0.3, -0.08, 0);
  muzzle.scale.set(0.8, 0.75, 1);
  head.add(muzzle);
  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.1, 8, 6), hide, -0.05, 0.12, side * 0.3);
    ear.scale.set(0.5, 0.3, 1);
    head.add(ear);
    const horn = mesh(new THREE.ConeGeometry(0.04, 0.16, 6), solid(0xe8dcc0), -0.02, 0.28, side * 0.14);
    horn.rotation.x = side * -0.5;
    head.add(horn);
    head.add(mesh(new THREE.SphereGeometry(0.035, 6, 5), MAT.dark, 0.18, 0.08, side * 0.2));
  }
  head.position.set(1.02, 1.08, 0);
  head.userData.graze = true;
  g.add(head);

  const tail = mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.7, 5), hide, -1.0, 0.85, 0);
  tail.rotation.z = -0.25;
  tail.userData.tail = true;
  g.add(tail);
  return g;
}

/** Pastagem: cercado de madeira, vaca pastando, cocho com água e fardo de feno. */
function pasture(): THREE.Group {
  const g = new THREE.Group();
  g.userData.noRotate = true;
  const w = 4.4;
  const d = 3;
  const posts: [number, number][] = [];
  for (let i = 0; i <= 4; i++) posts.push([-w / 2 + (w * i) / 4, -d / 2], [-w / 2 + (w * i) / 4, d / 2]);
  for (let i = 1; i < 3; i++) posts.push([-w / 2, -d / 2 + (d * i) / 3], [w / 2, -d / 2 + (d * i) / 3]);
  for (const [x, z] of posts) g.add(mesh(new THREE.BoxGeometry(0.13, 1, 0.13), MAT.wood, x, 0.5, z));
  for (const y of [0.4, 0.78]) {
    g.add(mesh(new THREE.BoxGeometry(w, 0.08, 0.06), MAT.wood, 0, y, -d / 2));
    g.add(mesh(new THREE.BoxGeometry(w * 0.35, 0.08, 0.06), MAT.wood, -w / 2 + w * 0.175, y, d / 2));
    g.add(mesh(new THREE.BoxGeometry(w * 0.35, 0.08, 0.06), MAT.wood, w / 2 - w * 0.175, y, d / 2));
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.08, d), MAT.wood, -w / 2, y, 0));
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.08, d), MAT.wood, w / 2, y, 0));
  }
  // porteira aberta na frente
  const gate = new THREE.Group();
  for (const y of [0.4, 0.78]) gate.add(mesh(new THREE.BoxGeometry(w * 0.3, 0.07, 0.05), MAT.woodLight, w * 0.15, y, 0));
  gate.position.set(-w * 0.15, 0, d / 2);
  gate.rotation.y = -0.9;
  g.add(gate);

  const cow = cowModel();
  cow.scale.setScalar(0.85);
  cow.position.set(-0.4, 0, 0.1);
  cow.rotation.y = 0.35;
  g.add(cow);

  // cocho com água
  const trough = new THREE.Group();
  trough.add(mesh(new THREE.BoxGeometry(1.2, 0.4, 0.5), MAT.woodLight, 0, 0.2, 0));
  const water = mesh(new THREE.BoxGeometry(1.08, 0.02, 0.4), solid(0x3b7fae, { roughness: 0.1, metalness: 0.1 }), 0, 0.38, 0);
  trough.add(water);
  trough.position.set(1.6, 0, -1.1);
  g.add(trough);

  // fardo de feno
  const hay = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.9, 20), solid(0xd8b85a, { roughness: 1 }), -1.7, 0.5, -1);
  hay.rotation.z = Math.PI / 2;
  g.add(hay);
  const loose = mesh(new THREE.SphereGeometry(0.35, 10, 6), solid(0xc9a64a, { roughness: 1 }), -1.1, 0.08, -0.6);
  loose.scale.y = 0.25;
  g.add(loose);
  return g;
}

export const naturalModels: Record<string, () => THREE.Group> = {
  plant_small: sprout,
  bush_basic: bush,
  tree_basic: () => tree(1),
  tree_first_step: () => {
    const g = tree(6, 1.12);
    g.add(glowRing(1.5, 0xf5c542));
    return g;
  },
  tree_large: largeTree,
  tree_special: () => conifer(true),
  flower_basic: () => flowerCluster(12),
  flowerbed: () => planterBox(2.6, 1.3, 26, 33),
  cow_pasture: pasture,
};

export { bush, largeTree };
