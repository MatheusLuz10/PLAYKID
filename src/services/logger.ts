/**
 * Registro de erros do app (preparado para monitoramento).
 *
 * - Sempre: console + últimos 50 registros em memória (recentLogs()).
 * - Quando configurado: um "reporter" envia para o servidor (public.app_logs)
 *   ou para uma ferramenta externa no futuro — basta trocar setLogReporter().
 * - Nunca registra senha, token, chave ou e-mail: o texto é limpo antes.
 */
export type LogLevel = 'error' | 'warn' | 'info';

export interface LogEntry {
  level: LogLevel;
  operation: string;
  code: string | null;
  message: string;
  context: Record<string, unknown>;
  timestamp: string;
}

type Reporter = (entry: LogEntry) => void | Promise<void>;

const MAX_BUFFER = 50;
const MAX_REPORTS_PER_MINUTE = 10;
const buffer: LogEntry[] = [];
let reporter: Reporter | null = null;
let reportTimes: number[] = [];

/** Remove dados sensíveis de um texto (tokens JWT, chaves do Supabase, e-mails). */
export function redact(text: string): string {
  return text
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, '[token]')
    .replace(/sb_(secret|publishable)_[A-Za-z0-9_-]+/g, '[chave]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .slice(0, 500);
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return typeof err === 'string' ? err : 'erro desconhecido';
}

/** Define para onde os erros são enviados (servidor, ferramenta externa…). */
export function setLogReporter(fn: Reporter | null) {
  reporter = fn;
}

export function recentLogs(): readonly LogEntry[] {
  return buffer;
}

function record(level: LogLevel, operation: string, err: unknown, context: Record<string, unknown>, code: string | null) {
  const entry: LogEntry = {
    level,
    operation: redact(operation).slice(0, 80),
    code,
    message: redact(describe(err)),
    // só o caminho da tela (sem parâmetros de URL, que podem ter tokens de recuperação)
    context: { route: typeof location !== 'undefined' ? location.pathname : null, ...context },
    timestamp: new Date().toISOString(),
  };
  buffer.unshift(entry);
  if (buffer.length > MAX_BUFFER) buffer.length = MAX_BUFFER;

  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  out(`[ECO QUEST] ${operation}`, err);

  if (level !== 'error' || !reporter) return;
  // Sem conexão não adianta enviar; e há um limite por minuto para não inundar o servidor.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const nowMs = Date.now();
  reportTimes = reportTimes.filter((t) => nowMs - t < 60_000);
  if (reportTimes.length >= MAX_REPORTS_PER_MINUTE) return;
  reportTimes.push(nowMs);
  Promise.resolve(reporter(entry)).catch(() => {});
}

export const logger = {
  error: (operation: string, err: unknown, context: Record<string, unknown> = {}, code: string | null = null) =>
    record('error', operation, err, context, code),
  warn: (operation: string, err: unknown, context: Record<string, unknown> = {}, code: string | null = null) =>
    record('warn', operation, err, context, code),
};
