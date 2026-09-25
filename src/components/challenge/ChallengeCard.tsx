import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { difficultyLabels, findCategory } from '../../logic/catalog';
import { challengeStatusLabels, getChallengeState, nextAction, requirementText } from '../../logic/challenges';
import { missionPath, type MissionStep } from '../../logic/mission';
import type { Challenge, ChallengeStatus } from '../../models';
import { useGame } from '../../state/GameContext';
import { ProgressBar } from '../ui/ProgressBar';

const ctaByStatus: Record<ChallengeStatus, { label: string; step: MissionStep }> = {
  locked: { label: 'Ver requisitos', step: 'desafio' },
  available: { label: 'Ver desafio', step: 'desafio' },
  accepted: { label: 'Começar', step: 'comprovar' },
  in_progress: { label: 'Continuar', step: 'comprovar' },
  waiting_follow_up: { label: 'Ver acompanhamento', step: 'acompanhar' },
  completed: { label: 'Ver desafio', step: 'desafio' },
  expired: { label: 'Ver opções', step: 'comprovar' },
};

/** Card do desafio: ícone, nome, categoria, dificuldade, duração, XP, status, progresso e ação. */
export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const { content, player } = useGame();
  const status = getChallengeState(content, challenge, player);
  const category = findCategory(content, challenge.categoryId);
  const uc = player.challenges[challenge.id];
  const action = nextAction(challenge, uc, player);
  const cta = ctaByStatus[status];
  const titleId = `challenge-${challenge.id}-title`;

  return (
    <article
      className={`challenge-card is-${status}`}
      style={{ '--cat': category?.color ?? 'var(--primary)' } as CSSProperties}
      aria-labelledby={titleId}
    >
      <div className="challenge-card__icon" aria-hidden>
        {challenge.icon}
      </div>
      <div className="challenge-card__body">
        <div className="challenge-card__tags">
          {category && (
            <span className="tag tag--muted">
              {category.icon} {category.name}
            </span>
          )}
          <span className={`tag tag--status-${status}`}>{challengeStatusLabels[status]}</span>
        </div>
        <h3 id={titleId} className="challenge-card__title">
          {challenge.title}
        </h3>
        <p className="challenge-card__meta">
          <span>🎯 {difficultyLabels[challenge.difficulty]}</span>
          {challenge.durationLabel && <span>⏱️ {challenge.durationLabel}</span>}
          <span>⭐ +{challenge.xpReward} XP</span>
        </p>

        {uc && status !== 'completed' && (
          <div className="challenge-card__progress">
            <span className="small">Progresso: {uc.progressPercentage}%</span>
            <ProgressBar value={uc.progressPercentage} label={`Progresso de ${challenge.title}`} size="sm" />
          </div>
        )}
        {status === 'locked' && <p className="challenge-card__requirement">🔒 {requirementText(content, challenge)}</p>}
        {action && <p className="challenge-card__next">Próxima ação: {action.icon} {action.text}</p>}
        {status === 'completed' && <p className="challenge-card__next">🏆 Recompensa recebida</p>}

        <Link
          to={missionPath(challenge.slug, cta.step)}
          className={`btn btn--sm ${status === 'locked' || status === 'completed' ? 'btn--ghost' : 'btn--primary'}`}
          aria-label={`${cta.label}: ${challenge.title}`}
        >
          {cta.label}
        </Link>
      </div>
    </article>
  );
}
