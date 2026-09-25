/** 🤝 Área comunitária: árvore, Praça Verde, jardim, área reaproveitada, painel solar, poste e centro ecológico. */
import * as THREE from 'three';
import { glowRing, MAT, mesh, rng, solid, stoneRing, tree, waterDisc } from './common';
import { flowerCluster, planterBox } from './natural';

export function bench(): THREE.Group {
  const b = new THREE.Group();
  for (const z of [-0.12, 0, 0.12]) b.add(mesh(new THREE.BoxGeometry(1.3, 0.05, 0.1), MAT.woodLight, 0, 0.45, z));
  for (const y of [0.62, 0.78]) b.add(mesh(new THREE.BoxGeometry(1.3, 0.1, 0.04), MAT.woodLight, 0, y, -0.2));
  for (const x of [-0.55, 0.55]) {
    b.add(mesh(new THREE.BoxGeometry(0.06, 0.45, 0.4), MAT.metal, x, 0.22, -0.02));
    b.add(mesh(new THREE.BoxGeometry(0.06, 0.4, 0.05), MAT.metal, x, 0.62, -0.2));
  }
  return b;
}

function communityTree(): THREE.Group {
  const g = tree(14, 1.35);
  const b = bench();
  b.position.set(0, 0, 1.4);
  b.rotation.y = Math.PI;
  g.add(b);
  // canteiro redondo em volta do tronco
  g.add(stoneRing(0.75, 16, 0.1));
  return g;
}

function lampPost(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.8, 10), solid(0x3d4a45, { metalness: 0.6, roughness: 0.4 }), 0, 1.4, 0));
  const arm = mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), solid(0x3d4a45, { metalness: 0.6, roughness: 0.4 }), 0.2, 2.75, 0);
  g.add(arm);
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.18, 12), solid(0x3d4a45), 0.42, 2.66, 0));
  const bulb = mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshStandardMaterial({ color: 0xfff1c1, emissive: 0xffd77a, emissiveIntensity: 1.6 }), 0.42, 2.55, 0);
  bulb.userData.noShadow = true;
  g.add(bulb);
  // plaquinha solar no topo
  const panel = mesh(new THREE.BoxGeometry(0.5, 0.03, 0.35), solid(0x1d3b6a, { roughness: 0.25, metalness: 0.4 }), 0, 2.95, 0);
  panel.rotation.z = 0.35;
  g.add(panel);
  return g;
}

/** Fonte de pedra com água (praça e jardim da casa). */
export function fountainModel(): THREE.Group {
  const fountain = new THREE.Group();
  fountain.add(mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.45, 32), MAT.stone, 0, 0.3, 0));
  const water = waterDisc(0.9, 5);
  water.position.y = 0.5;
  fountain.add(water);
  fountain.add(mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 12), MAT.stone, 0, 0.8, 0));
  fountain.add(mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.12, 20), MAT.stone, 0, 1.25, 0));
  const top = waterDisc(0.32, 8);
  top.position.y = 1.32;
  fountain.add(top);
  return fountain;
}

/** Praça Verde (marco épico): piso redondo, fonte no meio, bancos, árvores e canteiros. */
function greenSquare(): THREE.Group {
  const g = new THREE.Group();
  const r = 3.3;
  g.add(mesh(new THREE.CylinderGeometry(r, r, 0.1, 48), MAT.paving, 0, 0.05, 0));
  // anel de pedras portuguesas mais escuras
  const ring = mesh(new THREE.RingGeometry(r * 0.72, r * 0.8, 48), solid(0x8f8878), 0, 0.105, 0);
  ring.rotation.x = -Math.PI / 2;
  g.add(ring);
  g.add(fountainModel());
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const b = bench();
    b.position.set(Math.cos(a) * 2.2, 0.1, Math.sin(a) * 2.2);
    b.rotation.y = -a - Math.PI / 2;
    g.add(b);
    const t = tree(20 + i, 0.8);
    t.position.set(Math.cos(a + Math.PI / 4) * 2.9, 0.1, Math.sin(a + Math.PI / 4) * 2.9);
    g.add(t);
  }
  g.add(glowRing(3.8, 0xb98cff));
  return g;
}

function communityGarden(): THREE.Group {
  const g = new THREE.Group();
  const tulips = [0xe8453c, 0xf7d046, 0xf06f9b, 0xffffff];
  const a = planterBox(1.9, 0.9, 16, 101, tulips);
  a.position.set(-0.8, 0, -0.5);
  g.add(a);
  const b = planterBox(1.9, 0.9, 16, 102, tulips);
  b.position.set(0.9, 0, 0.6);
  b.rotation.y = 0.3;
  g.add(b);
  const can = new THREE.Group();
  can.add(mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.3, 14), solid(0x2f8f5b, { metalness: 0.3, roughness: 0.4 }), 0, 0.15, 0));
  const spout = mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.35, 6), solid(0x2f8f5b, { metalness: 0.3, roughness: 0.4 }), 0.18, 0.25, 0);
  spout.rotation.z = -0.9;
  can.add(spout);
  can.position.set(1.6, 0, -0.5);
  g.add(can);
  return g;
}

/** Área verde reaproveitada: pneus pintados e caixotes de madeira virando canteiros. */
function reusedArea(): THREE.Group {
  const g = new THREE.Group();
  const colors = [0xf2b705, 0x2f9fd6, 0xe0632a];
  const rand = rng(111);
  [
    [-0.8, 0],
    [0.3, -0.4],
    [0.5, 0.7],
  ].forEach(([x, z], i) => {
    const tire = new THREE.Group();
    const t1 = mesh(new THREE.TorusGeometry(0.42, 0.17, 10, 22), solid(colors[i], { roughness: 0.6 }), 0, 0.17, 0);
    t1.rotation.x = Math.PI / 2;
    tire.add(t1);
    tire.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.28, 18), MAT.soil, 0, 0.16, 0));
    const plants = flowerCluster(120 + i, [0xf06f9b, 0xfbd34d, 0xc08cf2], 4, 0.4);
    plants.scale.setScalar(0.9);
    plants.position.y = 0.28;
    tire.add(plants);
    tire.position.set(x, 0, z);
    g.add(tire);
  });
  // caixote (pallet) com mudas
  const crate = new THREE.Group();
  for (let y = 0; y < 3; y++) {
    crate.add(mesh(new THREE.BoxGeometry(1.1, 0.1, 0.05), MAT.woodLight, 0, 0.1 + y * 0.15, 0.3));
    crate.add(mesh(new THREE.BoxGeometry(1.1, 0.1, 0.05), MAT.woodLight, 0, 0.1 + y * 0.15, -0.3));
  }
  crate.add(mesh(new THREE.BoxGeometry(1.05, 0.3, 0.55), MAT.soil, 0, 0.2, 0));
  for (let i = 0; i < 6; i++) {
    const leaf = mesh(new THREE.SphereGeometry(0.12, 8, 6), solid(0x5ea83a), -0.4 + i * 0.16, 0.42, (rand() - 0.5) * 0.3);
    leaf.scale.y = 0.7;
    crate.add(leaf);
  }
  crate.position.set(-0.2, 0, 1.3);
  crate.rotation.y = 0.2;
  g.add(crate);
  return g;
}

/** Painéis solares num suporte metálico inclinado. */
function solarPanels(): THREE.Group {
  const g = new THREE.Group();
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x1b3561, roughness: 0.18, metalness: 0.55 });
  const frame = solid(0xc9ced3, { metalness: 0.7, roughness: 0.35 });
  for (let i = 0; i < 2; i++) {
    const unit = new THREE.Group();
    const panel = new THREE.Group();
    panel.add(mesh(new THREE.BoxGeometry(1.2, 0.05, 1.8), frame));
    panel.add(mesh(new THREE.BoxGeometry(1.12, 0.06, 1.72), panelMat));
    for (let k = 1; k < 3; k++) panel.add(mesh(new THREE.BoxGeometry(0.015, 0.065, 1.72), frame, -0.56 + (1.12 * k) / 3, 0, 0));
    for (let k = 1; k < 5; k++) panel.add(mesh(new THREE.BoxGeometry(1.12, 0.065, 0.015), frame, 0, 0, -0.86 + (1.72 * k) / 5));
    panel.position.y = 1.05;
    panel.rotation.x = 0.55; // virado para o sol
    unit.add(panel);
    unit.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), frame, 0, 0.35, 0.45));
    unit.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), frame, 0, 0.65, -0.45));
    unit.position.x = -0.7 + i * 1.4;
    g.add(unit);
  }
  return g;
}

/** Centro ecológico (lendário): casinha com telhado verde, painéis solares, janelas e cisterna. */
function ecoCenter(): THREE.Group {
  const g = new THREE.Group();
  const w = 4.2;
  const d = 3;
  const h = 2.2;
  g.add(mesh(new THREE.BoxGeometry(w + 0.4, 0.2, d + 0.4), MAT.paving, 0, 0.1, 0));
  g.add(mesh(new THREE.BoxGeometry(w, h, d), solid(0xefe6d2, { roughness: 0.9 }), 0, 0.2 + h / 2, 0));
  // madeira na fachada
  g.add(mesh(new THREE.BoxGeometry(w * 0.35, h, 0.06), MAT.woodLight, -w * 0.3, 0.2 + h / 2, d / 2 + 0.03));
  // porta e janelas
  g.add(mesh(new THREE.BoxGeometry(0.8, 1.5, 0.08), MAT.wood, 0.3, 0.95, d / 2 + 0.04));
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd1e8, roughness: 0.05, metalness: 0.3, emissive: 0x28506a, emissiveIntensity: 0.25 });
  for (const x of [1.4, -1.3]) {
    g.add(mesh(new THREE.BoxGeometry(0.8, 0.7, 0.06), glass, x, 1.4, d / 2 + 0.05));
    g.add(mesh(new THREE.BoxGeometry(0.9, 0.06, 0.1), MAT.woodLight, x, 1.02, d / 2 + 0.07));
  }
  for (const z of [-0.6, 0.6]) g.add(mesh(new THREE.BoxGeometry(0.06, 0.7, 0.8), glass, w / 2 + 0.03, 1.4, z));
  // telhado verde (duas águas, coberto de plantas)
  const roofMat = solid(0x6a4a33);
  const grassRoof = solid(0x5f9a3c, { roughness: 1 });
  for (const side of [-1, 1]) {
    const slab = new THREE.Group();
    slab.add(mesh(new THREE.BoxGeometry(w + 0.5, 0.12, d / 2 + 0.5), roofMat));
    slab.add(mesh(new THREE.BoxGeometry(w + 0.4, 0.1, d / 2 + 0.4), grassRoof, 0, 0.1, 0));
    slab.position.set(0, 0.2 + h + 0.55, (side * (d / 2 + 0.5)) / 2);
    slab.rotation.x = side * 0.45;
    g.add(slab);
  }
  // painéis solares sobre a água da frente do telhado
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x1b3561, roughness: 0.18, metalness: 0.55 });
  for (const x of [-1.2, 0, 1.2]) {
    const p = mesh(new THREE.BoxGeometry(1, 0.05, 0.9), panelMat, x, 0.2 + h + 0.72, 0.75);
    p.rotation.x = 0.45;
    g.add(p);
  }
  // cisterna (água da chuva) e plantas na entrada
  const tank = mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.2, 18), solid(0x3f8fb3, { roughness: 0.5 }), w / 2 + 0.7, 0.6, -0.6);
  g.add(tank);
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), MAT.metal, w / 2 + 0.3, 1.6, -0.6));
  const p1 = flowerCluster(131, [0xf06f9b, 0xfbd34d], 5, 0.5);
  p1.position.set(-0.6, 0.2, d / 2 + 0.5);
  g.add(p1);
  const p2 = flowerCluster(132, [0xc08cf2, 0xffffff], 5, 0.5);
  p2.position.set(1.3, 0.2, d / 2 + 0.5);
  g.add(p2);
  g.add(glowRing(3.6, 0xf5c542));
  return g;
}

export const communityModels: Record<string, () => THREE.Group> = {
  community_tree: communityTree,
  green_square: greenSquare,
  community_garden: communityGarden,
  green_area: reusedArea,
  solar_panel: solarPanels,
  sustainable_light: () => {
    const g = new THREE.Group();
    const a = lampPost();
    a.position.set(-0.8, 0, 0);
    const b = lampPost();
    b.position.set(0.8, 0, 0.3);
    b.rotation.y = Math.PI;
    g.add(a, b);
    return g;
  },
  community_space: ecoCenter,
};
