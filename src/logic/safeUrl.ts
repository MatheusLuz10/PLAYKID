/**
 * Só deixa passar endereços de imagem seguros: caminhos do próprio site,
 * https, blob: (prévia local) e data:image. Bloqueia javascript:, http: e
 * qualquer outro esquema. Use em todo src vindo de conteúdo ou do servidor.
 */
export function safeImageSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const value = url.trim();
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  if (/^data:image\/(png|jpe?g|webp|gif|svg\+xml);/i.test(value)) return value;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'https:' || parsed.protocol === 'blob:') return parsed.href;
    // Supabase local de desenvolvimento
    if (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)) return parsed.href;
  } catch {
    // endereço inválido
  }
  return undefined;
}
