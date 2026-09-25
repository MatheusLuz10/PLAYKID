import type { Level } from '../models';

const FALLBACK_LEVEL: Level = { number: 1, name: 'Explorador', icon: '🌱', xpRequired: 0, description: null };

export interface LevelInfo {
  /** XP total considerado (nunca negativo). */
  totalXp: number;
  current: Level;
  next: Level | null;
  /** Faixa do nível atual: do mínimo até o mínimo do próximo − 1 (null no último nível). */
  xpMin: number;
  xpMax: number | null;
  /** XP acumulado dentro do nível atual. */
  xpInLevel: number;
  /** Tamanho da faixa do nível atual (0 no nível máximo). */
  xpForNext: number;
  /** Quanto falta para o próximo nível (0 no nível máximo). */
  xpToNext: number;
}

/**
 * Nível a partir do XP acumulado, usando a tabela `levels` do banco
 * (mesma regra de public.calculate_user_level). Nenhum valor de XP fica no código.
 */
export function calculateUserLevel(totalXp: number, levels: Level[]): LevelInfo {
  const xp = Number.isFinite(totalXp) ? Math.max(0, Math.floor(totalXp)) : 0;
  const sorted = levels.length ? [...levels].sort((a, b) => a.number - b.number) : [FALLBACK_LEVEL];
  let index = 0;
  sorted.forEach((level, i) => {
    if (xp >= level.xpRequired) index = i;
  });
  const current = sorted[index];
  const next = sorted[index + 1] ?? null;
  return {
    totalXp: xp,
    current,
    next,
    xpMin: current.xpRequired,
    xpMax: next ? next.xpRequired - 1 : null,
    xpInLevel: xp - current.xpRequired,
    xpForNext: next ? next.xpRequired - current.xpRequired : 0,
    xpToNext: next ? next.xpRequired - xp : 0,
  };
}

/** 1250 → "1.250" */
export function formatXp(value: number): string {
  return value.toLocaleString('pt-BR');
}
