/**
 * Progressão do jogador calculada a partir dos dados reais (aulas, quizzes,
 * desafios, acompanhamentos, mundo). Nada aqui concede XP ou conquistas: quem
 * decide é o servidor (process_gamification_event / check_achievements, em
 * 21_gamification.sql). Estas funções mostram o progresso na interface e são
 * reutilizadas pelo modo demonstração, que espelha as mesmas regras.
 */
import type {
  Achievement,
  AchievementCategory,
  AchievementRequirement,
  Category,
  ContentCatalog,
  Level,
  PlayerState,
  XpTransaction,
} from '../models';

export interface CategoryStats {
  category: Category;
  /** Desafios concluídos nesta categoria. */
  challengesCompleted: number;
  /** Desafios cadastrados nesta categoria. */
  challengesTotal: number;
  /** Ações = desafios concluídos + acompanhamentos realizados. */
  actions: number;
  lessonsCompleted: number;
  explored: boolean;
}

export interface PlayerStats {
  lessonsCompleted: number;
  quizzesPassed: number;
  challengesCompleted: number;
  followupsCompleted: number;
  /** Desafios concluídos + acompanhamentos realizados. */
  actions: number;
  achievementsUnlocked: number;
  /** Categoria explorada = pelo menos uma lição ou um desafio concluído nela. */
  categoriesExplored: number;
  cyclesCompleted: number;
  byCategory: CategoryStats[];
}

export function computeStats(content: ContentCatalog, player: PlayerState): PlayerStats {
  const completedLessons = content.lessons.filter((l) => player.lessons[l.id]?.status === 'completed');
  const completedChallenges = content.challenges.filter((c) => player.challenges[c.id]?.status === 'completed');
  const followupsOf = (challengeId: string) => {
    const uc = player.challenges[challengeId];
    if (!uc || uc.status === 'expired') return 0;
    return new Set(uc.followups.filter((f) => f.status === 'completed').map((f) => f.stepId ?? f.id)).size;
  };

  const byCategory = content.categories.map((category): CategoryStats => {
    const challenges = content.challenges.filter((c) => c.categoryId === category.id);
    const challengesCompleted = challenges.filter((c) => player.challenges[c.id]?.status === 'completed').length;
    const lessonsCompleted = completedLessons.filter((l) => l.categoryId === category.id).length;
    return {
      category,
      challengesCompleted,
      challengesTotal: challenges.length,
      actions: challengesCompleted + challenges.reduce((sum, c) => sum + followupsOf(c.id), 0),
      lessonsCompleted,
      explored: lessonsCompleted > 0 || challengesCompleted > 0,
    };
  });

  const followupsCompleted = content.challenges.reduce((sum, c) => sum + followupsOf(c.id), 0);
  return {
    lessonsCompleted: completedLessons.length,
    quizzesPassed: Object.values(player.quizzes).filter((q) => q.passed).length,
    challengesCompleted: completedChallenges.length,
    followupsCompleted,
    actions: completedChallenges.length + followupsCompleted,
    achievementsUnlocked: player.achievements.length,
    categoriesExplored: byCategory.filter((c) => c.explored).length,
    // ciclo = item conquistado por um desafio e já visto no mundo
    cyclesCompleted: player.world.items.filter((i) => i.revealed && i.sourceType === 'challenge').length,
    byCategory,
  };
}

// ---------- Conquistas ----------

export const achievementCategoryLabels: Record<AchievementCategory, { icon: string; label: string }> = {
  knowledge: { icon: '📚', label: 'Conhecimento' },
  first_actions: { icon: '🌱', label: 'Primeiras ações' },
  nature: { icon: '🌳', label: 'Natureza' },
  water: { icon: '💧', label: 'Água' },
  waste: { icon: '♻️', label: 'Resíduos' },
  energy: { icon: '⚡', label: 'Energia' },
  biodiversity: { icon: '🐝', label: 'Biodiversidade' },
  community: { icon: '🤝', label: 'Comunidade' },
  special: { icon: '🏆', label: 'Especial' },
};

export interface AchievementProgress {
  current: number;
  target: number;
  done: boolean;
  /** Ex.: "3 / 5 desafios" */
  label: string;
  /** Ex.: "Complete mais 2 desafios de Natureza." */
  hint: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const units: Record<AchievementRequirement, [string, string]> = {
  lessons_completed: ['lição', 'lições'],
  quizzes_passed: ['quiz', 'quizzes'],
  challenges_completed: ['desafio', 'desafios'],
  challenge_completed: ['desafio', 'desafios'],
  category_challenges_completed: ['desafio', 'desafios'],
  category_actions_completed: ['ação', 'ações'],
  categories_explored: ['categoria', 'categorias'],
  level_reached: ['nível', 'níveis'],
  cycles_completed: ['ciclo', 'ciclos'],
};

function categoryNames(content: ContentCatalog, value: string) {
  const slugs = value.split(',').map((s) => s.trim());
  return content.categories.filter((c) => slugs.includes(c.slug));
}

/** Valor atual de uma condição — mesma definição de public.achievement_progress. */
export function requirementCurrent(
  type: AchievementRequirement,
  value: string,
  content: ContentCatalog,
  player: PlayerState,
  stats: PlayerStats,
): number {
  switch (type) {
    case 'lessons_completed':
      return stats.lessonsCompleted;
    case 'quizzes_passed':
      return stats.quizzesPassed;
    case 'challenges_completed':
      return stats.challengesCompleted;
    case 'challenge_completed': {
      const challenge = content.challenges.find((c) => c.slug === value);
      return challenge && player.challenges[challenge.id]?.status === 'completed' ? 1 : 0;
    }
    case 'category_challenges_completed':
    case 'category_actions_completed': {
      const ids = new Set(categoryNames(content, value).map((c) => c.id));
      return stats.byCategory
        .filter((c) => ids.has(c.category.id))
        .reduce((sum, c) => sum + (type === 'category_actions_completed' ? c.actions : c.challengesCompleted), 0);
    }
    case 'categories_explored':
      return stats.categoriesExplored;
    case 'level_reached':
      return player.profile.level;
    case 'cycles_completed':
      return stats.cyclesCompleted;
  }
}

export function achievementProgress(
  achievement: Achievement,
  content: ContentCatalog,
  player: PlayerState,
  stats: PlayerStats,
): AchievementProgress {
  const { requirementType: type, requirementValue: value } = achievement;
  const target = type === 'challenge_completed' ? 1 : achievement.requirementCount;
  const current = Math.min(requirementCurrent(type, value, content, player, stats), target);
  const missing = target - current;
  const [one, many] = units[type];
  const done = current >= target;

  let label = `${current} / ${target} ${target === 1 ? one : many}`;
  let hint: string;
  switch (type) {
    case 'lessons_completed':
      hint = `Conclua mais ${plural(missing, 'lição', 'lições')}.`;
      break;
    case 'quizzes_passed':
      hint = `Seja aprovado em mais ${plural(missing, 'quiz', 'quizzes')}.`;
      break;
    case 'challenges_completed':
      hint = `Conclua mais ${plural(missing, 'desafio', 'desafios')}.`;
      break;
    case 'challenge_completed': {
      const challenge = content.challenges.find((c) => c.slug === value);
      hint = challenge ? `Conclua o desafio “${challenge.title}”.` : 'Conclua o desafio indicado.';
      break;
    }
    case 'category_challenges_completed':
    case 'category_actions_completed': {
      const names = categoryNames(content, value).map((c) => c.name).join(' ou ');
      hint =
        type === 'category_actions_completed'
          ? `Realize mais ${plural(missing, 'ação', 'ações')} de ${names}.`
          : `Complete mais ${plural(missing, 'desafio', 'desafios')} de ${names}.`;
      break;
    }
    case 'categories_explored':
      hint = `Explore mais ${plural(missing, 'categoria', 'categorias')}: conclua uma lição ou um desafio em cada uma.`;
      break;
    case 'level_reached':
      label = `Nível ${current} de ${target}`;
      hint = `Alcance o nível ${target}.`;
      break;
    case 'cycles_completed':
      hint = 'Conclua um desafio e veja o novo item surgir no seu mundo.';
      break;
  }
  return { current, target, done, label, hint };
}

// ---------- Histórico de XP ----------

export const xpSourceLabels: Record<string, string> = {
  lesson_completed: 'Lição concluída',
  quiz_passed: 'Quiz aprovado',
  quiz_improved: 'Nova melhor nota',
  challenge_started: 'Desafio iniciado',
  challenge_step_completed: 'Etapa concluída',
  followup_completed: 'Acompanhamento realizado',
  challenge_completed: 'Desafio concluído',
  achievement_unlocked: 'Conquista desbloqueada',
  bonus: 'Bônus',
};

/** As quatro categorias de XP mostradas ao jogador. */
export const xpCategory: Record<XpTransaction['type'], { icon: string; label: string }> = {
  knowledge: { icon: '🌱', label: 'Conhecimento' },
  action: { icon: '🌳', label: 'Ação' },
  follow_up: { icon: '🌳', label: 'Ação' },
  achievement: { icon: '🏆', label: 'Conquista' },
  bonus: { icon: '⭐', label: 'Bônus' },
};

export function xpSourceLabel(t: XpTransaction): string {
  return xpSourceLabels[t.sourceType.replace(/^legacy_/, '')] ?? xpCategory[t.type].label;
}

// ---------- O que mudou depois de uma ação ----------

export interface ProgressChange {
  /** XP total ganho (inclui o XP das conquistas). */
  xpGained: number;
  /** XP ganho sem contar as conquistas (o XP da própria ação). */
  actionXp: number;
  /** Níveis alcançados, em ordem (vários de uma vez, se for o caso). */
  levels: Level[];
  achievements: Achievement[];
}

/** Compara o estado antes/depois de uma ação. Os números vêm do servidor. */
export function diffProgress(content: ContentCatalog, before: PlayerState, after: PlayerState): ProgressChange {
  const had = new Set(before.achievements.map((a) => a.achievementId));
  const achievements = after.achievements
    .filter((a) => !had.has(a.achievementId))
    .map((a) => content.achievements.find((x) => x.id === a.achievementId))
    .filter((a): a is Achievement => Boolean(a));
  const xpGained = Math.max(0, after.profile.totalXp - before.profile.totalXp);
  const levels = content.levels
    .filter((l) => l.number > before.profile.level && l.number <= after.profile.level)
    .sort((a, b) => a.number - b.number);
  return {
    xpGained,
    actionXp: Math.max(0, xpGained - achievements.reduce((sum, a) => sum + a.xpReward, 0)),
    levels,
    achievements,
  };
}

/** Conquista desbloqueada mais recente. */
export function latestAchievement(content: ContentCatalog, player: PlayerState): Achievement | null {
  const last = [...player.achievements].sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt))[0];
  return last ? (content.achievements.find((a) => a.id === last.achievementId) ?? null) : null;
}
