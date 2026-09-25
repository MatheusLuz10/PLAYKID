import type { ContentCatalog, Lesson, LessonLevel, PlayerState } from '../models';
import { findChallengeForLesson, findQuizForLesson } from './catalog';
import { missionPath } from './mission';

export type LessonState = 'locked' | 'not_started' | 'in_progress' | 'completed';

export const lessonLevelLabels: Record<LessonLevel, string> = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
};

export const lessonStateLabels: Record<LessonState, string> = {
  locked: 'Bloqueado',
  not_started: 'Não iniciado',
  in_progress: 'Em andamento',
  completed: 'Concluído',
};

/** Texto do botão de cada card (Começar / Continuar / Revisar). */
export const lessonCtaLabels: Record<LessonState, string> = {
  locked: 'Bloqueado',
  not_started: 'Começar',
  in_progress: 'Continuar',
  completed: 'Revisar',
};

/** Mesma normalização da coluna lessons.search_text (minúsculas, sem acentos). */
export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "1 conteúdo", "2 conteúdos"… */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export const findLessonBySlug = (c: ContentCatalog, slug: string) => c.lessons.find((l) => l.slug === slug);

export function lessonPath(lesson: Pick<Lesson, 'slug'>): string {
  return `/aula/${lesson.slug}`;
}

export function getLessonState(lesson: Lesson, player: PlayerState): LessonState {
  const progress = player.lessons[lesson.id];
  if (progress?.status === 'completed') return 'completed';
  if (lesson.prerequisiteId && player.lessons[lesson.prerequisiteId]?.status !== 'completed') return 'locked';
  if (progress?.status === 'in_progress') return 'in_progress';
  return 'not_started';
}

export function getLessonPercent(lesson: Lesson, player: PlayerState): number {
  const progress = player.lessons[lesson.id];
  if (progress?.status === 'completed') return 100;
  return progress?.progressPercentage ?? 0;
}

/**
 * Para onde leva o botão "Fazer quiz".
 * - Aula com quiz e desafio: o quiz da missão (já existente).
 * - Demais aulas: rota preparada /aula/:slug/quiz (o sistema completo de quiz chega na Etapa 4).
 */
export function quizPathForLesson(content: ContentCatalog, lesson: Lesson): string {
  const quiz = findQuizForLesson(content, lesson.id);
  const challenge = findChallengeForLesson(content, lesson.id);
  if (quiz && challenge) return missionPath(challenge.slug, 'quiz');
  return `${lessonPath(lesson)}/quiz`;
}

export interface CategoryStats {
  total: number;
  completed: number;
  inProgress: number;
  available: number;
  locked: number;
  percent: number;
}

export function getCategoryStats(content: ContentCatalog, player: PlayerState, categoryId: string): CategoryStats {
  const lessons = content.lessons.filter((l) => l.categoryId === categoryId);
  const states = lessons.map((l) => getLessonState(l, player));
  const completed = states.filter((s) => s === 'completed').length;
  return {
    total: lessons.length,
    completed,
    inProgress: states.filter((s) => s === 'in_progress').length,
    available: states.filter((s) => s !== 'locked').length,
    locked: states.filter((s) => s === 'locked').length,
    percent: lessons.length ? Math.round((completed / lessons.length) * 100) : 0,
  };
}

/** Aula em andamento acessada mais recentemente (card "Continue de onde parou"). */
export function findLessonToResume(content: ContentCatalog, player: PlayerState): Lesson | undefined {
  return Object.values(player.lessons)
    .filter((p) => p.status === 'in_progress')
    .sort((a, b) => (b.lastAccessedAt ?? '').localeCompare(a.lastAccessedAt ?? ''))
    .map((p) => content.lessons.find((l) => l.id === p.lessonId))
    .find((l): l is Lesson => Boolean(l));
}
