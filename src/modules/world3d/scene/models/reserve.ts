/**
 * 🌳 Reserva Florestal da Amazônia (no próprio mundo): floresta com samaúma,
 * castanheiras e açaizeiros, área de reflorestamento com mudas em fileiras,
 * portal de entrada e bichos da Amazônia (araras voando, tucano, preguiça, onça).
 * Tocar nela abre o que conhecer e os quizzes da reserva.
 */
import * as THREE from 'three';
import { heightAt } from '../terrain';
import { RESERVE } from '../layout';
import { crown, MAT, mesh, rng, shadow, solid, tree, trunk } from './common';

/** Samaúma: a "rainha da floresta" — tronco alto com raízes em aleta e copa larga em guarda-chuva. */
function samauma(seed: number): THREE.Group {
  const g = new THREE.Group();
  g.add(trunk(5.6, 0.5, seed, MAT.barkDark));
  for (let i = 0; i < 6; i++) {
    const fin = mesh(new THREE.BoxGeometry(0.1, 1.3, 1.0), MAT.barkDark, 0, 0.6, 0);
    fin.geometry.translate(0, 0, 0.5);
    fin.rotation.y = (i / 6) * Math.PI * 2 + seed;
    fin.scale.set(1, 1, 0.9 + (i % 2) * 0.3);
    g.add(fin);
  }
  crown(
    g,
    [
      [0, 6.1, 0, 1.7],
      [1.6, 5.8, 0.3, 1.25],
      [-1.6, 5.8, -0.2, 1.3],
      [0.2, 5.9, 1.5, 1.15],
      [-0.2, 5.9, -1.5, 1.15],
      [0, 6.7, 0, 1.1],
    ],
    0x1d4d1f,
    0x6aa545,
    seed,
  );
  return g;
}

/** Castanheira: tronco reto e copa redonda no alto; opcionalmente um galho lateral (para a preguiça). */
function castanheira(seed: number, branch = false): THREE.Group {
  const g = new THREE.Group();
  g.add(trunk(4.3, 0.32, seed));
  crown(
    g,
    [
      [0, 4.6, 0, 1.2],
      [0.8, 4.3, 0.2, 0.85],
      [-0.75, 4.35, -0.2, 0.9],
      [0, 5.2, 0.1, 0.8],
    ],
    0x255a22,
    0x79b04d,
    seed,
  );
  if (branch) {
    const b = mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.5, 7), MAT.bark, 0.75, 3.4, 0);
    b.rotation.z = Math.PI / 2 - 0.15;
    g.add(b);
  }
  return g;
}

/** Açaizeiro: palmeira fina, com folhas longas caídas e cachos de frutinhas roxas. */
function acai(seed: number): THREE.Group {
  const g = new THREE.Group();
  const h = 3.4 + (seed % 3) * 0.3;
  const stem = mesh(new THREE.CylinderGeometry(0.05, 0.08, h, 7), MAT.bark, 0, h / 2, 0);
  stem.rotation.z = Math.sin(seed) * 0.06;
  g.add(stem);
  const top = new THREE.Group();
  top.position.y = h;
  for (let i = 0; i < 8; i++) {
    const frond = new THREE.Group();
    const leaf = mesh(new THREE.BoxGeometry(1.35, 0.025, 0.22), solid(i % 2 ? 0x3f8a33 : 0x4f9a3c), 0.65, 0, 0);
    frond.add(leaf);
    frond.rotation.y = (i / 8) * Math.PI * 2 + seed;
    frond.rotation.z = -0.45 - (i % 3) * 0.08;
    top.add(frond);
  }
  for (let i = 0; i < 7; i++) top.add(mesh(new THREE.SphereGeometry(0.06, 6, 5), solid(0x4b1f4f), Math.cos(i) * 0.12, -0.25 - (i % 3) * 0.06, Math.sin(i) * 0.12));
  top.userData.sway = true;
  g.add(top);
  return g;
}

/** Muda plantada: montinho de terra, estaca de madeira e folhinhas. */
function seedling(seed: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(0.16, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), MAT.soil, 0, 0, 0));
  g.add(mesh(new THREE.BoxGeometry(0.03, 0.55, 0.03), MAT.woodLight, 0.08, 0.27, 0));
  const h = 0.22 + (seed % 3) * 0.06;
  g.add(mesh(new THREE.CylinderGeometry(0.012, 0.018, h, 5), MAT.stem, 0, h / 2, 0));
  for (let i = 0; i < 3; i++) {
    const leaf = mesh(new THREE.SphereGeometry(0.06, 6, 4), MAT.leaf, 0, h - i * 0.05, 0);
    leaf.scale.set(1.3, 0.3, 0.6);
    leaf.position.x = (i % 2 ? 1 : -1) * 0.05;
    leaf.rotation.y = i * 1.3;
    g.add(leaf);
  }
  return g;
}

/** Arara-vermelha voando em círculos sobre a copa. */
function macaw(cx: number, cz: number, h: number, phase: number, blue = false): THREE.Group {
  const g = new THREE.Group();
  const bodyColor = blue ? 0x2f6fd0 : 0xd62d20;
  const body = mesh(new THREE.SphereGeometry(0.16, 10, 8), solid(bodyColor), 0, 0, 0);
  body.scale.set(1.6, 0.9, 0.9);
  g.add(body);
  g.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), solid(bodyColor), 0.24, 0.06, 0));
  g.add(mesh(new THREE.ConeGeometry(0.045, 0.1, 6), solid(0xf1ede4), 0.34, 0.03, 0).rotateZ(-Math.PI / 2));
  const tail = mesh(new THREE.BoxGeometry(0.45, 0.02, 0.09), solid(blue ? 0xf2c230 : 0x2f6fd0), -0.4, -0.02, 0);
  g.add(tail);
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.add(mesh(new THREE.BoxGeometry(0.22, 0.02, 0.36), solid(blue ? 0xf2c230 : 0x2f6fd0), 0, 0, side * 0.18));
    wing.add(mesh(new THREE.BoxGeometry(0.18, 0.021, 0.12), solid(0xf2c230), 0.02, 0, side * 0.06));
    wing.userData.flapSide = side;
    g.add(wing);
  }
  g.userData.flap = true;
  g.userData.orbit = { r: 2.4, h, speed: 0.45, cx, cz, phase, figure8: blue };
  return g;
}

/** Tucano no galho: corpo preto, peito branco e o bico laranja enorme. */
function toucan(): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.13, 10, 8), solid(0x1d1d1d), 0, 0, 0);
  body.scale.set(0.9, 1.3, 0.9);
  g.add(body);
  g.add(mesh(new THREE.SphereGeometry(0.08, 8, 6), solid(0xf6f1e0), 0.07, 0.05, 0));
  g.add(mesh(new THREE.SphereGeometry(0.08, 10, 8), solid(0x1d1d1d), 0.02, 0.2, 0));
  const beak = mesh(new THREE.ConeGeometry(0.05, 0.26, 8), solid(0xf28a1d), 0.19, 0.19, 0);
  beak.rotation.z = -Math.PI / 2;
  g.add(beak);
  g.add(mesh(new THREE.BoxGeometry(0.03, 0.2, 0.08), solid(0x1d1d1d), -0.1, -0.12, 0));
  g.userData.hop = { amp: 0.04, speed: 1.6, turn: true };
  return g;
}

/** Preguiça pendurada no galho, bem devagar. */
function sloth(): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(new THREE.CapsuleGeometry(0.16, 0.3, 4, 10), solid(0x8a7258), 0, -0.4, 0);
  g.add(body);
  g.add(mesh(new THREE.SphereGeometry(0.12, 10, 8), solid(0x9c8468), 0, -0.2, 0.12));
  g.add(mesh(new THREE.SphereGeometry(0.075, 8, 6), solid(0xd8c7a8), 0, -0.2, 0.2));
  for (const x of [-0.035, 0.035]) g.add(mesh(new THREE.SphereGeometry(0.016, 5, 4), MAT.dark, x, -0.18, 0.26));
  for (const x of [-0.12, 0.12]) {
    const arm = mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.4, 6), solid(0x8a7258), x, -0.08, 0);
    g.add(arm);
  }
  g.userData.sway = true;
  return g;
}

/** Onça-pintada deitada, com rabo balançando. */
function jaguar(): THREE.Group {
  const g = new THREE.Group();
  const fur = solid(0xd9a441);
  const body = mesh(new THREE.CapsuleGeometry(0.2, 0.7, 4, 12), fur, 0, 0.22, 0);
  body.rotation.z = Math.PI / 2;
  g.add(body);
  const head = mesh(new THREE.SphereGeometry(0.18, 12, 10), fur, 0.52, 0.32, 0);
  head.scale.set(1.1, 0.95, 1);
  g.add(head);
  g.add(mesh(new THREE.SphereGeometry(0.08, 8, 6), solid(0xf0dfb8), 0.66, 0.28, 0));
  for (const z of [-0.1, 0.1]) {
    g.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), fur, 0.48, 0.48, z));
    g.add(mesh(new THREE.SphereGeometry(0.018, 5, 4), MAT.dark, 0.66, 0.36, z * 0.6));
  }
  for (const [x, z] of [[0.35, 0.14], [0.35, -0.14], [-0.3, 0.14], [-0.3, -0.14]]) g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 6), fur, x, 0.07, z));
  const rand = rng(77);
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2;
    const x = -0.45 + rand() * 0.9;
    g.add(mesh(new THREE.SphereGeometry(0.035, 5, 4), solid(0x3a2a1a), x, 0.22 + Math.cos(a) * 0.2, Math.sin(a) * 0.2));
  }
  const tail = new THREE.Group();
  tail.add(mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.6, 6), fur, 0, -0.3, 0));
  tail.position.set(-0.55, 0.25, 0);
  tail.rotation.z = -1.1;
  tail.userData.tail = true;
  g.add(tail);
  return g;
}

/** Portal de madeira da entrada, com a placa verde da reserva. */
function gate(): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.4, 8), MAT.wood, x, 1.2, 0));
  g.add(mesh(new THREE.BoxGeometry(2.5, 0.16, 0.2), MAT.wood, 0, 2.35, 0));
  g.add(mesh(new THREE.BoxGeometry(1.7, 0.5, 0.06), solid(0x2f6b3f), 0, 1.95, 0.08));
  g.add(mesh(new THREE.BoxGeometry(1.5, 0.08, 0.07), solid(0xf2c230), 0, 1.95, 0.1));
  return g;
}

/** Placa pequena da área de reflorestamento. */
function smallSign(color: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), MAT.wood, 0, 0.45, 0));
  g.add(mesh(new THREE.BoxGeometry(0.7, 0.36, 0.04), solid(color), 0, 0.85, 0.04));
  return g;
}

/** Monta a reserva inteira em volta de RESERVE (x, z), apoiando cada peça no terreno. */
export function buildReserve(): THREE.Group {
  const group = new THREE.Group();
  const baseY = heightAt(RESERVE.x, RESERVE.z);
  group.position.set(RESERVE.x, baseY, RESERVE.z);
  const put = (o: THREE.Object3D, lx: number, lz: number, rotY = 0, lift = 0) => {
    o.position.set(lx, heightAt(RESERVE.x + lx, RESERVE.z + lz) - baseY + lift, lz);
    o.rotation.y = rotY;
    group.add(o);
    return o;
  };

  // floresta (fundo): samaúma no meio, castanheiras, açaizeiros e árvores da mata
  put(samauma(3), -1.5, -2.2);
  const castA = put(castanheira(7, true), 3.6, -2.6, 0.4);
  put(castanheira(11), -5.8, -2.4, 1.1);
  for (const [x, z, s] of [[-7.4, -0.8, 1], [1.6, -3.4, 2], [5.9, -1.2, 3], [-3.9, -0.6, 4], [0.8, -1.0, 5]] as const) put(acai(s), x, z);
  for (const [x, z, s, k] of [[-3.4, -3.6, 21, 1.25], [6.6, -3.3, 22, 1.2], [-7.6, -3.3, 23, 1.15], [7.8, -0.2, 24, 1.05]] as const) put(tree(s, k), x, z);

  // bichos
  group.add(macaw(-1.5, -2.2, 8.2, 0));
  group.add(macaw(2.5, -1.8, 7.6, 2.1, true));
  const tuc = toucan();
  castA.add(tuc);
  tuc.position.set(-0.55, 4.05, 0.55);
  const sl = sloth();
  castA.add(sl);
  sl.position.set(1.25, 3.44, 0);
  put(jaguar(), -3.2, 1.3, 0.6).scale.setScalar(1.7);

  // área de reflorestamento (frente, à direita): canteiro com mudas em fileiras
  const bed = mesh(new THREE.BoxGeometry(5.6, 0.06, 2.0), MAT.soilWet, 0, 0.03, 0);
  bed.receiveShadow = true;
  put(bed, 4.6, 2.5);
  let i = 0;
  for (const z of [1.9, 2.5, 3.1]) for (let x = 2.2; x <= 7.0; x += 0.8) put(seedling(i++), x, z);
  put(smallSign(0x6aa84f), 1.4, 3.3, 0.2);

  // entrada
  put(gate(), -7.0, 3.3, 0.25);

  shadow(group);
  group.userData.reserve = true;
  group.name = 'reserva-florestal';
  return group;
}
