import type { GameBackend } from './backend/types';
import { setLogReporter } from './logger';
import { isSupabaseConfigured, supabase } from './supabaseClient';

export { authService } from './authService';
export { AppError, SESSION_EXPIRED_EVENT, toAppError } from './errors';
export { logger, recentLogs } from './logger';
export { isSupabaseConfigured } from './supabaseClient';
export type * from './backend/types';

/**
 * Fonte de dados do jogo:
 * - com VITE_SUPABASE_URL + chave pública → Supabase (dados reais);
 * - sem configuração → modo demonstração local.
 *
 * A implementação é carregada sob demanda na primeira chamada: em produção o
 * conteúdo da demonstração nem é baixado (e vice-versa). Todos os métodos do
 * contrato são assíncronos, então as telas não percebem a diferença.
 */
const mode: GameBackend['mode'] = isSupabaseConfigured ? 'supabase' : 'demo';

let instance: Promise<GameBackend> | null = null;
function load(): Promise<GameBackend> {
  instance ??= isSupabaseConfigured
    ? import('./backend/supabaseBackend').then((m) => new m.SupabaseBackend(supabase!))
    : import('./backend/localBackend').then((m) => new m.LocalBackend());
  return instance;
}

export const backend = new Proxy({} as GameBackend, {
  get(_target, prop) {
    if (prop === 'mode') return mode;
    // Só a demonstração pode ser reiniciada.
    if (prop === 'resetDemo' && mode !== 'demo') return undefined;
    if (prop === 'completeDemo' && mode !== 'demo') return undefined;
    if (prop === 'then') return undefined; // não é uma Promise
    return (...args: unknown[]) =>
      load().then((b) => (b[prop as keyof GameBackend] as (...a: unknown[]) => Promise<unknown>)(...args));
  },
});

// Erros inesperados vão para o registro do servidor (public.app_logs) — ou,
// na demonstração, para o registro local. Troque aqui para usar outra ferramenta.
setLogReporter((entry) =>
  backend.logError({ operation: entry.operation, code: entry.code, message: entry.message, context: entry.context }),
);
