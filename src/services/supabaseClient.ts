import { createClient as createNeonClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente do Supabase para o navegador.
 * Usa SOMENTE a chave pública (anon / publishable): toda a segurança vem das
 * políticas RLS e das funções do banco. Nunca coloque a service_role aqui.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as
  | string
  | undefined;

/** Bloqueia o uso acidental de uma chave privilegiada no frontend. */
function isPrivilegedKey(value: string): boolean {
  if (value.startsWith('sb_secret_')) return true;
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

const keyIsSafe = Boolean(key) && !isPrivilegedKey(key!);
if (key && !keyIsSafe) {
  console.error(
    '[ECO QUEST] A chave configurada é uma chave privilegiada (service_role/secret). ' +
      'Use a chave pública (anon/publishable). O Supabase NÃO foi iniciado.',
  );
}

/**
 * Neon (Managed Better Auth + Data API): o SDK do Neon oferece a mesma forma do
 * cliente Supabase (auth.signInWithPassword, rpc, from), então o app usa o mesmo
 * backend. Só as fotos mudam (vão pelo Worker, ver evidenceFiles.ts).
 * Os dois endereços são públicos (não dão acesso a nada sem o login).
 */
const neonAuthUrl = import.meta.env.VITE_NEON_AUTH_URL as string | undefined;
const neonDataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL as string | undefined;
export const isNeonConfigured = Boolean(neonAuthUrl && neonDataApiUrl);

/** Há um backend online (Neon ou Supabase)? Sem ele o app roda em modo demonstração. */
export const isSupabaseConfigured = isNeonConfigured || (Boolean(url) && keyIsSafe);

export const supabase: SupabaseClient | null = isNeonConfigured
  ? (createNeonClient({
      // o jogo só consulta o banco depois do login (GameProvider): sempre com o token da pessoa
      auth: { url: neonAuthUrl!, adapter: SupabaseAuthAdapter() },
      dataApi: { url: neonDataApiUrl! },
    }) as unknown as SupabaseClient)
  : isSupabaseConfigured
    ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } })
    : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase não configurado');
  return supabase;
}

export const EVIDENCE_BUCKET = 'eco-evidence';
