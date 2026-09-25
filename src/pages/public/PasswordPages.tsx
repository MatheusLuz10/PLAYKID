import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { AppError, authService, toAppError } from '../../services';
import { useAuth } from '../../state/AuthContext';

/** /recuperar-senha — envia o link por e-mail (sem revelar se a conta existe). */
export function RecoverPasswordPage() {
  const { mode } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authService.requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(toAppError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicLayout title="Recuperar senha">
      <div className="card stack stack--sm auth-card public-form">
        <h1 className="section-title">Recuperar senha</h1>
        {mode === 'demo' ? (
          <p className="banner banner--info">
            No modo demonstração não há conta nem senha: o progresso fica neste navegador.
          </p>
        ) : sent ? (
          <p className="banner banner--success" role="status">
            Se houver uma conta com este e-mail, enviamos um link para criar uma nova senha. Confira sua caixa de entrada
            (e o spam).
          </p>
        ) : (
          <form className="stack stack--sm" onSubmit={submit}>
            <p className="muted small">Informe o e-mail da sua conta. Enviaremos um link para criar uma nova senha.</p>
            {error && (
              <div className="banner banner--error" role="alert">
                {error}
              </div>
            )}
            <label className="field">
              <span className="field__label">E-mail</span>
              <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
              {busy ? 'Enviando…' : 'Enviar link'}
            </button>
          </form>
        )}
        <Link to="/entrar" className="text-link">
          ← Voltar para entrar
        </Link>
      </div>
    </PublicLayout>
  );
}

/** /redefinir-senha — aberta pelo link do e-mail (sessão de recuperação). */
export function ResetPasswordPage() {
  const { status, mode } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waited, setWaited] = useState(false);

  // O Supabase lê o token do link e cria a sessão; damos um instante para isso.
  useEffect(() => {
    const t = window.setTimeout(() => setWaited(true), 2500);
    return () => window.clearTimeout(t);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(new AppError('passwords_differ').message);
      return;
    }
    setBusy(true);
    try {
      await authService.updatePassword(password);
      navigate('/inicio', { replace: true });
    } catch (err) {
      setError(toAppError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const invalid = mode === 'supabase' && status !== 'signedIn' && waited;

  return (
    <PublicLayout title="Nova senha">
      <div className="card stack stack--sm auth-card public-form">
        <h1 className="section-title">Criar nova senha</h1>
        {mode === 'demo' ? (
          <p className="banner banner--info">No modo demonstração não há senha para redefinir.</p>
        ) : invalid ? (
          <>
            <p className="banner banner--error" role="alert">
              {new AppError('reset_link_invalid').message}
            </p>
            <Link to="/recuperar-senha" className="btn btn--primary btn--block">
              Pedir um novo link
            </Link>
          </>
        ) : status !== 'signedIn' ? (
          <p className="muted" role="status">
            Validando o link…
          </p>
        ) : (
          <form className="stack stack--sm" onSubmit={submit}>
            {error && (
              <div className="banner banner--error" role="alert">
                {error}
              </div>
            )}
            <label className="field">
              <span className="field__label">Nova senha</span>
              <input className="input" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
              <span className="muted small">Pelo menos 6 caracteres.</span>
            </label>
            <label className="field">
              <span className="field__label">Repita a nova senha</span>
              <input className="input" type="password" autoComplete="new-password" minLength={6} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </label>
            <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
              {busy ? 'Salvando…' : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
    </PublicLayout>
  );
}
