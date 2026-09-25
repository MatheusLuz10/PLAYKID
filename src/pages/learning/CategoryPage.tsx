import type { CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { LessonCard } from '../../components/learning/LessonCard';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { StateMessage } from '../../components/ui/StateMessage';
import { getCategoryStats, plural } from '../../logic/learning';
import { useGame } from '../../state/GameContext';

export function CategoryPage() {
  const { categorySlug = '' } = useParams();
  const { content, player } = useGame();
  const category = content.categories.find((c) => c.slug === categorySlug);

  if (!category) {
    return (
      <StateMessage icon="🧭" title="Categoria não encontrada" text="Ela pode ter sido removida ou o endereço está incorreto.">
        <Link to="/aprender" className="btn btn--primary">
          Ver categorias
        </Link>
      </StateMessage>
    );
  }

  const lessons = content.lessons
    .filter((l) => l.categoryId === category.id)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const stats = getCategoryStats(content, player, category.id);
  const coveredTopics = new Set(lessons.map((l) => l.topic));
  const upcomingTopics = category.topics.filter((t) => !coveredTopics.has(t));

  return (
    <div className="stack" style={{ '--cat': category.color } as CSSProperties}>
      <PageHeader
        backTo="/aprender"
        backLabel="Aprender"
        title={`${category.icon} ${category.name}`}
        subtitle={category.description}
      />

      <section className="card category-summary" aria-label={`Progresso em ${category.name}`}>
        <div className="category-card__progress">
          <span>
            <strong>{stats.completed}</strong> de {plural(stats.total, 'conteúdo concluído', 'conteúdos concluídos')} ·{' '}
            {stats.percent}%
          </span>
          <ProgressBar value={stats.completed} max={stats.total || 1} label={`Progresso em ${category.name}`} />
        </div>
        <ul className="category-card__stats">
          <li>🔓 {plural(stats.available, 'disponível', 'disponíveis')}</li>
          <li>▶️ {stats.inProgress} em andamento</li>
          <li>🔒 {plural(stats.locked, 'bloqueado', 'bloqueados')}</li>
        </ul>
      </section>

      {lessons.length === 0 ? (
        <StateMessage icon="🌱" title="Conteúdos a caminho" text="Esta categoria ainda não tem conteúdos publicados." />
      ) : (
        <div className="lesson-grid">
          {lessons.map((l) => (
            <LessonCard key={l.id} lesson={l} />
          ))}
        </div>
      )}

      {upcomingTopics.length > 0 && (
        <section className="card card--muted">
          <h2 className="section-title">Próximos temas</h2>
          <div className="chips">
            {upcomingTopics.map((t) => (
              <span key={t} className="chip">
                {t} · em breve
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
