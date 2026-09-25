import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError, toAppError } from './errors';

/**
 * Fotos das evidências. Dois armazenamentos com as mesmas regras:
 * - Supabase Storage (bucket privado eco-evidence, políticas RLS);
 * - Neon Object Storage, pela API do Worker (/api/evidencia), que confere o login
 *   e aplica as mesmas regras no banco antes de salvar, mostrar ou apagar.
 */
export interface EvidenceFiles {
  upload(path: string, file: Blob, contentType: string): Promise<void>;
  /** Apaga arquivos que não viraram evidência (as regras recusam os demais). */
  remove(paths: string[]): Promise<void>;
  /** Apaga todas as fotos do usuário (só depois de pedir a exclusão da conta). */
  removeAll(userId: string): Promise<void>;
  signedUrl(path: string): Promise<string | null>;
}

export function supabaseEvidenceFiles(sb: SupabaseClient, bucketName: string): EvidenceFiles {
  const bucket = () => sb.storage.from(bucketName);
  return {
    async upload(path, file, contentType) {
      const { error } = await bucket().upload(path, file, { contentType, upsert: false });
      if (error) throw toAppError(error, 'upload_failed');
    },
    async remove(paths) {
      if (!paths.length) return;
      const { error } = await bucket().remove(paths);
      if (error) console.warn('[ECO QUEST] limpeza de upload', error.message);
    },
    async removeAll(userId) {
      // Fotos: users/{id}/challenges/{desafio}/{arquivo}
      const root = `users/${userId}/challenges`;
      const { data: folders, error } = await bucket().list(root, { limit: 1000 });
      if (error) throw toAppError(error, 'delete_account_failed');
      for (const folder of folders ?? []) {
        const { data: files, error: listError } = await bucket().list(`${root}/${folder.name}`, { limit: 1000 });
        if (listError) throw toAppError(listError, 'delete_account_failed');
        const paths = (files ?? []).map((f) => `${root}/${folder.name}/${f.name}`);
        if (paths.length) {
          const { error: removeError } = await bucket().remove(paths);
          if (removeError) throw toAppError(removeError, 'delete_account_failed');
        }
      }
    },
    async signedUrl(path) {
      const { data, error } = await bucket().createSignedUrl(path, 60 * 60);
      if (error) {
        console.error('[ECO QUEST]', error);
        return null;
      }
      return data.signedUrl;
    },
  };
}

/** Neon: tudo passa pelo Worker do próprio site (mesma origem), com o token do login. */
export function workerEvidenceFiles(getToken: () => Promise<string | null>, base = '/api/evidencia'): EvidenceFiles {
  const call = async (method: string, path: string, init: RequestInit = {}) => {
    const token = await getToken();
    if (!token) throw new AppError('not_authenticated');
    const res = await fetch(`${base}${path}`, { ...init, method, headers: { ...init.headers, authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new AppError(body.error === 'file_too_large' ? 'image_too_large' : body.error === 'forbidden' ? 'forbidden' : 'upload_failed');
    }
    return res;
  };
  const q = (path: string) => `?caminho=${encodeURIComponent(path)}`;
  return {
    async upload(path, file, contentType) {
      await call('PUT', q(path), { body: file, headers: { 'content-type': contentType } });
    },
    async remove(paths) {
      for (const p of paths) await call('DELETE', q(p)).catch((err) => console.warn('[ECO QUEST] limpeza de upload', err));
    },
    async removeAll() {
      try {
        await call('DELETE', '/todas');
      } catch (err) {
        throw toAppError(err, 'delete_account_failed');
      }
    },
    async signedUrl(path) {
      try {
        const res = await call('GET', `/link${q(path)}`);
        return ((await res.json()) as { url: string }).url;
      } catch (err) {
        console.error('[ECO QUEST]', err);
        return null;
      }
    },
  };
}
