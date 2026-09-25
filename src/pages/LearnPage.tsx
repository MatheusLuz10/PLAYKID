import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { CategoryCard } from '../components/learning/CategoryCard';
import { LessonCard } from '../components/learning/LessonCard';
import { SearchBox } from '../components/learning/SearchBox';
import { ProgressBar } from '../components/ui/ProgressBar';
import { findLessonToResume, lessonPath } from '../logic/learning';
import type { Lesson } from '../models';
import { useGame } from '../state/GameContext';

export function LearnPage() {
  const { content, player } = useGame();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const resume = findLessonToResume(content, player);
  const resumeProgress = resume ? player.lessons[resume.id] : undefined;
  const favorites = player.favorites
    .map((id) => content.lessons.find((l) => l.id === id))
    .filter((l): l is Lesson => Boolean(l));
  const completed = content.lessons.filter((l) => player.lessons[l.id]?.status === 'completed').length;

  return (
    <div className="stack">
      <PageHeader
        title="📚 Aprender"
        subtitle="Descubra, entenda e depois aja. Cada conteúdo prepara você para um desafio real."
      />

      <SearchBox
        value={query}
        onChange={setQuery}
        onSubmit={(q) => navigate(`/aprender/biblioteca${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)}
      />

      {resume && resumeProgress && (
        <section className="card card--accent resume-strip" aria-labelledby="resume-strip-title">
          <p className="eyebrow">Continue de onde parou</p>
          <h2 id="resume-strip-title" className="card__title">
            {resume.title}
          </h2>
          <div className="next-step__progress">
            <ProgressBar
              value={resumeProgress.progressPercentage}
              label={`Progresso de ${resume.title}`}
              valueText={`${resumeProgress.progressPercentage}% concluído`}
              size="sm"
            />
            <span>
              Parte {resumeProgress.lastSectionIndex + 1} de {resume.sectionCount} · {resumeProgress.progressPercentage}%
            </span>
          </div>
          <Link to={lessonPath(resume)} className="btn btn--primary">
            Continuar
          </Link>
        </section>
      )}

      <section aria-labelledby="categories-title" className="stack stack--sm">
        <div className="section-head">
          <h2 id="categories-title" className="section-title">
            Categorias
          </h2>
          <span className="muted small">
            {completed} de {content.lessons.length} conteúdos concluídos
          </span>
        </div>
        <div className="category-grid">
          {content.categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </section>

      {favorites.length > 0 && (
        <section aria-labelledby="favorites-title" className="stack stack--sm">
          <h2 id="favorites-title" className="section-title">
            ⭐ Seus favoritos
          </h2>
          <div className="lesson-grid">
            {favorites.map((l) => (
              <LessonCard key={l.id} lesson={l} />
            ))}
          </div>
        </section>
      )}

      <Link to="/aprender/biblioteca" className="card library-link">
        <span className="big-icon big-icon--sm" aria-hidden>
          📖
        </span>
        <span>
          <strong>Biblioteca de conteúdos</strong>
          <span className="block muted small">Todos os conteúdos, com filtros por categoria, situação e nível.</span>
        </span>
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
