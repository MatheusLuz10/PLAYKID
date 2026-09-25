import { Link, useNavigate } from 'react-router-dom';
import { PublicFooter } from '../components/layout/PublicLayout';
import { WorldScene } from '../components/world/WorldScene';
import { useAuth } from '../state/AuthContext';

export function WelcomePage() {
  const { status, mode } = useAuth();
  const navigate = useNavigate();
  const signedIn = status === 'signedIn';

  // Com sessão: vai ao jogo (o AppShell leva para "Criar perfil" se necessário).
  const start = () => navigate(signedIn ? '/inicio' : '/entrar');

  return (
    <main className="welcome">
      <div className="welcome__inner">
        <h1 className="logo" aria-label="ECO QUEST">
          <span className="logo__mark" aria-hidden>
            🌱
          </span>
          <span className="logo__text">
            ECO <span>QUEST</span>
          </span>
        </h1>
        <p className="welcome__tagline">Aprenda. Faça. Transforme.</p>

        <div className="welcome__world">
          <WorldScene />
        </div>

        <p className="welcome__text">
          Seu pequeno mundo ecológico começa quase vazio. Cada coisa que você aprende e cada ação real que você
          faz ajudam esse mundo a crescer.
        </p>

        <button
          type="button"
          className="btn btn--primary btn--lg btn--block"
          onClick={start}
          disabled={status === 'loading'}
        >
          {signedIn && mode === 'supabase' ? 'Continuar' : 'Começar'}
        </button>
        {mode === 'demo' && (
          <>
            <Link to="/jogadores" className="btn btn--ghost btn--block">
              👥 Contas deste aparelho
            </Link>
            <p className="muted small">🧪 Modo demonstração: o progresso fica só neste navegador.</p>
          </>
        )}
        <PublicFooter />
      </div>
    </main>
  );
}
