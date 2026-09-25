/**
 * MODO DEMONSTRAÇÃO — contas locais neste aparelho, cada uma com login próprio.
 *
 * - Cada conta tem nome de usuário e senha. A senha nunca é guardada: só um
 *   resumo PBKDF2-SHA256 com sal aleatório (Web Crypto).
 * - Cada conta tem o próprio "banco" local, com evolução independente:
 *   a conta de demonstração ('demo-user', sem senha e com tudo desbloqueado) fica em
 *   'eco-quest:demo:v2'; as demais em 'eco-quest:demo:v2:<id>'.
 * - A sessão (quem está logado) fica no registro até a pessoa tocar em "Sair".
 * Tudo fica só neste navegador. No Supabase o login é o do servidor e nada disto é usado.
 */

export const DEMO_DATA_KEY = 'eco-quest:demo:v2';
export const LEGACY_PLAYER_ID = 'demo-user';
const REGISTRY_KEY = 'eco-quest:demo:jogadores';
const ONBOARDING_KEY = 'eco-quest:onboarding-visto';
const ATTEMPTS_KEY = 'eco-quest:demo:tentativas';
const ITERATIONS = 120_000;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 30_000;

interface PasswordHash {
  salt: string;
  hash: string;
  iterations: number;
}

interface PlayerEntry {
  id: string;
  createdAt: string;
  /** Nome de usuário do login (o mesmo do perfil). */
  username?: string;
  password?: PasswordHash;
}

interface Registry {
  current: string;
  players: PlayerEntry[];
  /** Conta logada agora (null = ninguém entrou). */
  session: string | null;
}

export interface DemoPlayerSummary {
  id: string;
  displayName: string | null;
  username: string | null;
  avatar: string;
  avatarUrl: string | null;
  level: number;
  totalXp: number;
  current: boolean;
  /** Conta de demonstração: sem senha, tudo desbloqueado. */
  showcase: boolean;
  hasPassword: boolean;
}

/** Erro com mensagem pronta para mostrar na tela. */
export class DemoAuthError extends Error {}

export function demoDataKey(playerId: string): string {
  return playerId === LEGACY_PLAYER_ID ? DEMO_DATA_KEY : `${DEMO_DATA_KEY}:${playerId}`;
}

function defaultRegistry(): Registry {
  return { current: LEGACY_PLAYER_ID, players: [{ id: LEGACY_PLAYER_ID, createdAt: new Date().toISOString() }], session: null };
}

function readRegistry(): Registry {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (raw) {
      const reg = JSON.parse(raw) as Partial<Registry>;
      const players = Array.isArray(reg.players) ? reg.players.filter((p) => p && typeof p.id === 'string') : [];
      if (players.length > 0) {
        const current = players.some((p) => p.id === reg.current) ? reg.current! : players[0].id;
        const session = players.some((p) => p.id === reg.session) ? reg.session! : null;
        return { current, players, session };
      }
    }
  } catch {
    // registro ilegível ou armazenamento bloqueado: volta ao estado inicial
  }
  return defaultRegistry();
}

function writeRegistry(reg: Registry) {
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(reg));
  } catch {
    // modo privado / cota cheia: segue só nesta sessão
  }
}

function readProfile(id: string): Partial<Omit<DemoPlayerSummary, 'id' | 'current' | 'showcase' | 'hasPassword'>> {
  try {
    const raw = localStorage.getItem(demoDataKey(id));
    if (raw) return (JSON.parse(raw) as { player?: { profile?: Record<string, never> } }).player?.profile ?? {};
  } catch {
    // dados ilegíveis
  }
  return {};
}

const normalize = (u: string) => u.trim().toLowerCase();

// ---------- senha (PBKDF2) ----------

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256);
  return toB64(new Uint8Array(bits));
}

async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: toB64(salt), hash: await derive(password, salt, ITERATIONS), iterations: ITERATIONS };
}

async function checkPassword(password: string, stored: PasswordHash): Promise<boolean> {
  const hash = await derive(password, fromB64(stored.salt), stored.iterations);
  // comparação sem atalho (mesmo tempo para qualquer diferença)
  let diff = hash.length ^ stored.hash.length;
  for (let i = 0; i < Math.min(hash.length, stored.hash.length); i++) diff |= hash.charCodeAt(i) ^ stored.hash.charCodeAt(i);
  return diff === 0;
}

export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (password.length > 128) return 'Senha longa demais.';
  if (password !== confirm) return 'As duas senhas não são iguais.';
  return null;
}

export function validateUsername(username: string): string | null {
  return /^[a-z0-9_]{3,24}$/.test(normalize(username)) ? null : 'Use de 3 a 24 letras minúsculas, números ou _ no nome de usuário.';
}

// ---------- tentativas erradas (pausa de 30 s depois de 5) ----------

function attempts(): Record<string, { n: number; until: number }> {
  try {
    return JSON.parse(sessionStorage.getItem(ATTEMPTS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveAttempts(a: Record<string, { n: number; until: number }>) {
  try {
    sessionStorage.setItem(ATTEMPTS_KEY, JSON.stringify(a));
  } catch {
    // ignorado
  }
}

function guard(key: string) {
  const a = attempts()[key];
  if (a && a.until > Date.now()) {
    throw new DemoAuthError(`Muitas tentativas. Espere ${Math.ceil((a.until - Date.now()) / 1000)} segundos e tente de novo.`);
  }
}

function failed(key: string) {
  const all = attempts();
  const n = (all[key]?.n ?? 0) + 1;
  all[key] = { n: n >= MAX_ATTEMPTS ? 0 : n, until: n >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0 };
  saveAttempts(all);
}

function succeeded(key: string) {
  const all = attempts();
  delete all[key];
  saveAttempts(all);
}

// ---------- consultas ----------

/** Conta logada agora (ou null). */
export function sessionPlayerId(): string | null {
  return readRegistry().session;
}

/** Conta cujos dados o jogo abre (a logada; sem sessão, a última usada). */
export function currentDemoPlayerId(): string {
  const reg = readRegistry();
  return reg.session ?? reg.current;
}

export function demoLoginUsername(playerId: string): string | null {
  return readRegistry().players.find((p) => p.id === playerId)?.username ?? null;
}

/** Contas deste aparelho (nome, avatar e nível lidos do perfil salvo de cada uma). */
export function listDemoPlayers(): DemoPlayerSummary[] {
  const reg = readRegistry();
  return reg.players.map((entry) => {
    const profile = readProfile(entry.id);
    return {
      id: entry.id,
      displayName: profile.displayName ?? null,
      username: profile.username ?? entry.username ?? null,
      avatar: profile.avatar ?? '🌱',
      avatarUrl: profile.avatarUrl ?? null,
      level: profile.level ?? 1,
      totalXp: profile.totalXp ?? 0,
      current: entry.id === reg.session,
      showcase: entry.id === LEGACY_PLAYER_ID,
      hasPassword: !!entry.password,
    };
  });
}

/** Nomes de usuário já usados pelas outras contas deste aparelho. */
export function usernamesOfOtherDemoPlayers(playerId: string): string[] {
  const reg = readRegistry();
  const names = new Set<string>();
  for (const p of reg.players) {
    if (p.id === playerId) continue;
    if (p.username) names.add(normalize(p.username));
    const u = readProfile(p.id).username;
    if (u) names.add(normalize(u));
  }
  return [...names];
}

// ---------- ações ----------

/** Cria uma conta nova (começa do zero) e já entra nela. */
export async function createDemoAccount(username: string, password: string, confirm: string): Promise<string> {
  const u = normalize(username);
  const problem = validateUsername(u) ?? validateNewPassword(password, confirm);
  if (problem) throw new DemoAuthError(problem);
  if (usernamesOfOtherDemoPlayers('').includes(u)) throw new DemoAuthError('Esse nome de usuário já está em uso neste aparelho. Escolha outro.');
  const id = `jogador-${crypto.randomUUID()}`;
  const entry: PlayerEntry = { id, createdAt: new Date().toISOString(), username: u, password: await hashPassword(password) };
  const reg = readRegistry();
  writeRegistry({ current: id, players: [...reg.players, entry], session: id });
  return id;
}

/** Entra numa conta pelo nome de usuário e senha. */
export async function signInDemo(username: string, password: string): Promise<string> {
  const u = normalize(username);
  guard(u);
  const reg = readRegistry();
  const entry = reg.players.find((p) => (p.username ? normalize(p.username) : normalize(readProfile(p.id).username ?? '')) === u);
  if (!entry || entry.id === LEGACY_PLAYER_ID) {
    failed(u);
    throw new DemoAuthError('Nome de usuário ou senha incorretos.');
  }
  if (!entry.password) throw new DemoAuthError('Esta conta ainda não tem senha. Entre por "Contas deste aparelho" para criar uma.');
  if (!(await checkPassword(password, entry.password))) {
    failed(u);
    throw new DemoAuthError('Nome de usuário ou senha incorretos.');
  }
  succeeded(u);
  writeRegistry({ ...reg, current: entry.id, session: entry.id });
  return entry.id;
}

/** Entra pela lista de contas: confere a senha (ou, se a conta ainda não tem, cria a senha agora). */
export async function signInDemoById(playerId: string, password: string, confirm?: string): Promise<void> {
  const reg = readRegistry();
  const entry = reg.players.find((p) => p.id === playerId);
  if (!entry) throw new DemoAuthError('Conta não encontrada.');
  if (entry.id === LEGACY_PLAYER_ID) {
    writeRegistry({ ...reg, current: entry.id, session: entry.id });
    return;
  }
  if (!entry.password) {
    const problem = validateNewPassword(password, confirm ?? '');
    if (problem) throw new DemoAuthError(problem);
    entry.password = await hashPassword(password);
    entry.username ??= readProfile(entry.id).username ?? undefined;
    writeRegistry({ ...reg, current: entry.id, session: entry.id });
    return;
  }
  guard(entry.id);
  if (!(await checkPassword(password, entry.password))) {
    failed(entry.id);
    throw new DemoAuthError('Senha incorreta.');
  }
  succeeded(entry.id);
  writeRegistry({ ...reg, current: entry.id, session: entry.id });
}

/** Conta de demonstração (sem senha, tudo desbloqueado). */
export function enterShowcase() {
  const reg = readRegistry();
  const players = reg.players.some((p) => p.id === LEGACY_PLAYER_ID)
    ? reg.players
    : [{ id: LEGACY_PLAYER_ID, createdAt: new Date().toISOString() }, ...reg.players];
  writeRegistry({ current: LEGACY_PLAYER_ID, players, session: LEGACY_PLAYER_ID });
}

export function signOutDemo() {
  const reg = readRegistry();
  writeRegistry({ ...reg, session: null });
}

/** O nome de usuário do perfil mudou: o login acompanha. */
export function renameDemoLogin(playerId: string, username: string) {
  const reg = readRegistry();
  const entry = reg.players.find((p) => p.id === playerId);
  if (!entry || entry.id === LEGACY_PLAYER_ID) return;
  entry.username = normalize(username);
  writeRegistry(reg);
}

/** Apaga uma conta e só os dados dela (e encerra a sessão, se era a logada). */
export function removeDemoPlayer(playerId: string) {
  const reg = readRegistry();
  try {
    localStorage.removeItem(demoDataKey(playerId));
    localStorage.removeItem(`${ONBOARDING_KEY}:${playerId}`);
  } catch {
    // ignorado
  }
  const players = reg.players.filter((p) => p.id !== playerId);
  if (players.length === 0) {
    writeRegistry(defaultRegistry());
    return;
  }
  writeRegistry({
    current: reg.current === playerId ? players[0].id : reg.current,
    players,
    session: reg.session === playerId ? null : reg.session,
  });
}
