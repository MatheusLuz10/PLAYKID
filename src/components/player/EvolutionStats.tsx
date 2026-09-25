import type { PlayerStats } from '../../logic/gamification';
import { ProgressBar } from '../ui/ProgressBar';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Contadores reais da jornada. */
export function StatsGrid({ stats, achievementsTotal, categoriesTotal }: { stats: PlayerStats; achievementsTotal: number; categoriesTotal: number }) {
  const items = [
    { icon: '📚', label: plural(stats.lessonsCompleted, 'Lição concluída', 'Lições concluídas'), value: stats.lessonsCompleted },
    { icon: '🧠', label: plural(stats.quizzesPassed, 'Quiz aprovado', 'Quizzes aprovados'), value: stats.quizzesPassed },
    { icon: '🎯', label: plural(stats.challengesCompleted, 'Desafio concluído', 'Desafios concluídos'), value: stats.challengesCompleted },
    { icon: '📅', label: plural(stats.followupsCompleted, 'Acompanhamento', 'Acompanhamentos'), value: stats.followupsCompleted },
    { icon: '🏆', label: 'Conquistas', value: `${stats.achievementsUnlocked}/${achievementsTotal}` },
    { icon: '🧭', label: 'Categorias exploradas', value: `${stats.categoriesExplored}/${categoriesTotal}` },
  ];
  return (
    <dl className="stats stats--6">
      {items.map((i) => (
        <div key={i.label}>
          <dt>
            <span aria-hidden>{i.icon}</span> {i.label}
          </dt>
          <dd>{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 🌎 Minhas ações: desafios concluídos + acompanhamentos realizados, por categoria. */
export function MyActions({ stats }: { stats: PlayerStats }) {
  return (
    <section className="card" aria-labelledby="my-actions-title">
      <h2 className="section-title" id="my-actions-title">
        🌎 Minhas ações
      </h2>
      <p className="muted small">Desafios concluídos e acompanhamentos registrados por você.</p>
      <ul className="my-actions">
        {stats.byCategory.map((c) => (
          <li key={c.category.id} className="my-actions__item" style={{ ['--cat' as string]: c.category.color }}>
            <span className="my-actions__icon" aria-hidden>
              {c.category.icon}
            </span>
            <span className="my-actions__name">{c.category.name}</span>
            <strong className="my-actions__value">
              {c.actions} <span className="sr-only">{plural(c.actions, 'ação', 'ações')}</span>
            </strong>
          </li>
        ))}
      </ul>
      <p className="small muted">
        Total: <strong>{stats.actions}</strong> {plural(stats.actions, 'ação realizada', 'ações realizadas')}
      </p>
    </section>
  );
}

/** Evolução por categoria (desafios concluídos de cada tema). */
export function CategoryProgress({ stats }: { stats: PlayerStats }) {
  return (
    <section className="card" aria-labelledby="cat-progress-title">
      <h2 className="section-title" id="cat-progress-title">
        🗺️ Categorias
      </h2>
      <ul className="category-progress">
        {stats.byCategory.map((c) => (
          <li key={c.category.id}>
            <div className="category-progress__head">
              <span>
                <span aria-hidden>{c.category.icon}</span> <strong>{c.category.name}</strong>
                {c.explored && <span className="tag tag--done category-progress__tag">Explorada</span>}
              </span>
              <span className="small muted">
                {c.challengesCompleted}/{c.challengesTotal} {plural(c.challengesTotal, 'desafio', 'desafios')} ·{' '}
                {c.lessonsCompleted} {plural(c.lessonsCompleted, 'lição', 'lições')}
              </span>
            </div>
            <ProgressBar
              value={c.challengesCompleted}
              max={Math.max(c.challengesTotal, 1)}
              label={`Desafios de ${c.category.name}`}
              valueText={`${c.challengesCompleted} de ${c.challengesTotal} desafios concluídos`}
              size="sm"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
