/**
 * Worker do ECO QUEST (Cloudflare): serve o site (dist/) e a API de fotos.
 *
 *   PUT    /api/evidencia?caminho=users/{uid}/challenges/{desafio}/{arquivo}.jpg   envia a foto
 *   GET    /api/evidencia/link?caminho=…                                          link temporário (1 h)
 *   DELETE /api/evidencia?caminho=…                                               apaga (upload que não virou evidência)
 *   DELETE /api/evidencia/todas                                                   apaga todas (após pedir exclusão da conta)
 *
 * Toda chamada exige o token do login (Neon Auth, JWT EdDSA) no cabeçalho Authorization.
 * As regras são as do banco (app_auth.storage_can_*), iguais às políticas do Supabase Storage.
 * As credenciais do banco e do Object Storage ficam só aqui (segredos do Worker).
 */
import { neon } from '@neondatabase/serverless';
import { AwsClient } from 'aws4fetch';
import { createRemoteJWKSet, jwtVerify } from 'jose';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DATABASE_URL: string;
  NEON_AUTH_JWKS_URL: string;
  NEON_AUTH_BASE_URL: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_ENDPOINT_URL_S3: string;
  AWS_REGION: string;
  EVIDENCE_BUCKET: string;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB (mesmo limite do bucket no Supabase)
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PATH = new RegExp(`^users/${UUID}/challenges/${UUID}/[A-Za-z0-9._-]{1,120}\\.(jpg|jpeg|png|webp)$`);
const DB_BUCKET = 'eco-evidence'; // nome do bucket no registro do banco (storage.objects)

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
const fail = (status: number, code: string) => json({ error: code }, status);

/** Confere o token do Neon Auth e devolve o id do usuário (ou null). */
async function userFrom(request: Request, env: Env): Promise<string | null> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  jwks ??= createRemoteJWKSet(new URL(env.NEON_AUTH_JWKS_URL));
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: new URL(env.NEON_AUTH_BASE_URL).origin });
    return typeof payload.sub === 'string' && new RegExp(`^${UUID}$`).test(payload.sub) ? payload.sub : null;
  } catch {
    return null;
  }
}

function s3(env: Env) {
  return new AwsClient({
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    region: env.AWS_REGION,
    service: 's3',
  });
}

/** Neon exige endereçamento por caminho: {endpoint}/{bucket}/{chave}. */
const objectUrl = (env: Env, path: string) =>
  `${env.AWS_ENDPOINT_URL_S3.replace(/\/$/, '')}/${env.EVIDENCE_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;

async function can(env: Env, rule: 'insert' | 'read' | 'delete', user: string, path: string) {
  const sql = neon(env.DATABASE_URL);
  const fn = { insert: 'storage_can_insert', read: 'storage_can_read', delete: 'storage_can_delete' }[rule];
  const rows = (await sql.query(`select app_auth.${fn}($1::uuid, $2) as ok`, [user, path])) as { ok: boolean }[];
  return rows[0]?.ok === true;
}

async function upload(request: Request, env: Env, user: string, path: string) {
  const type = (request.headers.get('content-type') ?? '').split(';')[0].trim();
  if (!TYPES.has(type)) return fail(415, 'invalid_file_type');
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BYTES) return fail(413, 'file_too_large');
  if (!(await can(env, 'insert', user, path))) return fail(403, 'forbidden');
  const body = await request.arrayBuffer();
  if (body.byteLength === 0) return fail(400, 'empty_file');
  if (body.byteLength > MAX_BYTES) return fail(413, 'file_too_large');

  const sql = neon(env.DATABASE_URL);
  const exists = (await sql.query(`select 1 from storage.objects where bucket_id = $1 and name = $2`, [DB_BUCKET, path])) as unknown[];
  if (exists.length) return fail(409, 'already_exists'); // nunca sobrescreve

  const put = await s3(env).fetch(objectUrl(env, path), { method: 'PUT', body, headers: { 'content-type': type } });
  if (!put.ok) return fail(502, 'upload_failed');
  // só depois do arquivo salvo o banco passa a conhecê-lo (evidência exige arquivo existente)
  await sql.query(`insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3::uuid) on conflict (bucket_id, name) do nothing`, [
    DB_BUCKET,
    path,
    user,
  ]);
  return json({ path }, 201);
}

async function signedLink(env: Env, user: string, path: string) {
  if (!(await can(env, 'read', user, path))) return fail(403, 'forbidden');
  const url = new URL(objectUrl(env, path));
  url.searchParams.set('X-Amz-Expires', '3600');
  const signed = await s3(env).sign(new Request(url, { method: 'GET' }), { aws: { signQuery: true } });
  return json({ url: signed.url });
}

async function remove(env: Env, user: string, path: string) {
  if (!(await can(env, 'delete', user, path))) return fail(403, 'forbidden');
  const del = await s3(env).fetch(objectUrl(env, path), { method: 'DELETE' });
  if (!del.ok && del.status !== 404) return fail(502, 'delete_failed');
  await neon(env.DATABASE_URL).query(`delete from storage.objects where bucket_id = $1 and name = $2`, [DB_BUCKET, path]);
  return json({ ok: true });
}

async function removeAll(env: Env, user: string) {
  const sql = neon(env.DATABASE_URL);
  const rows = (await sql.query(`select name from storage.objects where bucket_id = $1 and name like $2`, [
    DB_BUCKET,
    `users/${user}/%`,
  ])) as { name: string }[];
  let removed = 0;
  for (const { name } of rows) {
    const r = await remove(env, user, name);
    if (r.status === 403) return fail(403, 'deletion_not_requested');
    if (!r.ok) return r;
    removed++;
  }
  return json({ removed });
}

async function api(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await userFrom(request, env);
  if (!user) return fail(401, 'not_authenticated');
  const path = url.searchParams.get('caminho') ?? '';
  const route = `${request.method} ${url.pathname}`;
  if (route === 'DELETE /api/evidencia/todas') return removeAll(env, user);
  if (!PATH.test(path)) return fail(400, 'invalid_path');
  if (route === 'PUT /api/evidencia') return upload(request, env, user, path);
  if (route === 'GET /api/evidencia/link') return signedLink(env, user, path);
  if (route === 'DELETE /api/evidencia') return remove(env, user, path);
  return fail(404, 'not_found');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await api(request, env, url);
      } catch (err) {
        console.error('[ECO QUEST] api', err instanceof Error ? err.message : err);
        return fail(500, 'server_error');
      }
    }
    return env.ASSETS.fetch(request);
  },
};
