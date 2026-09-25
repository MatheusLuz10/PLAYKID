import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { CategoryProgress, MyActions, StatsGrid } from '../components/player/EvolutionStats';
import { LevelProgress, XpBreakdown } from '../components/player/LevelProgress';
import { XpHistory } from '../components/player/XpHistory';
import { computeStats, latestAchievement } from '../logic/gamification';
import { useGame } from '../state/GameContext';

/** 📈 Minha evolução: nível, XP por origem, números da jornada, categorias e histórico. */
export function EvolutionPage() {
  const { content, player } = useGame();
  const stats = useMemo(() => computeStats(content, player), [content, player]);
  const last = latestAchievement(content, player);

  return (
    <div className="stack">
      <PageHeader title="📈 Minha evolução" subtitle="Tudo o que você aprendeu e fez no mundo real." backTo="/perfil" backLabel="Perfil" />

      <section className="card" aria-label="Nível e XP">
        <LevelProgress profile={player.profile} levels={content.levels} />
        <XpBreakdown profile={player.profile} />
      </section>

      <section className="card" aria-labelledby="journey-title">
        <h2 className="section-title" id="journey-title">
          Sua jornada
        </h2>
        <StatsGrid stats={stats} achievementsTotal={content.achievements.length} categoriesTotal={content.categories.length} />
        {last && (
          <p className="small last-achievement">
            <span aria-hidden>🏆</span> Última conquista: <strong>{last.title}</strong> ·{' '}
            <Link to="/conquistas" className="text-link">
              ver todas
            </Link>
          </p>
        )}
      </section>

      <MyActions stats={stats} />
      <CategoryProgress stats={stats} />
      <XpHistory />
    </div>
  );
}
