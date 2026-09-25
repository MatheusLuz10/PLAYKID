import { achievementCategoryLabels, type AchievementProgress } from '../../logic/gamification';
import { formatDate } from '../../logic/dates';
import type { Achievement } from '../../models';
import { ProgressBar } from '../ui/ProgressBar';

interface AchievementCardProps {
  achievement: Achievement;
  unlockedAt: string | null;
  progress: AchievementProgress;
}

export function AchievementCard({ achievement, unlockedAt, progress }: AchievementCardProps) {
  const unlocked = unlockedAt !== null;
  const category = achievementCategoryLabels[achievement.category];
  return (
    <article className={`achievement ${unlocked ? 'is-unlocked' : 'is-locked'}`}>
      <span className="achievement__icon" aria-hidden>
        {achievement.icon}
        {!unlocked && <span className="achievement__lock">🔒</span>}
      </span>
      <div className="achievement__body">
        <span className="achievement__meta">
          <span className="tag">
            <span aria-hidden>{category.icon}</span> {category.label}
          </span>
          {achievement.xpReward > 0 && <span className="tag tag--xp">+{achievement.xpReward} XP</span>}
        </span>
        <h3 className="achievement__title">{achievement.title}</h3>
        <p className="achievement__desc">{achievement.description}</p>
        {unlocked ? (
          <p className="achievement__status">✓ Desbloqueada em {formatDate(unlockedAt)}</p>
        ) : (
          <div className="achievement__progress">
            <span className="small">
              <strong>{progress.label}</strong>
            </span>
            <ProgressBar
              value={progress.current}
              max={progress.target}
              label={`Progresso de ${achievement.title}`}
              valueText={progress.label}
              tone="sun"
              size="sm"
            />
            <span className="small muted">{progress.hint}</span>
          </div>
        )}
      </div>
      <span className="sr-only">{unlocked ? 'Conquista desbloqueada' : 'Conquista bloqueada'}</span>
    </article>
  );
}
