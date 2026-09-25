/** 🐝 Jardim dos polinizadores: flores, abelhas, borboleta, Jardim da Vida, joaninha, lagarta e pássaro. */
import * as THREE from 'three';
import { broadLeaf, flowerStem, glowRing, MAT, mesh, PETALS, rng, solid } from './common';
import { flowerCluster } from './natural';

/** Lavandas (espigas roxas) — flor que os polinizadores adoram. */
function lavender(rand: () => number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const h = 0.55 + rand() * 0.3;
    const stalk = new THREE.Group();
    stalk.add(mesh(new THREE.CylinderGeometry(0.01, 0.014, h, 4), solid(0x6d8a55), 0, h / 2, 0));
    stalk.add(mesh(new THREE.CapsuleGeometry(0.035, 0.16, 4, 6), solid(0x8b6fd1), 0, h + 0.06, 0));
    stalk.position.set((rand() - 0.5) * 0.4, 0, (rand() - 0.5) * 0.4);
    stalk.rotation.set((rand() - 0.5) * 0.3, 0, (rand() - 0.5) * 0.3);
    g.add(stalk);
  }
  return g;
}

function flowersForPollinators(): THREE.Group {
  const g = new THREE.Group();
  const rand = rng(61);
  const lav = lavender(rand);
  lav.position.set(-0.5, 0, 0);
  g.add(lav);
  const mix = flowerCluster(62, [0xe8453c, 0xfbd34d, 0xf29bb5], 7, 0.8);
  mix.position.set(0.45, 0, 0.1);
  g.add(mix);
  const lav2 = lavender(rand);
  lav2.position.set(0.2, 0, -0.55);
  g.add(lav2);
  g.userData.sway = true;
  return g;
}

export function beeModel(): THREE.Group {
  const bee = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.09, 12, 8), solid(0xf2b705), 0, 0, 0);
  body.scale.set(1.4, 1, 1);
  bee.add(body);
  for (const x of [-0.04, 0.04]) {
    const stripe = mesh(new THREE.TorusGeometry(0.083, 0.018, 6, 14), MAT.dark, x, 0, 0);
    stripe.rotation.y = Math.PI / 2;
    bee.add(stripe);
  }
  bee.add(mesh(new THREE.SphereGeometry(0.055, 8, 6), MAT.dark, 0.12, 0.01, 0));
  const wings = new THREE.Group();
  const wingMat = solid(0xe8f4ff, { transparent: true, opacity: 0.6, roughness: 0.2 });
  for (const side of [-1, 1]) {
    const wing = mesh(new THREE.SphereGeometry(0.07, 8, 5), wingMat, 0, 0.07, side * 0.06);
    wing.scale.set(1, 0.15, 0.6);
    wing.rotation.x = side * 0.5;
    wings.add(wing);
  }
  wings.userData.flap = true;
  bee.add(wings);
  return bee;
}

/** Caixa de abelhas sem ferrão num poste, com abelhas voando em volta das flores. */
function bees(): THREE.Group {
  const g = new THREE.Group();
  const hive = new THREE.Group();
  hive.add(mesh(new THREE.BoxGeometry(0.1, 1.1, 0.1), MAT.wood, 0, 0.55, 0));
  hive.add(mesh(new THREE.BoxGeometry(0.6, 0.4, 0.45), MAT.woodLight, 0, 1.3, 0));
  const roof = mesh(new THREE.BoxGeometry(0.72, 0.06, 0.58), MAT.wood, 0, 1.53, 0);
  roof.rotation.z = 0.08;
  hive.add(roof);
  hive.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10), MAT.dark, 0.31, 1.25, 0).rotateZ(Math.PI / 2));
  hive.position.set(-0.6, 0, -0.3);
  g.add(hive);
  const flowers = flowerCluster(71, [0xfbd34d, 0xffffff], 6, 0.7);
  flowers.position.set(0.5, 0, 0.3);
  g.add(flowers);
  for (let i = 0; i < 3; i++) {
    const bee = beeModel();
    bee.scale.setScalar(1.6);
    bee.userData.orbit = { r: 0.7 + i * 0.25, h: 0.9 + i * 0.25, speed: 1.3 + i * 0.35, cx: 0.2, cz: 0.1, phase: i * 2 };
    g.add(bee);
  }
  return g;
}

function butterflyModel(color: number): THREE.Group {
  const b = new THREE.Group();
  b.add(mesh(new THREE.CapsuleGeometry(0.02, 0.16, 4, 6), MAT.dark, 0, 0, 0).rotateZ(Math.PI / 2));
  const wingMat = solid(color, { side: THREE.DoubleSide, roughness: 0.5 });
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    const upper = mesh(new THREE.CircleGeometry(0.15, 14), wingMat, 0.03, 0, side * 0.13);
    upper.rotation.x = -Math.PI / 2;
    upper.scale.set(1, 1.2, 1);
    const lower = mesh(new THREE.CircleGeometry(0.1, 12), wingMat, -0.08, 0, side * 0.1);
    lower.rotation.x = -Math.PI / 2;
    const spot = mesh(new THREE.CircleGeometry(0.04, 10), MAT.dark, 0.05, 0.002, side * 0.16);
    spot.rotation.x = -Math.PI / 2;
    wing.add(upper, lower, spot);
    wing.userData.flapSide = side;
    b.add(wing);
  }
  b.userData.flap = true;
  return b;
}

function butterflies(): THREE.Group {
  const g = new THREE.Group();
  const flowers = flowerCluster(81, [0xc08cf2, 0xf7a8c4], 6, 0.8);
  g.add(flowers);
  const b = butterflyModel(0xf28a1c);
  b.scale.setScalar(1.8);
  b.userData.orbit = { r: 1.1, h: 1.3, speed: 0.8, cx: 0, cz: 0, phase: 0, figure8: true };
  g.add(b);
  const b2 = butterflyModel(0x4fa3e0);
  b2.scale.setScalar(1.4);
  b2.userData.orbit = { r: 0.8, h: 1.0, speed: 1.1, cx: 0, cz: 0, phase: 2.5, figure8: true };
  g.add(b2);
  return g;
}

function sunflower(h: number, rand: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.045, h, 6), MAT.stem, 0, h / 2, 0));
  for (let i = 0; i < 3; i++) {
    const leaf = broadLeaf(0.36, 0x4f8f2e);
    leaf.position.set(0, h * (0.3 + i * 0.2), 0);
    leaf.rotation.set(0, i * 2.1, 0.5);
    g.add(leaf);
  }
  const head = new THREE.Group();
  head.add(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 20), solid(0x5a3a1c, { roughness: 1 })).rotateX(Math.PI / 2));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const petal = mesh(new THREE.SphereGeometry(0.08, 8, 5), solid(0xf9c21a), Math.cos(a) * 0.23, Math.sin(a) * 0.23, 0);
    petal.scale.set(1.3, 0.45, 0.2);
    petal.rotation.z = a;
    head.add(petal);
  }
  head.position.y = h;
  head.rotation.set(-0.35, rand() * 0.6 - 0.3, 0);
  g.add(head);
  return g;
}

/** Jardim da Vida (marco épico): canteiro redondo com girassóis e flores, e borboletas. */
function lifeGarden(): THREE.Group {
  const g = new THREE.Group();
  const r = 2;
  g.add(mesh(new THREE.CylinderGeometry(r, r, 0.14, 40), MAT.soil, 0, 0.07, 0));
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    g.add(mesh(new THREE.DodecahedronGeometry(0.13, 0), MAT.stone, Math.cos(a) * r, 0.1, Math.sin(a) * r));
  }
  const rand = rng(91);
  const plants = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const s = sunflower(1.3 + rand() * 0.5, rand);
    s.position.set(Math.cos(a) * 0.7, 0.12, Math.sin(a) * 0.7);
    plants.add(s);
  }
  for (let i = 0; i < 22; i++) {
    const a = rand() * Math.PI * 2;
    const d = 0.9 + rand() * 0.9;
    const f = flowerStem(0.3 + rand() * 0.3, PETALS[i % PETALS.length], rand);
    f.position.set(Math.cos(a) * d, 0.12, Math.sin(a) * d);
    plants.add(f);
  }
  plants.userData.sway = true;
  g.add(plants);
  const b = butterflyModel(0xf5d33c);
  b.scale.setScalar(1.5);
  b.userData.orbit = { r: 1.4, h: 1.8, speed: 0.7, cx: 0, cz: 0, phase: 1, figure8: true };
  g.add(b);
  const bee = beeModel();
  bee.scale.setScalar(1.6);
  bee.userData.orbit = { r: 1.0, h: 1.2, speed: 1.6, cx: 0, cz: 0, phase: 3 };
  g.add(bee);
  g.add(glowRing(2.5, 0xb98cff));
  return g;
}

/** Joaninha numa folha grande. */
function ladybug(): THREE.Group {
  const g = new THREE.Group();
  const plant = new THREE.Group();
  plant.add(mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.5, 6), MAT.stem, 0, 0.25, 0));
  const leaf = broadLeaf(1.1, 0x5da83a);
  leaf.position.set(0.3, 0.5, 0);
  leaf.rotation.z = 0.15;
  plant.add(leaf);
  const leaf2 = broadLeaf(0.8, 0x4c9230);
  leaf2.position.set(-0.25, 0.35, 0.1);
  leaf2.rotation.set(0, 2.6, 0.3);
  plant.add(leaf2);
  g.add(plant);
  const bug = new THREE.Group();
  const shell = mesh(new THREE.SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), solid(0xd81f1f, { roughness: 0.3 }));
  shell.scale.set(1.2, 0.8, 1);
  bug.add(shell);
  bug.add(mesh(new THREE.BoxGeometry(0.3, 0.005, 0.01), MAT.dark, 0, 0.1, 0));
  for (const [x, z] of [
    [0.05, 0.06],
    [0.05, -0.06],
    [-0.06, 0.07],
    [-0.06, -0.07],
    [-0.1, 0],
  ]) {
    bug.add(mesh(new THREE.SphereGeometry(0.025, 6, 5), MAT.dark, x, 0.085, z));
  }
  bug.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), MAT.dark, 0.15, 0.02, 0));
  bug.position.set(0.45, 0.6, 0);
  bug.userData.hop = { amp: 0.01, speed: 3 };
  g.add(bug);
  g.scale.setScalar(1.4);
  return g;
}

/** Lagartinha verde num galho com folhas. */
function caterpillar(): THREE.Group {
  const g = new THREE.Group();
  const branch = mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.4, 6), MAT.bark, 0, 0.35, 0);
  branch.rotation.z = Math.PI / 2 - 0.3;
  g.add(branch);
  for (let i = 0; i < 4; i++) {
    const leaf = broadLeaf(0.5, 0x6cb044);
    leaf.position.set(-0.5 + i * 0.35, 0.2 + i * 0.12, (i % 2 ? 1 : -1) * 0.15);
    leaf.rotation.y = i % 2 ? 0.6 : -0.6;
    g.add(leaf);
  }
  const body = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const seg = mesh(new THREE.SphereGeometry(0.055, 10, 8), solid(i === 6 ? 0x5a8f1c : 0x8cc63f), -i * 0.08, 0, 0);
    seg.userData.wiggle = i;
    body.add(seg);
  }
  for (const z of [-0.02, 0.02]) body.add(mesh(new THREE.SphereGeometry(0.012, 5, 4), MAT.dark, 0.04, 0.03, z));
  body.position.set(0.25, 0.5, 0);
  body.rotation.z = -0.3;
  g.add(body);
  g.scale.setScalar(1.5);
  return g;
}

/** Pássaro numa casinha de passarinho sobre um poste. */
function bird(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.8, 8), MAT.wood, 0, 0.9, 0));
  const house = new THREE.Group();
  house.add(mesh(new THREE.BoxGeometry(0.45, 0.5, 0.45), solid(0x4f9fd6), 0, 0, 0));
  const roofL = mesh(new THREE.BoxGeometry(0.36, 0.04, 0.55), solid(0xc0503a), -0.12, 0.33, 0);
  roofL.rotation.z = 0.7;
  const roofR = mesh(new THREE.BoxGeometry(0.36, 0.04, 0.55), solid(0xc0503a), 0.12, 0.33, 0);
  roofR.rotation.z = -0.7;
  house.add(roofL, roofR);
  house.add(mesh(new THREE.CircleGeometry(0.07, 14), MAT.dark, 0, 0.03, 0.227));
  house.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 5), MAT.wood, 0, -0.1, 0.28).rotateX(Math.PI / 2));
  house.position.y = 2.05;
  g.add(house);
  const b = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.13, 12, 10), solid(0xe0632a), 0, 0, 0);
  body.scale.set(1.3, 1, 1);
  b.add(body);
  b.add(mesh(new THREE.SphereGeometry(0.085, 10, 8), solid(0x8a4a2a), 0.13, 0.07, 0));
  b.add(mesh(new THREE.ConeGeometry(0.03, 0.08, 6), solid(0xf2b705), 0.23, 0.06, 0).rotateZ(-Math.PI / 2));
  b.add(mesh(new THREE.BoxGeometry(0.16, 0.02, 0.08), solid(0x8a4a2a), -0.18, 0.02, 0));
  for (const z of [-0.05, 0.05]) b.add(mesh(new THREE.SphereGeometry(0.015, 5, 4), MAT.dark, 0.18, 0.1, z));
  b.position.set(0, 2.52, 0);
  b.userData.hop = { amp: 0.06, speed: 2.4, turn: true };
  g.add(b);
  return g;
}

export const pollinatorModels: Record<string, () => THREE.Group> = {
  flower_pollinator: flowersForPollinators,
  bee: bees,
  butterfly: butterflies,
  pollinator_garden: lifeGarden,
  ladybug,
  insect: caterpillar,
  bird,
};
