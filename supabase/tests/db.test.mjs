/**
 * Testes do banco (migrations + RLS + funções) sem Docker:
 * roda as migrations num PostgreSQL em WASM (PGlite) com stubs dos
 * esquemas auth/storage e dos papéis anon/authenticated do Supabase.
 *   npm run test:db
 */
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIG = fileURLToPath(new URL('../migrations', import.meta.url));

// Quantidades esperadas vêm do próprio conteúdo (content/*.json): novos conteúdos não quebram os testes.
const readContent = (f) => JSON.parse(fs.readFileSync(fileURLToPath(new URL(`../../content/${f}`, import.meta.url)), 'utf8'));
const CT = {
  lessons: readContent('lessons.json').lessons,
  quizzes: readContent('quizzes.json').quizzes,
  challenges: readContent('challenges.json').challenges,
  gamification: readContent('gamification.json'),
  world: readContent('world.json'),
  place: readContent('place.json'),
};
const EXP = {
  lessons: CT.lessons.length,
  sections: CT.lessons.reduce((n, l) => n + l.sections.length, 0),
  quizzes: CT.quizzes.length,
  questions: CT.quizzes.reduce((n, q) => n + q.questions.length, 0),
  options: CT.quizzes.reduce((n, q) => n + q.questions.reduce((m, x) => m + x.options.length, 0), 0),
  quizzesAt70: CT.quizzes.filter((q) => q.passing_score === 70).length,
  challenges: CT.challenges.length,
  // + 1 etapa antiga da árvore (13_seed), mantida inativa
  steps: CT.challenges.reduce((n, c) => n + c.steps.length, 0) + 1,
  levels: CT.gamification.levels.length,
  achievements: CT.gamification.achievements.length,
  worldItems: CT.world.items.length,
  worldEarnable: CT.world.items.filter((i) => i.unlock_type !== 'initial').length,
  placeItems: CT.place.items.length,
  placeEarnable: CT.place.items.filter((i) => i.unlock_type !== 'initial').length,
};
const db = new PGlite();

// ---- Supabase-like stubs -------------------------------------------------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema extensions;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(),
    bucket_id text, name text, owner uuid, created_at timestamptz default now());
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, update, delete on storage.objects to authenticated; -- como no Supabase
  grant usage on schema public to anon, authenticated;
  -- Supabase grants everything on new public objects by default:
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`);

for (const f of fs.readdirSync(MIG).sort()) {
  let sql = fs.readFileSync(path.join(MIG, f), 'utf8');
  sql = sql.replace(/create extension[^;]*;/gi, ''); // pgcrypto isn't needed (gen_random_uuid is core)
  try {
    await db.exec(sql);
    console.log('✓ migration', f);
  } catch (e) {
    console.error('✗ migration', f, '→', e.message);
    process.exit(1);
  }
}

// ---- Helpers -------------------------------------------------------------
let passed = 0;
let failed = 0;
const ok = (cond, msg) => {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; console.log('  ✗ FAIL:', msg); }
};

async function as(uid, sql, params = []) {
  await db.exec('begin');
  try {
    if (uid === 'anon') {
      await db.exec(`set local role anon; select set_config('request.jwt.claim.sub', '', true);`);
    } else {
      await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${uid}', true);`);
    }
    const res = await db.query(sql, params);
    await db.exec('commit');
    return res.rows;
  } catch (e) {
    await db.exec('rollback');
    throw e;
  }
}
async function expectError(uid, sql, match, msg, params = []) {
  try {
    await as(uid, sql, params);
    ok(false, `${msg} (no error raised)`);
  } catch (e) {
    ok(new RegExp(match).test(e.message), `${msg} → "${e.message}"`);
  }
}
const one = async (uid, sql, params) => (await as(uid, sql, params))[0];
/** A ação é permitida? Executa e DESFAZ (rollback): confere a regra sem mudar o estado dos testes seguintes. */
async function expectAllowed(uid, sql, msg, params = []) {
  await db.exec('begin');
  try {
    await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${uid}', true);`);
    await db.query(sql, params);
    ok(true, msg);
  } catch (e) {
    ok(false, `${msg} → "${e.message}"`);
  } finally {
    await db.exec('rollback');
  }
}

const A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const B = 'bbbbbbbb-0000-4000-8000-00000000000b';
const ADMIN = 'cccccccc-0000-4000-8000-00000000000c';
const LESSON = '20000000-0000-4000-8000-000000000001';
const QUIZ = '30000000-0000-4000-8000-000000000001';
const CH = '40000000-0000-4000-8000-000000000001';

await db.exec(`insert into auth.users (id, email) values ('${A}','a@x.com'), ('${B}','b@x.com'), ('${ADMIN}','admin@x.com');
               update public.profiles set role = 'admin' where user_id = '${ADMIN}';`);

console.log('\n# Cadastro → perfil e mundo automáticos');
ok((await db.query('select count(*)::int n from public.profiles')).rows[0].n === 3, 'trigger criou 3 perfis');
ok((await db.query('select count(*)::int n from public.worlds')).rows[0].n === 3, 'trigger criou 3 mundos');

console.log('\n# Seed');
const counts = (await db.query(`select
  (select count(*) from public.categories)::int c, (select count(*) from public.lessons)::int l,
  (select count(*) from public.lesson_sections)::int s, (select count(*) from public.quiz_questions)::int q,
  (select count(*) from public.quiz_options)::int o, (select count(*) from public.challenges)::int ch,
  (select count(*) from public.challenge_steps)::int st, (select count(*) from public.levels)::int lv,
  (select count(*) from public.achievements)::int a, (select count(*) from public.world_items)::int w`)).rows[0];
ok(counts.c === 6 && counts.l === EXP.lessons && counts.s === EXP.sections && counts.q === EXP.questions && counts.o === EXP.options &&
   counts.ch === EXP.challenges && counts.st === EXP.steps && counts.lv === EXP.levels && counts.a === EXP.achievements && counts.w === EXP.worldItems, `seed completo ${JSON.stringify(counts)}`);

console.log('\n# Conteúdo público e gabarito protegido');
ok((await as('anon', 'select id from public.categories')).length === 6, 'anon lê categorias');
ok((await as(A, 'select id, option_text from public.quiz_options')).length === EXP.options, 'usuário lê alternativas sem gabarito');
await expectError(A, 'select is_correct from public.quiz_options', 'permission denied', 'usuário NÃO lê is_correct');
await expectError(A, 'select * from public.quiz_options', 'permission denied', 'select * em quiz_options bloqueado');
await expectError(A, 'select explanation from public.quiz_questions', 'permission denied', 'usuário NÃO lê explicações antes de responder');
await expectError('anon', 'select is_correct from public.quiz_options', 'permission denied', 'anon NÃO lê is_correct');
await as(A, `update public.quiz_options set is_correct = not is_correct`).catch(() => {});
ok((await db.query('select count(*)::int n from public.quiz_options where is_correct')).rows[0].n === EXP.questions, 'usuário NÃO altera respostas corretas (gabarito intacto)');
ok((await as(A, `update public.lessons set title = 'hack' returning id`)).length === 0, 'usuário NÃO edita aulas (0 linhas)');
await expectError(A, `insert into public.categories (name, slug) values ('x','x')`, 'row-level security', 'usuário NÃO cria categoria');
ok((await as(ADMIN, `insert into public.categories (name, slug) values ('Teste','teste') returning id`)).length === 1, 'admin cria categoria');
ok((await as(ADMIN, `select * from public.admin_quiz_answer_key('${QUIZ}')`)).length === 20, 'admin lê o gabarito pela função');
await expectError(A, `select * from public.admin_quiz_answer_key('${QUIZ}')`, 'forbidden', 'usuário comum não lê o gabarito');
await as(ADMIN, `delete from public.categories where slug = 'teste'`);

console.log('\n# Perfil');
ok((await as(A, `update public.profiles set display_name = 'Ana', username = 'ana_eco', avatar_emoji = '🐢' returning id`)).length === 1, 'altera o próprio perfil');
await expectError(A, `update public.profiles set total_xp = 99999`, 'permission denied', 'NÃO altera XP manualmente');
await expectError(A, `update public.profiles set role = 'admin'`, 'permission denied', 'NÃO se promove a admin');
ok((await as(A, `update public.profiles set display_name = 'hack' where user_id = '${B}' returning id`)).length === 0, 'NÃO edita outro usuário');
ok((await as(A, 'select user_id from public.profiles')).length === 1, 'vê apenas o próprio perfil');
await expectError(A, `update public.profiles set username = 'ab' where user_id = '${A}'`, 'profiles_username_format|unique|check', 'username curto rejeitado');
await expectError('anon', 'select * from public.profiles', 'permission denied', 'anon não lê perfis');

console.log('\n# Escritas diretas bloqueadas');
await expectError(A, `insert into public.xp_transactions (user_id, amount, xp_type, source_type) values ('${A}', 1000, 'bonus', 'hack')`, 'permission denied', 'NÃO insere XP');
await expectError(A, `insert into public.user_achievements (user_id, achievement_id) values ('${A}', '60000000-0000-4000-8000-000000000003')`, 'permission denied', 'NÃO desbloqueia conquista');
await expectError(A, `insert into public.user_lesson_progress (user_id, lesson_id, status) values ('${A}', '${LESSON}', 'completed')`, 'permission denied', 'NÃO marca aula como concluída direto');
await expectError(A, `insert into public.user_world_items (world_id, world_item_id) select id, '70000000-0000-4000-8000-000000000001' from public.worlds`, 'permission denied', 'NÃO adiciona item ao mundo');
await expectError(A, `select public.award_xp('${A}', 5000, 'bonus', 'hack', null, 'x')`, 'permission denied', 'NÃO chama award_xp');
await expectError(A, `select public.check_achievements('${A}')`, 'permission denied', 'NÃO chama check_achievements');
await expectError(A, `select public.sync_world('${A}')`, 'permission denied', 'NÃO chama sync_world (desbloqueio do mundo)');

console.log('\n# Ordem do jogo: aula → quiz → desafio');
await expectError(A, `select public.start_quiz_attempt('${QUIZ}')`, 'lesson_not_completed', 'quiz bloqueado antes da aula');
await expectAllowed(A, `select public.accept_challenge('${CH}')`, 'missões abertas (28): desafio pode ser aceito antes da aula');
// Etapa 3 · Testes 1–4: abrir a aula, salvar progresso, sair e retomar
let t = (await one(A, `select public.track_lesson_progress('${LESSON}', 0) r`)).r;
ok(t.status === 'in_progress' && t.progress_percentage === 20 && t.last_section_index === 0, 'Teste 1 · aula aberta: parte 1 de 5 (20%)');
t = (await one(A, `select public.track_lesson_progress('${LESSON}', 2) r`)).r;
ok(t.progress_percentage === 60 && t.last_section_index === 2, 'Teste 2 · progresso salvo: parte 3 de 5 (60%)');
const resume = (await one(A, 'select public.get_player_state() s')).s.lessons.find((l) => l.lesson_id === LESSON);
ok(resume.last_section_index === 2 && resume.progress_percentage === 60, 'Testes 3/4 · ao voltar, o estado indica onde parou (parte 3)');
t = (await one(A, `select public.track_lesson_progress('${LESSON}', 0) r`)).r;
ok(t.progress_percentage === 60 && t.last_section_index === 0, 'voltar uma parte não reduz o percentual');
t = (await one(A, `select public.track_lesson_progress('${LESSON}', 99) r`)).r;
ok(t.last_section_index === 4 && t.progress_percentage === 99, 'índice fora do limite é ajustado pelo servidor (máx. 99% antes de concluir)');
await as(A, `select public.track_lesson_progress('${LESSON}', 1)`);
await expectError(A, `select public.complete_lesson('${LESSON}')`, 'lesson_not_finished', 'não conclui sem chegar à última parte');
await as(A, `select public.track_lesson_progress('${LESSON}', 4)`);
let r = await one(A, `select public.complete_lesson('${LESSON}') r`);
ok(r.r.xp_awarded === 20 && r.r.achievements[0]?.slug === 'primeiro-aprendizado', `aula concluída +20 XP e "Primeiro Aprendizado" ${JSON.stringify(r.r)}`);
r = await one(A, `select public.complete_lesson('${LESSON}') r`);
ok(r.r.xp_awarded === 0, 'concluir de novo não duplica XP');
await expectAllowed(A, `select public.accept_challenge('${CH}')`, 'missões abertas (28): desafio pode ser aceito sem quiz aprovado');

console.log('\n# Quiz: tentativa reprovada');
let att = (await one(A, `select public.start_quiz_attempt('${QUIZ}')->>'attempt_id' id`)).id;
const wrong = ['11', '21', '32', '41', '51']; // all wrong
for (let i = 0; i < 5; i++) {
  await as(A, `select public.answer_quiz_question($1, $2, $3)`, [att, `31000000-0000-4000-8000-00000000000${i + 1}`, `32000000-0000-4000-8000-0000000000${wrong[i]}`]);
}
r = await one(A, `select public.finish_quiz_attempt('${att}') r`);
ok(r.r.passed === false && r.r.xp_awarded === 0 && r.r.score === 0, `reprovado sem XP ${JSON.stringify(r.r)}`);
await expectAllowed(A, `select public.accept_challenge('${CH}')`, 'missões abertas (28): reprovar no quiz não impede aceitar o desafio');

console.log('\n# Quiz: tentativa aprovada (4/5)');
att = (await one(A, `select public.start_quiz_attempt('${QUIZ}')->>'attempt_id' id`)).id;
await expectError(A, `select public.finish_quiz_attempt('${att}')`, 'quiz_incomplete', 'não finaliza sem responder tudo');
const answers = ['11', '23', '31', '44', '52']; // q1 wrong
let fb;
for (let i = 0; i < 5; i++) {
  fb = await one(A, `select public.answer_quiz_question($1, $2, $3) r`, [att, `31000000-0000-4000-8000-00000000000${i + 1}`, `32000000-0000-4000-8000-0000000000${answers[i]}`]);
  if (i === 0) ok(fb.r.is_correct === false && fb.r.correct_option_id === '32000000-0000-4000-8000-000000000012' && fb.r.explanation.length > 10, 'resposta errada devolve correta + explicação');
}
await expectError(A, `select public.answer_quiz_question($1, $2, $3)`, 'already_answered', 'não responde a mesma pergunta 2x', [att, '31000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000012']);
await expectError(B, `select public.answer_quiz_question($1, $2, $3)`, 'not_found', 'B não responde na tentativa de A', [att, '31000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000012']);
r = await one(A, `select public.finish_quiz_attempt('${att}') r`);
ok(r.r.passed === true && r.r.score === 80 && r.r.correct_answers === 4 && r.r.xp_awarded === 30, `aprovado 80% +30 XP ${JSON.stringify({ ...r.r, achievements: r.r.achievements.map((a) => a.slug) })}`);
ok(r.r.achievements.some((a) => a.slug === 'primeiro-conhecimento'), 'conquista "Primeiro Conhecimento"');
ok((await as(A, 'select id from public.quiz_answers')).length === 10, 'respostas individuais registradas (2 tentativas × 5)');
ok((await as(B, 'select id from public.quiz_answers')).length === 0, 'B não vê respostas de A');

console.log('\n# Etapa 5 · Desafio: aceitar e checklist');
const S = {
  local: '41000000-0000-4000-8000-000000000001',
  especie: '41000000-0000-4000-8000-000000000008',
  solo: '41000000-0000-4000-8000-000000000009',
  plantar: '41000000-0000-4000-8000-000000000002',
  foto: '41000000-0000-4000-8000-000000000003',
  info: '41000000-0000-4000-8000-000000000010',
};
// completar etapa: (usuário, desafio do usuário, etapa, { file, thumb, name, mime, size, note, date })
const stepSql = `select public.complete_challenge_step($1,$2,$3,$4,$5,$6,$7,$8,$9) r`;
const stepArgs = (ucId, stepId, o = {}) => [ucId, stepId, o.file ?? null, o.thumb ?? null, o.name ?? null, o.mime ?? null, o.size ?? null, o.note ?? null, o.date ?? null];
const doStep = async (user, ucId, stepId, o) => (await one(user, stepSql, stepArgs(ucId, stepId, o))).r;
const followSql = `select public.complete_followup($1,$2,$3,$4,$5,$6,$7) r`;
const followArgs = (fid, o = {}) => [fid, o.file ?? null, o.thumb ?? null, o.name ?? null, o.mime ?? null, o.size ?? null, o.note ?? null];
const upload = async (user, path) => as(user, `insert into storage.objects (bucket_id, name, owner) values ('eco-evidence', $1, $2)`, [path, user]);
const JPG = { mime: 'image/jpeg', size: 245000 };

const uc = (await one(A, `select public.accept_challenge('${CH}') id`)).id;
ok((await one(A, `select public.accept_challenge('${CH}') id`)).id === uc, 'Teste 5 · aceitar de novo não duplica');
const ucRow = await one(A, `select status, progress_percentage p, round(extract(epoch from deadline_at - accepted_at) / 86400)::int d from public.user_challenges`);
ok(ucRow.status === 'accepted' && ucRow.p === 0 && ucRow.d === 15, 'Testes 4/12 · aceito, prazo de 15 dias calculado pelo servidor');
await expectError(A, `update public.user_challenges set deadline_at = now() + interval '1 year'`, 'permission denied', 'usuário não altera o prazo');
ok((await as(A, 'select id from public.user_challenge_steps')).length === 9, 'Teste 6 · 9 etapas criadas (6 principais + 3 acompanhamentos)');
await expectError(A, `select public.complete_challenge('${uc}')`, 'steps_pending', 'Teste 16 · não conclui com etapas pendentes');
await expectError(A, stepSql, 'previous_steps_pending', 'checklist em ordem (plantar antes de escolher o local)', stepArgs(uc, S.plantar));
let rs = await doStep(A, uc, S.local);
ok(rs.status === 'in_progress' && rs.progress_percentage === 11, 'Teste 7 · 1ª etapa → in_progress, progresso 11% calculado no servidor (1/9)');
await expectError(A, stepSql, 'step_already_completed', 'etapa não é concluída duas vezes', stepArgs(uc, S.local));
await expectError(B, stepSql, 'not_found', 'Teste 20 · B não altera o desafio de A', stepArgs(uc, S.especie));
await expectError(A, `update public.user_challenges set progress_percentage = 100, status = 'completed'`, 'permission denied', 'cliente não envia progress = 100');
await doStep(A, uc, S.especie);
await doStep(A, uc, S.solo);
await doStep(A, uc, S.plantar);
await expectError(A, stepSql, 'photo_required', 'etapa de foto exige fotografia', stepArgs(uc, S.foto));

console.log('\n# Evidências e Storage');
const photo = `users/${A}/challenges/${CH}/1700000000-abc.jpg`;
const thumb = `users/${A}/challenges/${CH}/1700000000-abc-thumb.jpg`;
await expectError(A, stepSql, 'evidence_file_missing', 'Teste 23 · upload interrompido (arquivo ausente) não cria registro', stepArgs(uc, S.foto, { file: photo, ...JPG }));
ok((await as(A, 'select id from public.challenge_evidence')).length === 0, 'nenhuma evidência inválida gravada');
await upload(A, photo);
await upload(A, thumb);
ok(true, 'Teste 8 · upload na própria pasta permitido');
await expectError(A, `insert into storage.objects (bucket_id, name) values ('eco-evidence', 'users/${B}/challenges/${CH}/x.jpg')`, 'row-level security', 'upload na pasta de outro usuário bloqueado');
await expectError(B, `insert into storage.objects (bucket_id, name) values ('eco-evidence', 'users/${B}/challenges/${CH}/x.jpg')`, 'row-level security', 'upload sem ter aceitado o desafio bloqueado');
await expectError(A, stepSql, 'image_invalid', 'Teste 9 · tipo de arquivo inválido (gif) rejeitado', stepArgs(uc, S.foto, { file: photo, mime: 'image/gif', size: 1000 }));
await expectError(A, stepSql, 'image_too_large', 'Teste 10 · arquivo acima de 10 MB rejeitado', stepArgs(uc, S.foto, { file: photo, mime: 'image/jpeg', size: 11 * 1024 * 1024 }));
await expectError(A, stepSql, 'invalid_evidence_path', 'caminho de outro usuário rejeitado', stepArgs(uc, S.foto, { file: `users/${B}/challenges/${CH}/x.jpg`, ...JPG }));
await expectError(A, stepSql, 'invalid_date', 'data futura rejeitada', stepArgs(uc, S.foto, { file: photo, ...JPG, date: '2999-01-01' }));
rs = await doStep(A, uc, S.foto, { file: photo, thumb, name: 'arvore.jpg', ...JPG, note: 'Muda de ipê-amarelo' });
const ev = await one(A, `select evidence_type, status, file_url, file_name, mime_type, file_size, challenge_step_id, uploaded_at is not null up, captured_at::date = current_date cap from public.challenge_evidence`);
ok(ev.evidence_type === 'photo' && ev.status === 'submitted' && ev.file_url === photo && ev.file_name === 'arvore.jpg' &&
   ev.mime_type === 'image/jpeg' && Number(ev.file_size) === 245000 && ev.challenge_step_id === S.foto && ev.up && ev.cap,
   'evidência com metadados (arquivo, tipo, tamanho, etapa, data informada × data do registro)');
await expectError(A, stepSql, 'observation_required', 'etapa de texto exige observação', stepArgs(uc, S.info, { note: ' ' }));
rs = await doStep(A, uc, S.info, { note: 'Plantei\u0007 um ipê-amarelo no quintal.\nRecebe sol pela manhã.' });
const note = (await one(A, `select description from public.challenge_evidence where challenge_step_id = '${S.info}'`)).description;
ok(!/[\u0000-\u001f]/.test(note) && note.startsWith('Plantei'), `observação sanitizada: "${note}"`);
ok(rs.status === 'waiting_follow_up' && rs.progress_percentage === 67, 'etapas principais concluídas → waiting_follow_up (67%)');
const fus = await as(A, `select title, (scheduled_for::date - current_date) d from public.challenge_followups order by scheduled_for`);
ok(fus.map((f) => f.d).join() === '30,90,180', `acompanhamentos agendados pelo servidor: dias ${fus.map((f) => f.d)}`);
await expectError(A, `select public.complete_challenge('${uc}')`, 'followups_pending', 'não conclui com acompanhamentos pendentes');
ok((await as(A, `select u.id from public.user_world_items u join public.world_items wi on wi.id = u.world_item_id where wi.code = 'tree_basic'`)).length === 0, 'árvore do desafio ainda NÃO liberada');
ok((await as(B, 'select id from storage.objects')).length === 0, 'Teste 11 · B não vê as fotos de A no Storage');
ok((await as(B, 'select id from public.challenge_evidence')).length === 0, 'B não vê as evidências de A');
ok((await as(ADMIN, 'select id from public.challenge_evidence')).length === 2, 'admin vê evidências (moderação futura)');

console.log('\n# Acompanhamentos');
const followups = await as(A, `select id from public.challenge_followups order by scheduled_for`);
await expectError(A, followSql, 'followup_not_due', 'Teste 14 · acompanhamento do dia 30 bloqueado hoje', followArgs(followups[0].id));
let fuN = 0;
for (const f of followups) {
  await db.exec(`update public.challenge_followups set scheduled_for = now() - interval '1 day' where id = '${f.id}'`); // o tempo passa
  if (fuN === 0) await expectError(A, followSql, 'photo_required', 'acompanhamento exige foto', followArgs(f.id));
  fuN += 1;
  const fp = `users/${A}/challenges/${CH}/fu-${fuN}.jpg`;
  await upload(A, fp);
  const rr = (await one(A, followSql, followArgs(f.id, { file: fp, name: `fu-${fuN}.jpg`, ...JPG, note: `Acompanhamento ${fuN}` }))).r;
  ok(rr.xp_awarded === 20 && rr.pending_followups === 3 - fuN, `acompanhamento ${fuN}: +20 XP, faltam ${3 - fuN}`);
}
ok((await one(A, 'select count(*)::int n from public.challenge_evidence where followup_id is not null')).n === 3, 'Teste 15 · cada acompanhamento registrou evidência');
await expectError(A, followSql, 'followup_already_done', 'não registra o mesmo acompanhamento 2x', followArgs(followups[0].id, { file: `users/${A}/challenges/${CH}/fu-1.jpg`, ...JPG }));

console.log('\n# Conclusão e recompensa');
r = await one(A, `select public.complete_challenge('${uc}') r`);
const slugs = r.r.achievements.map((a) => a.slug);
ok(r.r.xp_awarded === 100 && r.r.already_completed === false, 'conclusão definitiva: +100 XP');
ok(slugs.includes('primeira-arvore') && slugs.includes('primeiro-passo'), `conquistas: ${slugs}`);
ok(r.r.world_items.some((w) => w.code === 'tree_basic'), `item "Árvore jovem" (tree_basic) desbloqueado: ${r.r.world_items.map((w) => w.code)}`);
const again = (await one(A, `select public.complete_challenge('${uc}') r`)).r;
ok(again.already_completed === true && again.xp_awarded === 0 && again.achievements.length === 0, 'Testes 21/22 · repetir a conclusão não dá nada de novo');
ok((await one(A, `select count(*)::int n from public.xp_transactions where source_type = 'challenge_completed'`)).n === 1, 'Teste 17 · uma única transação de XP do desafio');
ok((await one(A, `select count(*)::int n from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id where a.slug = 'primeira-arvore'`)).n === 1, 'Teste 18 · conquista não duplicada');
const item = await one(A, `select u.quantity, u.position_x::int x, u.metadata, u.source_type from public.user_world_items u join public.world_items wi on wi.id = u.world_item_id where wi.code = 'tree_basic'`);
ok(item.quantity === 1 && item.x === 55 && item.metadata.revealed === false && item.source_type === 'challenge', 'Teste 19 · árvore no mundo uma única vez (origem: desafio)');
ok((await one(A, `select public.accept_challenge('${CH}') id`)).id === uc, 'aceitar de novo após concluir não cria duplicata');
const ucDone = await one(A, 'select status, progress_percentage p from public.user_challenges');
ok(ucDone.status === 'completed' && ucDone.p === 100, 'Teste 24 · desafio concluído (100%)');
const prof = await one(A, 'select total_xp, knowledge_xp, action_xp, achievement_xp, level from public.profiles');
// 20 aula + 30 quiz · 5 início + 10 etapas + 60 acompanhamentos + 100 desafio · conquistas 10+10+50+50
ok(prof.total_xp === 345 && prof.knowledge_xp === 50 && prof.action_xp === 175 && prof.achievement_xp === 120 && prof.level === 3, `perfil: ${JSON.stringify(prof)}`);
const xpSum = await one(A, 'select sum(amount)::int s, count(*)::int n from public.xp_transactions');
ok(xpSum.s === prof.total_xp && xpSum.n === 13, `histórico de XP bate com o perfil (${xpSum.n} transações)`);
ok((await as(B, `select id from public.user_world_items where user_id = '${A}'`)).length === 0, 'B NÃO vê o mundo de A');

console.log('\n# Evoluir: jogador vê o mundo → ciclo completo');
r = await one(A, `select public.reveal_world_items() r`);
ok(r.r.revealed.length === 4 && r.r.achievements[0]?.slug === 'primeiro-ciclo-completo', `revelados 4 itens novos + "Primeiro Ciclo Completo" (${r.r.revealed.length})`);
r = await one(A, `select public.reveal_world_items() r`);
ok(r.r.revealed.length === 0 && r.r.achievements.length === 0, 'revelar de novo não repete nada');
ok((await as(A, 'select id from public.user_achievements')).length === 5, 'A tem as 5 conquistas');
await expectError(A, `insert into public.user_achievements (user_id, achievement_id) values ('${A}', '60000000-0000-4000-8000-000000000001')`, 'permission denied', 'duplicar conquista impossível');

console.log('\n# Estado do jogador em uma chamada');
const st = (await one(A, 'select public.get_player_state() s')).s;
ok(st.profile.display_name === 'Ana' && st.lessons.length === 1 && st.quizzes[0].passed === true &&
   st.quizzes[0].attempts === 2 && st.challenges[0].followups.length === 3 && st.challenges[0].evidence.length === 5 &&
   st.challenges[0].steps.some((s) => s.notes) && typeof st.server_time === 'string' &&
   st.achievements.length === 5 && st.world.items.length === 5 && st.world.stage === 3,
   'get_player_state completo (etapas com notas, 5 evidências, hora do servidor)');
const stB = (await one(B, 'select public.get_player_state() s')).s;
ok(stB.challenges.length === 0 && stB.achievements.length === 0 && stB.world.items.length === 1, 'estado de B só tem o mundo inicial (isolado)');
await expectError('anon', 'select public.get_player_state()', 'permission denied|not_authenticated', 'anon não obtém estado');

console.log('\n# Auditoria');
await expectError(A, `select public.admin_recalculate_xp('${A}')`, 'forbidden', 'usuário não recalcula XP');
await db.exec(`update public.profiles set total_xp = 1 where user_id = '${A}'`); // corrompe o cache
await as(ADMIN, `select public.admin_recalculate_xp('${A}')`);
ok((await one(A, 'select total_xp from public.profiles')).total_xp === 375, 'admin recalcula o XP a partir do histórico (375)');

console.log('\n# Expiração e cancelamento');
await as(B, `select public.track_lesson_progress('${LESSON}', 4)`);
await as(B, `select public.complete_lesson('${LESSON}')`);
const attB = (await one(B, `select public.start_quiz_attempt('${QUIZ}')->>'attempt_id' id`)).id;
for (const [q, o] of [['1', '12'], ['2', '23'], ['3', '31'], ['4', '44'], ['5', '52']]) {
  await as(B, `select public.answer_quiz_question($1,$2,$3)`, [attB, `31000000-0000-4000-8000-00000000000${q}`, `32000000-0000-4000-8000-0000000000${o}`]);
}
await as(B, `select public.finish_quiz_attempt('${attB}')`);
const ucB = (await one(B, `select public.accept_challenge('${CH}') id`)).id;
await db.exec(`update public.user_challenges set deadline_at = now() - interval '1 day' where id = '${ucB}'`);
await expectError(B, stepSql, 'challenge_expired', 'Teste 13 · etapa após o prazo é recusada', stepArgs(ucB, S.local));
await expectError(B, `select public.complete_challenge('${ucB}')`, 'challenge_expired', 'Teste 13 · desafio expirado não pode ser concluído');
const ucB2 = (await one(B, `select public.accept_challenge('${CH}') id`)).id;
ok(ucB2 !== ucB && (await as(B, `select status from public.user_challenges order by created_at`)).map((x) => x.status).join() === 'expired,accepted', 'reiniciar: o antigo expira e um novo começa');
await as(B, `select public.cancel_challenge('${ucB2}')`);
await expectError(B, stepSql, 'challenge_not_active', 'desafio cancelado não aceita etapas', stepArgs(ucB2, S.local));
await expectError(B, `select public.cancel_challenge('${ucB2}')`, 'challenge_not_active', 'não cancela duas vezes');
await expectError(A, `select public.cancel_challenge('${uc}')`, 'challenge_not_active', 'desafio concluído não pode ser cancelado');
const ucB3 = (await one(B, `select public.accept_challenge('${CH}') id`)).id;
ok(ucB3 !== ucB2, 'depois de encerrar, pode aceitar de novo');
await expectError(A, `select public.expire_overdue_challenges()`, 'permission denied', 'rotina de expiração não é acessível ao usuário');

// =====================================================================
console.log('\n# Etapa 3 · Aprendizagem');
const lp = await one(A, `select status, progress_percentage, completed_at is not null done from public.user_lesson_progress where lesson_id = '${LESSON}'`);
ok(lp.status === 'completed' && lp.progress_percentage === 100 && lp.done, 'Teste 7 · aula concluída (completed, 100%, completed_at)');
ok((await one(A, `select count(*)::int n from public.xp_transactions where source_type = 'lesson_completed' and xp_type = 'knowledge'`)).n === 1, 'Teste 6 · XP de conhecimento registrado uma única vez');
t = (await one(A, `select public.track_lesson_progress('${LESSON}', 1) r`)).r;
ok(t.status === 'completed' && t.progress_percentage === 100, 'revisar uma aula concluída não a reabre');
ok((await as('anon', `select related_lesson_id from public.lesson_related where lesson_id = '${LESSON}'`)).length === 4, 'Teste 9 · 4 conteúdos relacionados');
const secs = await as('anon', `select blocks, image_alt from public.lesson_sections where lesson_id = '${LESSON}' order by order_index`);
ok(secs.length === 5 && secs[4].blocks.some((b) => b.type === 'choice') && secs[2].blocks.some((b) => b.type === 'observe'), 'aula das árvores: 5 partes com blocos interativos');
ok((await one('anon', `select difficulty from public.lessons where id = '${LESSON}'`)).difficulty === 'beginner', 'dificuldade migrada para beginner');
ok((await as('anon', `select slug from public.lessons where difficulty = 'intermediate'`)).length === 2, 'níveis beginner/intermediate disponíveis');

// Teste 10 · outro usuário não altera o progresso do primeiro
const before = await one(A, `select progress_percentage, status from public.user_lesson_progress where lesson_id = '${LESSON}'`);
await expectError(B, `update public.user_lesson_progress set status = 'not_started', progress_percentage = 0`, 'permission denied', 'Teste 10 · B não altera progresso diretamente');
await expectError(B, `insert into public.user_lesson_progress (user_id, lesson_id, status) values ('${A}', '${LESSON}', 'not_started')`, 'permission denied', 'B não cria progresso para A');
const planta = '20000000-0000-4000-8000-000000000002';
await as(B, `select public.track_lesson_progress('${planta}', 0)`);
const after = await one(A, `select progress_percentage, status from public.user_lesson_progress where lesson_id = '${LESSON}'`);
ok(after.progress_percentage === before.progress_percentage && after.status === before.status, 'Teste 10 · progresso de A intacto após ações de B');
ok((await as(B, `select user_id from public.user_lesson_progress where user_id = '${A}'`)).length === 0, 'B não enxerga o progresso de A');

console.log('\n# Pré-requisitos');
const horta = '20000000-0000-4000-8000-000000000003';
await expectAllowed(A, `select public.track_lesson_progress('${horta}', 0)`, 'aulas abertas (28): sem pré-requisito, qualquer aula pode ser começada');
await expectError(A, `select public.complete_lesson('${horta}')`, 'lesson_not_finished', 'aula aberta, mas só conclui depois de ler até o fim');
await as(A, `select public.track_lesson_progress('${planta}', 2)`);
r = await one(A, `select public.complete_lesson('${planta}') r`);
ok(r.r.xp_awarded === 20, 'aula curta concluída (+20 XP)');
t = (await one(A, `select public.track_lesson_progress('${horta}', 0) r`)).r;
ok(t.status === 'in_progress', 'pré-requisito concluído libera a aula seguinte');

console.log('\n# Favoritos');
ok((await as(A, `insert into public.user_lesson_favorites (lesson_id) values ('${LESSON}') returning user_id`))[0].user_id === A, 'favoritar (user_id preenchido pelo servidor)');
await expectError(A, `insert into public.user_lesson_favorites (lesson_id) values ('${LESSON}')`, 'duplicate|unique', 'não duplica favorito');
await expectError(A, `insert into public.user_lesson_favorites (user_id, lesson_id) values ('${B}', '${planta}')`, 'row-level security', 'não cria favorito para outro usuário');
ok((await as(B, 'select id from public.user_lesson_favorites')).length === 0, 'B não vê os favoritos de A');
ok((await as(B, `delete from public.user_lesson_favorites returning id`)).length === 0, 'B não remove os favoritos de A');
ok((await one(A, 'select public.get_player_state() s')).s.favorites[0] === LESSON, 'favoritos no estado do jogador');
ok((await as(A, `delete from public.user_lesson_favorites where lesson_id = '${LESSON}' returning id`)).length === 1, 'desfavoritar');
await expectError('anon', 'select id from public.user_lesson_favorites', 'permission denied', 'anon não acessa favoritos');

console.log('\n# Busca');
const found = await as('anon', `select slug from public.lessons where active and search_text like '%arvore%'`);
ok(found.some((x) => x.slug === 'por-que-as-arvores-sao-importantes'), `"árvore" encontra a aula das árvores (sem acento) → ${found.length} resultado(s)`);
ok((await as('anon', `select slug from public.lessons where search_text like '%polinizador%'`)).length === 1, 'busca por "polinizador"');
await expectError(A, `select public.lesson_section_count('${LESSON}')`, 'permission denied', 'funções internas continuam protegidas');

// =====================================================================
console.log('\n# Etapa 4 · Quiz');
const D = 'dddddddd-0000-4000-8000-00000000000d';
await db.exec(`insert into auth.users (id, email) values ('${D}', 'd@x.com')`);
const lessonIdBySlug = async (slug) => (await db.query(`select id from public.lessons where slug = $1`, [slug])).rows[0].id;
const quizOf = async (lessonId) => (await db.query(`select id from public.quizzes where lesson_id = $1`, [lessonId])).rows[0].id;
const questionsOf = async (quizId) =>
  (await db.query(`select q.id, (select id from public.quiz_options o where o.question_id = q.id and o.is_correct) correct,
                          (select id from public.quiz_options o where o.question_id = q.id and not o.is_correct order by order_index limit 1) wrong
                   from public.quiz_questions q where q.quiz_id = $1 and q.active order by q.order_index`, [quizId])).rows;
const finishLesson = async (user, lessonId) => {
  const n = (await db.query(`select count(*)::int n from public.lesson_sections where lesson_id = $1`, [lessonId])).rows[0].n;
  await as(user, `select public.track_lesson_progress($1, $2)`, [lessonId, n - 1]);
  await as(user, `select public.complete_lesson($1)`, [lessonId]);
};
const start = async (user, quizId) => (await one(user, `select public.start_quiz_attempt($1) r`, [quizId])).r;
const answerAll = async (user, attemptId, questions, pick) => {
  for (const [i, q] of questions.entries()) {
    await as(user, `select public.answer_quiz_question($1, $2, $3)`, [attemptId, q.id, pick(i) ? q.correct : q.wrong]);
  }
};
const finish = async (user, attemptId) => (await one(user, `select public.finish_quiz_attempt($1) r`, [attemptId])).r;

// Estrutura
const counts4 = (await db.query(`select (select count(*) from public.quizzes)::int qz,
  (select count(*) from public.quizzes where passing_score = 70)::int p70,
  (select count(*) from public.quiz_questions where topic is null)::int notopic,
  (select count(*) from public.quiz_options where explanation is null)::int nofeedback`)).rows[0];
ok(counts4.qz === EXP.quizzes && counts4.p70 === EXP.quizzesAt70 && counts4.notopic === 0 && counts4.nofeedback === 0,
   `${EXP.quizzes} quizzes, nota mínima configurada no banco, todas as perguntas com tópico e alternativas com feedback ${JSON.stringify(counts4)}`);
ok((await as(A, 'select topic, question_type from public.quiz_questions limit 1'))[0].question_type === 'single_choice', 'tópico e tipo da pergunta são públicos');
await expectError(A, 'select explanation from public.quiz_options', 'permission denied', 'feedback das alternativas continua oculto antes da resposta');
const oldAttempt = await one(A, `select status, attempt_number from public.quiz_attempts where quiz_id = '${QUIZ}' order by started_at limit 1`);
ok(oldAttempt.status === 'completed' && oldAttempt.attempt_number === 1, 'tentativas da Etapa 2 migradas (status/número)');

// Testes 1 e 2 · aula não concluída / concluída
const TREE_QUIZ = QUIZ;
await expectError(D, `select public.start_quiz_attempt('${TREE_QUIZ}')`, 'lesson_not_completed', 'Teste 1 · quiz bloqueado sem concluir a aula');
await expectAllowed(D, `select public.accept_challenge('${CH}')`, 'missões abertas (28): aceitar sem a aula');
await finishLesson(D, LESSON);
await expectAllowed(D, `select public.accept_challenge('${CH}')`, 'missões abertas (28): aceitar sem quiz aprovado');

// Testes 3, 4, 5 · começar, abandonar e retornar
const treeQs = await questionsOf(TREE_QUIZ);
let s1 = await start(D, TREE_QUIZ);
ok(s1.attempt_number === 1, 'Teste 2/3 · aula concluída → tentativa 1 criada (status started)');
let fbD = (await one(D, `select public.answer_quiz_question($1,$2,$3) r`, [s1.attempt_id, treeQs[0].id, treeQs[0].wrong])).r;
ok(fbD.is_correct === false && fbD.option_explanation.length > 20 && fbD.explanation.length > 20 && fbD.correct_option_id === treeQs[0].correct,
   'Teste 6 · resposta errada: feedback da alternativa + explicação + correta');
await expectError(D, `select public.answer_quiz_question($1,$2,$3)`, 'already_answered', 'resposta não pode ser alterada', [s1.attempt_id, treeQs[0].id, treeQs[0].correct]);
let active = (await one(D, `select public.get_active_quiz_attempt('${TREE_QUIZ}') r`)).r;
ok(active.attempt_id === s1.attempt_id && active.answers.length === 1 && active.answers[0].question_id === treeQs[0].id,
   'Testes 4/5 · ao voltar, a tentativa em andamento é retomada (1 resposta; nada das outras perguntas é revelado)');
let s2 = await start(D, TREE_QUIZ);
const statuses = (await as(D, `select status from public.quiz_attempts where quiz_id = '${TREE_QUIZ}' order by attempt_number`)).map((x) => x.status);
ok(s2.attempt_number === 2 && statuses.join() === 'abandoned,started', 'recomeçar marca a anterior como "abandoned" (histórico preservado)');
await expectError(D, `select public.answer_quiz_question($1,$2,$3)`, 'attempt_closed', 'tentativa abandonada não aceita respostas', [s1.attempt_id, treeQs[1].id, treeQs[1].correct]);

// Testes 6, 9 · reprovado
await answerAll(D, s2.attempt_id, treeQs, (i) => i < 3); // 3/5 = 60% < 70%
let res = await finish(D, s2.attempt_id);
ok(res.passed === false && res.score === 60 && res.passing_score === 70 && res.correct_answers === 3 && res.incorrect_answers === 2,
   'Teste 9 · reprovado com 60% (nota mínima 70% vinda do banco)');
ok(res.xp_awarded === 0 && res.challenge_unlocked === null && res.review.length === 5 && res.review.filter((x) => !x.is_correct).length === 2,
   'reprovação: sem XP, sem desafio, revisão com as 2 perguntas erradas');
await expectError(D, `select public.finish_quiz_attempt('${s2.attempt_id}')`, 'attempt_closed', 'não finaliza a mesma tentativa duas vezes');
await expectAllowed(D, `select public.accept_challenge('${CH}')`, 'missões abertas (28): reprovação não bloqueia o desafio');

// Testes 7, 8, 10, 11, 13, 14 · tentar de novo e ser aprovado
const s3 = await start(D, TREE_QUIZ);
await answerAll(D, s3.attempt_id, treeQs, (i) => i < 4); // 80%
res = await finish(D, s3.attempt_id);
ok(res.passed && res.score === 80 && res.first_pass && res.attempt_number === 3, 'Testes 8/10 · aprovado na tentativa 3 (80%)');
ok(res.xp_awarded === 30, 'Teste 11 · +30 XP (xp_reward configurado no banco)');
ok(res.achievements.some((a) => a.slug === 'primeiro-conhecimento'), 'Teste 13 · conquista "Primeiro Conhecimento"');
ok(res.challenge_unlocked?.slug === 'plante-uma-arvore', 'Teste 14 · servidor informa o desafio desbloqueado');
ok(res.points_earned === 4 && res.points_total === 5, 'pontos calculados no servidor (4/5)');
ok(typeof (await one(D, `select public.accept_challenge('${CH}') id`)).id === 'string', 'Teste 14 · desafio aceito após aprovação');

// Teste 12 · XP não duplicado
const s4 = await start(D, TREE_QUIZ);
await answerAll(D, s4.attempt_id, treeQs, () => true);
res = await finish(D, s4.attempt_id);
ok(res.passed && res.score === 100 && !res.first_pass && res.xp_awarded === 0, 'Teste 12 · nova aprovação (100%) não repete o XP');
ok((await one(D, `select count(*)::int n from public.xp_transactions where source_type like 'quiz%'`)).n === 1, 'uma única transação de XP de quiz');
const hist = await as(D, `select attempt_number, status, score, passed from public.quiz_attempts where quiz_id = '${TREE_QUIZ}' order by attempt_number`);
ok(hist.map((h) => `${h.attempt_number}:${h.status}:${h.score}`).join(' ') === '1:abandoned:0 2:completed:60 3:completed:80 4:completed:100',
   `Teste 10 · histórico de tentativas: ${hist.map((h) => `#${h.attempt_number} ${h.status} ${h.score}%`).join(', ')}`);

// Bônus de melhoria configurável e limitado
const plantaLesson = await lessonIdBySlug('como-uma-planta-cresce');
const plantaQuiz = await quizOf(plantaLesson);
const plantaQs = await questionsOf(plantaQuiz);
await finishLesson(D, plantaLesson);
await as(ADMIN, `update public.quizzes set improvement_xp_reward = 20 where id = '${plantaQuiz}'`);
let sp = await start(D, plantaQuiz);
await answerAll(D, sp.attempt_id, plantaQs, (i) => i < 2); // 67%
res = await finish(D, sp.attempt_id);
ok(res.passed && res.score === 67 && res.xp_awarded === 30, 'aula curta: aprovado com 67% (mínimo 60%) → +30 XP');
sp = await start(D, plantaQuiz);
await answerAll(D, sp.attempt_id, plantaQs, () => true);
res = await finish(D, sp.attempt_id);
ok(res.xp_awarded === 20, 'bônus configurável ao superar a melhor nota (67% → 100%): +20 XP');
sp = await start(D, plantaQuiz);
await answerAll(D, sp.attempt_id, plantaQs, () => true);
res = await finish(D, sp.attempt_id);
ok(res.xp_awarded === 0, 'repetir 100% não gera mais XP (sem exploração)');

// Limite de tentativas configurável
await as(ADMIN, `update public.quizzes set attempts_allowed = 3 where id = '${plantaQuiz}'`);
await expectError(D, `select public.start_quiz_attempt('${plantaQuiz}')`, 'attempts_exhausted', 'attempts_allowed respeitado');
await as(ADMIN, `update public.quizzes set attempts_allowed = null, improvement_xp_reward = 0 where id = '${plantaQuiz}'`);

// Conquista "Aprendiz Dedicado" (5 quizzes)
for (const slug of ['por-que-precisamos-economizar-agua', 'o-que-e-reciclagem']) {
  const lid = await lessonIdBySlug(slug);
  await finishLesson(D, lid);
  const qz = await quizOf(lid);
  const st = await start(D, qz);
  await answerAll(D, st.attempt_id, await questionsOf(qz), () => true);
  res = await finish(D, st.attempt_id);
}
ok(!res.achievements.some((a) => a.slug === 'aprendiz-dedicado'), '4 quizzes aprovados: ainda sem a conquista de 5');
{
  const lid = await lessonIdBySlug('o-que-e-biodiversidade');
  await finishLesson(D, lid);
  const qz = await quizOf(lid);
  const st = await start(D, qz);
  await answerAll(D, st.attempt_id, await questionsOf(qz), () => true);
  res = await finish(D, st.attempt_id);
  ok(res.achievements.some((a) => a.slug === 'aprendiz-dedicado'), 'conquista "Aprendiz Dedicado" no 5º quiz');
}

// Teste 15 · outro usuário não manipula o resultado
const sD = await start(D, TREE_QUIZ);
await expectError(B, `select public.answer_quiz_question($1,$2,$3)`, 'not_found', 'Teste 15 · B não responde na tentativa de D', [sD.attempt_id, treeQs[0].id, treeQs[0].correct]);
await expectError(B, `select public.finish_quiz_attempt('${sD.attempt_id}')`, 'not_found', 'B não finaliza a tentativa de D');
ok((await as(B, `select id from public.quiz_attempts where user_id = '${D}'`)).length === 0, 'B não vê as tentativas de D');
ok((await one(B, `select public.get_active_quiz_attempt('${TREE_QUIZ}') r`)).r === null, 'B não enxerga a tentativa em andamento de D');
await expectError(D, `update public.quiz_attempts set passed = true, score = 100 where id = '${sD.attempt_id}'`, 'permission denied', 'nem o dono altera nota/aprovação diretamente');
await expectError(D, `insert into public.quiz_attempts (user_id, quiz_id, status, passed, score) values ('${D}', '${TREE_QUIZ}', 'completed', true, 100)`, 'permission denied', 'não cria tentativa "aprovada" pelo cliente');
await expectError(D, `insert into public.quiz_answers (attempt_id, question_id, selected_option_id, is_correct) values ('${sD.attempt_id}', '${treeQs[0].id}', '${treeQs[0].wrong}', true)`, 'permission denied', 'não registra resposta com is_correct forjado');
await expectError(D, `select public.quiz_answer_review('${sD.attempt_id}')`, 'permission denied', 'função interna de revisão protegida');
await expectError(D, `select public.get_owned_attempt('${sD.attempt_id}', '${D}')`, 'permission denied', 'função interna de tentativa protegida');
await expectError('anon', `select public.start_quiz_attempt('${TREE_QUIZ}')`, 'permission denied|not_authenticated', 'anon não inicia quiz');

// =====================================================================
console.log('\n# Calendário da missão (sem burlar datas)');
const E = 'eeeeeeee-0000-4000-8000-00000000000e';
await db.exec(`insert into auth.users (id, email) values ('${E}', 'e@x.com')`);
await finishLesson(E, LESSON);
{
  const st = await start(E, TREE_QUIZ);
  await answerAll(E, st.attempt_id, treeQs, () => true);
  await finish(E, st.attempt_id);
}
const ucE = (await one(E, `select public.accept_challenge('${CH}') id`)).id;
await db.exec(`update public.user_challenges set accepted_at = now() - interval '10 days', deadline_at = now() + interval '5 days' where id = '${ucE}'`);
for (const s of [S.local, S.especie, S.solo, S.plantar]) await doStep(E, ucE, s);
const photoE = `users/${E}/challenges/${CH}/1-e.jpg`;
await upload(E, photoE);
await expectError(E, stepSql, 'invalid_date', 'data anterior ao aceite da missão é recusada', stepArgs(ucE, S.foto, { file: photoE, ...JPG, date: new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10) }));
await doStep(E, ucE, S.foto, { file: photoE, ...JPG, date: new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10) });
await doStep(E, ucE, S.info, { note: 'Plantei há 10 dias' });
const daysE = await as(E, `select (scheduled_for::date - current_date) d from public.challenge_followups where user_challenge_id = '${ucE}' order by scheduled_for`);
ok(daysE.map((x) => x.d).join() === '30,90,180', 'acompanhamentos contam do dia do registro no servidor (data digitada no passado não adianta)');
const fuE = (await one(E, `select id from public.challenge_followups where user_challenge_id = '${ucE}' order by scheduled_for limit 1`)).id;
const fuPhotoE = `users/${E}/challenges/${CH}/2-e.jpg`;
await upload(E, fuPhotoE);
await db.exec(`update public.challenge_followups set scheduled_for = now() + interval '3 days' where id = '${fuE}'`);
await expectError(E, followSql, 'followup_not_due', 'faltando 3 dias: ainda bloqueado (janela de 2 dias)', followArgs(fuE, { file: fuPhotoE, ...JPG }));
await db.exec(`update public.challenge_followups set scheduled_for = now() + interval '1 day' where id = '${fuE}'`);
ok((await one(E, followSql, followArgs(fuE, { file: fuPhotoE, ...JPG }))).r.xp_awarded === 20, 'faltando 1 dia: liberado (dentro da janela) +20 XP');
await expectError(E, `update public.challenge_followups set scheduled_for = now() - interval '1 day'`, 'permission denied', 'jogador não consegue antecipar a data do acompanhamento');

console.log('\n# Etapa 5 · Outros desafios');
const F = 'ffffffff-0000-4000-8000-00000000000f';
await db.exec(`insert into auth.users (id, email) values ('${F}', 'f@x.com')`);
const catalog = (await db.query(`select c.id, c.slug, c.lesson_id, c.requires_follow_up,
  (select count(*)::int from public.challenge_steps s where s.challenge_id = c.id and s.active) steps
  from public.challenges c where c.active order by c.slug`)).rows;
ok(catalog.length === EXP.challenges, `${EXP.challenges} desafios cadastrados: ${catalog.map((c) => c.slug).join(', ')}`);
const stepsOf = async (challengeId) => (await db.query(`select id, step_type, evidence_kind from public.challenge_steps where challenge_id = $1 and active order by order_index`, [challengeId])).rows;
const runMain = async (user, ch) => {
  await finishLesson(user, ch.lesson_id);
  const qz = await quizOf(ch.lesson_id);
  const stq = await start(user, qz);
  await answerAll(user, stq.attempt_id, await questionsOf(qz), () => true);
  await finish(user, stq.attempt_id);
  const id = (await one(user, `select public.accept_challenge($1) id`, [ch.id])).id;
  let last;
  for (const s of (await stepsOf(ch.id)).filter((x) => x.step_type !== 'follow_up')) {
    if (s.evidence_kind === 'photo') {
      const p = `users/${user}/challenges/${ch.id}/${s.id}.jpg`;
      await upload(user, p);
      last = await doStep(user, id, s.id, { file: p, ...JPG });
    } else {
      last = await doStep(user, id, s.id, { note: s.evidence_kind === 'text' ? 'Registro de teste' : null });
    }
  }
  return { id, last };
};
// Sem acompanhamento: conclui direto após o checklist
const acao = catalog.find((c) => c.slug === 'participe-de-uma-acao-ambiental');
let run = await runMain(F, acao);
ok(run.last.status === 'in_progress' && run.last.progress_percentage === 100, 'desafio sem acompanhamento: checklist completo (100%), aguardando conclusão');
r = await one(F, `select public.complete_challenge('${run.id}') r`);
ok(r.r.xp_awarded === 100 && r.r.world_items.some((w) => w.code === 'community_tree') && r.r.world_items.some((w) => w.code === 'green_square') && r.r.achievements.some((a) => a.slug === 'primeiro-passo') && r.r.achievements.some((a) => a.slug === 'acao-em-comunidade'), 'ação ambiental concluída: +100 XP, árvore comunitária + Praça Verde, "Primeiro Passo" e "Ação em Comunidade"');
// Registro diário (7 dias, texto)
const residuos = catalog.find((c) => c.slug === 'separe-seus-residuos-por-7-dias');
run = await runMain(F, residuos);
ok(run.last.status === 'waiting_follow_up', 'resíduos: etapas principais → registros diários agendados');
const days = await as(F, `select id, (scheduled_for::date - current_date) d from public.challenge_followups where user_challenge_id = '${run.id}' order by scheduled_for`);
ok(days.map((x) => x.d).join() === '1,2,3,4,5,6,7', 'registros diários: dias 1 a 7');
await expectError(F, followSql, 'followup_not_due', 'registro do dia 1 ainda não abre hoje (janela 0)', followArgs(days[0].id, { note: 'x' }));
await db.exec(`update public.challenge_followups set scheduled_for = now() - interval '1 hour' where id = '${days[0].id}'`);
await expectError(F, followSql, 'observation_required', 'registro diário exige observação', followArgs(days[0].id));
ok((await one(F, followSql, followArgs(days[0].id, { note: 'Separei 3 embalagens e reaproveitei um pote.' }))).r.xp_awarded === 5, 'registro do dia 1 (texto) +5 XP');
// Flor: item do mundo próprio
const flor = catalog.find((c) => c.slug === 'cultive-uma-flor');
run = await runMain(F, flor);
const fuFlor = (await one(F, `select id from public.challenge_followups where user_challenge_id = '${run.id}'`)).id;
await db.exec(`update public.challenge_followups set scheduled_for = now() - interval '1 day' where id = '${fuFlor}'`);
const pFlor = `users/${F}/challenges/${flor.id}/fu.jpg`;
await upload(F, pFlor);
await as(F, followSql, followArgs(fuFlor, { file: pFlor, ...JPG }));
r = await one(F, `select public.complete_challenge('${run.id}') r`);
ok(r.r.xp_awarded === 100 && r.r.world_items.some((w) => w.code === 'flower_basic') && r.r.achievements.some((a) => a.slug === 'primeira-flor'), 'flor concluída: +100 XP, item "Flor" no mundo e "Primeira Flor"');

// =====================================================================
// Etapa 6 · Gamificação: XP, níveis, conquistas e eventos
// =====================================================================
console.log('\n# Etapa 6 · Primeira experiência completa (usuário novo)');
const G = '99999999-0000-4000-8000-000000000009';
await db.exec(`insert into auth.users (id, email) values ('${G}', 'g@x.com')`);
const profG = async () => one(G, 'select total_xp, knowledge_xp, action_xp, achievement_xp, bonus_xp, level from public.profiles');
const txCount = async (type) => (await db.query(`select count(*)::int n from public.xp_transactions where user_id = $1 and source_type = $2`, [G, type])).rows[0].n;
const hasAch = async (slug) => (await db.query(`select 1 from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id where ua.user_id = $1 and a.slug = $2`, [G, slug])).rows.length === 1;
const progressOf = async (type, value = '') => (await db.query(`select public.achievement_progress($1, $2, $3) n`, [G, type, value])).rows[0].n;

let pg = await profG();
ok(pg.total_xp === 0 && pg.level === 1, 'Nível 1 · usuário começa no nível 1 com 0 XP');

// Lição
await finishLesson(G, LESSON);
pg = await profG();
ok(pg.knowledge_xp === 20 && await txCount('lesson_completed') === 1, 'XP 1 · concluir lição gera XP (+20, origem lesson_completed)');
ok(await hasAch('primeiro-aprendizado') && pg.achievement_xp === 10, 'Conquista 1 · primeira lição → "Primeiro Aprendizado" (+10 XP)');
r = await one(G, `select public.complete_lesson('${LESSON}') r`);
ok(r.r.xp_awarded === 0 && r.r.achievements.length === 0 && await txCount('lesson_completed') === 1, 'XP 2 · concluir de novo (atualizar a página) não duplica XP');

// Quiz
let stG = await start(G, QUIZ);
await answerAll(G, stG.attempt_id, await questionsOf(QUIZ), () => true);
let fin = await finish(G, stG.attempt_id);
ok(fin.xp_awarded === 30 && await txCount('quiz_passed') === 1, 'XP 3 · passar no quiz gera XP (+30, origem quiz_passed)');
ok(fin.achievements.some((a) => a.slug === 'primeiro-conhecimento'), 'Conquista 2 · primeiro quiz → "Primeiro Conhecimento"');
stG = await start(G, QUIZ);
await answerAll(G, stG.attempt_id, await questionsOf(QUIZ), () => true);
fin = await finish(G, stG.attempt_id);
ok(fin.passed && fin.xp_awarded === 0 && await txCount('quiz_passed') === 1, 'XP 4 · refazer o quiz aprovado não gera XP de novo');

// Desafio: iniciar, encerrar e iniciar de novo
const ucG1 = (await one(G, `select public.accept_challenge('${CH}') id`)).id;
ok((await profG()).total_xp === 75 && await txCount('challenge_started') === 1, 'XP 5 · iniciar o desafio gera +5 XP');
await as(G, `select public.cancel_challenge('${ucG1}')`);
const ucG = (await one(G, `select public.accept_challenge('${CH}') id`)).id;
ok(ucG !== ucG1 && (await profG()).total_xp === 75 && await txCount('challenge_started') === 1, 'XP 5 · encerrar e iniciar de novo não gera XP de novo (sem farm)');

// Checklist (só as etapas com evidência dão XP: foto +5, observação +5)
for (const s of (await stepsOf(CH)).filter((x) => x.step_type !== 'follow_up')) {
  if (s.evidence_kind === 'photo') {
    const p = `users/${G}/challenges/${CH}/${s.id}.jpg`;
    await upload(G, p);
    await doStep(G, ucG, s.id, { file: p, ...JPG });
  } else {
    await doStep(G, ucG, s.id, { note: s.evidence_kind === 'text' ? 'Plantei um ipê.' : null });
  }
}
ok(await txCount('challenge_step_completed') === 2 && (await profG()).total_xp === 85, 'etapas importantes: +5 XP cada (2 etapas configuradas)');
const fotoStep = (await stepsOf(CH)).find((s) => s.evidence_kind === 'photo');
await expectError(G, stepSql, 'step_already_completed|challenge_not_active', 'mesma etapa não pode ser concluída de novo', stepArgs(ucG, fotoStep.id, { file: `users/${G}/challenges/${CH}/${fotoStep.id}.jpg`, ...JPG }));
ok(await txCount('challenge_step_completed') === 2, 'enviar outra foto não gera XP');

// Acompanhamentos (datas antecipadas só no teste)
await db.exec(`update public.challenge_followups set scheduled_for = now() - interval '1 day' where user_challenge_id = '${ucG}'`);
const fusG = await as(G, `select id from public.challenge_followups where user_challenge_id = '${ucG}' order by scheduled_for`);
for (const [i, f] of fusG.entries()) {
  const p = `users/${G}/challenges/${CH}/fu${i}.jpg`;
  await upload(G, p);
  const rr = (await one(G, followSql, followArgs(f.id, { file: p, ...JPG }))).r;
  ok(rr.xp_awarded === 20, `XP 7 · acompanhamento ${i + 1} gera +20 XP`);
}
await expectError(G, followSql, '.+', 'acompanhamento repetido é recusado', followArgs(fusG[0].id, { file: `users/${G}/challenges/${CH}/fu0.jpg`, ...JPG }));
ok(await txCount('followup_completed') === 3, 'XP 7 · cada acompanhamento gera XP uma única vez');
pg = await profG();
ok(pg.total_xp === 145 && pg.level === 2, `Nível 2/5 · 145 XP → nível 2 (subida detectada) ${JSON.stringify(pg)}`);
const lvlEvents = async () => (await db.query(`select (metadata->>'level')::int lv from public.gamification_events where user_id = $1 and event_type = 'level_reached' order by 1`, [G])).rows.map((x) => x.lv);
ok((await lvlEvents()).join() === '2', 'Nível 5 · evento level_reached registrado para o nível 2');

// Conclusão
r = await one(G, `select public.complete_challenge('${ucG}') r`);
const slugsG = r.r.achievements.map((a) => a.slug);
ok(r.r.xp_awarded === 100 && await txCount('challenge_completed') === 1, 'XP 6 · concluir o desafio gera +100 XP');
ok(slugsG.includes('primeiro-passo'), 'Conquista 3 · primeiro desafio → "Primeiro Passo"');
ok(slugsG.includes('primeira-arvore'), 'Conquista 4 · desafio da árvore → "Primeira Árvore"');
ok(r.r.world_items.some((w) => w.code === 'tree_basic'), 'desafio concluído → item do Mundo desbloqueado');
pg = await profG();
ok(pg.total_xp === 345 && pg.level === 3 && pg.achievement_xp === 120, `jornada: 345 XP, nível 3, 120 XP de conquistas ${JSON.stringify(pg)}`);
ok((await lvlEvents()).join() === '2,3', 'subiu para o nível 3 ao concluir o desafio');
for (let i = 0; i < 3; i++) await as(G, `select public.complete_challenge('${ucG}')`);
ok(await txCount('challenge_completed') === 1 && (await profG()).total_xp === 345, 'XP 6 · cliques repetidos na conclusão não geram XP');
ok((await db.query(`select count(*)::int n from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id where ua.user_id = $1 and a.slug = 'primeira-arvore'`, [G])).rows[0].n === 1, 'Conquista 8 · conquista não é duplicada');
ok((await db.query(`select count(*)::int n from public.xp_transactions t join public.achievements a on a.id = t.source_id where t.user_id = $1 and t.source_type = 'achievement_unlocked' and a.slug = 'primeira-arvore'`, [G])).rows[0].n === 1, 'Conquista 9 / XP 8 · XP da conquista registrado uma única vez');

console.log('\n# Etapa 6 · Progresso das conquistas (dados reais)');
ok(await progressOf('lessons_completed') === 1 && await progressOf('challenges_completed') === 1, 'Conquista 5/6 · lições (1) e desafios (1) contados corretamente');
ok(await progressOf('category_actions_completed', 'natureza') === 4, 'ações de Natureza = 1 desafio + 3 acompanhamentos = 4 (Guardião das Plantas: 4/5)');
ok(await progressOf('category_challenges_completed', 'natureza') === 1 && await progressOf('category_challenges_completed', 'agua') === 0, 'desafios por categoria: Natureza 1, Água 0');
for (const slug of ['por-que-precisamos-economizar-agua', 'o-que-e-reciclagem']) await finishLesson(G, await lessonIdBySlug(slug));
ok(await progressOf('categories_explored') === 3 && !(await hasAch('explorador-eco')), '3 categorias exploradas: ainda sem "Explorador ECO"');
await finishLesson(G, await lessonIdBySlug('por-que-economizar-energia'));
ok(await progressOf('categories_explored') === 4 && await hasAch('explorador-eco'), 'Conquista 7 · 4ª categoria explorada → "Explorador ECO"');
ok(await progressOf('lessons_completed') === 4 && !(await hasAch('curioso')), '4 lições: ainda sem "Curioso"');
await finishLesson(G, await lessonIdBySlug('como-uma-planta-cresce'));
ok(await hasAch('curioso'), 'Conquista 5 · 5ª lição → "Curioso"');
pg = await profG();
ok(pg.total_xp === 505 && pg.level === 4, `505 XP → nível 4 ${JSON.stringify(pg)}`);

console.log('\n# Etapa 6 · Níveis');
const lvl = async (xp) => (await one('anon', 'select public.calculate_user_level($1) l', [xp])).l;
let L = await lvl(0);
ok(L.level === 1 && L.next_level === 2 && L.xp_to_next === 100, 'Nível 1 · 0 XP → nível 1, faltam 100 para o nível 2');
L = await lvl(680);
ok(L.level === 4 && L.title === 'Cuidador' && L.next_level === 5 && L.next_level_xp === 700 && L.xp_to_next === 20,
   `Nível 2/4 · 680 XP → nível 4 "Cuidador", próximo 5 com 700 XP, faltam 20 ${JSON.stringify(L)}`);
L = await lvl(345);
ok(L.xp_in_level === 95 && L.xp_for_next === 200 && L.xp_min === 250 && L.xp_max === 449, 'Nível 3 · barra: 95 de 200 XP dentro do nível 3 (250–449)');
L = await lvl(999999);
ok(L.level === 20 && L.next_level === null && L.xp_to_next === null, 'nível máximo (20 · Lenda ECO) sem próximo nível');
ok((await lvl(-50)).level === 1 && (await lvl(-50)).xp === 0 && (await lvl(null)).level === 1, 'Nível 9 · valores inválidos (negativo, nulo) não quebram o cálculo');
const ranges = await as('anon', 'select level_number, xp_min, xp_max from public.level_ranges order by level_number');
ok(ranges.length === 20 && ranges[3].xp_min === 450 && ranges[3].xp_max === 699 && ranges[19].xp_max === null, '20 níveis com faixa mínima/máxima vinda do banco');
// Vários níveis de uma vez: bônus especial concedido pelo servidor
await db.exec(`select public.award_xp('${G}', 1000, 'bonus', 'bonus', gen_random_uuid(), 'Evento especial de teste')`);
pg = await profG();
ok(pg.total_xp === 1505 && pg.level === 7 && pg.bonus_xp === 1000, `+1000 XP: nível 4 → 7 ${JSON.stringify(pg)}`);
ok((await lvlEvents()).join() === '2,3,4,5,6,7', 'Nível 6 · todos os níveis ultrapassados registrados (5, 6 e 7)');
await db.exec(`select public.check_achievements('${G}')`);
ok(await hasAch('em-evolucao') && !(await hasAch('guardiao-do-planeta')), '"Em Evolução" (nível 5) desbloqueada; "Guardião do Planeta" (nível 10) não');
await expectError(G, `update public.profiles set level = 20`, 'permission denied', 'Nível 7 · usuário não altera o próprio nível');
await expectError(G, `update public.profiles set total_xp = 99999`, 'permission denied', 'usuário não altera o próprio XP');
try {
  await db.exec(`insert into public.xp_transactions (user_id, amount, xp_type, source_type) values ('${G}', -10, 'bonus', 'bonus')`);
  ok(false, 'Nível 8 · XP negativo deveria ser recusado');
} catch (e) {
  ok(/xp_transactions_amount_check/.test(e.message), 'Nível 8 · XP negativo é recusado pelo banco');
}
ok((await db.query(`select public.award_xp('${G}', -10, 'bonus', 'bonus', gen_random_uuid(), 'x') n`)).rows[0].n === 0, 'award_xp ignora valor negativo');

console.log('\n# Etapa 6 · Eventos');
const gev = async (type, ref) => (await db.query(`select public.process_gamification_event($1, $2, $3) n`, [G, type, ref])).rows[0].n;
const flowerId = catalog.find((c) => c.slug === 'cultive-uma-flor').id;
for (const [type, ref, match, msg] of [
  ['challenge_completed', flowerId, 'event_not_verified', 'desafio não concluído não gera evento'],
  ['lesson_completed', await lessonIdBySlug('o-que-e-biodiversidade'), 'event_not_verified', 'lição não concluída não gera evento'],
  ['hack', CH, 'invalid_event', 'tipo de evento desconhecido é recusado'],
]) {
  try { await gev(type, ref); ok(false, msg); } catch (e) { ok(new RegExp(match).test(e.message), `${msg} → "${e.message}"`); }
}
ok(await gev('challenge_completed', CH) === 0 && await gev('challenge_completed', CH) === 0, 'XP 9 · chamadas repetidas do mesmo evento devolvem 0 XP');
try {
  await db.exec(`insert into public.gamification_events (user_id, event_type, reference_id) values ('${G}', 'challenge_completed', '${CH}')`);
  ok(false, 'evento duplicado deveria violar a chave única');
} catch (e) {
  ok(/unique|duplicate/.test(e.message), 'XP 9 · chave única (usuário, evento, referência) bloqueia duplicação mesmo em chamadas simultâneas');
}
const histG = await as(G, 'select amount, source_type, description, metadata, created_at from public.xp_transactions order by created_at desc');
ok(histG.every((t) => t.amount > 0 && t.source_type && t.description), `histórico: ${histG.length} transações com origem, descrição e data`);
ok(histG.filter((t) => t.source_type !== 'bonus').every((t) => t.metadata.event_id), 'cada transação aponta para o evento que a gerou');
ok(histG.reduce((s, t) => s + t.amount, 0) === 1505, 'soma do histórico = XP total do perfil');
const stG6 = (await one(G, 'select public.get_player_state() s')).s;
ok(stG6.profile.achievement_xp > 0 && stG6.profile.bonus_xp === 1000, 'get_player_state traz XP de conquistas e de bônus');

console.log('\n# Etapa 6 · Segurança');
await expectError(G, `insert into public.xp_transactions (user_id, amount, xp_type, source_type) values ('${G}', 100, 'bonus', 'bonus')`, 'permission denied', 'XP 10 · usuário não insere XP diretamente');
await expectError(G, `update public.xp_transactions set amount = 9999`, 'permission denied', 'usuário não altera transações');
await expectError(G, `delete from public.xp_transactions`, 'permission denied', 'usuário não apaga transações');
await expectError(G, `select public.process_gamification_event('${G}', 'challenge_completed', '${CH}')`, 'permission denied', 'usuário não chama o processador de eventos');
await expectError(G, `insert into public.gamification_events (user_id, event_type, reference_id) values ('${G}', 'bonus', '${CH}')`, 'permission denied', 'usuário não registra eventos');
await expectError(G, `insert into public.user_achievements (user_id, achievement_id) values ('${G}', '60000000-0000-4000-8000-000000000018')`, 'permission denied', 'Conquista 10 · usuário não desbloqueia conquista manualmente');
await expectError(G, `select public.check_achievements('${G}')`, 'permission denied', 'usuário não força a verificação de conquistas');
ok((await as(G, `update public.achievements set xp_reward = 5000 returning id`)).length === 0 &&
   (await db.query(`select max(xp_reward)::int m from public.achievements`)).rows[0].m < 5000, 'usuário não altera o XP das conquistas');
ok((await as(G, `update public.levels set xp_required = 0 where level_number = 20 returning id`)).length === 0, 'usuário não altera a tabela de níveis');

console.log('\n# Etapa 6 · Isolamento entre usuários (A × G)');
ok((await as(A, `select id from public.xp_transactions where user_id = '${G}'`)).length === 0, 'A não vê o XP de G');
ok((await as(A, `select id from public.gamification_events where user_id = '${G}'`)).length === 0, 'A não vê os eventos de G');
ok((await as(A, `select id from public.user_achievements where user_id = '${G}'`)).length === 0, 'A não vê as conquistas de G');
ok((await as(A, `select id from public.profiles where user_id = '${G}'`)).length === 0, 'A não vê o perfil (nível) de G');
ok((await as(G, 'select distinct user_id from public.gamification_events')).every((x) => x.user_id === G), 'G vê apenas os próprios eventos');
await expectError(A, `update public.profiles set level = 1 where user_id = '${G}'`, 'permission denied', 'A não altera o nível de G');
await expectError(A, `update public.xp_transactions set amount = 1 where user_id = '${G}'`, 'permission denied', 'A não altera o XP de G');
await expectError(A, `insert into public.user_achievements (user_id, achievement_id) values ('${G}', '60000000-0000-4000-8000-000000000018')`, 'permission denied', 'A não desbloqueia conquista para G');
await expectError(A, `select public.award_xp('${G}', 100, 'bonus', 'bonus', gen_random_uuid(), 'x')`, 'permission denied', 'A não cria recompensa para G');
await expectError(A, `select public.process_gamification_event('${G}', 'challenge_completed', '${CH}')`, 'permission denied', 'A não processa evento em nome de G');
ok((await profG()).total_xp === 1505, 'XP de G intacto após as tentativas de A');

// =====================================================================
// Etapa 7 · Mundo virtual ecológico
// =====================================================================
console.log('\n# Etapa 7 · Estrutura do mundo');
const wcount = (await db.query(`select
  (select count(*) from public.world_areas)::int areas,
  (select count(*) from public.world_stages)::int stages,
  (select count(*) from public.world_items where active)::int items,
  (select count(*) from public.world_items where active and (area is null or category_id is null or meaning is null))::int incomplete,
  (select count(*) from public.world_items where active and unlock_type = 'initial')::int initial`)).rows[0];
ok(wcount.areas === 5 && wcount.stages === 7 && wcount.items === EXP.worldItems && wcount.incomplete === 0 && wcount.initial === 1,
   `5 áreas, 7 estágios, ${EXP.worldItems} itens com área, categoria e significado ${JSON.stringify(wcount)}`);
ok((await as('anon', 'select code from public.world_items where active')).length === EXP.worldItems, 'catálogo de itens é público (sem dados de jogadores)');

console.log('\n# Etapa 7 · Mundo inicial (usuário novo)');
const W = '77777777-0000-4000-8000-000000000007';
await db.exec(`insert into auth.users (id, email) values ('${W}', 'w@x.com')`);
const worldW = await one(W, 'select id, name, description, stage, status, progress from public.worlds');
ok(worldW.name === 'Meu Primeiro Ecossistema' && worldW.description.startsWith('Este mundo cresce') && worldW.stage === 1 && worldW.status === 'empty' && worldW.progress === 0,
   'Teste 1 · novo usuário recebe "Meu Primeiro Ecossistema" (estágio 1, vazio, 0%)');
const codesOf = async (user) => (await as(user, `select wi.code, u.source_type, u.metadata from public.user_world_items u join public.world_items wi on wi.id = u.world_item_id order by u.unlocked_at, wi.sort_order`));
let itemsW = await codesOf(W);
ok(itemsW.length === 1 && itemsW[0].code === 'plant_small' && itemsW[0].source_type === 'initial' && itemsW[0].metadata.revealed === true,
   'Teste 1 · mundo inicial com uma pequena planta (sem "surgir" como novidade)');
let stW = (await one(W, 'select public.get_player_state() s')).s;
ok(stW.world.name === 'Meu Primeiro Ecossistema' && stW.world.stage === 1 && stW.world.items.length === 1 && Array.isArray(stW.world.stage_history),
   'Teste 3 · o jogador vê o próprio mundo no estado do jogo');

console.log('\n# Etapa 7 · Aprender faz o mundo crescer (conquista, lição e nível mínimo)');
const bioLesson = await lessonIdBySlug('o-que-e-biodiversidade');
// Nível mínimo configurado: a joaninha exige nível 20 (só neste teste)
await db.exec(`update public.world_items set min_level = 20 where code = 'ladybug'`);
await finishLesson(W, bioLesson);
itemsW = await codesOf(W);
ok(itemsW.some((i) => i.code === 'bush_basic' && i.source_type === 'achievement'), 'Teste 11 · conquista "Primeiro Aprendizado" libera o arbusto (origem: conquista)');
ok(!itemsW.some((i) => i.code === 'ladybug'), 'Teste 12 · nível mínimo configurado segura o item mesmo com a lição concluída');
await db.exec(`update public.world_items set min_level = null where code = 'ladybug'`);
await db.exec(`select public.sync_world('${W}')`);
itemsW = await codesOf(W);
ok(itemsW.some((i) => i.code === 'ladybug' && i.source_type === 'lesson'), 'lição "O que é biodiversidade?" libera a joaninha (origem: lição)');
let wp = (await db.query(`select public.world_progress($1) p`, [W])).rows[0].p;
ok(wp.stage === 2 && wp.items_unlocked === 2 && wp.categories_explored === 1 && wp.challenges_completed === 0,
   `Teste 15 · 2 itens + 1 categoria → estágio 2 "Primeiras plantas" ${JSON.stringify({ s: wp.stage, i: wp.items_unlocked, c: wp.categories_explored })}`);
ok((await one(W, 'select stage from public.worlds')).stage === 2, 'estágio guardado no mundo foi atualizado pelo servidor');

console.log('\n# Etapa 7 · Desafio dos polinizadores');
const polinizadores = catalog.find((c) => c.slug === 'crie-um-espaco-para-polinizadores');
const runW = await runMain(W, polinizadores);
ok(!(await codesOf(W)).some((i) => i.code === 'bee'), 'polinizadores só aparecem depois da conclusão definitiva');
await db.exec(`update public.challenge_followups set scheduled_for = now() - interval '1 day' where user_challenge_id = '${runW.id}'`);
const fuW = (await one(W, `select id from public.challenge_followups where user_challenge_id = '${runW.id}'`)).id;
const pW = `users/${W}/challenges/${polinizadores.id}/fu.jpg`;
await upload(W, pW);
await as(W, followSql, followArgs(fuW, { file: pW, ...JPG }));
r = await one(W, `select public.complete_challenge('${runW.id}') r`);
const newCodes = r.r.world_items.map((w) => w.code);
ok(['flower_pollinator', 'bee', 'butterfly'].every((c) => newCodes.includes(c)), `Teste 4/18 · desafio dos polinizadores → flores, abelha e borboleta (${newCodes.join(', ')})`);
ok(newCodes.includes('pollinator_garden') && newCodes.includes('tree_first_step'), 'marcos: "Jardim da Vida" (Amigo dos Polinizadores) e "Árvore do Primeiro Passo" (Primeiro Passo)');
ok(newCodes.includes('community_garden'), 'Teste 12 · nível 3 alcançado libera o jardim comunitário');
const beeRow = await one(W, `select u.source_type, u.source_id, u.position_x::int x, u.metadata, u.user_id from public.user_world_items u join public.world_items wi on wi.id = u.world_item_id where wi.code = 'bee'`);
ok(beeRow.source_type === 'challenge' && beeRow.source_id === polinizadores.id && beeRow.x === 28 && beeRow.metadata.revealed === false && beeRow.user_id === W,
   'Teste 5 · item salvo em user_world_items com dono, origem (desafio), posição e "novo"');
ok((await as(W, `select wi.code from public.user_world_items u join public.world_items wi on wi.id = u.world_item_id where wi.code in ('tree_basic', 'flower_basic')`)).length === 0,
   'Testes 16/17 · árvore e flor NÃO aparecem sem os desafios deles');

console.log('\n# Etapa 7 · Evolução e categorias');
wp = (await db.query(`select public.world_progress($1) p`, [W])).rows[0].p;
const expected = Math.round(100 * (0.5 * wp.items_unlocked / wp.items_total + 0.3 * 1 / wp.challenges_total + 0.2 * 1 / 6));
ok(wp.items_unlocked === 9 && wp.items_total === EXP.worldEarnable && wp.challenges_completed === 1 && wp.progress === expected,
   `Teste 13 · progresso = 50% itens (9/${wp.items_total}) + 30% desafios (1/${wp.challenges_total}) + 20% categorias (1/6) = ${wp.progress}%`);
ok(wp.stage === 3 && wp.next_stage.stage === 4 && wp.next_stage.min_challenges === 2, 'Teste 15 · estágio 3 "Ecossistema"; o 4 pede 2 desafios');
await finishLesson(W, await lessonIdBySlug('por-que-precisamos-economizar-agua'));
wp = (await db.query(`select public.world_progress($1) p`, [W])).rows[0].p;
ok(wp.categories_explored === 2 && (await codesOf(W)).some((i) => i.code === 'riverbank'), 'Teste 14 · lição de Água: 2 categorias exploradas e vegetação de margem');
const stageEv = (await as(W, `select (metadata ->> 'stage')::int s from public.gamification_events where event_type = 'world_stage_reached' order by created_at, 1`)).map((x) => x.s);
ok(stageEv.join() === '2,3', `história do mundo: estágios alcançados registrados (${stageEv.join()})`);
stW = (await one(W, 'select public.get_player_state() s')).s;
ok(stW.world.stage === 3 && stW.world.progress === wp.progress && stW.world.stage_history.length === 2 &&
   stW.world.items.every((i) => i.source_type && i.unlocked_at), 'estado do jogo traz estágio, progresso, história e origem de cada item');
const againW = (await one(W, 'select public.get_player_state() s')).s;
ok(againW.world.items.length === stW.world.items.length, 'Teste 7 · recarregar mantém os itens');

console.log('\n# Etapa 7 · Sem duplicação');
const beforeW = (await one(W, 'select count(*)::int n from public.user_world_items')).n;
await db.exec(`select public.sync_world('${W}')`);
for (let i = 0; i < 2; i++) await as(W, `select public.complete_challenge('${runW.id}')`);
ok((await one(W, 'select count(*)::int n from public.user_world_items')).n === beforeW, 'Teste 8 · sincronizar e concluir de novo não duplica itens');
try {
  await db.exec(`insert into public.user_world_items (user_id, world_id, world_item_id, source_type) select '${W}', w.id, wi.id, 'challenge' from public.worlds w, public.world_items wi where w.user_id = '${W}' and wi.code = 'bee'`);
  ok(false, 'item duplicado deveria violar a chave única');
} catch (e) {
  ok(/unique|duplicate/.test(e.message), 'chave única (mundo, item) impede duplicação');
}

console.log('\n# Etapa 7 · Segurança');
await expectError(W, `insert into public.user_world_items (user_id, world_id, world_item_id, source_type) select '${W}', w.id, wi.id, 'challenge' from public.worlds w, public.world_items wi where wi.code = 'tree_special'`, 'permission denied', 'Teste 9 · jogador não desbloqueia item manualmente');
await expectError(W, `update public.user_world_items set source_type = 'initial'`, 'permission denied', 'jogador não altera a origem do item');
await expectError(W, `update public.worlds set stage = 7, progress = 100`, 'permission denied', 'jogador não altera o estágio do mundo');
await expectError(W, `select public.sync_world('${W}')`, 'permission denied', 'jogador não força o desbloqueio');
await expectError(W, `select public.refresh_world('${W}')`, 'permission denied', 'jogador não força o recálculo do estágio');
await expectError(W, `select public.world_progress('${W}')`, 'permission denied', 'jogador não consulta o progresso de outros pela função interna');
ok((await as(W, `update public.world_items set unlock_type = 'initial', unlock_reference = null returning id`)).length === 0, 'jogador não edita as regras de recompensa');
ok((await as(W, `update public.world_stages set min_items = 0 returning id`)).length === 0, 'jogador não edita os estágios');
ok((await as(A, `select id from public.user_world_items where user_id = '${W}'`)).length === 0, 'Teste 10 · A não vê os itens de W');
ok((await as(A, `select id from public.worlds where user_id = '${W}'`)).length === 0, 'A não vê o mundo de W');
ok((await as(W, 'select distinct user_id from public.user_world_items')).every((x) => x.user_id === W), 'W vê apenas os próprios itens');
await expectError(A, `insert into public.user_world_items (user_id, world_id, world_item_id, source_type) select '${A}', w.id, wi.id, 'challenge' from public.worlds w, public.world_items wi where w.user_id = '${W}' and wi.code = 'river'`, 'permission denied', 'A não insere item no mundo de W');

// =====================================================================
// Etapa 8 · Integração final: administração, conta, logs e segurança
// =====================================================================
console.log('\n# Etapa 8 · Administração (acesso controlado)');
for (const fn of ['admin_dashboard()', 'admin_list_users()', `admin_list_content('challenge')`, 'admin_list_logs()',
  `admin_set_content_active('challenge', '${CH}', false)`, `admin_set_role('${B}', 'admin')`]) {
  await expectError(A, `select public.${fn}`, 'forbidden', `usuário comum não usa ${fn.split('(')[0]}`);
}
await expectError('anon', 'select public.admin_dashboard()', 'permission denied|not_authenticated', 'anônimo não acessa o painel');

const dash = (await one(ADMIN, 'select public.admin_dashboard() d')).d;
const real = (await db.query(`select
  (select count(*) from public.profiles)::int users,
  (select count(*) from public.user_challenges where status = 'completed')::int done,
  (select count(*) from public.challenge_evidence)::int ev,
  (select coalesce(sum(amount), 0) from public.xp_transactions)::int xp,
  (select count(*) from public.lessons)::int lessons`)).rows[0];
ok(dash.users === real.users && dash.challenges_completed === real.done && dash.evidence_sent === real.ev &&
   Number(dash.xp_distributed) === real.xp && dash.content.lessons.total === real.lessons && dash.content.world_items.total === EXP.worldItems,
   `painel com números reais: ${dash.users} usuários, ${dash.challenges_completed} desafios concluídos, ${dash.evidence_sent} evidências, ${dash.xp_distributed} XP`);
ok(dash.active_users_30d > 0 && dash.lessons_completed > 0 && dash.quizzes_taken > 0, 'usuários ativos, lições e quizzes contados a partir dos eventos reais');

const users = (await one(ADMIN, `select public.admin_list_users('ana') u`)).u;
ok(users.total === 1 && users.items[0].email === 'a@x.com' && users.items[0].level === 3 && users.items[0].challenges_completed === 1 && users.items[0].status === 'active',
   'lista de usuários: nome, e-mail, nível, XP, desafios concluídos, cadastro e status');
ok(!('password' in users.items[0]) && !('evidence' in users.items[0]), 'lista de usuários não expõe dados privados desnecessários');
const pageAll = (await one(ADMIN, 'select public.admin_list_users(null, 2, 0) u')).u;
ok(pageAll.items.length === 2 && pageAll.total > 2, 'lista de usuários é paginada');

console.log('\n# Etapa 8 · Desativar conteúdo preserva o histórico');
const chList = (await one(ADMIN, `select public.admin_list_content('challenge') c`)).c;
ok(chList.length === EXP.challenges && chList.find((c) => c.id === CH).usage >= 2, `painel lista os ${EXP.challenges} desafios com o uso real`);
await as(ADMIN, `select public.admin_set_content_active('challenge', '${CH}', false)`);
ok((await as(A, `select id from public.challenges where id = '${CH}'`)).length === 1, 'A (que concluiu) continua vendo o desafio desativado');
const H = '12121212-0000-4000-8000-000000000012';
await db.exec(`insert into auth.users (id, email) values ('${H}', 'h@x.com')`);
ok((await as(H, `select id from public.challenges where id = '${CH}'`)).length === 0, 'usuário novo não vê o desafio desativado');
ok((await one(A, `select count(*)::int n from public.xp_transactions where source_type = 'challenge_completed'`)).n === 1 &&
   (await one(A, `select status from public.user_challenges where challenge_id = '${CH}'`)).status === 'completed', 'XP e conclusão de A intactos');
await finishLesson(H, LESSON);
const stH = await start(H, QUIZ);
await answerAll(H, stH.attempt_id, await questionsOf(QUIZ), () => true);
await finish(H, stH.attempt_id);
await expectError(H, `select public.accept_challenge('${CH}')`, 'not_found', 'desafio desativado não pode ser aceito');
await as(ADMIN, `select public.admin_set_content_active('challenge', '${CH}', true)`);
ok(typeof (await one(H, `select public.accept_challenge('${CH}') id`)).id === 'string', 'reativado: pode ser aceito de novo');
await expectError(ADMIN, `select public.admin_set_content_active('tabela_qualquer', '${CH}', false)`, 'invalid_input', 'tipo de conteúdo inválido é recusado');
await expectError(ADMIN, `select public.admin_set_content_active('lesson', '${CH}', false)`, 'not_found', 'id inexistente é recusado');
ok((await one(ADMIN, `select count(*)::int n from public.app_logs where operation = 'admin.set_active'`)).n === 2, 'ações administrativas ficam registradas');

console.log('\n# Etapa 8 · Papel de administrador');
await expectError(A, `update public.profiles set role = 'admin' where user_id = '${A}'`, 'permission denied', 'usuário não se promove a admin');
await expectError(ADMIN, `select public.admin_set_role('${ADMIN}', 'user')`, 'cannot_change_own_role', 'admin não muda o próprio papel (evita ficar sem admin)');
await as(ADMIN, `select public.admin_set_role('${B}', 'admin')`);
ok((await one(B, 'select public.admin_dashboard() d')).d.users > 0, 'admin promove outro usuário por procedimento seguro');
await as(ADMIN, `select public.admin_set_role('${B}', 'user')`);
await expectError(B, 'select public.admin_dashboard()', 'forbidden', 'rebaixado: perde o acesso na hora');

console.log('\n# Etapa 8 · Registro de erros sem dados sensíveis');
await as(A, `select public.log_client_error('challenge.complete', 'network', 'falhou com token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc e chave sb_secret_abc123 de a@x.com', '{"route": "/missao"}'::jsonb)`);
const logRow = (await db.query(`select operation, code, message, context, user_id from public.app_logs where operation = 'challenge.complete'`)).rows[0];
ok(logRow.code === 'network' && !/eyJ|sb_secret|a@x\.com/.test(logRow.message) && logRow.message.includes('[token]') && logRow.context.route === '/missao' && logRow.user_id === A,
   `log registrado com contexto e sem token/chave/e-mail: "${logRow.message}"`);
for (let i = 0; i < 30; i++) await as(A, `select public.log_client_error('spam', null, 'x')`);
ok((await db.query(`select count(*)::int n from public.app_logs where user_id = '${A}'`)).rows[0].n <= 20, 'limite de 20 registros por minuto por usuário');
ok((await as(A, 'select id from public.app_logs')).length === 0, 'usuário comum não lê o registro de erros');
await expectError(A, `insert into public.app_logs (operation) values ('x')`, 'permission denied', 'usuário não escreve direto no registro');
ok((await one(ADMIN, 'select public.admin_list_logs(5) l')).l.length === 5, 'admin lê os erros recentes');

console.log('\n# Etapa 8 · Manipulação pelo navegador');
for (const [sql, msg] of [
  [`update public.profiles set total_xp = 999999, level = 100`, 'xp = 999999 / level = 100'],
  [`insert into public.user_achievements (user_id, achievement_id) values ('${H}', '60000000-0000-4000-8000-000000000018')`, 'achievement = true'],
  [`update public.user_challenges set status = 'completed'`, 'completed = true'],
  [`insert into public.user_world_items (user_id, world_id, world_item_id, source_type) select '${H}', w.id, wi.id, 'challenge' from public.worlds w, public.world_items wi where w.user_id = '${H}' and wi.code = 'river'`, 'world_item = unlocked'],
  [`update public.profiles set deletion_requested_at = now()`, 'marcar exclusão sem a função'],
]) {
  await expectError(H, sql, 'permission denied', `servidor rejeita ${msg}`);
}

console.log('\n# Etapa 8 · Excluir minha conta');
const photosF = (await as(F, 'select name from storage.objects')).map((o) => o.name);
const evidenceF = (await as(F, 'select file_url from public.challenge_evidence where file_url is not null')).map((e) => e.file_url);
ok(photosF.length > 0 && evidenceF.length > 0, `F tem ${photosF.length} fotos e ${evidenceF.length} evidências`);
ok((await as(F, `delete from storage.objects where name = $1 returning id`, [evidenceF[0]])).length === 0, 'foto que é evidência NÃO pode ser apagada (protege o histórico)');
await upload(F, `users/${F}/challenges/${catalog[0].id}/orfa.jpg`).catch(() => {});
const orphan = (await as(F, `select name from storage.objects where name like '%orfa.jpg'`)).length;
if (orphan) ok((await as(F, `delete from storage.objects where name like '%orfa.jpg' returning id`)).length === 1, 'upload interrompido (arquivo órfão) pode ser removido');
ok((await as(B, `delete from storage.objects where name = $1 returning id`, [photosF[0]])).length === 0, 'B não apaga fotos de F');
await expectError(F, 'select public.delete_my_account()', 'deletion_not_confirmed', 'exclusão exige a confirmação (pedido) antes');
const xpABefore = (await one(A, 'select total_xp from public.profiles')).total_xp;
const worldWBefore = (await one(W, 'select count(*)::int n from public.user_world_items')).n;
await as(F, 'select public.request_account_deletion()');
ok((await as(F, 'delete from storage.objects returning id')).length === photosF.length, 'depois do pedido, F remove todas as próprias fotos');
await as(F, 'select public.delete_my_account()');
const leftovers = (await db.query(`select
  (select count(*) from auth.users where id = $1)::int u,
  (select count(*) from public.profiles where user_id = $1)::int p,
  (select count(*) from public.worlds where user_id = $1)::int w,
  (select count(*) from public.user_world_items where user_id = $1)::int wi,
  (select count(*) from public.user_challenges where user_id = $1)::int ch,
  (select count(*) from public.challenge_evidence where user_id = $1)::int ev,
  (select count(*) from public.xp_transactions where user_id = $1)::int xp,
  (select count(*) from public.user_achievements where user_id = $1)::int ach,
  (select count(*) from public.gamification_events where user_id = $1)::int evt,
  (select count(*) from public.quiz_attempts where user_id = $1)::int qa,
  (select count(*) from public.user_lesson_progress where user_id = $1)::int lp`, [F])).rows[0];
ok(Object.values(leftovers).every((n) => n === 0), `conta excluída: perfil, progresso, evidências, XP, conquistas e mundo removidos ${JSON.stringify(leftovers)}`);
ok((await one(A, 'select total_xp from public.profiles')).total_xp === xpABefore && (await one(W, 'select count(*)::int n from public.user_world_items')).n === worldWBefore,
   'outros usuários não são afetados');
ok((await db.query(`select count(*)::int n from public.app_logs where operation = 'account.deleted' and user_id is null`)).rows[0].n === 1,
   'exclusão registrada sem identificar o usuário');

console.log('\n# Etapa 8 · Níveis e integridade');
const lvls = (await db.query('select level_number, xp_required from public.levels order by level_number')).rows;
ok(lvls.every((l, i) => l.level_number === i + 1 && (i === 0 ? l.xp_required === 0 : l.xp_required > lvls[i - 1].xp_required)),
   '20 níveis em ordem, sem duplicados, com XP mínimo crescente');
for (const [xp, lv] of [[0, 1], [100, 2], [250, 3]]) {
  ok((await one('anon', 'select public.level_for_xp($1) l', [xp])).l === lv, `${xp} XP → nível ${lv}`);
}
const noRls = (await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`)).rows.map((r) => r.relname);
ok(noRls.length === 0, `RLS habilitado em todas as tabelas públicas ${noRls.join(', ')}`);
const orphans = (await db.query(`select
  (select count(*) from public.challenge_evidence e where not exists (select 1 from public.user_challenges uc where uc.id = e.user_challenge_id))::int ev,
  (select count(*) from public.user_world_items u where not exists (select 1 from public.worlds w where w.id = u.world_id))::int wi,
  (select count(*) from public.profiles p where not exists (select 1 from public.worlds w where w.user_id = p.user_id))::int noworld`)).rows[0];
ok(orphans.ev === 0 && orphans.wi === 0 && orphans.noworld === 0, 'sem registros órfãos; todo perfil tem mundo');
const dupProfiles = (await db.query('select count(*)::int n from (select user_id from public.profiles group by user_id having count(*) > 1) x')).rows[0].n;
ok(dupProfiles === 0, 'sem perfis duplicados');

// =====================================================================
// Módulo Meu Lugar (casa 3D)
// =====================================================================
console.log('\n# Meu Lugar · catálogo e casa inicial');
const pc = (await db.query(`select (select count(*) from public.place_items where active)::int items,
  (select count(*) from public.place_stages)::int stages`)).rows[0];
ok(pc.items === EXP.placeItems && pc.stages === CT.place.stages.length, `${EXP.placeItems} objetos e ${CT.place.stages.length} estágios cadastrados ${JSON.stringify(pc)}`);
ok((await as('anon', 'select code from public.place_items')).length === EXP.placeItems, 'catálogo de objetos é público (sem dados de jogadores)');

const P = '31313131-0000-4000-8000-000000000031';
await db.exec(`insert into auth.users (id, email) values ('${P}', 'p@x.com')`);
const placeOf = async (user) => (await as(user, `select pi.code, u.source_type, u.challenge_id, u.evidence_id, u.origin_note, u.revealed, u.state
  from public.user_place_items u join public.place_items pi on pi.id = u.place_item_id order by pi.sort_order`));
let pl = await placeOf(P);
ok(pl.length === EXP.placeItems && pl.every((x) => x.source_type === 'initial' && x.revealed && x.state === 'visible'),
   `casa completa (29): usuário novo recebe todos os ${EXP.placeItems} objetos da casa e do quintal, já vistos`);
let ps = (await one(P, 'select public.get_place_state() s')).s;
const lastPlaceStage = Math.max(...CT.place.stages.map((s) => s.stage));
ok(ps.items.length === EXP.placeItems && ps.progress.stage === lastPlaceStage && ps.progress.progress === 100 && ps.progress.items_total === EXP.placeEarnable,
   `estado da casa completa: estágio ${lastPlaceStage}, 100%, ${EXP.placeEarnable}/${EXP.placeEarnable} objetos`);

console.log('\n# Meu Lugar · integração com as atividades existentes');
const xpBeforeP = (await one(P, 'select total_xp from public.profiles')).total_xp;
await finishLesson(P, await lessonIdBySlug('como-uma-planta-cresce'));
pl = await placeOf(P);
ok(pl.some((x) => x.code === 'book' && x.source_type === 'achievement') && pl.some((x) => x.code === 'potted_plant' && x.source_type === 'lesson'),
   'lição concluída → livro (conquista "Primeiro Aprendizado") e planta (lição)');
const xpAfterP = (await one(P, 'select total_xp from public.profiles')).total_xp;
const placeXp = (await db.query(`select count(*)::int n from public.xp_transactions where user_id = $1 and (source_type ilike '%place%' or description ilike '%casa%')`, [P])).rows[0].n;
ok(xpAfterP - xpBeforeP === 20 + 10 && placeXp === 0, 'a casa não cria XP: só os 30 XP da lição e da conquista, como antes');

const plA = await placeOf(A);
const treeA = plA.find((x) => x.code === 'my_tree');
ok(treeA && treeA.source_type === 'challenge' && treeA.challenge_id === CH, 'desafio "Plante uma árvore" concluído → Minha Árvore, com o desafio relacionado');
ok(treeA && typeof treeA.origin_note === 'string' && treeA.origin_note.length > 0, `diário: a árvore guarda o registro do jogador ("${treeA?.origin_note}")`);
const picA = plA.find((x) => x.code === 'picture');
const firstPhotoA = (await one(A, `select id from public.challenge_evidence where evidence_type = 'photo' order by created_at limit 1`)).id;
ok(picA && picA.source_type === 'evidence' && picA.evidence_id === firstPhotoA, 'primeira foto de evidência → quadro, ligado à evidência');
const plW = await placeOf(W);
ok(plA.find((x) => x.code === 'bee')?.source_type === 'initial' && ['bee', 'butterfly'].every((c) => plW.find((x) => x.code === c)?.source_type === 'challenge'),
   'abelha e borboleta: todos têm; quem concluiu os polinizadores (W) guarda a origem do desafio, A recebeu com a casa');
ok(plA.find((x) => x.code === 'vegetable_garden')?.source_type === 'initial', 'horta já está no quintal mesmo sem o desafio da horta (casa completa)');

console.log('\n# Meu Lugar · idempotência e sincronização');
const beforeA = plA.length;
await db.exec(`select public.sync_place('${A}'); select public.sync_place('${A}');`);
await as(A, `select public.complete_challenge((select id from public.user_challenges where challenge_id = '${CH}' and status = 'completed'))`);
ok((await placeOf(A)).length === beforeA, 'processar de novo (sincronizar, concluir outra vez) não duplica objetos');
try {
  await db.exec(`insert into public.user_place_items (user_id, place_item_id, source_type) select '${A}', id, 'initial' from public.place_items where code = 'desk'`);
  ok(false, 'duplicata deveria violar a chave única');
} catch (e) {
  ok(/unique|duplicate/.test(e.message), 'chave única (usuário, objeto) impede duplicação');
}
const sPlace1 = (await one(A, 'select public.get_place_state() s')).s;
const sPlace2 = (await one(A, 'select public.get_place_state() s')).s;
ok(JSON.stringify(sPlace1) === JSON.stringify(sPlace2) && sPlace1.items.length === beforeA, 'mesma casa em qualquer acesso (o servidor é a fonte oficial)');
const rv1 = (await one(A, 'select public.reveal_place_items() n')).n;
ok(rv1 >= 0 && (await one(A, 'select public.reveal_place_items() n')).n === 0, 'marcar como visto: na segunda vez não sobra nada novo');

console.log('\n# Meu Lugar · evolução');
const prA = sPlace1.progress;
const realA = (await db.query(`select count(*)::int n, count(distinct pi.category)::int c from public.user_place_items u
  join public.place_items pi on pi.id = u.place_item_id where u.user_id = $1 and pi.unlock_type <> 'initial'`, [A])).rows[0];
ok(prA.items_unlocked === realA.n && prA.categories === realA.c && prA.progress === Math.round((100 * realA.n) / EXP.placeEarnable),
   `evolução com números reais: ${prA.items_unlocked}/${EXP.placeEarnable} objetos, ${prA.categories} categorias, ${prA.progress}%, estágio ${prA.stage}`);

console.log('\n# Meu Lugar · segurança');
ok((await as(A, `select id from public.user_place_items where user_id = '${P}'`)).length === 0, 'A não acessa a casa de P');
ok((await one(A, 'select public.get_place_state() s')).s.items.length === beforeA, 'get_place_state devolve só a casa do próprio jogador');
await expectError(P, `insert into public.user_place_items (user_id, place_item_id, source_type) select '${P}', id, 'initial' from public.place_items where code = 'big_tree'`, 'permission denied', 'jogador não desbloqueia objeto manualmente');
await expectError(P, `update public.user_place_items set source_type = 'initial'`, 'permission denied', 'jogador não altera a origem');
await expectError(P, `delete from public.user_place_items`, 'permission denied', 'jogador não apaga objetos da casa');
await expectError(P, `select public.sync_place('${P}')`, 'permission denied', 'jogador não força o desbloqueio');
ok((await as(P, `update public.place_items set unlock_type = 'initial', unlock_reference = null returning id`)).length === 0, 'jogador não edita as regras dos objetos');
await expectError('anon', 'select public.get_place_state()', 'permission denied|not_authenticated', 'anônimo não lê casa nenhuma');
ok((await db.query(`select count(*)::int n from public.user_place_items where user_id = $1`, [F])).rows[0].n === 0, 'conta excluída: a casa também foi apagada (cascata)');

console.log('\n# Visitas · mundo e casa de outro jogador pelo @usuário');
await as(W, `update public.profiles set username = 'wal_eco', display_name = 'Wal' where user_id = '${W}'`);
const visit = (await one(A, `select public.visit_player('@Wal_Eco') v`)).v;
const worldIdsW = (await db.query(`select u.world_item_id from public.user_world_items u join public.worlds w on w.id = u.world_id where w.user_id = $1`, [W])).rows.map((r) => r.world_item_id);
const placeIdsW = (await db.query(`select place_item_id from public.user_place_items where user_id = $1 and state = 'visible'`, [W])).rows.map((r) => r.place_item_id);
ok(visit.player.username === 'wal_eco' && visit.player.display_name === 'Wal' && visit.player.is_me === false && typeof visit.player.level === 'number',
   'visita pelo @usuário (com @ e maiúsculas): nome, avatar e nível do jogador visitado');
ok(visit.world.item_ids.length === worldIdsW.length && worldIdsW.every((id) => visit.world.item_ids.includes(id)) && visit.place.item_ids.length === placeIdsW.length,
   `visita mostra o mundo (${worldIdsW.length} itens) e a casa (${placeIdsW.length} objetos) de verdade`);
const visitText = JSON.stringify(visit);
ok(!/email|avatar_url|origin_note|evidence|photo|total_xp|x\.com/.test(visitText), 'visita não expõe e-mail, foto de perfil, fotos, diário nem XP');
ok((await one(W, `select public.visit_player('wal_eco') v`)).v.player.is_me === true, 'visitar o próprio @usuário é reconhecido');
await expectError(A, `select public.visit_player('ninguem_aqui')`, 'player_not_found', '@usuário inexistente → jogador não encontrado');
await expectError('anon', `select public.visit_player('wal_eco')`, 'permission denied|not_authenticated', 'sem login não visita ninguém');
ok((await as(A, `select id from public.user_world_items u where u.world_id in (select id from public.worlds where user_id = '${W}')`)).length === 0,
   'visitar não abre acesso direto aos dados do outro (RLS continua valendo)');

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
