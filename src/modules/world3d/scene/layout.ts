/**
 * Planta do mundo 3D: as 5 áreas numa paisagem contínua.
 *
 *        comunitária        polinizadores        (fundo)
 *   horta          natural            água
 *                   (câmera vem da frente)
 */
export type AreaCode = 'natural' | 'water' | 'garden' | 'pollinators' | 'community';

export interface Zone {
  cx: number;
  cz: number;
  w: number;
  d: number;
}

export const ZONES: Record<AreaCode, Zone> = {
  natural: { cx: 0, cz: 0, w: 26, d: 19 },
  water: { cx: 29, cz: -2, w: 24, d: 19 },
  garden: { cx: -29, cz: -2, w: 24, d: 19 },
  pollinators: { cx: 15, cz: -25, w: 24, d: 16 },
  community: { cx: -15, cz: -25, w: 24, d: 16 },
};

export const AREA_CODES = Object.keys(ZONES) as AreaCode[];

/**
 * A casa do jogador (a mesma de "Meu Lugar", em miniatura): na frente, à esquerda da
 * trilha principal, com a porta virada para a câmera. Tocar nela leva para dentro.
 */
export const HOME = { x: -8, z: 14, scale: 0.42, radius: 3.2 };

/** Retângulo que contém todas as áreas (fora dele o terreno vira colina). */
export const WORLD_BOUNDS = { minX: -43, maxX: 43, minZ: -35, maxZ: 12 };

export function zoneOf(area: string): Zone {
  return ZONES[(area in ZONES ? area : 'natural') as AreaCode];
}

/** Posição do mapa 2D (x 0–100 %, y ~35–92 %) → ponto dentro da área, no terreno 3D. */
export function slotToWorld(area: string, slot: { x: number; y: number }): { x: number; z: number } {
  const z = zoneOf(area);
  const margin = 1.8;
  const fx = (slot.x - 50) / 50;
  const fy = Math.min(1, Math.max(0, (slot.y - 34) / 58));
  return { x: z.cx + fx * (z.w / 2 - margin), z: z.cz - z.d / 2 + margin + fy * (z.d - margin * 2) };
}

/** Pequenos ajustes em 3D para itens grandes não encostarem nos vizinhos. */
export const ITEM_OFFSETS: Record<string, [number, number]> = {
  cow_pasture: [1.5, -1.6],
};

/** Câmera de cada área (visão de cima e um pouco de frente). */
export function zoneView(area: AreaCode): { pos: [number, number, number]; target: [number, number, number] } {
  const z = ZONES[area];
  return { pos: [z.cx, 16, z.cz + z.d / 2 + 17], target: [z.cx, 0.8, z.cz + 0.5] };
}

export const OVERVIEW = { pos: [0, 60, 62] as [number, number, number], target: [0, 0, -9] as [number, number, number] };

/** Tela em pé (celular): olha o mundo pelo lado, assim o comprimento dele fica na vertical da tela. */
export const OVERVIEW_PORTRAIT = { pos: [70, 74, -10] as [number, number, number], target: [0, 0, -10] as [number, number, number] };
