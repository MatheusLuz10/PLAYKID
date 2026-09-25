import { Link } from 'react-router-dom';
import type { Lesson, LessonDetail } from '../../models';
import type { ActionResult } from '../../services';
import { useGame } from '../../state/GameContext';
import { LessonCard } from './LessonCard';

interface LessonSummaryProps {
  lesson: Lesson;
  detail: LessonDetail;
  /** Resultado da conclusão agora (null quando a aula já estava concluída). */
  result: ActionResult | null;
  quizHref: string;
  onReview: () => void;
}

/** 🎓 Você aprendeu → XP → conteúdo concluído → quiz liberado → relacionados. */
export function LessonSummary({ lesson, detail, result, quizHref, onReview }: LessonSummaryProps) {
  const { content } = useGame();
  const related = detail.relatedIds
    .map((id) => content.lessons.find((l) => l.id === id))
    .filter((l): l is Lesson => Boolean(l));

  return (
    <div className="stack">
      <section className="card lesson-summary" aria-labelledby="summary-title">
        <span className="lesson-summary__badge" aria-hidden>
          🎓
        </span>
        <h2 id="summary-title" className="lesson-summary__title" tabIndex={-1}>
          Você aprendeu
        </h2>
        <ul className="lesson-summary__list">
          {detail.summaryPoints.map((p) => (
            <li key={p.text}>
              <span aria-hidden>{p.icon}</span>
              <span>{p.text}</span>
            </li>
          ))}
        </ul>
        <div className="lesson-summary__reward" aria-live="polite">
          {result && result.xpAwarded > 0 ? (
            <p className="xp-pill">⭐ +{result.xpAwarded} XP de conhecimento</p>
          ) : (
            <p className="muted small">Você já tinha concluído esta aula — o XP foi registrado na primeira vez.</p>
          )}
          <p className="status-pill status-pill--done">✅ Conteúdo concluído</p>
        </div>
      </section>

      <section className="card quiz-unlock" aria-labelledby="quiz-unlock-title">
        <span className="big-icon big-icon--sm" aria-hidden>
          🧠
        </span>
        <h2 id="quiz-unlock-title" className="quiz-unlock__title">
          Seu conhecimento será testado
        </h2>
        <p className="muted">
          Você concluiu a aula. Agora responda algumas perguntas para verificar o que aprendeu.
        </p>
        <Link to={quizHref} className="btn btn--primary btn--lg">
          Fazer quiz
        </Link>
      </section>

      {related.length > 0 && (
        <section aria-labelledby="related-title">
          <h2 id="related-title" className="section-title">
            📚 Você também pode aprender
          </h2>
          <div className="lesson-grid">
            {related.map((l) => (
              <LessonCard key={l.id} lesson={l} />
            ))}
          </div>
        </section>
      )}

      <div className="actions">
        <button type="button" className="btn btn--ghost" onClick={onReview}>
          ↺ Revisar a aula
        </button>
        <Link to="/aprender" className="btn btn--ghost">
          Voltar para Aprender
        </Link>
      </div>
      <span className="sr-only">{lesson.title} concluída.</span>
    </div>
  );
}
