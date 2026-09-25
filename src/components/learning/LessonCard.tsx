import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { findCategory, findLesson } from '../../logic/catalog';
import {
  getLessonPercent,
  getLessonState,
  lessonCtaLabels,
  lessonLevelLabels,
  lessonPath,
  lessonStateLabels,
} from '../../logic/learning';
import type { Lesson } from '../../models';
import { useGame } from '../../state/GameContext';
import { ProgressBar } from '../ui/ProgressBar';
import { FavoriteButton } from './FavoriteButton';

/** Card de conteúdo: categoria, título, tempo, XP, nível, progresso e ação. */
export function LessonCard({ lesson }: { lesson: Lesson }) {
  const { content, player } = useGame();
  const category = findCategory(content, lesson.categoryId);
  const state = getLessonState(lesson, player);
  const percent = getLessonPercent(lesson, player);
  const prerequisite = lesson.prerequisiteId ? findLesson(content, lesson.prerequisiteId) : undefined;
  const titleId = `lesson-${lesson.id}-title`;

  return (
    <article
      className={`lesson-tile is-${state}`}
      style={{ '--cat': category?.color ?? 'var(--primary)' } as CSSProperties}
      aria-labelledby={titleId}
    >
      <div className="lesson-tile__top">
        <span className="lesson-tile__category">
          <span aria-hidden>{category?.icon}</span> {category?.name}
        </span>
        <FavoriteButton lessonId={lesson.id} title={lesson.title} />
      </div>

      <h3 id={titleId} className="lesson-tile__title">
        {lesson.title}
      </h3>

      <p className="lesson-tile__meta">
        <span>📖 {lesson.durationMinutes} min</span>
        <span>⭐ +{lesson.xpReward} XP</span>
        <span>🎯 {lessonLevelLabels[lesson.difficulty]}</span>
      </p>

      {state === 'locked' ? (
        <p className="lesson-tile__locked">
          🔒 Conclua “{prerequisite?.title ?? 'o conteúdo anterior'}” para liberar.
        </p>
      ) : (
        <div className="lesson-tile__progress">
          <span className="lesson-tile__progress-label">
            {state === 'completed' ? '✓ Concluído' : state === 'in_progress' ? `Progresso: ${percent}%` : 'Não iniciado'}
          </span>
          <ProgressBar value={percent} label={`Progresso de ${lesson.title}`} size="sm" />
        </div>
      )}

      {state === 'locked' ? (
        <span className="btn btn--ghost btn--sm is-disabled" aria-disabled="true">
          🔒 {lessonStateLabels.locked}
        </span>
      ) : (
        <Link
          to={lessonPath(lesson)}
          className={`btn btn--sm ${state === 'completed' ? 'btn--ghost' : 'btn--primary'}`}
          aria-label={`${lessonCtaLabels[state]}: ${lesson.title}`}
        >
          {lessonCtaLabels[state]}
        </Link>
      )}
    </article>
  );
}
