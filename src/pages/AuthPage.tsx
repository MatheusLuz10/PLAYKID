import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { DemoAuthForm } from '../components/auth/DemoAuthForm';
import { PublicFooter } from '../components/layout/PublicLayout';
import { toAppError } from '../services';
import { useAuth } from '../state/AuthContext';

type Tab = 'entrar' | 'cadastrar';

export function AuthPage() {
  const { status, mode, signIn, signUp } = useAuth();
  const location = useLocation();
  const [params] = useSearchParams();
  const from = (location.state as { from?: string; expired?: boolean } | null)?.from;
  const expired = Boolean((location.state as { expired?: boolean } | null)?.expired);
  const [tab, setTab] = useState<Tab>(params.get('modo') === 'cadastro' ? 'cadastrar' : 'entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Já autenticado: segue para o jogo — de volta para a página que o jogador tentou abrir, quando houver.
  const safeFrom = from && from.startsWith('/') && !from.startsWith('//') ? from : '/inicio';
  if (status === 'signedIn') return <Navigate to={safeFrom} replace />;

  // Demonstração: contas locais deste aparelho, com nome de usuário e senha.
  if (mode === 'demo') {
    return (
      <div className="welcome">
        <div className="welcome__inner">
          <Link to="/" className="logo" aria-label="ECO QUEST — voltar ao início">
            <span className="logo__mark" aria-hidden>
              🌱
            </span>
            <span className="logo__text">
              ECO <span>QUEST</span>
            </span>
          </Link>
          {expired && (
            <div className="banner banner--info" role="status">
              Sua sessão terminou. Entre novamente — seu progresso está salvo.
            </div>
          )}
          <DemoAuthForm initialTab={tab} next={safeFrom} />
          <PublicFooter />
        </div>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (tab === 'entrar') {
        await signIn(email, password);
      } else {
        const { needsConfirmation } = await signUp(email, password);
        if (needsConfirmation) {
          setInfo('Conta criada! Enviamos um link de confirmação para o seu e-mail. Depois de confirmar, é só entrar.');
          setTab('entrar');
        }
      }
    } catch (err) {
      setError(toAppError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="welcome">
      <div className="welcome__inner">
        <Link to="/" className="logo" aria-label="ECO QUEST — voltar ao início">
          <span className="logo__mark" aria-hidden>
            🌱
          </span>
          <span className="logo__text">
            ECO <span>QUEST</span>
          </span>
        </Link>

        <form className="card stack stack--sm auth-card" onSubmit={submit}>
          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'entrar'}
              className={`tabs__tab ${tab === 'entrar' ? 'is-active' : ''}`}
              onClick={() => setTab('entrar')}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'cadastrar'}
              className={`tabs__tab ${tab === 'cadastrar' ? 'is-active' : ''}`}
              onClick={() => setTab('cadastrar')}
            >
              Criar conta
            </button>
          </div>

          {expired && !error && !info && (
            <div className="banner banner--info" role="status">
              Sua sessão expirou. Entre novamente — seu progresso está salvo.
            </div>
          )}
          {info && <div className="banner banner--success" role="status">{info}</div>}
          {error && <div className="banner banner--error" role="alert">{error}</div>}

          <label className="field">
            <span className="field__label">E-mail</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Senha</span>
            <input
              className="input"
              type="password"
              autoComplete={tab === 'entrar' ? 'current-password' : 'new-password'}
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {tab === 'cadastrar' && <span className="muted small">Pelo menos 6 caracteres.</span>}
          </label>

          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
            {busy ? 'Aguarde…' : tab === 'entrar' ? 'Entrar' : 'Criar conta'}
          </button>
          {tab === 'entrar' && (
            <Link to="/recuperar-senha" className="text-link center">
              Esqueci minha senha
            </Link>
          )}
          {tab === 'cadastrar' && (
            <p className="muted small">
              Ao criar a conta, você concorda com os <Link to="/termos">Termos de uso</Link> e a{' '}
              <Link to="/privacidade">Política de privacidade</Link>.
            </p>
          )}
        </form>
        <PublicFooter />
      </div>
    </div>
  );
}
