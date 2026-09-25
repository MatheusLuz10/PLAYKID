/**
 * Junta as migrations em um único arquivo (supabase/setup.sql) para colar
 * no SQL Editor do painel do Supabase, na ordem correta.
 *   npm run db:bundle
 */
import fs from 'node:fs';
import path from 'node:path';

const dir = 'supabase/migrations';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const parts = files.map((f) => `-- >>> ${f}\n${fs.readFileSync(path.join(dir, f), 'utf8').trim()}\n`);
const header = '-- ECO QUEST · script completo gerado por "npm run db:bundle" (não edite; edite supabase/migrations)\n\n';
fs.writeFileSync('supabase/setup.sql', header + parts.join('\n'));
console.log(`supabase/setup.sql gerado com ${files.length} arquivos.`);
