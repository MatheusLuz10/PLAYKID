/**
 * Catálogo do módulo Meu Lugar, lido de content/place.json (a mesma fonte que
 * gera o SQL). Aqui só ficam definições; quem decide o que foi desbloqueado é
 * o servidor (sync_place).
 */
import content from '../../../content/place.json';
import type { ObjectModel } from './scene/objects';

export type PlaceUnlockType = 'initial' | 'lesson' | 'challenge' | 'achievement' | 'level' | 'evidence';
export type PlaceCategory = 'casa' | 'educacao' | 'natureza' | 'agua' | 'reciclagem' | 'energia' | 'biodiversidade' | 'comunidade';

export interface PlaceItemDef {
  id: string;
  code: string;
  name: string;
  icon: string;
  model: ObjectModel;
  category: PlaceCategory;
  location: string;
  position: [number, number, number];
  /** Graus (eixo vertical). */
  rotation: number;
  scale: number;
  unlockType: PlaceUnlockType;
  unlockReference: string | null;
  description: string;
  meaning: string;
  order: number;
}

export interface PlaceStage {
  number: number;
  name: string;
  icon: string;
  description: string;
  minItems: number;
  minCategories: number;
}

interface Source {
  stages: { stage: number; name: string; icon: string; description: string; min_items: number; min_categories: number }[];
  items: {
    id: string; code: string; name: string; icon: string; model: string; category: string; location: string;
    position: number[]; rotation: number; scale: number; unlock_type: string; unlock_reference?: string;
    description: string; meaning: string;
  }[];
}

const source = content as Source;

export const PLACE_ITEMS: PlaceItemDef[] = source.items.map((it, i) => ({
  id: it.id,
  code: it.code,
  name: it.name,
  icon: it.icon,
  model: it.model as ObjectModel,
  category: it.category as PlaceCategory,
  location: it.location,
  position: [it.position[0], it.position[1], it.position[2]],
  rotation: it.rotation,
  scale: it.scale,
  unlockType: it.unlock_type as PlaceUnlockType,
  unlockReference: it.unlock_reference ?? null,
  description: it.description,
  meaning: it.meaning,
  order: i + 1,
}));

export const PLACE_STAGES: PlaceStage[] = source.stages.map((s) => ({
  number: s.stage,
  name: s.name,
  icon: s.icon,
  description: s.description,
  minItems: s.min_items,
  minCategories: s.min_categories,
}));

export const PLACE_CATEGORY_LABELS: Record<PlaceCategory, { icon: string; label: string }> = {
  casa: { icon: '🏠', label: 'Casa' },
  educacao: { icon: '📚', label: 'Educação' },
  natureza: { icon: '🌱', label: 'Natureza' },
  agua: { icon: '💧', label: 'Água' },
  reciclagem: { icon: '♻️', label: 'Reciclagem' },
  energia: { icon: '⚡', label: 'Energia' },
  biodiversidade: { icon: '🐝', label: 'Biodiversidade' },
  comunidade: { icon: '🤝', label: 'Comunidade' },
};

/** Objetos de fora da casa (árvores, bichos, horta, água, banco): ficam no quintal, dentro do Meu Mundo. */
export function isOutdoorItem(def: Pick<PlaceItemDef, 'location'>): boolean {
  return def.location === 'horta' || def.location.startsWith('jardim');
}

export const PLACE_LOCATION_LABELS: Record<string, string> = {
  sala: 'Sala',
  quarto: 'Quarto',
  cozinha: 'Cozinha',
  estudos: 'Área de estudos',
  'jardim-arvores': 'Quintal no Meu Mundo · árvores',
  'jardim-flores': 'Quintal no Meu Mundo · flores',
  horta: 'Quintal no Meu Mundo · horta',
  'jardim-agua': 'Quintal no Meu Mundo · água',
  'jardim-biodiversidade': 'Quintal no Meu Mundo · biodiversidade',
};
