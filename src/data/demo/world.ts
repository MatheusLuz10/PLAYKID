/**
 * Mundo do MODO DEMONSTRAÇÃO, lido da mesma fonte que gera o SQL
 * (content/world.json → supabase/migrations/24_world_content.sql).
 */
import content from '../../../content/world.json';
import type { WorldArea, WorldItem, WorldStage, WorldStatus, WorldUnlockType } from '../../models';
import { CATEGORY_IDS } from './challenges';

interface SourceItem {
  id: string;
  code: string;
  name: string;
  icon: string;
  area: string;
  category: string;
  item_type: string;
  rarity?: string;
  milestone?: boolean;
  unlock_type: string;
  unlock_reference?: string;
  min_level?: number;
  slot: { x: number; y: number };
  description: string;
  meaning: string;
  unlock_title?: string;
  unlock_message?: string;
}
interface SourceWorld {
  world: { name: string; description: string };
  areas: { code: string; name: string; icon: string; description: string }[];
  stages: {
    stage: number;
    name: string;
    icon: string;
    status: string;
    description: string;
    min_items: number;
    min_challenges: number;
    min_categories: number;
  }[];
  items: SourceItem[];
}

const source = content as SourceWorld;

export const demoWorldInfo = source.world;

export const demoWorldAreas: WorldArea[] = source.areas.map((a) => ({
  code: a.code,
  name: a.name,
  icon: a.icon,
  description: a.description,
}));

export const demoWorldStages: WorldStage[] = source.stages.map((s) => ({
  number: s.stage,
  name: s.name,
  icon: s.icon,
  description: s.description,
  status: s.status as WorldStatus,
  minItems: s.min_items,
  minChallenges: s.min_challenges,
  minCategories: s.min_categories,
}));

export const demoWorldItems: WorldItem[] = source.items.map((it, i) => ({
  id: it.id,
  code: it.code,
  name: it.name,
  icon: it.icon,
  description: it.description,
  meaning: it.meaning,
  area: it.area,
  categoryId: CATEGORY_IDS[it.category] ?? null,
  itemType: it.item_type,
  rarity: it.rarity ?? 'common',
  milestone: Boolean(it.milestone),
  unlockType: it.unlock_type as WorldUnlockType,
  unlockReference: it.unlock_reference ?? null,
  minLevel: it.min_level ?? null,
  order: i + 1,
  slot: it.slot,
  unlockTitle: it.unlock_title ?? null,
  unlockMessage: it.unlock_message ?? null,
}));
