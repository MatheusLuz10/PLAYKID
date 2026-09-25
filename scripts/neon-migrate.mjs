/**
 * Instala/atualiza o banco do ECO QUEST no Neon.
 *   node scripts/neon-migrate.mjs            (usa DATABASE_URL_UNPOOLED do .env.local)
 *   node scripts/neon-migrate.mjs --url <postgres-url>
 *
 * Ordem: supabase/neon/00_compat.sql → migrations 01…27 (as já aplicadas são puladas;
 * as de conteúdo "*_content.sql" rodam sempre, pois são idempotentes) → supabase/neon/99_accounts.sql.
 * Nas migrations, "auth.users" vira "app_auth.users" e "auth.uid()" vira "app_auth.uid()"
 * (o esquema auth é do Neon e não é acessível aos papéis da Data API).
 * Cada arquivo roda numa transação: se falhar, nada dele fica pela metade.
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const root = path.resolve(import.meta.dirname, '..');
const argUrl = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : null;

function envUrl() {
  const file = path.join(root, '.env.local');
  if (!fs.existsSync(file)) return null;
  const line = fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('DATABASE_URL_UNPOOLED='));
  return line ? line.slice('DATABASE_URL_UNPOOLED='.length).replace(/^"|"$/g, '') : null;
}

const url = argUrl ?? process.env.DATABASE_URL_UNPOOLED ?? envUrl();
if (!url) {
  console.error('Informe --url ou tenha DATABASE_URL_UNPOOLED no .env.local (neon link / neon env pull).');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url.replace('sslmode=require', 'sslmode=verify-full') });
await client.connect();

const run = async (name, sql) => {
  const t = Date.now();
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('commit');
    console.log(`  ✓ ${name} (${Date.now() - t} ms)`);
  } catch (err) {
    await client.query('rollback').catch(() => {});
    console.error(`  ✗ ${name}: ${err.message}`);
    await client.end();
    process.exit(1);
  }
};

console.log(`Neon: ${new URL(url).host}`);
await run('00_compat.sql', fs.readFileSync(path.join(root, 'supabase/neon/00_compat.sql'), 'utf8'));
await client.query(`create table if not exists app_auth.migrations (name text primary key, applied_at timestamptz not null default now())`);
const applied = new Set((await client.query('select name from app_auth.migrations')).rows.map((r) => r.name));

const dir = path.join(root, 'supabase/migrations');
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  const isContent = file.endsWith('_content.sql');
  if (applied.has(file) && !isContent) continue;
  const sql = fs
    .readFileSync(path.join(dir, file), 'utf8')
    .replace(/\bauth\.users\b/g, 'app_auth.users')
    .replace(/\bauth\.uid\(\)/g, 'app_auth.uid()');
  await run(file, `${sql}\ninsert into app_auth.migrations (name) values ('${file}') on conflict (name) do update set applied_at = now();`);
}

await run('99_accounts.sql', fs.readFileSync(path.join(root, 'supabase/neon/99_accounts.sql'), 'utf8'));
await client.end();
console.log('Banco do ECO QUEST pronto no Neon.');
