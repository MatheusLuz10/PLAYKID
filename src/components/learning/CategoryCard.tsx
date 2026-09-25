import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { getCategoryStats, plural } from '../../logic/learning';
import type { Category } from '../../models';
import { useGame } from '../../state/GameContext';
import { ProgressBar } from '../ui/ProgressBar';

export function CategoryCard({ category }: { category: Category }) {
  const { content, player } = useGame();
  const stats = getCategoryStats(content, player, category.id);

  return (
    <Link
      to={`/aprender/${category.slug}`}
      className="category-card"
      style={{ '--cat': category.color } as CSSProperties}
    >
      <div className="category__head">
        <span className="category__icon" aria-hidden>
          {category.icon}
        </span>
        <div>
          <h2 className="category__name">{category.name}</h2>
          <p className="category__desc">{category.description}</p>
        </div>
      </div>

      <div className="category-card__progress">
        <span>
          {stats.completed} de {plural(stats.total, 'conteúdo concluído', 'conteúdos concluídos')}
        </span>
        <ProgressBar value={stats.completed} max={stats.total || 1} label={`Progresso em ${category.name}`} size="sm" />
      </div>

      <ul className="category-card__stats" aria-label={`Resumo de ${category.name}`}>
        <li>📚 {plural(stats.total, 'conteúdo', 'conteúdos')}</li>
        <li>🔓 {plural(stats.available, 'disponível', 'disponíveis')}</li>
        {stats.inProgress > 0 && <li>▶️ {stats.inProgress} em andamento</li>}
        {stats.locked > 0 && <li>🔒 {plural(stats.locked, 'bloqueado', 'bloqueados')}</li>}
      </ul>
    </Link>
  );
}
