import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingMessage } from '../components/ui/StateMessage';
import { quizPathForLesson } from '../logic/learning';
import type { QuizAttemptRecord } from '../models';
import { useGame } from '../state/GameContext';

type Knowledge = 'mastered' | 'studying' | 'not_evaluated';

const knowledgeLabels: Record<Knowledge, string> = {
  mastered: '✅ Dominado',
  studying: '📚 Em estudo',
  not_evaluated: '○ Ainda não avaliado',
};

/** 🧠 Meu desempenho + 🧠 Conhecimentos (a partir dos quizzes e tentativas reais). */
export function PerformancePage() {
  const { content, player, actions } = useGame();
  const [attempts, setAttempts] = useState<(QuizAttemptRecord & { quizId: string })[] | null>(null);
  const { listQuizAttempts } = actions;

  useEffect(() => {
    let alive = true;
    listQuizAttempts().then((list) => alive && setAttempts(list ?? []));
    return () => {
      alive = false;
    };
  }, [listQuizAttempts]);

  const rows = content.quizzes
    .map((quiz) => {
      const lesson = content.lessons.find((l) => l.id === quiz.lessonId);
      const category = lesson ? content.categories.find((c) => c.id === lesson.categoryId) : undefined;
      const summary = player.quizzes[quiz.id];
      const completed = (attempts ?? [])
        .filter((a) => a.quizId === quiz.id && a.status === 'completed')
        .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
      const knowledge: Knowledge = summary?.passed ? 'mastered' : summary ? 'studying' : 'not_evaluated';
      return { quiz, lesson, category, summary, last: completed[0], knowledge };
    })
    .filter((r) => r.lesson);

  const done = rows.filter((r) => r.summary);
  const passed = rows.filter((r) => r.summary?.passed).length;
  const totalAttempts = done.reduce((sum, r) => sum + (r.summary?.attempts ?? 0), 0);

  return (
    <div className="stack">
      <PageHeader backTo="/perfil" backLabel="Perfil" title="🧠 Meu desempenho" subtitle="Seus quizzes, tentativas e conhecimentos." />

      <dl className="stats stats--3">
        <div>
          <dt>Quizzes realizados</dt>
          <dd>{done.length}</dd>
        </div>
        <div>
          <dt>Aprovados</dt>
          <dd>{passed}</dd>
        </div>
        <div>
          <dt>Tentativas</dt>
          <dd>{totalAttempts}</dd>
        </div>
      </dl>

      <section className="card" aria-labelledby="perf-title">
        <h2 id="perf-title" className="section-title">
          Quizzes realizados
        </h2>
        {attempts === null ? (
          <LoadingMessage text="Carregando seu histórico…" />
        ) : done.length === 0 ? (
          <p className="empty">Você ainda não fez nenhum quiz. Conclua uma aula para liberar o primeiro.</p>
        ) : (
          <ul className="perf-list">
            {done.map(({ quiz, lesson, category, summary, last }) => (
              <li key={quiz.id} className="perf-list__item">
                <div className="perf-list__head">
                  <strong>
                    <span aria-hidden>{category?.icon}</span> {lesson!.topic ?? lesson!.title}
                  </strong>
                  <span className={`tag ${summary!.passed ? 'tag--done' : 'tag--status-in_progress'}`}>
                    {summary!.passed ? 'APROVADO' : 'NÃO APROVADO'}
                  </span>
                </div>
                <p className="muted small">{lesson!.title}</p>
                <dl className="perf-list__facts">
                  <div>
                    <dt>Melhor resultado</dt>
                    <dd>{summary!.score}%</dd>
                  </div>
                  <div>
                    <dt>Último resultado</dt>
                    <dd>{last ? `${last.score}%` : '—'}</dd>
                  </div>
                  <div>
                    <dt>Tentativas</dt>
                    <dd>{summary!.attempts}</dd>
                  </div>
                </dl>
                <Link to={quizPathForLesson(content, lesson!)} className="text-link">
                  {summary!.passed ? 'Refazer quiz →' : 'Tentar novamente →'}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="knowledge-title">
        <h2 id="knowledge-title" className="section-title">
          🧠 Conhecimentos
        </h2>
        <ul className="knowledge-list">
          {rows.map(({ quiz, lesson, category, knowledge }) => (
            <li key={quiz.id} className={`knowledge-list__item is-${knowledge}`}>
              <span aria-hidden>{category?.icon}</span>
              <span className="knowledge-list__name">{lesson!.topic ?? lesson!.title}</span>
              <span className="knowledge-list__status">{knowledgeLabels[knowledge]}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
