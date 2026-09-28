/**
 * "Pular por agora" no painel de próximo passo: a missão pulada vai para o fim da fila.
 * É só a ordem das sugestões, guardada neste aparelho para cada jogador (não muda o progresso).
 */
const KEY = 'eco-quest:pulados';

export function readSkipped(userId: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(`${KEY}:${userId}`) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Manda a missão para o fim da fila (a mais recente pulada fica por último). */
export function skipToEnd(userId: string, skipped: string[], id: string): string[] {
  const next = [...skipped.filter((x) => x !== id), id];
  try {
    localStorage.setItem(`${KEY}:${userId}`, JSON.stringify(next));
  } catch {
    // modo privado: vale só enquanto a página estiver aberta
  }
  return next;
}

/** Ordem da fila: quem não foi pulado mantém a ordem original; os pulados vão para o fim, na ordem em que foram pulados. */
export function orderQueue<T extends { id: string }>(items: T[], skipped: string[]): T[] {
  const rank = (x: T) => skipped.indexOf(x.id);
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => rank(a.item) - rank(b.item) || a.i - b.i)
    .map((x) => x.item);
}
