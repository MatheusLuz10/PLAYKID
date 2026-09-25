import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authService, backend, isSupabaseConfigured, SESSION_EXPIRED_EVENT } from '../services';
import { sessionPlayerId, signOutDemo } from '../services/demoPlayers';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  mode: 'demo' | 'supabase';
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  /** A sessão caiu no meio do uso (token expirado/revogado). */
  sessionExpired: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Na demonstração o login é local (contas deste aparelho): entrar e sair recarregam a página.
  const [demoSession] = useState(() => (isSupabaseConfigured ? null : sessionPlayerId()));
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? 'loading' : demoSession ? 'signedIn' : 'signedOut');
  const [userId, setUserId] = useState<string | null>(isSupabaseConfigured ? null : demoSession);
  const [email, setEmail] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    const apply = (session: Awaited<ReturnType<typeof authService.getSession>>) => {
      if (!active) return;
      setUserId(session?.user.id ?? null);
      setEmail(session?.user.email ?? null);
      setStatus(session ? 'signedIn' : 'signedOut');
      if (session) setSessionExpired(false);
    };
    authService.getSession().then(apply);
    const unsubscribe = authService.onChange(apply);
    // O servidor recusou o token: encerra a sessão local e volta para "Entrar".
    const onExpired = () => {
      setSessionExpired(true);
      void authService.clearLocalSession();
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      mode: backend.mode,
      status,
      userId,
      email,
      sessionExpired,
      signIn: authService.signIn,
      signUp: authService.signUp,
      signOut: isSupabaseConfigured
        ? authService.signOut
        : async () => {
            signOutDemo();
            window.location.assign('/');
          },
    }),
    [status, userId, email, sessionExpired],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
