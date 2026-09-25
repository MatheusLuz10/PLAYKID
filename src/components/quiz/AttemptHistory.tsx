import { formatDate } from '../../logic/dates';
import type { QuizAttemptRecord } from '../../models';

const statusText = (a: QuizAttemptRecord) =>
  a.status === 'abandoned' ? 'Não concluída' : a.status === 'started' ? 'Em andamento' : a.passed ? '✅ Aprovado' : 'Não aprovado';

/** Histórico de tentativas (cada tentativa fica registrada separadamente). */
export function AttemptHistory({ attempts }: { attempts: QuizAttemptRecord[] }) {
  if (attempts.length === 0) return null;
  return (
    <section className="card" aria-labelledby="attempts-title">
      <h2 id="attempts-title" className="section-title">
        Suas tentativas
      </h2>
      <ol className="attempt-list">
        {[...attempts]
          .sort((a, b) => b.number - a.number)
          .map((a) => (
            <li key={a.id} className={`attempt-list__item is-${a.status === 'completed' ? (a.passed ? 'passed' : 'failed') : a.status}`}>
              <span className="attempt-list__number">Tentativa {a.number}</span>
              <span className="attempt-list__score">{a.status === 'completed' ? `${a.score}%` : '—'}</span>
              <span className="attempt-list__status">{statusText(a)}</span>
              <span className="muted small attempt-list__date">{formatDate(a.completedAt ?? a.startedAt)}</span>
            </li>
          ))}
      </ol>
    </section>
  );
}
