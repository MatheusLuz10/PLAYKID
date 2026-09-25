import { Link, useParams } from 'react-router-dom';
import { LessonPlayer } from '../../components/learning/LessonPlayer';
import { StateMessage } from '../../components/ui/StateMessage';
import { findCategory, findLesson } from '../../logic/catalog';
import { findLessonBySlug, getLessonState, lessonPath, quizPathForLesson } from '../../logic/learning';
import { useGame } from '../../state/GameContext';

/** Aula aberta pela área Aprender / Biblioteca. */
export function LessonPage() {
  const { lessonSlug = '' } = useParams();
  const { content, player } = useGame();
  const lesson = findLessonBySlug(content, lessonSlug);

  if (!lesson) {
    return (
      <StateMessage icon="🧭" title="Conteúdo não encontrado" text="Ele pode ter sido removido ou o endereço está incorreto.">
        <Link to="/aprender/biblioteca" className="btn btn--primary">
          Ir para a biblioteca
        </Link>
      </StateMessage>
    );
  }

  const category = findCategory(content, lesson.categoryId);
  const backTo = category ? `/aprender/${category.slug}` : '/aprender';

  if (getLessonState(lesson, player) === 'locked') {
    const prerequisite = lesson.prerequisiteId ? findLesson(content, lesson.prerequisiteId) : undefined;
    return (
      <div className="stack">
        <Link to={backTo} className="back-link">
          ← {category?.name ?? 'Aprender'}
        </Link>
        <StateMessage
          icon="🔒"
          title="Conteúdo indisponível por enquanto"
          text={
            <>
              Para acessar “{lesson.title}”, conclua antes “{prerequisite?.title ?? 'o conteúdo anterior'}”. Os
              conteúdos são liberados em sequência para você aprender passo a passo.
            </>
          }
        >
          {prerequisite && (
            <Link to={lessonPath(prerequisite)} className="btn btn--primary">
              Ir para “{prerequisite.title}”
            </Link>
          )}
        </StateMessage>
      </div>
    );
  }

  return (
    <div className="stack">
      <Link to={backTo} className="back-link">
        ← {category?.name ?? 'Aprender'}
      </Link>
      <LessonPlayer key={lesson.id} lesson={lesson} quizHref={quizPathForLesson(content, lesson)} />
    </div>
  );
}
