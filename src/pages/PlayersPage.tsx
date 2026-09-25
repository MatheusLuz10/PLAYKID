import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { safeImageSrc } from '../logic/safeUrl';
import { DemoAuthError, listDemoPlayers, signInDemoById, type DemoPlayerSummary } from '../services/demoPlayers';
import { useAuth } from '../state/AuthContext';

/**
 * 👥 Contas deste aparelho (modo demonstração). Cada conta tem login próprio:
 * para entrar é preciso a senha dela. A conta de demonstração não tem senha.
 * No Supabase cada jogador é uma conta do servidor, então esta tela leva para "Entrar".
 */
export function PlayersPage() {
  const { mode } = useAuth();
  const [players] = useState(listDemoPlayers);
  const [open, setOpen] = useState<string | null>(null);

  if (mode !== 'demo') return <Navigate to="/entrar" replace />;

  return (
    <main className="welcome">
      <div className="welcome__inner welcome__inner--left">
        <Link to="/" className="logo" aria-label="ECO QUEST — voltar ao início">
          <span className="logo__mark" aria-hidden>
            🌱
          </span>
          <span className="logo__text">
            ECO <span>QUEST</span>
          </span>
        </Link>
        <header className="page-header">
          <p className="eyebrow">Contas deste aparelho</p>
          <h1 className="page-title">👥 Quem vai jogar?</h1>
          <p className="page-subtitle">Cada conta tem a sua senha e a sua própria evolução.</p>
        </header>

        <ul className="list players-list" aria-label="Contas cadastradas">
          {players.map((p) => (
            <PlayerRow key={p.id} player={p} open={open === p.id} onOpen={() => setOpen(open === p.id ? null : p.id)} />
          ))}
        </ul>

        <Link to="/entrar?modo=cadastro" className="btn btn--ghost btn--block">
          ➕ Criar conta nova
        </Link>
        <p className="muted small">
          🧪 Modo demonstração: as contas ficam só neste navegador. Para apagar uma conta, entre nela e use Perfil → Excluir
          minha conta.
        </p>
      </div>
    </main>
  );
}

function PlayerRow({ player: p, open, onOpen }: { player: DemoPlayerSummary; open: boolean; onOpen: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const name = p.showcase ? 'Conta de demonstração' : (p.displayName ?? (p.username ? `@${p.username}` : 'Conta nova'));
  const image = safeImageSrc(p.avatarUrl);
  const needsNewPassword = !p.showcase && !p.hasPassword;

  const enter = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInDemoById(p.id, password, confirm);
      window.location.assign('/inicio');
    } catch (err) {
      setError(err instanceof DemoAuthError ? err.message : 'Não foi possível entrar.');
      setBusy(false);
    }
  };

  return (
    <li className="list__row players-list__row">
      <span className="avatar avatar--lg" aria-hidden>
        {image ? <img className="avatar__image" src={image} alt="" /> : p.showcase ? '🌟' : p.avatar}
      </span>
      <span>
        <strong>{name}</strong>
        <span className="block muted small">
          {p.showcase ? (
            'Sem senha · tudo desbloqueado'
          ) : (
            <>
              {p.username && <>@{p.username} · </>}Nível {p.level} · {p.totalXp.toLocaleString('pt-BR')} XP
            </>
          )}
        </span>
        {p.current && <span className="tag tag--done players-list__tag">Conectada agora</span>}
      </span>
      {p.showcase ? (
        <button type="button" className="btn btn--primary btn--sm" onClick={() => void enter()} disabled={busy}>
          Entrar
        </button>
      ) : (
        <button type="button" className="btn btn--primary btn--sm" aria-expanded={open} onClick={onOpen} aria-label={`Entrar como ${name}`}>
          Entrar
        </button>
      )}
      {open && !p.showcase && (
        <form className="players-list__login" onSubmit={enter}>
          {needsNewPassword && <p className="muted small">Esta conta ainda não tem senha. Crie uma agora para protegê-la.</p>}
          <label className="field">
            <span className="field__label">{needsNewPassword ? 'Nova senha' : `Senha de ${name}`}</span>
            <input
              className="input"
              type="password"
              autoComplete={needsNewPassword ? 'new-password' : 'current-password'}
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {needsNewPassword && (
            <label className="field">
              <span className="field__label">Confirmar senha</span>
              <input className="input" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </label>
          )}
          {error && (
            <p className="banner banner--error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? 'Aguarde…' : needsNewPassword ? 'Criar senha e entrar' : 'Entrar'}
          </button>
        </form>
      )}
    </li>
  );
}
