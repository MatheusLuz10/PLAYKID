/**
 * Aulas do MODO DEMONSTRAÇÃO, lidas da mesma fonte que gera o SQL
 * (content/lessons.json → supabase/migrations/15_learning_content.sql).
 * Assim, o conteúdo não fica duplicado nem escrito dentro de componentes.
 */
import content from '../../../content/lessons.json';
import type { Lesson, LessonDetail, LessonLevel } from '../../models';
import { mapLessonDetail, type LessonSectionRow } from '../../services/backend/mappers';

interface SourceLesson {
  id: string;
  category: string;
  slug: string;
  topic: string;
  title: string;
  description: string;
  difficulty: string;
  estimated_minutes: number;
  xp_reward: number;
  order_index: number;
  prerequisite: string | null;
  summary_points: { icon: string; text: string }[];
  related: string[];
  sections: { icon: string; title: string; content: string; image_url: string | null; image_alt: string | null; blocks: unknown[] }[];
}

const CATEGORY_IDS: Record<string, string> = {
  natureza: '10000000-0000-4000-8000-000000000001',
  agua: '10000000-0000-4000-8000-000000000002',
  residuos: '10000000-0000-4000-8000-000000000003',
  energia: '10000000-0000-4000-8000-000000000004',
  biodiversidade: '10000000-0000-4000-8000-000000000005',
  comunidade: '10000000-0000-4000-8000-000000000006',
};

const source = (content as { lessons: SourceLesson[] }).lessons;
const idBySlug = new Map(source.map((l) => [l.slug, l.id]));

export const demoLessons: Lesson[] = source.map((l) => ({
  id: l.id,
  slug: l.slug,
  categoryId: CATEGORY_IDS[l.category],
  topic: l.topic,
  title: l.title,
  summary: l.description,
  difficulty: l.difficulty as LessonLevel,
  durationMinutes: l.estimated_minutes,
  xpReward: l.xp_reward,
  orderIndex: l.order_index,
  sectionCount: l.sections.length,
  prerequisiteId: l.prerequisite ? (idBySlug.get(l.prerequisite) ?? null) : null,
}));

export function demoLessonDetail(lessonId: string): LessonDetail | null {
  const lesson = source.find((l) => l.id === lessonId);
  if (!lesson) return null;
  const rows: LessonSectionRow[] = lesson.sections.map((s, i) => ({
    id: `${lesson.id}-${i + 1}`,
    section_type: 'content',
    icon: s.icon,
    title: s.title,
    content: s.content,
    image_url: s.image_url,
    image_alt: s.image_alt,
    video_url: null,
    blocks: s.blocks,
    order_index: i + 1,
  }));
  const related = lesson.related.map((slug) => idBySlug.get(slug)).filter((id): id is string => Boolean(id));
  return mapLessonDetail(lesson.id, rows, lesson.summary_points, related);
}

/** Texto pesquisável, como a coluna gerada lessons.search_text. */
export function demoSearchText(lessonId: string): string {
  const l = source.find((x) => x.id === lessonId);
  return l ? `${l.title} ${l.description} ${l.topic}` : '';
}
