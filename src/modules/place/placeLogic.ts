/**
 * Regras de leitura do módulo Meu Lugar (sem efeitos): textos de origem,
 * conversão para a cena e cálculo de evolução — espelha public.place_progress.
 */
import type { ContentCatalog, PlayerState } from '../../models';
import { computeStats } from '../../logic/gamification';
import { PLACE_ITEMS, PLACE_STAGES, type PlaceCategory, type PlaceItemDef, type PlaceStage } from './catalog';
import type { SceneObject } from './scene/PlaceScene';

const quote = (s: string) => `“${s}”`;

/** Objeto desbloqueado pelo jogador (vem do servidor: user_place_items). */
export interface OwnedPlaceItem {
  itemId: string;
  unlockedAt: string;
  sourceType: string;
  sourceId: string | null;
  /** Registro do jogador ligado à origem (observação da evidência) — o "diário". */
  originNote: string | null;
  revealed: boolean;
}

/** "Desbloqueado através de …" — a atividade real que fez o objeto aparecer. */
export function unlockSourceText(def: PlaceItemDef, content: ContentCatalog): string {
  const ref = def.unlockReference ?? '';
  switch (def.unlockType) {
    case 'initial':
      return 'Faz parte da casa inicial.';
    case 'lesson': {
      const l = content.lessons.find((x) => x.slug === ref);
      return `Desbloqueado através da lição ${quote(l?.title ?? ref)}.`;
    }
    case 'challenge': {
      const c = content.challenges.find((x) => x.slug === ref);
      return `Desbloqueado através do desafio ${quote(c?.title ?? ref)}.`;
    }
    case 'achievement': {
      const a = content.achievements.find((x) => x.slug === ref);
      return `Desbloqueado através da conquista ${quote(a?.title ?? ref)}.`;
    }
    case 'level':
      return `Desbloqueado ao alcançar o nível ${ref}.`;
    case 'evidence':
      return 'Desbloqueado ao enviar a primeira foto de uma ação real.';
  }
}

/** Como liberar um objeto que ainda não apareceu. */
export function unlockHint(def: PlaceItemDef, content: ContentCatalog): string {
  const ref = def.unlockReference ?? '';
  switch (def.unlockType) {
    case 'initial':
      return 'Já faz parte da casa.';
    case 'lesson':
      return `Conclua a lição ${quote(content.lessons.find((x) => x.slug === ref)?.title ?? ref)}.`;
    case 'challenge':
      return `Conclua o desafio ${quote(content.challenges.find((x) => x.slug === ref)?.title ?? ref)}.`;
    case 'achievement':
      return `Desbloqueie a conquista ${quote(content.achievements.find((x) => x.slug === ref)?.title ?? ref)}.`;
    case 'level':
      return `Alcance o nível ${ref}.`;
    case 'evidence':
      return 'Envie a foto de uma etapa de desafio (a primeira ação comprovada).';
  }
}

export function toSceneObject(def: PlaceItemDef, isNew = false): SceneObject {
  return {
    code: def.code,
    model: def.model,
    position: def.position,
    rotation: (def.rotation * Math.PI) / 180,
    scale: def.scale,
    isNew,
    label: def.name,
  };
}

export interface PlaceProgressInfo {
  stage: PlaceStage;
  next: PlaceStage | null;
  /** 0–100: objetos conquistados / objetos que podem ser conquistados. */
  progress: number;
  itemsUnlocked: number;
  itemsTotal: number;
  categories: number;
  byCategory: Record<PlaceCategory, number>;
}

/** calculatePlaceStage — mesma regra de public.place_progress. */
export function calculatePlaceStage(owned: OwnedPlaceItem[], items: PlaceItemDef[] = PLACE_ITEMS): PlaceProgressInfo {
  const ownedIds = new Set(owned.map((o) => o.itemId));
  const earnable = items.filter((d) => d.unlockType !== 'initial');
  const mine = earnable.filter((d) => ownedIds.has(d.id));
  const byCategory = {} as Record<PlaceCategory, number>;
  for (const d of mine) byCategory[d.category] = (byCategory[d.category] ?? 0) + 1;
  const categories = Object.keys(byCategory).length;
  const reached = PLACE_STAGES.filter((s) => s.minItems <= mine.length && s.minCategories <= categories);
  const stage = reached[reached.length - 1] ?? PLACE_STAGES[0];
  return {
    stage,
    next: PLACE_STAGES.find((s) => s.number > stage.number) ?? null,
    progress: earnable.length ? Math.round((mine.length / earnable.length) * 100) : 0,
    itemsUnlocked: mine.length,
    itemsTotal: earnable.length,
    categories,
    byCategory,
  };
}

/** Números reais do jogador para o painel ("missões" = aulas concluídas + quizzes aprovados). */
export function activityCounts(content: ContentCatalog, player: PlayerState) {
  const stats = computeStats(content, player);
  return {
    missions: stats.lessonsCompleted + stats.quizzesPassed,
    lessons: stats.lessonsCompleted,
    quizzes: stats.quizzesPassed,
    challenges: stats.challengesCompleted,
  };
}
