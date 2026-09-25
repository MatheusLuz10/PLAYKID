import type { Session } from '@supabase/supabase-js';
import { toAppError } from './errors';
import { supabase } from './supabaseClient';

/** Autenticação por e-mail e senha (Supabase Auth). */
export const authService = {
  async getSession(): Promise<Session | null> {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  onChange(callback: (session: Session | null) => void): () => void {
    if (!supabase) return () => {};
    const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
    return () => data.subscription.unsubscribe();
  },

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw toAppError(error);
  },

  /** Retorna true quando o projeto exige confirmação por e-mail. */
  async signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }> {
    const { data, error } = await supabase!.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw toAppError(error);
    return { needsConfirmation: !data.session };
  },

  async signOut(): Promise<void> {
    const { error } = await supabase!.auth.signOut();
    if (error) throw toAppError(error);
  },

  /** Sessão inválida no servidor: limpa só este dispositivo (sem chamar o servidor). */
  async clearLocalSession(): Promise<void> {
    await supabase?.auth.signOut({ scope: 'local' }).catch(() => {});
  },

  /**
   * Envia o link de recuperação. Não informa se o e-mail existe (evita
   * descobrir contas). O link leva para /redefinir-senha.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    if (error && error.status === 429) throw toAppError(error);
  },

  /** Nova senha (a sessão de recuperação vem do link do e-mail). */
  async updatePassword(password: string): Promise<void> {
    const { error } = await supabase!.auth.updateUser({ password });
    if (error) throw toAppError(error);
  },
};
