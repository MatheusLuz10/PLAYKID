import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../state/AuthContext';
import { GameProvider } from '../../state/GameContext';

/**
 * Área autenticada: exige sessão e carrega os dados do jogador.
 * O GameProvider é recriado quando o usuário muda (key), evitando misturar dados.
 */
export function RequireAuth() {
  const { status, userId, sessionExpired } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="screen-center" role="status">
        <span className="big-icon" aria-hidden>
          🌱
        </span>
        <p className="muted">Carregando…</p>
      </div>
    );
  }
  // Guarda para onde o jogador ia: depois de entrar, ele volta para lá.
  if (status === 'signedOut')
    return <Navigate to="/entrar" replace state={{ from: location.pathname, expired: sessionExpired }} />;

  return (
    <GameProvider key={userId}>
      <Outlet />
    </GameProvider>
  );
}
