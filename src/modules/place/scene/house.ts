/**
 * Terreno, casa e jardim de "Meu Lugar", no mesmo estilo realista do mundo 3D:
 * relevo suave com grama ao vento, trilha de pedras, cerca de madeira, paredes
 * rebocadas, pisos de madeira e cerâmica, telhado de telhas e janelas com moldura.
 * Unidades em metros. A casa fica atrás; o jardim, na frente (z positivo).
 */
import * as THREE from 'three';
import { buildGrassField, fbm, noise2, type Wind } from '../../world3d/scene/terrain';
import { bricks, ceramicTiles, plaster, roofTiles, stone, woodFloor, woodGrain } from './textures';

export const COLORS = {
  grass: 0x8ebf72,
  grassDark: 0x6aa84f,
  soil: 0x9c7a55,
  soilDark: 0x6d5237,
  path: 0xe9e1cf,
  wall: 0xf6f0e2,
  wallTrim: 0xd9ccb0,
  roof: 0xb24a3b,
  floorSala: 0xd8b98f,
  floorQuarto: 0xc9d6e8,
  floorCozinha: 0xe7dfcf,
  floorEstudos: 0xcfe1c8,
  door: 0x7a5436,
  glass: 0x9fd3ec,
  water: 0x7ec3e6,
};

const box = (w: number, h: number, d: number, material: THREE.Material) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

/** Dimensões da casa (usadas também para posicionar os cômodos e a câmera). */
export const HOUSE = {
  width: 10,
  depth: 8,
  wallHeight: 2.8,
  thickness: 0.2,
  /** Centro da casa. */
  center: new THREE.Vector3(0, 0, -4),
};

/** Cômodos (quadrantes) — a porta de entrada dá para a sala. */
export const ROOMS = {
  sala: { name: 'Sala', x: -2.5, z: -2, color: COLORS.floorSala },
  cozinha: { name: 'Cozinha', x: 2.5, z: -2, color: COLORS.floorCozinha },
  quarto: { name: 'Quarto', x: -2.5, z: -6, color: COLORS.floorQuarto },
  estudos: { name: 'Área de estudos', x: 2.5, z: -6, color: COLORS.floorEstudos },
} as const;

/** Áreas do jardim (na frente da casa). */
export const GARDEN = {
  arvores: { name: 'Espaço para árvores', x: -8, z: 4, w: 5, d: 6 },
  flores: { name: 'Espaço para flores', x: -2.6, z: 5.2, w: 3.4, d: 2.2 },
  horta: { name: 'Horta', x: 2.6, z: 5.2, w: 3.4, d: 2.2 },
  agua: { name: 'Espaço para água', x: 8, z: 4, w: 5, d: 5 },
  biodiversidade: { name: 'Espaço para biodiversidade', x: 0, z: 9.5, w: 9, d: 2.4 },
} as const;

export type RoomCode = keyof typeof ROOMS;
export type GardenCode = keyof typeof GARDEN;

/** Raio da cerca: dentro dele o terreno é plano (os objetos ficam em y = 0). */
const FENCE_R = 14;

/** Altura do chão: plano no terreno da casa, colinas suaves depois da cerca. */
export function placeHeightAt(x: number, z: number): number {
  const r = Math.hypot(x, z - 1);
  if (r < FENCE_R + 1) return 0;
  const k = Math.min(1, (r - FENCE_R - 1) / 18);
  return k * k * (2 + fbm(x * 0.05 + 4, z * 0.05) * 6);
}

// ---------- terreno ----------

const PATH_STONES: [number, number][] = [
  [-2.5, 0.9],
  [-2.3, 2],
  [-2.6, 3.1],
  [-2.2, 4.2],
  [-2.5, 6.9],
  [-2.3, 8],
  [-2.6, 9.1],
  [-2.4, 10.2],
  [-2.5, 11.3],
  [-2.4, 12.4],
];

export function buildTerrain(): THREE.Group {
  const g = new THREE.Group();
  const size = 90;
  const seg = 90;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const low = new THREE.Color(0x4f7d35);
  const high = new THREE.Color(0x86a84a);
  const dry = new THREE.Color(0xa7a257);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, placeHeightAt(x, z) - 0.01);
    const p = fbm(x * 0.21 + 11, z * 0.21 - 4);
    c.copy(low).lerp(high, Math.min(1, p * 1.2));
    if (p > 0.68) c.lerp(dry, (p - 0.68) * 1.6);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true;
  g.add(ground);

  // trilha de pedras do portão até a porta
  const stoneMat = new THREE.MeshStandardMaterial({ map: stone(), color: 0xd9d4c8, roughness: 0.95 });
  PATH_STONES.forEach(([x, z], i) => {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.42 + noise2(i, 1) * 0.12, 0.46, 0.08, 9), stoneMat);
    s.position.set(x, 0.03, z);
    s.rotation.y = i;
    s.scale.set(1, 1, 0.8 + noise2(i, 3) * 0.3);
    s.receiveShadow = true;
    g.add(s);
  });

  // cerca de madeira em volta do terreno, com portão aberto na trilha
  const wood = new THREE.MeshStandardMaterial({ map: woodGrain(), color: 0xc4a27c, roughness: 0.8 });
  const n = 48;
  const gate = (a: number) => {
    const x = Math.cos(a) * FENCE_R;
    const z = Math.sin(a) * FENCE_R + 1;
    return Math.abs(x + 2.5) < 1.2 && z > 0;
  };
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const b = ((i + 1) / n) * Math.PI * 2;
    if (gate(a)) continue;
    const x = Math.cos(a) * FENCE_R;
    const z = Math.sin(a) * FENCE_R + 1;
    const post = box(0.14, 0.95, 0.14, wood);
    post.position.set(x, 0.47, z);
    post.rotation.y = -a;
    g.add(post);
    if (gate(b)) continue;
    const nx = Math.cos(b) * FENCE_R;
    const nz = Math.sin(b) * FENCE_R + 1;
    const len = Math.hypot(nx - x, nz - z);
    for (const y of [0.4, 0.75]) {
      const rail = box(len, 0.08, 0.05, wood);
      rail.position.set((x + nx) / 2, y, (z + nz) / 2);
      rail.rotation.y = -Math.atan2(nz - z, nx - x);
      g.add(rail);
    }
  }
  return g;
}

/** Grama ao vento: fora da casa, da trilha e dos canteiros. */
export function buildPlaceGrass(count: number, wind: Wind): THREE.InstancedMesh {
  const W = HOUSE.width / 2 + 0.7;
  const inHouse = (x: number, z: number) => Math.abs(x) < W && z > -8.8 && z < 0.8;
  const inBed = (x: number, z: number) =>
    [GARDEN.flores, GARDEN.horta].some((b) => Math.abs(x - b.x) < b.w / 2 + 0.2 && Math.abs(z - b.z) < b.d / 2 + 0.2);
  const onPath = (x: number, z: number) => Math.abs(x + 2.45) < 0.75 && z > 0 && z < 13;
  const inPond = (x: number, z: number) => Math.hypot(x - 7.4, z - 3.2) < 2.6 || Math.hypot(x - 9.3, z - 5.8) < 1.1;
  return buildGrassField(
    count,
    (rand) => {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * 34;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r + 1;
      if (inHouse(x, z) || inBed(x, z) || onPath(x, z) || inPond(x, z)) return null;
      // longe da casa a grama fica mais rala (a névoa esconde)
      if (r > FENCE_R + 2 && rand() < 0.55) return null;
      return { x, z };
    },
    placeHeightAt,
    wind,
    11,
  );
}

/** Canteiros de terra (flores e horta), com borda de madeira. */
export function buildGardenZones(): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ map: woodGrain(), color: 0xa98460, roughness: 0.8 });
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x5f4430, roughness: 1 });
  for (const z of [GARDEN.flores, GARDEN.horta]) {
    const soil = box(z.w, 0.12, z.d, soilMat);
    soil.position.set(z.x, 0.06, z.z);
    g.add(soil);
    for (const [dx, dz, w, d] of [
      [0, z.d / 2, z.w + 0.14, 0.1],
      [0, -z.d / 2, z.w + 0.14, 0.1],
      [z.w / 2, 0, 0.1, z.d],
      [-z.w / 2, 0, 0.1, z.d],
    ]) {
      const b = box(w, 0.2, d, wood);
      b.position.set(z.x + dx, 0.1, z.z + dz);
      g.add(b);
    }
  }
  return g;
}

// ---------- casa ----------

export interface HouseParts {
  group: THREE.Group;
  roof: THREE.Group;
  /** Paredes externas e internas (baixam no modo "ver por dentro"). */
  walls: THREE.Mesh[];
}

interface Opening {
  at: number;
  width: number;
  bottom: number;
  top: number;
  kind: 'door' | 'window';
}

/** Parede com aberturas: blocos de parede + portas (folha de madeira) e janelas (vidro com moldura). */
function wallWithOpenings(
  length: number,
  height: number,
  thickness: number,
  openings: Opening[],
  material: THREE.Material,
): { group: THREE.Group; meshes: THREE.Mesh[]; extras: THREE.Object3D[] } {
  const group = new THREE.Group();
  const meshes: THREE.Mesh[] = [];
  const extras: THREE.Object3D[] = [];
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xf7f4ee, roughness: 0.6 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xa9d7ee, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.2 });
  const doorMat = new THREE.MeshStandardMaterial({ map: woodGrain(), color: 0x8a5c3a, roughness: 0.7 });
  const sorted = [...openings].sort((a, b) => a.at - b.at);
  let cursor = -length / 2;
  const add = (x0: number, x1: number, y0: number, y1: number) => {
    if (x1 - x0 <= 0.001 || y1 - y0 <= 0.001) return;
    const m = box(x1 - x0, y1 - y0, thickness, material);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
    group.add(m);
    meshes.push(m);
  };
  const frame = (o: Opening) => {
    const f = new THREE.Group();
    const t = 0.07;
    const d = thickness + 0.04;
    const h = o.top - o.bottom;
    for (const x of [o.at - o.width / 2 - t / 2, o.at + o.width / 2 + t / 2]) {
      const side = box(t, h + t, d, frameMat);
      side.position.set(x, o.bottom + h / 2, 0);
      f.add(side);
    }
    const head = box(o.width + t * 2, t, d, frameMat);
    head.position.set(o.at, o.top + t / 2, 0);
    f.add(head);
    if (o.kind === 'window') {
      const sill = box(o.width + t * 3, 0.06, d + 0.12, frameMat);
      sill.position.set(o.at, o.bottom - 0.03, 0);
      f.add(sill);
      // divisória em cruz
      const mv = box(0.04, h, 0.05, frameMat);
      mv.position.set(o.at, o.bottom + h / 2, 0);
      const mh = box(o.width, 0.04, 0.05, frameMat);
      mh.position.set(o.at, o.bottom + h / 2, 0);
      f.add(mv, mh);
    }
    return f;
  };
  for (const o of sorted) {
    const x0 = o.at - o.width / 2;
    const x1 = o.at + o.width / 2;
    add(cursor, x0, 0, height); // parede cheia até a abertura
    add(x0, x1, 0, o.bottom); // abaixo (janela)
    add(x0, x1, o.top, height); // acima
    const f = frame(o);
    group.add(f);
    extras.push(f);
    if (o.kind === 'window') {
      const glass = new THREE.Mesh(new THREE.BoxGeometry(o.width, o.top - o.bottom, thickness * 0.2), glassMat);
      glass.position.set(o.at, (o.bottom + o.top) / 2, 0);
      group.add(glass);
      extras.push(glass);
    } else {
      const door = new THREE.Group();
      const leaf = box(o.width * 0.95, o.top - 0.02, thickness * 0.4, doorMat);
      leaf.position.y = (o.top - 0.02) / 2;
      door.add(leaf);
      for (const y of [0.55, 1.45]) {
        const panel = box(o.width * 0.62, 0.62, 0.02, doorMat);
        panel.position.set(0, y, thickness * 0.21);
        door.add(panel);
      }
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.3 }));
      knob.position.set(o.width * 0.35, 1.0, thickness * 0.25);
      door.add(knob);
      door.position.set(o.at, 0, thickness * 0.3);
      door.userData.leaf = true;
      group.add(door);
      extras.push(door);
    }
    cursor = x1;
  }
  add(cursor, length / 2, 0, height);
  return { group, meshes, extras };
}

export function buildHouse(): HouseParts {
  const { width: W, depth: D, wallHeight: H, thickness: T, center } = HOUSE;
  const group = new THREE.Group();
  group.position.copy(center);
  const wallMat = new THREE.MeshStandardMaterial({ map: plaster(), color: 0xfbf6ea, roughness: 0.92 });
  const innerMat = new THREE.MeshStandardMaterial({ map: plaster(), color: 0xf3ecdc, roughness: 0.92 });
  const walls: THREE.Mesh[] = [];

  // piso por cômodo: madeira na sala, quarto e estudos; cerâmica na cozinha
  const floors: Record<RoomCode, THREE.Material> = {
    sala: new THREE.MeshStandardMaterial({ map: woodFloor('#c69c6d'), roughness: 0.65 }),
    quarto: new THREE.MeshStandardMaterial({ map: woodFloor('#b98a5e'), roughness: 0.7 }),
    estudos: new THREE.MeshStandardMaterial({ map: woodFloor('#d6b88f'), roughness: 0.65 }),
    cozinha: new THREE.MeshStandardMaterial({ map: ceramicTiles('#ece5d6'), roughness: 0.35 }),
  };
  for (const [code, room] of Object.entries(ROOMS) as [RoomCode, (typeof ROOMS)[RoomCode]][]) {
    const floor = box(W / 2 - T, 0.08, D / 2 - T, floors[code]);
    floor.position.set(room.x, 0.04, room.z - center.z);
    group.add(floor);
  }
  // base de pedra e degrau da entrada
  const base = box(W + 0.4, 0.15, D + 0.4, new THREE.MeshStandardMaterial({ map: stone(), color: 0xd8d2c4, roughness: 0.95 }));
  base.position.y = -0.05;
  group.add(base);
  const step = box(1.5, 0.1, 0.6, new THREE.MeshStandardMaterial({ map: stone(), color: 0xcfc9bb, roughness: 0.95 }));
  step.position.set(-2.5, 0.02, D / 2 + 0.5);
  group.add(step);

  const openingsFront: Opening[] = [
    { at: -2.5, width: 1.1, bottom: 0, top: 2.1, kind: 'door' },
    { at: 2.5, width: 1.6, bottom: 0.9, top: 2.0, kind: 'window' },
  ];
  const openingsBack: Opening[] = [
    { at: -2.5, width: 1.4, bottom: 0.9, top: 2.0, kind: 'window' },
    { at: 2.5, width: 1.4, bottom: 0.9, top: 2.0, kind: 'window' },
  ];
  const openingsSide: Opening[] = [{ at: 0, width: 1.4, bottom: 0.9, top: 2.0, kind: 'window' }];

  const front = wallWithOpenings(W, H, T, openingsFront, wallMat);
  front.group.position.set(0, 0, D / 2);
  const back = wallWithOpenings(W, H, T, openingsBack, wallMat);
  back.group.position.set(0, 0, -D / 2);
  back.group.rotation.y = Math.PI;
  const left = wallWithOpenings(D, H, T, openingsSide, wallMat);
  left.group.rotation.y = -Math.PI / 2;
  left.group.position.set(-W / 2, 0, 0);
  const right = wallWithOpenings(D, H, T, openingsSide, wallMat);
  right.group.rotation.y = Math.PI / 2;
  right.group.position.set(W / 2, 0, 0);
  for (const w of [front, back, left, right]) {
    group.add(w.group);
    walls.push(...w.meshes);
  }

  // paredes internas (em cruz), com passagens abertas
  const innerX = wallWithOpenings(W, H, T * 0.8, [
    { at: -2.5, width: 1.0, bottom: 0, top: 2.1, kind: 'door' },
    { at: 2.5, width: 1.0, bottom: 0, top: 2.1, kind: 'door' },
  ], innerMat);
  innerX.extras.forEach((e) => e.userData.leaf && innerX.group.remove(e)); // passagens abertas: tira as folhas, mantém os batentes
  const innerZ = wallWithOpenings(D, H, T * 0.8, [
    { at: -2, width: 1.0, bottom: 0, top: 2.1, kind: 'door' },
    { at: 2, width: 1.0, bottom: 0, top: 2.1, kind: 'door' },
  ], innerMat);
  innerZ.extras.forEach((e) => e.userData.leaf && innerZ.group.remove(e));
  innerZ.group.rotation.y = Math.PI / 2;
  group.add(innerX.group, innerZ.group);
  walls.push(...innerX.meshes, ...innerZ.meshes);

  // telhado de duas águas com telhas, cumeeira e oitões
  const roof = new THREE.Group();
  const roofMat = new THREE.MeshStandardMaterial({ map: roofTiles(), roughness: 0.75 });
  const slope = Math.hypot(D / 2 + 0.5, 1.6);
  const angle = Math.atan2(1.6, D / 2 + 0.5);
  for (const side of [-1, 1]) {
    const panel = box(W + 0.8, 0.14, slope, roofMat);
    panel.position.set(0, H + 0.8, (side * (D / 2 + 0.5)) / 2);
    panel.rotation.x = side * angle;
    roof.add(panel);
    // beiral (acabamento de madeira)
    const fascia = box(W + 0.85, 0.16, 0.08, new THREE.MeshStandardMaterial({ map: woodGrain(), color: 0x9a6b44 }));
    fascia.position.set(0, H + 0.02, side * (D / 2 + 0.52));
    roof.add(fascia);
  }
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, W + 0.9, 12), new THREE.MeshStandardMaterial({ color: 0x9c3f31, roughness: 0.7 }));
  ridge.rotation.z = Math.PI / 2;
  ridge.position.set(0, H + 1.62, 0);
  ridge.castShadow = true;
  roof.add(ridge);
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-D / 2, 0);
  gableShape.lineTo(D / 2, 0);
  gableShape.lineTo(0, 1.55);
  gableShape.lineTo(-D / 2, 0);
  const gableGeo = new THREE.ShapeGeometry(gableShape);
  for (const x of [-W / 2, W / 2]) {
    const gable = new THREE.Mesh(gableGeo, new THREE.MeshStandardMaterial({ map: plaster(), color: 0xfbf6ea, side: THREE.DoubleSide }));
    gable.rotation.y = Math.PI / 2;
    gable.position.set(x, H, 0);
    gable.castShadow = true;
    roof.add(gable);
  }
  group.add(roof);

  // chaminé de tijolos
  const chimney = box(0.6, 1.3, 0.6, new THREE.MeshStandardMaterial({ map: bricks(), roughness: 0.9 }));
  chimney.position.set(3, H + 1.35, -1.5);
  roof.add(chimney);
  const cap = box(0.75, 0.1, 0.75, new THREE.MeshStandardMaterial({ color: 0x6f6a62 }));
  cap.position.set(3, H + 2.05, -1.5);
  roof.add(cap);

  return { group, roof, walls };
}
