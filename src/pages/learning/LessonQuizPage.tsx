import { Link, Navigate, useParams } from 'react-router-dom';
import { QuizPlayer } from '../../components/quiz/QuizPlayer';
import { StateMessage } from '../../components/ui/StateMessage';
import { findQuizForLesson } from '../../logic/catalog';
import { findLessonBySlug, lessonPath } from '../../logic/learning';
import { useGame } from '../../state/GameContext';

/** Quiz de uma aula (/aula/:slug/quiz). O desafio só é liberado após a aprovação. */
export function LessonQuizPage() {
  const { lessonSlug = '' } = useParams();
  const { content } = useGame();
  const lesson = findLessonBySlug(content, lessonSlug);

  if (!lesson) return <Navigate to="/aprender/biblioteca" replace />;
  const quiz = findQuizForLesson(content, lesson.id);

  return (
    <div className="stack">
      <Link to={lessonPath(lesson)} className="back-link">
        ← {lesson.title}
      </Link>
      {quiz ? (
        <QuizPlayer lesson={lesson} quiz={quiz} reviewHref={lessonPath(lesson)} />
      ) : (
        <StateMessage
          icon="🧠"
          title="Quiz em preparação"
          text={`As perguntas sobre “${lesson.title}” estão sendo preparadas. Assim que o quiz estiver disponível, ele aparecerá aqui.`}
        >
          <Link to="/aprender/biblioteca" className="btn btn--primary">
            Explorar outros conteúdos
          </Link>
        </StateMessage>
      )}
    </div>
  );
}
