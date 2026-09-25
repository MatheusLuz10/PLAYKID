/** 🥕 Horta: canteiro, ervas, horta inicial, cenouras, tomates e composteira. */
import * as THREE from 'three';
import { broadLeaf, glowRing, MAT, mesh, rng, solid } from './common';

/** Canteiro elevado de madeira com terra e fileiras de mudinhas. */
function raisedBed(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  for (const [x, z, sx, sz] of [
    [0, d / 2, w + 0.14, 0.14],
    [0, -d / 2, w + 0.14, 0.14],
    [w / 2, 0, 0.14, d],
    [-w / 2, 0, 0.14, d],
  ]) {
    g.add(mesh(new THREE.BoxGeometry(sx, 0.3, sz), MAT.wood, x, 0.15, z));
  }
  g.add(mesh(new THREE.BoxGeometry(w, 0.24, d), MAT.soilWet, 0, 0.12, 0));
  return g;
}

function seedling(rand: () => number): THREE.Group {
  const s = new THREE.Group();
  s.add(mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.14, 4), MAT.stem, 0, 0.07, 0));
  for (const side of [-1, 1]) {
    const leaf = mesh(new THREE.SphereGeometry(0.06, 8, 5), solid(0x7cc24e), side * 0.05, 0.14, 0);
    leaf.scale.set(1, 0.2, 0.55);
    leaf.rotation.z = side * 0.4;
    s.add(leaf);
  }
  s.rotation.y = rand() * Math.PI;
  return s;
}

function gardenBed(): THREE.Group {
  const g = raisedBed(2.2, 1.1);
  const rand = rng(3);
  const rows = new THREE.Group();
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 7; i++) {
      const s = seedling(rand);
      s.position.set(-0.9 + i * 0.3, 0.24, -0.33 + r * 0.33);
      rows.add(s);
    }
  }
  rows.userData.sway = true;
  g.add(rows);
  return g;
}

/** Vasos de barro com ervas (manjericão, alecrim e hortelã). */
function herbs(): THREE.Group {
  const g = new THREE.Group();
  const rand = rng(5);
  const pots: [number, number, number][] = [
    [-0.55, 0, 0.8],
    [0.1, 0.25, 1],
    [0.6, -0.2, 0.75],
  ];
  pots.forEach(([x, z, s], i) => {
    const pot = new THREE.Group();
    pot.add(mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.4, 16), MAT.terracotta, 0, 0.2, 0));
    pot.add(mesh(new THREE.TorusGeometry(0.28, 0.035, 6, 16), MAT.terracotta, 0, 0.4, 0).rotateX(Math.PI / 2));
    pot.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 16), MAT.soil, 0, 0.38, 0));
    const plant = new THREE.Group();
    if (i === 1) {
      // alecrim: raminhos finos e retos
      for (let k = 0; k < 16; k++) {
        const twig = mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.45, 4), solid(0x5d7f4c), (rand() - 0.5) * 0.3, 0.6, (rand() - 0.5) * 0.3);
        twig.rotation.set((rand() - 0.5) * 0.5, 0, (rand() - 0.5) * 0.5);
        plant.add(twig);
      }
    } else {
      // manjericão / hortelã: folhinhas arredondadas
      const color = i === 0 ? 0x4f9a3a : 0x6cb85a;
      for (let k = 0; k < 18; k++) {
        const leaf = mesh(new THREE.SphereGeometry(0.07, 8, 5), solid(color), (rand() - 0.5) * 0.35, 0.45 + rand() * 0.25, (rand() - 0.5) * 0.35);
        leaf.scale.set(1, 0.4, 0.7);
        leaf.rotation.set(rand(), rand() * 3, rand());
        plant.add(leaf);
      }
    }
    plant.userData.sway = true;
    pot.add(plant);
    pot.position.set(x, 0, z);
    pot.scale.setScalar(s * 1.4);
    g.add(pot);
  });
  return g;
}

function lettuce(rand: () => number): THREE.Group {
  const head = new THREE.Group();
  const colors = [0x8fcf5a, 0x6fb244, 0xa6d86b];
  for (let i = 0; i < 7; i++) {
    const leaf = broadLeaf(0.34, colors[i % colors.length]);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.08, 0.1, Math.sin(a) * 0.08);
    leaf.rotation.set(0, -a, 0.9);
    head.add(leaf);
  }
  head.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), solid(0xb9e07c), 0, 0.12, 0));
  head.rotation.y = rand() * Math.PI;
  return head;
}

/** Horta Inicial (marco): canteiro grande com alfaces, couves e plaquinha. */
function gardenBasic(): THREE.Group {
  const g = raisedBed(3.4, 2.2);
  const rand = rng(11);
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 6; i++) {
      const l = lettuce(rand);
      l.position.set(-1.35 + i * 0.54, 0.24, -0.7 + r * 0.7);
      g.add(l);
    }
  }
  // plaquinha
  const sign = new THREE.Group();
  sign.add(mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), MAT.wood, 0, 0.3, 0));
  sign.add(mesh(new THREE.BoxGeometry(0.5, 0.3, 0.04), MAT.woodLight, 0, 0.6, 0.03));
  sign.position.set(1.85, 0, 1.2);
  g.add(sign);
  g.add(glowRing(2.6, 0xf5c542));
  return g;
}

/** Fileira de cenouras (ramas) e duas cenouras colhidas. */
function carrots(): THREE.Group {
  const g = new THREE.Group();
  const mound = mesh(new THREE.CapsuleGeometry(0.28, 2.2, 4, 10), MAT.soilWet, 0, 0.02, 0);
  mound.rotation.z = Math.PI / 2;
  mound.scale.set(1, 0.4, 1);
  g.add(mound);
  const tops = new THREE.Group();
  const rand = rng(21);
  const orange = solid(0xf07b1c);
  for (let i = 0; i < 9; i++) {
    const x = -1.1 + i * 0.28;
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.08, 8), orange, x, 0.12, 0));
    for (let k = 0; k < 5; k++) {
      const frond = mesh(new THREE.ConeGeometry(0.035, 0.42, 4), solid(0x4f9a2e), x + (rand() - 0.5) * 0.08, 0.34, (rand() - 0.5) * 0.08);
      frond.rotation.set((rand() - 0.5) * 0.7, rand() * 3, (rand() - 0.5) * 0.7);
      tops.add(frond);
    }
  }
  tops.userData.sway = true;
  g.add(tops);
  for (const [x, z, r] of [
    [0.4, 0.55, 0.3],
    [0.75, 0.5, -0.2],
  ]) {
    const carrot = mesh(new THREE.ConeGeometry(0.07, 0.42, 10), orange, x, 0.08, z);
    carrot.rotation.set(0, r, Math.PI / 2);
    g.add(carrot);
    const leaves = mesh(new THREE.ConeGeometry(0.05, 0.3, 4), solid(0x4f9a2e), x - 0.3, 0.08, z);
    leaves.rotation.z = -Math.PI / 2;
    g.add(leaves);
  }
  g.scale.setScalar(1.25);
  return g;
}

/** Tomateiros amarrados em estacas, com tomates verdes e maduros. */
function tomatoes(): THREE.Group {
  const g = new THREE.Group();
  const rand = rng(31);
  for (let p = 0; p < 3; p++) {
    const plant = new THREE.Group();
    plant.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6), MAT.woodLight, 0.08, 0.8, 0));
    plant.add(mesh(new THREE.CylinderGeometry(0.022, 0.03, 1.3, 6), MAT.stem, 0, 0.65, 0));
    const leaves = new THREE.Group();
    for (let k = 0; k < 14; k++) {
      const leaf = broadLeaf(0.28, 0x3f7f2c);
      const y = 0.25 + rand() * 1.1;
      const a = rand() * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 0.14, y, Math.sin(a) * 0.14);
      leaf.rotation.set(0, -a, 0.6);
      leaves.add(leaf);
    }
    leaves.userData.sway = true;
    plant.add(leaves);
    for (let k = 0; k < 6; k++) {
      const ripe = rand() < 0.65;
      const a = rand() * Math.PI * 2;
      const tomato = mesh(new THREE.SphereGeometry(0.09 + rand() * 0.03, 12, 10), solid(ripe ? 0xd7261e : 0x7fb04a, { roughness: 0.35 }), Math.cos(a) * 0.16, 0.35 + rand() * 0.8, Math.sin(a) * 0.16);
      tomato.scale.y = 0.85;
      plant.add(tomato);
    }
    plant.position.set(-0.8 + p * 0.8, 0, (rand() - 0.5) * 0.2);
    g.add(plant);
  }
  const bed = mesh(new THREE.BoxGeometry(2.4, 0.08, 0.7), MAT.soilWet, 0, 0.04, 0);
  g.add(bed);
  return g;
}

/** Composteira de ripas com restos orgânicos. */
function compost(): THREE.Group {
  const g = new THREE.Group();
  const w = 1.3;
  for (let y = 0; y < 4; y++) {
    const h = 0.14 + y * 0.2;
    g.add(mesh(new THREE.BoxGeometry(w, 0.13, 0.06), MAT.wood, 0, h, -w / 2));
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.13, w), MAT.wood, -w / 2, h, 0));
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.13, w), MAT.wood, w / 2, h, 0));
    if (y < 2) g.add(mesh(new THREE.BoxGeometry(w, 0.13, 0.06), MAT.wood, 0, h, w / 2));
  }
  for (const [x, z] of [
    [-w / 2, -w / 2],
    [w / 2, -w / 2],
    [-w / 2, w / 2],
    [w / 2, w / 2],
  ]) {
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), MAT.woodLight, x, 0.45, z));
  }
  const heap = mesh(new THREE.SphereGeometry(0.62, 16, 10), solid(0x4a3524, { roughness: 1 }), 0, 0.25, 0);
  heap.scale.set(1, 0.6, 1);
  g.add(heap);
  const rand = rng(51);
  const bits = [0x8fbf4a, 0xe07b2c, 0xe8c35a, 0x9c6b3c];
  for (let i = 0; i < 14; i++) {
    const bit = mesh(new THREE.BoxGeometry(0.08, 0.03, 0.12), solid(bits[i % bits.length]), (rand() - 0.5) * 0.8, 0.55 + rand() * 0.05, (rand() - 0.5) * 0.8);
    bit.rotation.set(rand(), rand() * 3, rand());
    g.add(bit);
  }
  // pá encostada
  const shovel = new THREE.Group();
  shovel.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 6), MAT.woodLight, 0, 0.55, 0));
  shovel.add(mesh(new THREE.BoxGeometry(0.22, 0.28, 0.02), MAT.metal, 0, 0.05, 0));
  shovel.position.set(0.85, 0, 0.3);
  shovel.rotation.z = -0.25;
  g.add(shovel);
  return g;
}

export const gardenModels: Record<string, () => THREE.Group> = {
  garden_bed: gardenBed,
  herbs,
  garden_basic: gardenBasic,
  carrot: carrots,
  tomato: tomatoes,
  compost,
};
