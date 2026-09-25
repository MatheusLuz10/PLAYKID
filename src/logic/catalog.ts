import type { Challenge, ContentCatalog, Difficulty, PlayerState } from '../models';

export const difficultyLabels: Record<Difficulty, string> = {
  facil: 'Fácil',
  medio: 'Médio',
  dificil: 'Difícil',
};

export const findChallengeBySlug = (c: ContentCatalog, slug: string) => c.challenges.find((x) => x.slug === slug);
export const findChallenge = (c: ContentCatalog, id: string) => c.challenges.find((x) => x.id === id);
export const findLesson = (c: ContentCatalog, id: string) => c.lessons.find((x) => x.id === id);
export const findQuizForLesson = (c: ContentCatalog, lessonId: string) => c.quizzes.find((q) => q.lessonId === lessonId);
export const findCategory = (c: ContentCatalog, id: string) => c.categories.find((x) => x.id === id);

/** Desafio preparado por uma aula (LESSON → QUIZ → CHALLENGE). */
export const findChallengeForLesson = (c: ContentCatalog, lessonId: string) =>
  c.challenges.find((x) => x.lessonId === lessonId);

/**
 * Conteúdo desativado pelo administrador some das telas, exceto para quem já
 * tem histórico com ele (aula feita, quiz tentado, desafio iniciado,
 * conquista ou item conquistado) — ninguém perde a própria jornada.
 */
export function visibleCatalog(c: ContentCatalog, player: PlayerState): ContentCatalog {
  const owned = new Set(player.world.items.map((i) => i.worldItemId));
  const unlocked = new Set(player.achievements.map((a) => a.achievementId));
  return {
    ...c,
    lessons: c.lessons.filter((l) => l.active !== false || player.lessons[l.id]),
    quizzes: c.quizzes.filter((q) => q.active !== false || player.quizzes[q.id]),
    challenges: c.challenges.filter((ch) => ch.active !== false || player.challenges[ch.id]),
    achievements: c.achievements.filter((a) => a.active !== false || unlocked.has(a.id)),
    worldItems: c.worldItems.filter((w) => w.active !== false || owned.has(w.id)),
  };
}

/** O que um desafio entrega ao ser concluído (conquista específica e itens do mundo). */
export function challengeRewards(c: ContentCatalog, challenge: Challenge) {
  return {
    achievements: c.achievements.filter(
      (a) => a.requirementType === 'challenge_completed' && a.requirementValue === challenge.slug,
    ),
    worldItems: c.worldItems.filter((w) => w.unlockType === 'challenge' && w.unlockReference === challenge.slug),
  };
}
