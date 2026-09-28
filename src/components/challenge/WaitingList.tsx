import { Link } from 'react-router-dom';
import { nextAction } from '../../logic/challenges';
import { missionPath } from '../../logic/mission';
import type { Challenge } from '../../models';
import { useGame } from '../../state/GameContext';

/** 🌱 Desafios feitos que só aguardam a data do acompanhamento: uma linha cada, sem ocupar a tela. */
export function WaitingList({ challenges }: { challenges: Challenge[] }) {
  const { player } = useGame();
  if (challenges.length === 0) return null;
  return (
    <ul className="waiting-list">
      {challenges.map((c) => {
        const action = nextAction(c, player.challenges[c.id], player);
        return (
          <li key={c.id} className="waiting-list__row">
            <span className="waiting-list__icon" aria-hidden>
              {c.icon}
            </span>
            <span className="waiting-list__text">
              <strong>{c.title}</strong>
              {action && (
                <span className="block small muted">
                  {action.icon} {action.text}
                </span>
              )}
            </span>
            <Link to={missionPath(c.slug, 'acompanhar')} className="text-link small" aria-label={`Ver acompanhamento: ${c.title}`}>
              Ver
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
