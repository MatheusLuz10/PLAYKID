import { Link } from 'react-router-dom';
import { useMission } from '../../hooks/useMission';
import { challengeRewards } from '../../logic/catalog';
import { missionPath } from '../../logic/mission';

export function RewardPage() {
  const mission = useMission()!;
  const { challenge, content, lastCompletion } = mission;

  // Logo após concluir: o que o servidor realmente entregou.
  // Em visitas posteriores: as recompensas previstas pelo desafio.
  const fresh = lastCompletion?.challengeId === challenge.id ? lastCompletion : null;
  const planned = challengeRewards(content, challenge);
  const xp = fresh ? fresh.xpAwarded : challenge.xpReward;
  // Itens do mundo: definição completa (ícone, tipo) vinda do catálogo.
  const worldItems = (fresh ? fresh.worldItems : planned.worldItems)
    .map((w) => content.worldItems.find((x) => x.id === w.id))
    .filter((w) => w !== undefined);
  const achievements = fresh
    ? fresh.achievements.map((a) => ({ id: a.id, icon: a.icon, title: a.name }))
    : planned.achievements.map((a) => ({ id: a.id, icon: a.icon, title: a.title }));

  return (
    <div className="reward card center">
      <span className="reward__burst" aria-hidden>
        🎉
      </span>
      <h1 className="reward__title">Desafio concluído</h1>
      <p className="muted">Você transformou conhecimento em ação real.</p>

      <ul className="reward__list">
        <li className="reward__item reward__item--xp">
          <span aria-hidden>⭐</span>
          <strong>+{xp} XP</strong>
        </li>
        {worldItems.map((item) => (
          <li key={item.id} className="reward__item">
            <span aria-hidden>{item.icon}</span>
            <span>
              <strong>{item.itemType === 'tree' ? 'Nova árvore desbloqueada' : 'Novo elemento no seu mundo'}</strong>
              <span className="block muted small">“{item.name}” já está no seu mundo.</span>
            </span>
          </li>
        ))}
        {achievements.map((a) => (
          <li key={a.id} className="reward__item">
            <span aria-hidden>🏆</span>
            <span>
              <span className="block muted small">Conquista desbloqueada:</span>
              <strong>
                {a.icon} “{a.title}”
              </strong>
            </span>
          </li>
        ))}
      </ul>

      <Link to="/mundo" className="btn btn--primary btn--lg btn--block">
        Ver meu mundo 🌎
      </Link>
      <Link to={missionPath(challenge.slug, 'acompanhar')} className="btn btn--ghost btn--block">
        Continuar acompanhamento
      </Link>
    </div>
  );
}
