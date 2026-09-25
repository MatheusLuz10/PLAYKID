/**
 * Objetos da casa e do jardim, feitos por código (nenhum arquivo de modelo é baixado).
 * - Jardim: os mesmos modelos orgânicos do mundo 3D (árvores, flores, horta, bichos, água).
 * - Móveis: cantos arredondados e veio de madeira (textura gerada em canvas).
 * Tamanho de referência: escala 1 ≈ tamanho real em metros.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { foliage, tree } from '../../world3d/scene/models/common';
import { bench, fountainModel } from '../../world3d/scene/models/community';
import { gardenModels } from '../../world3d/scene/models/garden';
import { cowModel, flowerCluster, largeTree } from '../../world3d/scene/models/natural';
import { pollinatorModels } from '../../world3d/scene/models/pollinators';
import { waterModels } from '../../world3d/scene/models/water';
import { woodGrain } from './textures';

export type ObjectModel =
  | 'table'
  | 'chair'
  | 'bookshelf'
  | 'picture'
  | 'book'
  | 'flower'
  | 'plant'
  | 'tree_small'
  | 'tree_large'
  | 'vegetable_garden'
  | 'bee'
  | 'butterfly'
  | 'bird'
  | 'pond'
  | 'fountain'
  | 'solar_lamp'
  | 'reuse_vase'
  | 'recycling_bins'
  | 'bench'
  | 'wardrobe'
  | 'bed'
  | 'broom'
  | 'toy_box'
  | 'sink'
  | 'reading_nook'
  | 'magnifier'
  | 'journal'
  | 'meditation_cushion'
  | 'cow'
  | 'sofa'
  | 'coffee_table'
  | 'rug'
  | 'armchair'
  | 'stove'
  | 'fridge'
  | 'dining_table'
  | 'water_filter'
  | 'nightstand'
  | 'laundry_basket'
  | 'desk_lamp'
  | 'corkboard';

export const OBJECT_MODELS: ObjectModel[] = [
  'table', 'chair', 'bookshelf', 'picture', 'book', 'flower', 'plant', 'tree_small', 'tree_large',
  'vegetable_garden', 'bee', 'butterfly', 'bird', 'pond', 'fountain', 'solar_lamp', 'reuse_vase', 'recycling_bins', 'bench',
  'wardrobe', 'bed', 'broom', 'toy_box', 'sink', 'reading_nook', 'magnifier', 'journal', 'meditation_cushion', 'cow',
  'sofa', 'coffee_table', 'rug', 'armchair', 'stove', 'fridge', 'dining_table', 'water_filter', 'nightstand', 'laundry_basket',
  'desk_lamp', 'corkboard',
];

const cache = new Map<number, THREE.MeshStandardMaterial>();
/** Tons de madeira: recebem o veio de madeira (a cor tinge a textura). */
const WOOD_TONES = new Set([0xa4744a, 0x7a5436, 0xb88a5a, 0x8f6440, 0x6f4e37, 0xa9844d]);
/** Materiais compartilhados por cor (menos memória). Não são descartados por objeto. */
function mat(color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  if (Object.keys(extra).length) return new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
  let m = cache.get(color);
  if (!m) {
    m = WOOD_TONES.has(color)
      ? new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(1.15), map: woodGrain(), roughness: 0.72 })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    m.userData.shared = true;
    cache.set(color, m);
  }
  return m;
}

const WOOD = 0xa4744a;
const WOOD_DARK = 0x7a5436;
const LEAF = 0x56994a;
const LEAF_DARK = 0x3f7d3b;
const LEAF_LIGHT = 0x79b660;
const SOIL = 0x6d5237;

function mesh(geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, extra?: Partial<THREE.MeshStandardMaterialParameters>) {
  const m = new THREE.Mesh(geo, mat(color, extra));
  m.position.set(x, y, z);
  return m;
}
/** Caixa com cantos levemente arredondados (móveis mais realistas). */
const B = (w: number, h: number, d: number) => {
  const r = Math.min(0.035, Math.min(w, h, d) * 0.22);
  return r < 0.004 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 2, r);
};
const C = (rt: number, rb: number, h: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
const S = (r: number, seg = 10) => new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.7)));

const builders: Record<ObjectModel, () => THREE.Group> = {
  table() {
    const g = new THREE.Group();
    g.add(mesh(B(1.4, 0.08, 0.8), WOOD, 0, 0.75, 0));
    for (const [x, z] of [[-0.6, -0.32], [0.6, -0.32], [-0.6, 0.32], [0.6, 0.32]]) g.add(mesh(B(0.07, 0.72, 0.07), WOOD_DARK, x, 0.36, z));
    return g;
  },
  chair() {
    const g = new THREE.Group();
    g.add(mesh(B(0.45, 0.06, 0.45), WOOD, 0, 0.45, 0));
    g.add(mesh(B(0.45, 0.5, 0.06), WOOD, 0, 0.72, -0.2));
    for (const [x, z] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) g.add(mesh(B(0.05, 0.45, 0.05), WOOD_DARK, x, 0.22, z));
    return g;
  },
  bookshelf() {
    const g = new THREE.Group();
    g.add(mesh(B(1.2, 1.8, 0.35), WOOD_DARK, 0, 0.9, 0));
    const colors = [0xb24a3b, 0x2f7fae, 0xe3a233, 0x6aa84f, 0x8a6a4a];
    for (let shelf = 0; shelf < 3; shelf++) {
      g.add(mesh(B(1.1, 0.04, 0.3), WOOD, 0, 0.35 + shelf * 0.55, 0.03));
      for (let i = 0; i < 6; i++) g.add(mesh(B(0.12, 0.34, 0.24), colors[(i + shelf) % colors.length], -0.42 + i * 0.16, 0.55 + shelf * 0.55, 0.04));
    }
    return g;
  },
  picture() {
    // quadro de parede: moldura + "foto" de paisagem
    const g = new THREE.Group();
    g.add(mesh(B(1.1, 0.8, 0.05), WOOD_DARK, 0, 0, 0));
    g.add(mesh(B(0.95, 0.4, 0.06), 0x9fd3ec, 0, 0.12, 0.005));
    g.add(mesh(B(0.95, 0.25, 0.06), 0x8ebf72, 0, -0.2, 0.006));
    g.add(mesh(S(0.08), 0xf2bf4e, 0.3, 0.2, 0.04));
    return g;
  },
  book() {
    const g = new THREE.Group();
    g.add(mesh(B(0.3, 0.06, 0.22), 0x2f6b3f, 0, 0.03, 0));
    g.add(mesh(B(0.28, 0.04, 0.2), 0xfffdf6, 0.01, 0.07, 0));
    g.add(mesh(B(0.3, 0.02, 0.22), 0x2f6b3f, 0, 0.1, 0));
    return g;
  },
  flower() {
    const g = new THREE.Group();
    for (const [x, z, color] of [[0, 0, 0xf29bb5], [0.25, 0.15, 0xf2bf4e], [-0.22, 0.12, 0xb58cf2], [0.1, -0.22, 0xf29bb5]] as const) {
      g.add(mesh(C(0.015, 0.015, 0.45, 5), LEAF_DARK, x, 0.22, z));
      g.add(mesh(S(0.09), color, x, 0.47, z));
      g.add(mesh(S(0.04), 0xf2bf4e, x, 0.5, z + 0.05));
    }
    return g;
  },
  plant() {
    const g = new THREE.Group();
    g.add(mesh(C(0.2, 0.15, 0.3), 0xb86b45, 0, 0.15, 0));
    g.add(mesh(S(0.28), LEAF, 0, 0.5, 0));
    g.add(mesh(S(0.18), LEAF_LIGHT, 0.12, 0.62, 0.05));
    return g;
  },
  tree_small() {
    const g = new THREE.Group();
    g.add(mesh(C(0.08, 0.12, 1.2), WOOD_DARK, 0, 0.6, 0));
    g.add(mesh(S(0.65), LEAF, 0, 1.55, 0));
    g.add(mesh(S(0.4), LEAF_LIGHT, 0.25, 1.8, 0.15));
    return g;
  },
  tree_large() {
    const g = new THREE.Group();
    g.add(mesh(C(0.18, 0.28, 2.6), WOOD_DARK, 0, 1.3, 0));
    g.add(mesh(S(1.4, 12), LEAF_DARK, 0, 3.2, 0));
    g.add(mesh(S(1.0, 12), LEAF, 0.7, 3.6, 0.4));
    g.add(mesh(S(0.9, 12), LEAF_LIGHT, -0.6, 3.9, -0.3));
    for (const [x, y, z] of [[0.9, 3.0, 0.9], [-0.8, 3.3, 0.7], [0.3, 2.6, 1.2]]) g.add(mesh(S(0.12), 0xe7a33a, x, y, z));
    return g;
  },
  vegetable_garden() {
    const g = new THREE.Group();
    g.add(mesh(B(2.8, 0.25, 1.6), WOOD, 0, 0.125, 0));
    g.add(mesh(B(2.6, 0.06, 1.4), SOIL, 0, 0.26, 0));
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 6; i++) {
        const leafy = row !== 1;
        g.add(mesh(leafy ? S(0.13) : C(0.03, 0.06, 0.25, 6), leafy ? LEAF_LIGHT : 0xe07a2e, -1.05 + i * 0.42, leafy ? 0.38 : 0.4, -0.45 + row * 0.45));
      }
    }
    return g;
  },
  bee() {
    const g = new THREE.Group();
    const body = mesh(S(0.14), 0xf2bf4e, 0, 0, 0);
    body.scale.set(1.3, 1, 1);
    g.add(body);
    g.add(mesh(B(0.04, 0.26, 0.26), 0x1e2b22, 0.05, 0, 0));
    g.add(mesh(B(0.04, 0.26, 0.26), 0x1e2b22, -0.08, 0, 0));
    for (const z of [-0.12, 0.12]) g.add(mesh(S(0.09), 0xffffff, 0, 0.14, z, { transparent: true, opacity: 0.8 }));
    return g;
  },
  butterfly() {
    const g = new THREE.Group();
    g.add(mesh(C(0.02, 0.02, 0.3, 6), 0x3a2a1e, 0, 0, 0));
    for (const side of [-1, 1]) {
      const wing = mesh(S(0.16), 0xb58cf2, 0, 0.02, side * 0.15);
      wing.scale.set(1, 0.2, 1);
      g.add(wing);
      const wing2 = mesh(S(0.1), 0xf29bb5, -0.12, 0.02, side * 0.12);
      wing2.scale.set(1, 0.2, 1);
      g.add(wing2);
    }
    return g;
  },
  bird() {
    const g = new THREE.Group();
    const body = mesh(S(0.18), 0x2f7fae, 0, 0, 0);
    body.scale.set(1.4, 1, 1);
    g.add(body);
    g.add(mesh(S(0.11), 0x2f7fae, 0.22, 0.1, 0));
    g.add(mesh(new THREE.ConeGeometry(0.04, 0.12, 6), 0xe3a233, 0.35, 0.1, 0).rotateZ(-Math.PI / 2));
    for (const side of [-1, 1]) {
      const wing = mesh(B(0.2, 0.03, 0.2), 0x1f5f86, -0.02, 0.06, side * 0.16);
      wing.rotation.x = side * 0.4;
      g.add(wing);
    }
    return g;
  },
  pond() {
    const g = new THREE.Group();
    const rim = mesh(C(1.9, 2.0, 0.18, 24), 0xbfb6a3, 0, 0.09, 0);
    g.add(rim);
    g.add(mesh(C(1.7, 1.7, 0.2, 24), 0x5aa7d0, 0, 0.12, 0, { roughness: 0.2, metalness: 0.1 }));
    for (const [x, z] of [[0.6, 0.4], [-0.7, -0.3]]) {
      const pad = mesh(C(0.25, 0.25, 0.02, 10), LEAF, x, 0.23, z);
      g.add(pad);
      g.add(mesh(S(0.07), 0xf29bb5, x, 0.28, z));
    }
    return g;
  },
  fountain() {
    const g = new THREE.Group();
    g.add(mesh(C(0.9, 1.0, 0.4, 18), 0xd9ccb0, 0, 0.2, 0));
    g.add(mesh(C(0.78, 0.78, 0.1, 18), 0x7ec3e6, 0, 0.38, 0, { roughness: 0.2 }));
    g.add(mesh(C(0.1, 0.14, 0.9, 10), 0xd9ccb0, 0, 0.8, 0));
    g.add(mesh(C(0.35, 0.2, 0.12, 14), 0xd9ccb0, 0, 1.25, 0));
    g.add(mesh(S(0.14), 0x9fd3ec, 0, 1.4, 0, { transparent: true, opacity: 0.8 }));
    return g;
  },
  solar_lamp() {
    const g = new THREE.Group();
    g.add(mesh(C(0.12, 0.16, 0.08), 0x5a6a5e, 0, 0.04, 0));
    g.add(mesh(C(0.025, 0.025, 1.3, 6), 0x5a6a5e, 0, 0.7, 0));
    g.add(mesh(S(0.14), 0xfff4c2, 0, 1.4, 0, { emissive: 0xffe38a, emissiveIntensity: 0.6 }));
    const panel = mesh(B(0.4, 0.03, 0.3), 0x234f7a, 0, 1.62, 0, { metalness: 0.4, roughness: 0.3 });
    panel.rotation.x = -0.4;
    g.add(panel);
    return g;
  },
  reuse_vase() {
    // vaso feito de garrafa reutilizada, com planta
    const g = new THREE.Group();
    g.add(mesh(C(0.14, 0.14, 0.38, 12), 0x8fcbe8, 0, 0.19, 0, { transparent: true, opacity: 0.7, roughness: 0.2 }));
    g.add(mesh(C(0.13, 0.13, 0.12, 12), SOIL, 0, 0.3, 0));
    g.add(mesh(S(0.18), LEAF_LIGHT, 0, 0.5, 0));
    g.add(mesh(S(0.06), 0xf29bb5, 0.1, 0.62, 0.05));
    return g;
  },
  recycling_bins() {
    // três lixeiras de coleta seletiva (papel, plástico, orgânico)
    const g = new THREE.Group();
    [0x2f7fae, 0xb24a3b, 0x8a6a4a].forEach((color, i) => {
      g.add(mesh(B(0.42, 0.62, 0.42), color, -0.48 + i * 0.48, 0.31, 0));
      g.add(mesh(B(0.46, 0.05, 0.46), 0x1e2b22, -0.48 + i * 0.48, 0.64, 0));
    });
    return g;
  },
  bench() {
    const g = new THREE.Group();
    g.add(mesh(B(1.8, 0.08, 0.45), WOOD, 0, 0.45, 0));
    g.add(mesh(B(1.8, 0.35, 0.06), WOOD, 0, 0.75, -0.2));
    for (const x of [-0.75, 0.75]) g.add(mesh(B(0.08, 0.45, 0.4), 0x5a6a5e, x, 0.22, 0));
    return g;
  },
  wardrobe() {
    const g = new THREE.Group();
    g.add(mesh(B(1.5, 2.2, 0.55), WOOD_DARK, 0, 1.1, 0));
    g.add(mesh(B(0.65, 2.05, 0.04), 0xc58b5d, -0.38, 1.1, 0.3));
    g.add(mesh(B(0.65, 2.05, 0.04), 0xc58b5d, 0.38, 1.1, 0.3));
    g.add(mesh(S(0.05), 0xf2bf4e, -0.08, 1.1, 0.34));
    g.add(mesh(S(0.05), 0xf2bf4e, 0.08, 1.1, 0.34));
    return g;
  },
  bed() {
    const g = new THREE.Group();
    g.add(mesh(B(2.1, 0.35, 3), WOOD_DARK, 0, 0.25, 0));
    g.add(mesh(B(1.95, 0.25, 2.55), 0xf0d8b8, 0, 0.55, 0.15));
    g.add(mesh(B(2.1, 1.3, 0.18), WOOD, 0, 0.85, -1.42));
    g.add(mesh(B(0.7, 0.14, 0.45), 0xffffff, -0.52, 0.75, -1.12));
    g.add(mesh(B(0.7, 0.14, 0.45), 0xffffff, 0.52, 0.75, -1.12));
    return g;
  },
  broom() {
    const g = new THREE.Group();
    g.add(mesh(C(0.035, 0.035, 1.8, 8), WOOD, 0, 0.9, 0).rotateZ(-0.18));
    g.add(mesh(B(0.5, 0.18, 0.2), 0xd0921f, 0.16, 0.08, 0));
    for (let i = 0; i < 5; i++) g.add(mesh(B(0.05, 0.25, 0.08), 0xf2bf4e, -0.04 + i * 0.1, -0.08, 0));
    return g;
  },
  toy_box() {
    const g = new THREE.Group();
    g.add(mesh(B(1.2, 0.8, 0.9), 0x5b9fc2, 0, 0.4, 0));
    g.add(mesh(B(1.28, 0.1, 0.96), 0x3b6fa0, 0, 0.85, 0));
    g.add(mesh(S(0.16), 0xf29bb5, -0.25, 0.9, 0.2));
    g.add(mesh(S(0.14), 0xf2bf4e, 0.22, 0.9, -0.1));
    return g;
  },
  sink() {
    const g = new THREE.Group();
    g.add(mesh(B(1.5, 0.75, 0.7), 0xd9ccb0, 0, 0.38, 0));
    g.add(mesh(C(0.28, 0.28, 0.08, 16), 0x7ec3e6, 0, 0.78, 0, { roughness: 0.2 }));
    g.add(mesh(C(0.04, 0.04, 0.55, 8), 0x8b9a9e, 0, 1.02, -0.15));
    g.add(mesh(C(0.04, 0.04, 0.25, 8), 0x8b9a9e, 0, 1.28, -0.03).rotateX(Math.PI / 2));
    return g;
  },
  reading_nook() {
    const g = new THREE.Group();
    g.add(mesh(B(1.4, 0.08, 0.9), WOOD, 0, 0.72, 0));
    g.add(mesh(B(0.08, 0.7, 0.08), WOOD_DARK, -0.58, 0.35, -0.32));
    g.add(mesh(B(0.08, 0.7, 0.08), WOOD_DARK, 0.58, 0.35, -0.32));
    g.add(mesh(B(0.5, 0.06, 0.35), 0x2f6b3f, 0, 0.8, 0));
    g.add(mesh(B(0.42, 0.04, 0.3), 0xfffdf6, 0.03, 0.85, 0.02));
    return g;
  },
  magnifier() {
    const g = new THREE.Group();
    g.add(mesh(C(0.25, 0.25, 0.04, 20), 0x9fd3ec, 0, 0.6, 0, { transparent: true, opacity: 0.7, roughness: 0.2 }));
    g.add(mesh(C(0.04, 0.04, 0.6, 8), WOOD_DARK, 0.28, 0.32, 0).rotateZ(-0.6));
    return g;
  },
  journal() {
    const g = new THREE.Group();
    g.add(mesh(B(0.65, 0.12, 0.48), 0xb24a3b, 0, 0.08, 0));
    g.add(mesh(B(0.06, 0.02, 0.38), 0xfffdf6, 0, 0.15, 0));
    g.add(mesh(C(0.02, 0.02, 0.5, 8), 0xf2bf4e, 0.1, 0.12, 0).rotateZ(Math.PI / 2));
    return g;
  },
  meditation_cushion() {
    const g = new THREE.Group();
    g.add(mesh(C(0.7, 0.7, 0.25, 16), 0xb58cf2, 0, 0.13, 0));
    g.add(mesh(C(0.5, 0.5, 0.04, 16), 0xf29bb5, 0, 0.28, 0));
    return g;
  },
  cow() {
    const g = new THREE.Group();
    g.add(mesh(S(0.55, 12), 0xf4eee1, 0, 1.0, 0));
    g.add(mesh(S(0.34, 12), 0xf4eee1, 0, 1.48, 0.42));
    g.add(mesh(S(0.12), 0x3d3028, -0.18, 1.54, 0.68));
    g.add(mesh(S(0.12), 0x3d3028, 0.18, 1.54, 0.68));
    for (const x of [-0.3, 0.3]) for (const z of [-0.28, 0.28]) g.add(mesh(C(0.07, 0.07, 0.65, 8), 0x6f4e37, x, 0.35, z));
    g.add(mesh(C(0.04, 0.04, 0.5, 8), 0x6f4e37, -0.58, 0.95, -0.05).rotateZ(Math.PI / 2));
    return g;
  },  // ---------- móveis (encosto sempre para -z: a frente olha para +z) ----------
  sofa() {
    const g = new THREE.Group();
    const fabric = 0x5f8f7a;
    g.add(mesh(B(1.9, 0.42, 0.85), fabric, 0, 0.3, 0));
    g.add(mesh(B(1.9, 0.6, 0.22), fabric, 0, 0.7, -0.33));
    for (const x of [-0.87, 0.87]) g.add(mesh(B(0.18, 0.55, 0.85), 0x4f7d69, x, 0.45, 0));
    for (const x of [-0.45, 0.45]) g.add(mesh(B(0.8, 0.12, 0.62), 0x79a892, x, 0.57, 0.07));
    g.add(mesh(B(0.38, 0.32, 0.12), 0xf2bf4e, -0.55, 0.78, -0.16).rotateZ(0.15));
    for (const x of [-0.85, 0.85]) for (const z of [-0.33, 0.33]) g.add(mesh(C(0.04, 0.03, 0.12, 6), WOOD_DARK, x, 0.06, z));
    return g;
  },
  coffee_table() {
    const g = new THREE.Group();
    // tampo de ripas de madeira reaproveitada (tons diferentes)
    [0xa4744a, 0xb88a5a, 0x8f6440, 0xa4744a].forEach((c, i) => g.add(mesh(B(1.1, 0.06, 0.15), c, 0, 0.45, -0.24 + i * 0.16)));
    for (const x of [-0.48, 0.48]) for (const z of [-0.24, 0.24]) g.add(mesh(B(0.07, 0.42, 0.07), WOOD_DARK, x, 0.21, z));
    g.add(mesh(C(0.1, 0.08, 0.14, 12), 0xe8dcc0, 0.25, 0.55, 0));
    g.add(mesh(S(0.1), LEAF, 0.25, 0.68, 0));
    g.add(mesh(B(0.25, 0.04, 0.18), 0xc0503a, -0.25, 0.5, 0.02));
    return g;
  },
  rug() {
    const g = new THREE.Group();
    const colors = [0xd9825b, 0xe8c35a, 0x5b9fc2, 0x7fb069, 0xc77dff];
    g.add(mesh(C(1.05, 1.05, 0.02, 32), 0xefe3cf, 0, 0.1, 0));
    colors.forEach((c, i) => g.add(mesh(C(0.9 - i * 0.17, 0.9 - i * 0.17, 0.02, 32), c, 0, 0.11 + i * 0.003, 0)));
    return g;
  },
  armchair() {
    const g = new THREE.Group();
    const fabric = 0xc9803f;
    g.add(mesh(B(0.85, 0.4, 0.8), fabric, 0, 0.3, 0));
    g.add(mesh(B(0.85, 0.65, 0.18), fabric, 0, 0.72, -0.31));
    for (const x of [-0.38, 0.38]) g.add(mesh(B(0.14, 0.5, 0.8), 0xa9692f, x, 0.45, 0));
    g.add(mesh(B(0.6, 0.1, 0.56), 0xe0a060, 0, 0.55, 0.06));
    for (const x of [-0.35, 0.35]) for (const z of [-0.3, 0.3]) g.add(mesh(C(0.035, 0.03, 0.12, 6), WOOD_DARK, x, 0.06, z));
    return g;
  },
  stove() {
    const g = new THREE.Group();
    g.add(mesh(B(0.8, 0.85, 0.65), 0xeeeeea, 0, 0.43, 0));
    g.add(mesh(B(0.8, 0.04, 0.65), 0x2f3437, 0, 0.87, 0));
    for (const x of [-0.18, 0.18]) for (const z of [-0.14, 0.14]) g.add(mesh(C(0.1, 0.1, 0.02, 14), 0x1b1e20, x, 0.9, z));
    g.add(mesh(B(0.6, 0.4, 0.02), 0x2f3437, 0, 0.42, 0.33, { roughness: 0.2 }));
    g.add(mesh(C(0.015, 0.015, 0.5, 6), 0x9aa3ab, 0, 0.7, 0.36).rotateZ(Math.PI / 2));
    for (let i = 0; i < 4; i++) g.add(mesh(C(0.03, 0.03, 0.03, 8), 0x2f3437, -0.27 + i * 0.18, 0.78, 0.34).rotateX(Math.PI / 2));
    g.add(mesh(C(0.14, 0.12, 0.14, 14), 0xc0503a, 0.18, 0.99, 0.14));
    return g;
  },
  fridge() {
    const g = new THREE.Group();
    g.add(mesh(B(0.75, 1.8, 0.7), 0xf4f6f6, 0, 0.9, 0, { roughness: 0.4 }));
    g.add(mesh(B(0.76, 0.02, 0.71), 0xc7cdd0, 0, 1.25, 0.001));
    for (const y of [0.75, 1.5]) g.add(mesh(B(0.04, 0.35, 0.05), 0x9aa3ab, 0.3, y, 0.37));
    // selo de eficiência energética
    g.add(mesh(B(0.14, 0.2, 0.01), 0x3fa34d, -0.2, 1.05, 0.355));
    g.add(mesh(B(0.12, 0.12, 0.01), 0xf2bf4e, 0.05, 1.55, 0.355));
    return g;
  },
  dining_table() {
    const g = new THREE.Group();
    g.add(mesh(B(1.5, 0.07, 0.9), WOOD, 0, 0.75, 0));
    for (const x of [-0.65, 0.65]) for (const z of [-0.35, 0.35]) g.add(mesh(B(0.07, 0.72, 0.07), WOOD_DARK, x, 0.36, z));
    // quatro cadeiras
    const seats: [number, number, number][] = [
      [-0.4, 0.7, 0],
      [0.4, 0.7, 0],
      [-0.4, -0.7, Math.PI],
      [0.4, -0.7, Math.PI],
    ];
    for (const [x, z, r] of seats) {
      const c = new THREE.Group();
      c.add(mesh(B(0.42, 0.05, 0.42), 0xb88a5a, 0, 0.45, 0));
      c.add(mesh(B(0.42, 0.45, 0.05), 0xb88a5a, 0, 0.7, 0.2));
      for (const cx of [-0.18, 0.18]) for (const cz of [-0.18, 0.18]) c.add(mesh(B(0.04, 0.45, 0.04), WOOD_DARK, cx, 0.22, cz));
      c.position.set(x, 0, z);
      c.rotation.y = r;
      g.add(c);
    }
    // fruteira
    g.add(mesh(C(0.2, 0.12, 0.08, 16), 0xe8dcc0, 0, 0.83, 0));
    g.add(mesh(S(0.07), 0xe0632a, -0.06, 0.9, 0.02));
    g.add(mesh(S(0.07), 0x7fb04a, 0.07, 0.9, -0.03));
    g.add(mesh(S(0.065), 0xd7261e, 0.01, 0.93, 0.07));
    return g;
  },
  water_filter() {
    const g = new THREE.Group();
    g.add(mesh(B(0.5, 0.8, 0.45), WOOD, 0, 0.4, 0));
    g.add(mesh(C(0.2, 0.17, 0.35, 16), 0xb5653a, 0, 0.98, 0));
    g.add(mesh(C(0.18, 0.2, 0.3, 16), 0xb5653a, 0, 1.3, 0));
    g.add(mesh(C(0.1, 0.12, 0.05, 16), 0xb5653a, 0, 1.47, 0));
    g.add(mesh(C(0.02, 0.02, 0.1, 6), 0x9aa3ab, 0, 0.9, 0.2).rotateX(Math.PI / 2));
    g.add(mesh(C(0.06, 0.05, 0.14, 12), 0xdfeaf2, 0.14, 0.87, 0.12, { transparent: true, opacity: 0.7, roughness: 0.1 }));
    return g;
  },
  nightstand() {
    const g = new THREE.Group();
    g.add(mesh(B(0.5, 0.55, 0.45), WOOD, 0, 0.28, 0));
    g.add(mesh(B(0.42, 0.2, 0.02), 0xb88a5a, 0, 0.36, 0.23));
    g.add(mesh(S(0.025), 0x3d3028, 0, 0.36, 0.25));
    g.add(mesh(C(0.07, 0.09, 0.05, 12), 0xe8dcc0, -0.08, 0.58, 0));
    g.add(mesh(C(0.1, 0.14, 0.14, 12), 0xfff1c1, -0.08, 0.72, 0, { emissive: 0xffd77a, emissiveIntensity: 0.6 }));
    g.add(mesh(B(0.14, 0.03, 0.2), 0x4f7bff, 0.12, 0.57, 0.05));
    return g;
  },
  laundry_basket() {
    const g = new THREE.Group();
    g.add(mesh(C(0.3, 0.25, 0.55, 16), 0xc9a66b, 0, 0.28, 0));
    for (let i = 0; i < 3; i++) g.add(mesh(new THREE.TorusGeometry(0.29 - i * 0.02, 0.012, 6, 20), 0xa9844d, 0, 0.12 + i * 0.16, 0).rotateX(Math.PI / 2));
    g.add(mesh(S(0.14), 0x5b9fc2, -0.06, 0.55, 0.02));
    g.add(mesh(S(0.12), 0xf29bb5, 0.09, 0.56, -0.05));
    return g;
  },
  desk_lamp() {
    const g = new THREE.Group();
    g.add(mesh(C(0.1, 0.12, 0.04, 14), 0x3b6fa0, 0, 0.02, 0));
    g.add(mesh(C(0.018, 0.018, 0.4, 6), 0x9aa3ab, 0, 0.22, 0).rotateZ(0.25));
    g.add(mesh(C(0.018, 0.018, 0.3, 6), 0x9aa3ab, -0.12, 0.47, 0).rotateZ(-0.9));
    const shade = mesh(C(0.05, 0.12, 0.14, 14), 0x3b6fa0, 0.02, 0.52, 0);
    shade.rotation.z = -0.6;
    g.add(shade);
    g.add(mesh(S(0.04), 0xfff1c1, 0.05, 0.47, 0, { emissive: 0xffd77a, emissiveIntensity: 1 }));
    return g;
  },
  corkboard() {
    const g = new THREE.Group();
    g.add(mesh(B(1.2, 0.8, 0.05), WOOD_DARK, 0, 0, 0));
    g.add(mesh(B(1.1, 0.7, 0.03), 0xc49a6c, 0, 0, 0.02));
    [0xfff49c, 0x9fd8f7, 0xf7b2c8, 0xb8e59f].forEach((c, i) => {
      const note = mesh(B(0.2, 0.2, 0.01), c, -0.35 + i * 0.23, i % 2 ? -0.12 : 0.12, 0.04);
      note.rotation.z = (i - 1.5) * 0.08;
      g.add(note);
      g.add(mesh(S(0.02), 0xd7261e, note.position.x, note.position.y + 0.08, 0.05));
    });
    return g;
  },
};

// ---------- jardim: modelos do mundo 3D, em escala para os espaços da casa ----------

const noGlow = (g: THREE.Group) => {
  g.traverse((o) => o.userData.pulse && o.removeFromParent());
  return g;
};

/** Modelos de área externa: ficam no chão (y = 0) e têm partes animadas (vento, voo, água). */
const OUTDOOR: Partial<Record<ObjectModel, { build: () => THREE.Group; base: number }>> = {
  tree_small: { build: () => tree(3), base: 0.65 },
  tree_large: { build: largeTree, base: 0.72 },
  flower: { build: () => flowerCluster(5, [0xf06f9b, 0xfbd34d, 0xc08cf2, 0xffffff], 9, 1.1), base: 0.6 },
  bee: { build: pollinatorModels.bee, base: 0.75 },
  butterfly: { build: pollinatorModels.butterfly, base: 0.6 },
  bird: { build: pollinatorModels.bird, base: 0.75 },
  pond: { build: () => waterModels.pond(new THREE.Vector3()), base: 0.55 },
  fountain: { build: fountainModel, base: 1 },
  vegetable_garden: { build: () => noGlow(gardenModels.garden_basic()), base: 0.9 },
  cow: { build: cowModel, base: 0.8 },
  bench: { build: bench, base: 1 },
};

export function isOutdoorModel(model: ObjectModel): boolean {
  return model in OUTDOOR;
}

/** Vaso de barro com planta de folhas cheias (dentro de casa). */
function pottedPlant(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(C(0.22, 0.16, 0.34, 18), 0xb86b45, 0, 0.17, 0, { roughness: 0.85 }));
  g.add(mesh(new THREE.TorusGeometry(0.22, 0.03, 8, 20), 0xa55b39, 0, 0.34, 0).rotateX(Math.PI / 2));
  g.add(mesh(C(0.2, 0.2, 0.03, 18), 0x5a4028, 0, 0.33, 0));
  const leaves = new THREE.Group();
  for (const [x, y, z, r] of [
    [0, 0.62, 0, 0.3],
    [0.16, 0.55, 0.08, 0.2],
    [-0.14, 0.56, -0.06, 0.22],
    [0.02, 0.82, 0.02, 0.18],
  ]) {
    const f = foliage(r, 0x2f6b2a, 0x7cbf55, x * 10 + z, 1);
    f.position.set(x, y, z);
    leaves.add(f);
  }
  leaves.userData.sway = true;
  g.add(leaves);
  return g;
}

export function buildObject(model: ObjectModel): THREE.Group {
  const outdoor = OUTDOOR[model];
  if (outdoor) {
    const inner = outdoor.build();
    inner.scale.multiplyScalar(outdoor.base);
    const g = new THREE.Group();
    g.add(inner);
    g.userData.grounded = true;
    return g;
  }
  if (model === 'plant') return pottedPlant();
  const build = builders[model] ?? builders.plant;
  return build();
}
