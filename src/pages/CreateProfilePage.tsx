import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ProfileForm } from '../components/player/ProfileForm';
import { useGame } from '../state/GameContext';

export function CreateProfilePage() {
  const { player, actions, mode } = useGame();
  const navigate = useNavigate();

  if (player.profile.displayName) return <Navigate to="/inicio" replace />;

  return (
    <div className="welcome">
      <div className="welcome__inner welcome__inner--left">
        <header className="page-header">
          <p className="eyebrow">Passo final</p>
          <h1 className="page-title">Crie seu perfil</h1>
          <p className="page-subtitle">Como você quer ser chamado(a) no ECO QUEST?</p>
        </header>
        <ProfileForm
          profile={player.profile}
          submitLabel="Criar perfil"
          onSubmit={async (input) => {
            await actions.updateProfile(input);
            navigate('/inicio', { replace: true });
          }}
        />
        {mode === 'demo' && (
          <Link to="/jogadores" className="btn btn--ghost btn--block">
            👥 Entrar em outra conta
          </Link>
        )}
      </div>
    </div>
  );
}
