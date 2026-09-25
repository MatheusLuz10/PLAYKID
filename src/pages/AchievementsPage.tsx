import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AchievementCard } from '../components/achievements/AchievementCard';
import { PageHeader } from '../components/layout/PageHeader';
import { ProgressBar } from '../components/ui/ProgressBar';
import { achievementCategoryLabels, achievementProgress, computeStats } from '../logic/gamification';
import type { AchievementCategory } from '../models';
import { useGame } from '../state/GameContext';

export function AchievementsPage() {
  const { content, player } = useGame();
  const [params, setParams] = useSearchParams();
  const filter = params.get('categoria') as AchievementCategory | null;

  const stats = useMemo(() => computeStats(content, player), [content, player]);
  const unlockedAt = new Map(player.achievements.map((a) => [a.achievementId, a.unlockedAt]));
  const all = content.achievements;
  const unlockedCount = all.filter((a) => unlockedAt.has(a.id)).length;
  const categories = (Object.keys(achievementCategoryLabels) as AchievementCategory[]).filter((c) =>
    all.some((a) => a.category === c),
  );

  const visible = all.filter((a) => !filter || a.category === filter);
  const unlocked = visible
    .filter((a) => unlockedAt.has(a.id))
    .sort((a, b) => unlockedAt.get(b.id)!.localeCompare(unlockedAt.get(a.id)!));
  const locked = visible.filter((a) => !unlockedAt.has(a.id));

  const render = (list: typeof all) => (
    <div className="achievements">
      {list.map((a) => (
        <AchievementCard
          key={a.id}
          achievement={a}
          unlockedAt={unlockedAt.get(a.id) ?? null}
          progress={achievementProgress(a, content, player, stats)}
        />
      ))}
    </div>
  );

  return (
    <div className="stack">
      <PageHeader title="🏆 Conquistas" subtitle={`${unlockedCount} de ${all.length} desbloqueadas`} />
      <ProgressBar
        value={unlockedCount}
        max={all.length}
        label="Conquistas desbloqueadas"
        valueText={`${unlockedCount} de ${all.length} conquistas`}
        tone="sun"
      />

      <div className="filter-group" role="group" aria-label="Filtrar conquistas por categoria">
        <button type="button" className={`filter-chip ${!filter ? 'is-active' : ''}`} aria-pressed={!filter} onClick={() => setParams({})}>
          Todas
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className={`filter-chip ${filter === c ? 'is-active' : ''}`}
            aria-pressed={filter === c}
            onClick={() => setParams(filter === c ? {} : { categoria: c })}
          >
            <span aria-hidden>{achievementCategoryLabels[c].icon}</span> {achievementCategoryLabels[c].label}
          </button>
        ))}
      </div>

      <section className="stack" aria-labelledby="ach-unlocked">
        <h2 className="section-title" id="ach-unlocked">
          ✨ Desbloqueadas <span className="muted">({unlocked.length})</span>
        </h2>
        {unlocked.length ? render(unlocked) : <p className="empty">Nenhuma conquista desbloqueada nesta categoria ainda.</p>}
      </section>

      <section className="stack" aria-labelledby="ach-locked">
        <h2 className="section-title" id="ach-locked">
          🔒 Bloqueadas <span className="muted">({locked.length})</span>
        </h2>
        {locked.length ? render(locked) : <p className="empty">Você desbloqueou todas as conquistas desta categoria!</p>}
      </section>
    </div>
  );
}
