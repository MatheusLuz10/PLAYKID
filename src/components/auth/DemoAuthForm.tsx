import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { createDemoAccount, DemoAuthError, enterShowcase, signInDemo } from '../../services/demoPlayers';

interface DemoAuthFormProps {
  initialTab: 'entrar' | 'cadastrar';
  /** Para onde ir depois de entrar (a página que a pessoa tentou abrir). */
  next: string;
}

/**
 * Login da demonstração: contas deste aparelho, cada uma com nome de usuário e senha.
 * Entrar recarrega a página para o jogo abrir só com os dados da conta escolhida.
 */
export function DemoAuthForm({ initialTab, next }: DemoAuthFormProps) {
  const [tab, setTab] = useState(initialTab);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = useId();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (tab === 'entrar') {
        await signInDemo(username, password);
        window.location.assign(next);
      } else {
        await createDemoAccount(username, password, confirm);
        window.location.assign('/criar-perfil');
      }
    } catch (err) {
      setError(err instanceof DemoAuthError ? err.message : 'Não foi possível entrar. Tente de novo.');
      setBusy(false);
    }
  };

  const switchTab = (t: 'entrar' | 'cadastrar') => {
    setTab(t);
    setError(null);
    setPassword('');
    setConfirm('');
  };

  return (
    <>
      <form className="card stack stack--sm auth-card" onSubmit={submit}>
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'entrar'} className={`tabs__tab ${tab === 'entrar' ? 'is-active' : ''}`} onClick={() => switchTab('entrar')}>
            Entrar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'cadastrar'}
            className={`tabs__tab ${tab === 'cadastrar' ? 'is-active' : ''}`}
            onClick={() => switchTab('cadastrar')}
          >
            Criar conta
          </button>
        </div>

        {error && (
          <div className="banner banner--error" role="alert">
            {error}
          </div>
        )}

        <label className="field">
          <span className="field__label" id={`${ids}-user`}>
            Nome de usuário
          </span>
          <input
            aria-labelledby={`${ids}-user`}
            aria-describedby={tab === 'cadastrar' ? `${ids}-user-hint` : undefined}
            className="input"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={24}
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
          />
          {tab === 'cadastrar' && (
            <span className="muted small" id={`${ids}-user-hint`}>
              3 a 24 letras minúsculas, números ou _ (ex.: ana_eco).
            </span>
          )}
        </label>
        <label className="field">
          <span className="field__label" id={`${ids}-pass`}>
            Senha
          </span>
          <input
            aria-labelledby={`${ids}-pass`}
            aria-describedby={tab === 'cadastrar' ? `${ids}-pass-hint` : undefined}
            className="input"
            type="password"
            autoComplete={tab === 'entrar' ? 'current-password' : 'new-password'}
            minLength={tab === 'cadastrar' ? 6 : undefined}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {tab === 'cadastrar' && (
            <span className="muted small" id={`${ids}-pass-hint`}>
              Pelo menos 6 caracteres. Não use a mesma senha de outros sites.
            </span>
          )}
        </label>
        {tab === 'cadastrar' && (
          <label className="field">
            <span className="field__label">Confirmar senha</span>
            <input className="input" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
        )}

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
          {busy ? 'Aguarde…' : tab === 'entrar' ? 'Entrar' : 'Criar conta'}
        </button>
        {tab === 'cadastrar' && (
          <p className="muted small">
            Ao criar a conta, você concorda com os <Link to="/termos">Termos de uso</Link> e a <Link to="/privacidade">Política de privacidade</Link>.
          </p>
        )}
      </form>

      <div className="card card--muted stack stack--sm auth-card">
        <p className="muted small">
          🧪 Modo demonstração: as contas ficam só neste navegador, cada uma com a sua evolução. A senha não é guardada, só
          um código embaralhado dela.
        </p>
        <Link to="/jogadores" className="btn btn--ghost btn--block">
          👥 Contas deste aparelho
        </Link>
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={() => {
            enterShowcase();
            window.location.assign(next);
          }}
        >
          🌟 Entrar na conta de demonstração (sem senha, tudo desbloqueado)
        </button>
      </div>
    </>
  );
}
