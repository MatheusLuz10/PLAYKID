import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { missionPath } from '../../logic/mission';
import type { Lesson, Question } from '../../models';
import type { QuizAttemptResult } from '../../services';
import { useGame } from '../../state/GameContext';
import { LessonCard } from '../learning/LessonCard';

interface QuizResultProps {
  lesson: Lesson;
  questions: Question[];
  result: QuizAttemptResult;
  reviewHref: string;
  onRetry: () => void;
  canRetry: boolean;
  retrying: boolean;
}

/** Tela de resultado — todos os números vêm do servidor (finish_quiz_attempt). */
export function QuizResult({ lesson, questions, result, reviewHref, onRetry, canRetry, retrying }: QuizResultProps) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const wrong = result.review.filter((r) => !r.isCorrect);
  const topics = questions.map((q) => q.topic).filter((t): t is string => Boolean(t));

  return (
    <div className="stack">
      <section className={`card quiz-result ${result.passed ? 'is-passed' : 'is-failed'}`} aria-labelledby="quiz-result-title">
        <span className="quiz-result__badge" aria-hidden>
          {result.passed ? '🎉' : '📚'}
        </span>
        <h1 id="quiz-result-title" className="quiz-result__title" tabIndex={-1}>
          {result.passed ? 'Quiz concluído' : 'Ainda não'}
        </h1>
        {!result.passed && <p className="muted">Você não atingiu a pontuação necessária desta vez.</p>}
        <p className="quiz-result__score" aria-label={`Nota: ${result.score}%`}>
          {result.score}%
        </p>
        <p>
          Você acertou{' '}
          <strong>
            {result.correctAnswers} de {result.totalQuestions} perguntas
          </strong>
        </p>

        <dl className="facts facts--2 quiz-result__facts">
          <div>
            <dt>Resultado</dt>
            <dd>
              {result.passed ? '🧠 Conhecimento adquirido' : `Mínimo: ${result.passingScore}%`}
              {result.passed && (
                <span className="block quiz-result__xp">
                  {result.xpAwarded > 0 ? `+${result.xpAwarded} XP` : 'XP já recebido na primeira aprovação'}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd className={result.passed ? 'text-success' : 'text-warning'}>
              {result.passed ? '✅ APROVADO' : '🔁 NÃO APROVADO'}
            </dd>
          </div>
        </dl>
        <p className="muted small">Tentativa {result.attemptNumber}</p>
      </section>

      {result.passed ? (
        <>
          {topics.length > 0 && (
            <section className="card" aria-labelledby="learned-title">
              <h2 id="learned-title" className="section-title">
                📚 O que você aprendeu
              </h2>
              <ul className="lesson-summary__list">
                {topics.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          )}

          {result.challengeUnlocked ? (
            <section className="card quiz-unlock challenge-unlocked" aria-labelledby="challenge-unlocked-title">
              <span className="big-icon" aria-hidden>
                🎯
              </span>
              <h2 id="challenge-unlocked-title" className="quiz-unlock__title">
                Desafio desbloqueado
              </h2>
              <p className="muted">
                Agora que você aprendeu {lesson.topic ? `sobre ${lesson.topic.toLowerCase()}` : 'o conteúdo'} e demonstrou
                seu conhecimento, está pronto para colocar o aprendizado em prática.
              </p>
              <p className="challenge-unlocked__name">
                <span aria-hidden>{result.challengeUnlocked.icon}</span> {result.challengeUnlocked.title}
              </p>
              <Link to={missionPath(result.challengeUnlocked.slug, 'desafio')} className="btn btn--primary btn--lg">
                Ir para o desafio
              </Link>
            </section>
          ) : (
            <section className="card center stack stack--sm">
              <p>
                🧠 <strong>{lesson.topic ?? lesson.title}</strong> — conhecimento dominado.
              </p>
              <Link to="/aprender/biblioteca" className="btn btn--primary">
                Explorar outros conteúdos
              </Link>
            </section>
          )}
        </>
      ) : (
        <>
          {wrong.length > 0 && (
            <section className="card" aria-labelledby="review-title">
              <h2 id="review-title" className="section-title">
                Perguntas para revisar
              </h2>
              <ol className="review-list">
                {wrong.map((r) => {
                  const q = byId.get(r.questionId);
                  const chosen = q?.options.find((o) => o.id === r.selectedOptionId);
                  const correct = q?.options.find((o) => o.id === r.correctOptionId);
                  return (
                    <li key={r.questionId} className="review-list__item">
                      <strong>{q?.prompt}</strong>
                      <p>
                        <span className="review-list__label">✕ Sua resposta:</span> {chosen?.text}
                      </p>
                      <p>
                        <span className="review-list__label">✓ Resposta correta:</span> {correct?.text}
                      </p>
                      {r.optionFeedback && <p className="muted">{r.optionFeedback}</p>}
                      {r.explanation && <p className="review-list__explanation">💡 {r.explanation}</p>}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
          <RelatedToReview lessonId={lesson.id} />
          <div className="actions">
            <Link to={reviewHref} className="btn btn--ghost">
              📖 Revisar conteúdo
            </Link>
            {canRetry ? (
              <button type="button" className="btn btn--primary" onClick={onRetry} disabled={retrying}>
                🔁 Tentar novamente
              </button>
            ) : (
              <p className="muted small">Você usou todas as tentativas deste quiz.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Conteúdos relacionados à aula (usa o cache de detalhes da aula). */
function RelatedToReview({ lessonId }: { lessonId: string }) {
  const { content, actions } = useGame();
  const [ids, setIds] = useState<string[]>([]);
  const { loadLessonDetail } = actions;
  useEffect(() => {
    let active = true;
    loadLessonDetail(lessonId)
      .then((d) => active && setIds(d.relatedIds.slice(0, 2)))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [lessonId, loadLessonDetail]);
  const related = ids.map((id) => content.lessons.find((l) => l.id === id)).filter((l): l is Lesson => Boolean(l));
  if (related.length === 0) return null;
  return (
    <section aria-labelledby="related-review-title">
      <h2 id="related-review-title" className="section-title">
        📚 Conteúdos relacionados
      </h2>
      <div className="lesson-grid">
        {related.map((l) => (
          <LessonCard key={l.id} lesson={l} />
        ))}
      </div>
    </section>
  );
}
