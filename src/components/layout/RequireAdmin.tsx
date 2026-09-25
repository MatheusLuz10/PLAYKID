import { Link, Outlet } from 'react-router-dom';
import { useGame } from '../../state/GameContext';
import { StateMessage } from '../ui/StateMessage';

/**
 * Área /admin: só para quem tem profiles.role = 'admin'.
 * Isto só esconde a tela — a proteção real está no servidor: TODA função de
 * administração confere o papel (require_admin) e as políticas RLS também.
 */
export function RequireAdmin() {
  const { player } = useGame();
  if (player.profile.role !== 'admin') {
    return (
      <StateMessage icon="🔐" title="Acesso restrito" text="Esta área é só para administradores do ECO QUEST." role="alert">
        <Link to="/inicio" className="btn btn--primary">
          Voltar ao início
        </Link>
      </StateMessage>
    );
  }
  return <Outlet />;
}
