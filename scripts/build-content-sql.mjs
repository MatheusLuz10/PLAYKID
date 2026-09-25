/**
 * Gera supabase/migrations/15_learning_content.sql a partir de content/lessons.json.
 *   npm run content:sql
 *
 * O SQL é idempotente (upsert das aulas; seções e relacionados são recriados),
 * então pode ser executado de novo depois de editar o conteúdo.
 */
import fs from 'node:fs';

const SOURCE = 'content/lessons.json';
const TARGET = 'supabase/migrations/15_learning_content.sql';

// IDs fixos das categorias (13_seed.sql).
const CATEGORY_IDS = {
  natureza: '10000000-0000-4000-8000-000000000001',
  agua: '10000000-0000-4000-8000-000000000002',
  residuos: '10000000-0000-4000-8000-000000000003',
  energia: '10000000-0000-4000-8000-000000000004',
  biodiversidade: '10000000-0000-4000-8000-000000000005',
  comunidade: '10000000-0000-4000-8000-000000000006',
};
const LEVELS = ['beginner', 'intermediate', 'advanced'];
const BLOCK_TYPES = ['fun_fact', 'observe', 'think', 'tip', 'choice'];

const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const json = (v) => `${q(JSON.stringify(v))}::jsonb`;

/** ID determinístico de seção: 21000000-…-LLLLLLLLLSSS */
const sectionId = (lessonNumber, sectionNumber) =>
  `21000000-0000-4000-8000-${String(lessonNumber).padStart(9, '0')}${String(sectionNumber).padStart(3, '0')}`;

const { lessons } = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const bySlug = new Map(lessons.map((l) => [l.slug, l]));

// ---------- validação ----------
const problems = [];
for (const l of lessons) {
  if (!CATEGORY_IDS[l.category]) problems.push(`${l.slug}: categoria desconhecida "${l.category}"`);
  if (!LEVELS.includes(l.difficulty)) problems.push(`${l.slug}: dificuldade inválida "${l.difficulty}"`);
  if (l.prerequisite && !bySlug.has(l.prerequisite)) problems.push(`${l.slug}: pré-requisito inexistente`);
  for (const r of l.related ?? []) if (!bySlug.has(r)) problems.push(`${l.slug}: relacionado inexistente "${r}"`);
  if (!l.sections?.length) problems.push(`${l.slug}: sem seções`);
  for (const s of l.sections ?? []) {
    if (s.image_url && !s.image_alt) problems.push(`${l.slug}/${s.title}: imagem sem texto alternativo`);
    for (const b of s.blocks ?? []) {
      if (!BLOCK_TYPES.includes(b.type)) problems.push(`${l.slug}/${s.title}: bloco inválido "${b.type}"`);
      if (b.type === 'observe' && !b.image_alt) problems.push(`${l.slug}/${s.title}: "observe" sem texto alternativo`);
      if (b.type === 'choice' && !b.options?.some((o) => o.is_best)) problems.push(`${l.slug}/${s.title}: escolha sem opção indicada`);
    }
  }
}
if (problems.length) {
  console.error('Conteúdo inválido:\n- ' + problems.join('\n- '));
  process.exit(1);
}

// ---------- SQL ----------
const ids = lessons.map((l) => q(l.id)).join(', ');
const out = [];
out.push(`-- =====================================================================
-- 15 · Conteúdos educativos (Etapa 3)
-- =====================================================================
-- ARQUIVO GERADO por "npm run content:sql" a partir de content/lessons.json.
-- Não edite à mão: edite o JSON e gere novamente.
`);

out.push('-- Aulas (upsert)');
for (const l of lessons) {
  out.push(`insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values (${q(l.id)}, ${q(CATEGORY_IDS[l.category])}, ${q(l.topic)}, ${q(l.title)}, ${q(l.slug)}, ${q(l.description)}, ${q(l.difficulty)}, ${l.estimated_minutes}, ${l.xp_reward}, ${l.order_index}, ${json(l.summary_points ?? [])}, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;`);
}

out.push('\n-- Pré-requisitos (depois que todas as aulas existem)');
for (const l of lessons) {
  const pre = l.prerequisite ? q(bySlug.get(l.prerequisite).id) : 'null';
  out.push(`update public.lessons set prerequisite_lesson_id = ${pre} where id = ${q(l.id)};`);
}

out.push('\n-- Seções (recriadas)');
out.push(`delete from public.lesson_sections where lesson_id in (${ids});`);
lessons.forEach((l, li) => {
  const rows = l.sections.map(
    (s, si) =>
      `  (${q(sectionId(li + 1, si + 1))}, ${q(l.id)}, 'content', ${q(s.icon)}, ${q(s.title)}, ${q(s.content)}, ${q(s.image_url)}, ${q(s.image_alt)}, ${json(s.blocks ?? [])}, ${si + 1})`,
  );
  out.push(`insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
${rows.join(',\n')};`);
});

out.push('\n-- Conteúdos relacionados (recriados)');
out.push(`delete from public.lesson_related where lesson_id in (${ids});`);
const related = lessons.flatMap((l) =>
  (l.related ?? []).map((slug, i) => `  (${q(l.id)}, ${q(bySlug.get(slug).id)}, ${i + 1})`),
);
if (related.length) {
  out.push(`insert into public.lesson_related (lesson_id, related_lesson_id, order_index) values
${related.join(',\n')};`);
}

fs.writeFileSync(TARGET, out.join('\n') + '\n');
console.log(`${TARGET} gerado: ${lessons.length} aulas, ${lessons.reduce((n, l) => n + l.sections.length, 0)} seções.`);

// =====================================================================
// Quizzes: content/quizzes.json → supabase/migrations/17_quiz_content.sql
// =====================================================================
const QUIZ_SOURCE = 'content/quizzes.json';
const QUIZ_TARGET = 'supabase/migrations/17_quiz_content.sql';
const { quizzes } = JSON.parse(fs.readFileSync(QUIZ_SOURCE, 'utf8'));
const lessonNumber = new Map(lessons.map((l, i) => [l.slug, i + 1]));
const pad = (n, size) => String(n).padStart(size, '0');

// IDs determinísticos (os do quiz das árvores vêm explícitos no JSON para preservar o histórico).
const quizId = (ln) => `30000000-0000-4000-8000-${pad(ln, 12)}`;
const questionId = (ln, qn) => `31000000-0000-4000-8000-${pad(ln, 3)}000000${pad(qn, 3)}`;
const optionId = (ln, qn, on) => `32000000-0000-4000-8000-${pad(ln, 3)}000${pad(qn, 3)}${pad(on, 3)}`;

const quizProblems = [];
const seenLessons = new Set();
for (const quiz of quizzes) {
  if (!bySlug.has(quiz.lesson)) quizProblems.push(`quiz de aula inexistente: "${quiz.lesson}"`);
  if (seenLessons.has(quiz.lesson)) quizProblems.push(`${quiz.lesson}: mais de um quiz para a mesma aula`);
  seenLessons.add(quiz.lesson);
  if (!(quiz.passing_score >= 0 && quiz.passing_score <= 100)) quizProblems.push(`${quiz.lesson}: nota mínima inválida`);
  quiz.questions.forEach((question, qi) => {
    const where = `${quiz.lesson} / pergunta ${qi + 1}`;
    if (!question.explanation) quizProblems.push(`${where}: sem explicação`);
    if (question.options.length !== 4) quizProblems.push(`${where}: precisa de 4 alternativas`);
    if (question.options.filter((o) => o.correct).length !== 1) quizProblems.push(`${where}: precisa de exatamente 1 correta`);
    question.options.forEach((o, oi) => {
      if (!o.feedback) quizProblems.push(`${where} / alternativa ${oi + 1}: sem feedback`);
    });
  });
}
if (quizProblems.length) {
  console.error('Quizzes inválidos:\n- ' + quizProblems.join('\n- '));
  process.exit(1);
}

const qout = [`-- =====================================================================
-- 17 · Quizzes (Etapa 4)
-- =====================================================================
-- ARQUIVO GERADO por "npm run content:sql" a partir de content/quizzes.json.
-- Não edite à mão. Idempotente: atualiza perguntas/alternativas existentes
-- (mantendo os IDs e o histórico de respostas) e desativa perguntas removidas.
`];

let totalQuestions = 0;
for (const quiz of quizzes) {
  const ln = lessonNumber.get(quiz.lesson);
  const lesson = bySlug.get(quiz.lesson);
  const qid = quiz.id ?? quizId(ln);
  const questions = quiz.questions.map((question, qi) => ({
    ...question,
    id: question.id ?? questionId(ln, qi + 1),
    options: question.options.map((o, oi) => ({ ...o, id: o.id ?? optionId(ln, qi + 1, oi + 1) })),
  }));
  totalQuestions += questions.length;
  const questionIds = questions.map((x) => q(x.id)).join(', ');

  qout.push(`-- ${quiz.title}
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values (${q(qid)}, ${q(lesson.id)}, ${q(quiz.title)}, ${q(quiz.description)}, ${quiz.passing_score}, ${quiz.xp_reward}, ${quiz.improvement_xp_reward ?? 0}, ${quiz.attempts_allowed ?? 'null'}, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = ${q(qid)} and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = ${q(qid)} and id not in (${questionIds});
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
${questions.map((x, i) => `  (${q(x.id)}, ${q(qid)}, ${q(x.question)}, ${q(x.explanation)}, ${q(x.topic)}, 'single_choice', ${i + 1}, ${x.points ?? 1}, true)`).join(',\n')}
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in (${questionIds}) and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
${questions.flatMap((x) => x.options.map((o, oi) => `  (${q(o.id)}, ${q(x.id)}, ${q(o.text)}, ${o.correct ? 'true' : 'false'}, ${q(o.feedback)}, ${oi + 1})`)).join(',\n')}
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;
`);
}

fs.writeFileSync(QUIZ_TARGET, qout.join('\n'));
console.log(`${QUIZ_TARGET} gerado: ${quizzes.length} quizzes, ${totalQuestions} perguntas.`);

// =====================================================================
// Desafios: content/challenges.json → supabase/migrations/20_challenge_content.sql
// =====================================================================
const CH_SOURCE = 'content/challenges.json';
const CH_TARGET = 'supabase/migrations/20_challenge_content.sql';
const { challenges } = JSON.parse(fs.readFileSync(CH_SOURCE, 'utf8'));
const STEP_TYPES = ['instruction', 'action', 'evidence', 'follow_up', 'completion'];
const EVIDENCE_KINDS = ['none', 'photo', 'text'];
const DIFFICULTIES = ['facil', 'medio', 'dificil'];

const challengeId = (n) => `40000000-0000-4000-8000-${pad(n, 12)}`;
const stepId = (n, s) => `41000000-0000-4000-8000-${pad(n, 3)}000000${pad(s, 3)}`;

const chProblems = [];
const seenSlugs = new Set();
challenges.forEach((c) => {
  if (seenSlugs.has(c.slug)) chProblems.push(`${c.slug}: slug repetido`);
  seenSlugs.add(c.slug);
  if (!bySlug.has(c.lesson)) chProblems.push(`${c.slug}: aula inexistente "${c.lesson}"`);
  if (!CATEGORY_IDS[c.category]) chProblems.push(`${c.slug}: categoria desconhecida`);
  if (!DIFFICULTIES.includes(c.difficulty)) chProblems.push(`${c.slug}: dificuldade inválida`);
  if (!(c.deadline_days > 0)) chProblems.push(`${c.slug}: deadline_days inválido`);
  const main = c.steps.filter((s) => s.type !== 'follow_up');
  if (!main.length) chProblems.push(`${c.slug}: sem etapas principais`);
  if (c.requires_evidence && !c.steps.some((s) => (s.evidence_kind ?? 'none') !== 'none')) chProblems.push(`${c.slug}: exige evidência mas nenhuma etapa pede foto ou texto`);
  if (c.requires_follow_up !== c.steps.some((s) => s.type === 'follow_up')) chProblems.push(`${c.slug}: requires_follow_up não bate com as etapas`);
  c.steps.forEach((s, i) => {
    const where = `${c.slug} / etapa ${i + 1}`;
    if (!STEP_TYPES.includes(s.type)) chProblems.push(`${where}: tipo inválido`);
    if (!EVIDENCE_KINDS.includes(s.evidence_kind ?? 'none')) chProblems.push(`${where}: evidence_kind inválido`);
    if (s.type === 'follow_up' && !(s.day_offset > 0)) chProblems.push(`${where}: acompanhamento sem day_offset`);
    if (s.type !== 'follow_up' && main.indexOf(s) === -1) chProblems.push(`${where}: ordem inválida`);
  });
  // Acompanhamentos sempre depois das etapas principais.
  const firstFollow = c.steps.findIndex((s) => s.type === 'follow_up');
  if (firstFollow !== -1 && c.steps.slice(firstFollow).some((s) => s.type !== 'follow_up')) chProblems.push(`${c.slug}: etapas principais depois de acompanhamentos`);
});
if (chProblems.length) {
  console.error('Desafios inválidos:\n- ' + chProblems.join('\n- '));
  process.exit(1);
}

const cout = [`-- =====================================================================
-- 20 · Desafios ecológicos (Etapa 5)
-- =====================================================================
-- ARQUIVO GERADO por "npm run content:sql" a partir de content/challenges.json.
-- Não edite à mão. Idempotente: atualiza desafios e etapas existentes (mantendo
-- os IDs e o progresso dos jogadores); etapas removidas ficam inativas.
`];
let totalSteps = 0;
challenges.forEach((c, ci) => {
  const n = ci + 1;
  const id = c.id ?? challengeId(n);
  const lines = (arr) => (arr && arr.length ? q(arr.join('\n')) : 'null');
  cout.push(`-- ${c.title}
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values (${q(id)}, ${q(CATEGORY_IDS[c.category])}, ${q(bySlug.get(c.lesson).id)}, ${q(c.icon)}, ${q(c.title)}, ${q(c.slug)},
  ${q(c.description)}, ${lines(c.steps.filter((s) => s.type !== 'follow_up').map((s) => s.description))}, ${lines(c.safety_notes)},
  ${q(c.difficulty)}, ${c.deadline_days}, ${c.xp_reward}, true, ${c.requires_evidence ? 'true' : 'false'}, ${c.requires_follow_up ? 'true' : 'false'},
  ${q(c.why_it_matters)}, ${lines(c.materials)}, ${q(c.evidence_instructions)}, ${q(c.duration_label)})
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;
`);
  const steps = c.steps.map((s, si) => ({ ...s, id: s.id ?? stepId(n, si + 1) }));
  totalSteps += steps.length;
  // Tira todas as etapas do caminho (ordem negativa ÚNICA, abaixo da menor já usada) antes do upsert:
  // assim reaplicar o SQL não colide com etapas desativadas em execuções anteriores.
  cout.push(`update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = ${q(id)}) as base
      from public.challenge_steps where challenge_id = ${q(id)}) x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = ${q(id)} and id not in (${steps.map((s) => q(s.id)).join(', ')});
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
${steps
  .map(
    (s, si) =>
      `  (${q(s.id)}, ${q(id)}, ${q(s.title)}, ${q(s.description)}, ${q(s.type)}, ${si + 1}, ${s.required === false ? 'false' : 'true'}, ${s.xp_reward ?? 0}, ${s.type === 'follow_up' ? s.day_offset : 'null'}, ${s.early_window_days ?? 2}, ${q(s.evidence_kind ?? 'none')}, ${s.deadline_offset_days ?? 'null'}, true)`,
  )
  .join(',\n')}
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;
`);
});
fs.writeFileSync(CH_TARGET, cout.join('\n'));
console.log(`${CH_TARGET} gerado: ${challenges.length} desafios, ${totalSteps} etapas.`);

// =====================================================================
// Progressão: content/gamification.json → supabase/migrations/22_gamification_content.sql
// =====================================================================
const GM_SOURCE = 'content/gamification.json';
const GM_TARGET = 'supabase/migrations/22_gamification_content.sql';
const { levels, achievements } = JSON.parse(fs.readFileSync(GM_SOURCE, 'utf8'));
const ACH_CATEGORIES = ['knowledge', 'first_actions', 'nature', 'water', 'waste', 'energy', 'biodiversity', 'community', 'special'];
const COUNT_TYPES = ['lessons_completed', 'quizzes_passed', 'challenges_completed', 'categories_explored', 'level_reached', 'cycles_completed'];
const CATEGORY_TYPES = ['category_challenges_completed', 'category_actions_completed'];
const levelId = (n) => `50000000-0000-4000-8000-${pad(n, 12)}`;

const gmProblems = [];
levels.forEach((l, i) => {
  if (l.level !== i + 1) gmProblems.push(`nível ${l.level}: os níveis devem ser 1, 2, 3… em ordem`);
  if (i === 0 && l.xp_required !== 0) gmProblems.push('o nível 1 deve começar em 0 XP');
  if (i > 0 && !(l.xp_required > levels[i - 1].xp_required)) gmProblems.push(`nível ${l.level}: XP mínimo deve ser maior que o do nível anterior`);
  if (!l.name) gmProblems.push(`nível ${l.level}: sem título`);
});
const achSlugs = new Set();
achievements.forEach((a) => {
  if (achSlugs.has(a.slug)) gmProblems.push(`${a.slug}: código repetido`);
  achSlugs.add(a.slug);
  if (!ACH_CATEGORIES.includes(a.category)) gmProblems.push(`${a.slug}: categoria inválida`);
  if (!(a.xp_reward >= 0)) gmProblems.push(`${a.slug}: xp_reward inválido`);
  if (COUNT_TYPES.includes(a.type)) {
    if (!(a.count > 0)) gmProblems.push(`${a.slug}: count inválido`);
    if (a.type === 'level_reached' && !levels.some((l) => l.level === a.count)) gmProblems.push(`${a.slug}: nível inexistente`);
  } else if (CATEGORY_TYPES.includes(a.type)) {
    if (!(a.count > 0)) gmProblems.push(`${a.slug}: count inválido`);
    for (const c of String(a.value ?? '').split(',')) if (!CATEGORY_IDS[c]) gmProblems.push(`${a.slug}: categoria "${c}" inexistente`);
  } else if (a.type === 'challenge_completed') {
    if (!challenges.some((c) => c.slug === a.value)) gmProblems.push(`${a.slug}: desafio "${a.value}" inexistente`);
  } else gmProblems.push(`${a.slug}: tipo de condição inválido "${a.type}"`);
});
if (gmProblems.length) {
  console.error('Progressão inválida:\n- ' + gmProblems.join('\n- '));
  process.exit(1);
}

const gout = [`-- =====================================================================
-- 22 · Níveis e conquistas (Etapa 6)
-- =====================================================================
-- ARQUIVO GERADO por "npm run content:sql" a partir de content/gamification.json.
-- Não edite à mão. Idempotente: pode ser executado de novo depois de editar o JSON.

-- Níveis: a faixa de cada um vai do seu xp_required até o do próximo − 1.
-- Afasta os valores antigos antes do upsert para não esbarrar nos índices únicos.
update public.levels set level_number = level_number + 100000, xp_required = xp_required + 100000000;
insert into public.levels (id, level_number, name, xp_required, description, icon) values
${levels.map((l) => `  (${q(levelId(l.level))}, ${l.level}, ${q(l.name)}, ${l.xp_required}, ${q(l.description)}, ${q(l.icon)})`).join(',\n')}
on conflict (id) do update set
  level_number = excluded.level_number, name = excluded.name, xp_required = excluded.xp_required,
  description = excluded.description, icon = excluded.icon;
delete from public.levels where id not in (${levels.map((l) => q(levelId(l.level))).join(', ')});

-- Conquistas: as que saírem do JSON ficam inativas (quem já tem, continua tendo).
insert into public.achievements (id, name, slug, description, icon, category, requirement_type, requirement_value,
  requirement_count, xp_reward, order_index, active) values
${achievements
  .map(
    (a, i) =>
      `  (${q(a.id)}, ${q(a.name)}, ${q(a.slug)}, ${q(a.description)}, ${q(a.icon)}, ${q(a.category)}, ${q(a.type)}, ${q(a.value ?? '')}, ${a.count ?? 1}, ${a.xp_reward}, ${i + 1}, true)`,
  )
  .join(',\n')}
on conflict (id) do update set
  name = excluded.name, slug = excluded.slug, description = excluded.description, icon = excluded.icon,
  category = excluded.category, requirement_type = excluded.requirement_type,
  requirement_value = excluded.requirement_value, requirement_count = excluded.requirement_count,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, active = true;
update public.achievements set active = false where id not in (${achievements.map((a) => q(a.id)).join(', ')});

-- XP por iniciar cada desafio (content/challenges.json → start_xp_reward).
${challenges.map((c, ci) => `update public.challenges set start_xp_reward = ${c.start_xp_reward ?? 0} where id = ${q(c.id ?? challengeId(ci + 1))};`).join('\n')}

-- Nível guardado no perfil segue a nova tabela de níveis.
update public.profiles set level = public.level_for_xp(total_xp);
`];
fs.writeFileSync(GM_TARGET, gout.join('\n'));
console.log(`${GM_TARGET} gerado: ${levels.length} níveis, ${achievements.length} conquistas.`);

// =====================================================================
// Mundo: content/world.json → supabase/migrations/24_world_content.sql
// =====================================================================
const WD_SOURCE = 'content/world.json';
const WD_TARGET = 'supabase/migrations/24_world_content.sql';
const worldContent = JSON.parse(fs.readFileSync(WD_SOURCE, 'utf8'));
const ITEM_TYPES = ['tree', 'flower', 'plant', 'animal', 'water', 'building', 'decoration'];
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const STATUSES = ['empty', 'evolving', 'developed', 'rich', 'ecosystem'];
const UNLOCK_TYPES = ['initial', 'lesson', 'challenge', 'achievement', 'level'];
const stageId = (n) => `72000000-0000-4000-8000-${pad(n, 12)}`;

const wdProblems = [];
const areaCodes = new Set(worldContent.areas.map((a) => a.code));
worldContent.stages.forEach((st, i) => {
  if (st.stage !== i + 1) wdProblems.push(`estágio ${st.stage}: os estágios devem ser 1, 2, 3… em ordem`);
  if (!STATUSES.includes(st.status)) wdProblems.push(`estágio ${st.stage}: estado inválido`);
  if (i === 0 && (st.min_items || st.min_challenges || st.min_categories)) wdProblems.push('o estágio 1 não pode ter requisitos');
});
const codes = new Set();
const itemIds = new Set();
for (const it of worldContent.items) {
  const where = `item ${it.code}`;
  if (!/^[a-z0-9_]+$/.test(it.code ?? '')) wdProblems.push(`${where}: código inválido`);
  if (codes.has(it.code)) wdProblems.push(`${where}: código repetido`);
  if (itemIds.has(it.id)) wdProblems.push(`${where}: id repetido`);
  codes.add(it.code);
  itemIds.add(it.id);
  if (!areaCodes.has(it.area)) wdProblems.push(`${where}: área inexistente`);
  if (!CATEGORY_IDS[it.category]) wdProblems.push(`${where}: categoria inexistente`);
  if (!ITEM_TYPES.includes(it.item_type)) wdProblems.push(`${where}: tipo inválido`);
  if (it.rarity && !RARITIES.includes(it.rarity)) wdProblems.push(`${where}: raridade inválida`);
  if (!UNLOCK_TYPES.includes(it.unlock_type)) wdProblems.push(`${where}: forma de desbloqueio inválida`);
  const ref = it.unlock_reference;
  if (it.unlock_type === 'lesson' && !bySlug.has(ref)) wdProblems.push(`${where}: lição "${ref}" inexistente`);
  if (it.unlock_type === 'challenge' && !challenges.some((c) => c.slug === ref)) wdProblems.push(`${where}: desafio "${ref}" inexistente`);
  if (it.unlock_type === 'achievement' && !achievements.some((a) => a.slug === ref)) wdProblems.push(`${where}: conquista "${ref}" inexistente`);
  if (it.unlock_type === 'level' && !levels.some((l) => String(l.level) === ref)) wdProblems.push(`${where}: nível "${ref}" inexistente`);
  if (it.min_level !== undefined && !levels.some((l) => l.level === it.min_level)) wdProblems.push(`${where}: nível mínimo inexistente`);
  if (!it.slot || !(it.slot.x >= 0 && it.slot.x <= 100 && it.slot.y >= 0 && it.slot.y <= 100)) wdProblems.push(`${where}: posição fora da área (0–100)`);
  if (!it.meaning) wdProblems.push(`${where}: falta o significado (meaning)`);
}
if (!worldContent.items.some((it) => it.unlock_type === 'initial')) wdProblems.push('o mundo inicial precisa de pelo menos um item "initial"');
if (wdProblems.length) {
  console.error('Mundo inválido:\n- ' + wdProblems.join('\n- '));
  process.exit(1);
}

const wout = [`-- =====================================================================
-- 24 · Mundo virtual: áreas, estágios e itens (Etapa 7)
-- =====================================================================
-- ARQUIVO GERADO por "npm run content:sql" a partir de content/world.json.
-- Não edite à mão. Idempotente: pode ser executado de novo depois de editar o JSON.
-- Itens que saírem do JSON ficam inativos (quem já tem, continua tendo).

insert into public.world_areas (code, name, icon, description, sort_order) values
${worldContent.areas.map((a, i) => `  (${q(a.code)}, ${q(a.name)}, ${q(a.icon)}, ${q(a.description)}, ${i + 1})`).join(',\n')}
on conflict (code) do update set
  name = excluded.name, icon = excluded.icon, description = excluded.description, sort_order = excluded.sort_order;

insert into public.world_stages (id, stage_number, name, icon, description, status, min_items, min_challenges, min_categories) values
${worldContent.stages.map((st) => `  (${q(stageId(st.stage))}, ${st.stage}, ${q(st.name)}, ${q(st.icon)}, ${q(st.description)}, ${q(st.status)}, ${st.min_items}, ${st.min_challenges}, ${st.min_categories})`).join(',\n')}
on conflict (id) do update set
  stage_number = excluded.stage_number, name = excluded.name, icon = excluded.icon, description = excluded.description,
  status = excluded.status, min_items = excluded.min_items, min_challenges = excluded.min_challenges,
  min_categories = excluded.min_categories;
delete from public.world_stages where id not in (${worldContent.stages.map((st) => q(stageId(st.stage))).join(', ')});

-- Códigos antigos liberados antes do upsert (os itens mantêm os mesmos IDs).
update public.world_items set code = 'old_' || replace(id::text, '-', '_'), slug = 'old-' || id::text
where id in (${worldContent.items.map((it) => q(it.id)).join(', ')});
insert into public.world_items (id, code, slug, name, description, meaning, icon, area, category_id, item_type, rarity,
  milestone, unlock_type, unlock_reference, min_level, sort_order, metadata, unlock_title, unlock_message, active) values
${worldContent.items
  .map(
    (it, i) =>
      `  (${q(it.id)}, ${q(it.code)}, ${q(it.code)}, ${q(it.name)}, ${q(it.description)}, ${q(it.meaning)}, ${q(it.icon)}, ${q(it.area)}, ${q(CATEGORY_IDS[it.category])}, ${q(it.item_type)}, ${q(it.rarity ?? 'common')},
   ${it.milestone ? 'true' : 'false'}, ${q(it.unlock_type)}, ${q(it.unlock_reference ?? null)}, ${it.min_level ?? 'null'}, ${i + 1}, ${json({ slot: it.slot })}, ${q(it.unlock_title ?? null)}, ${q(it.unlock_message ?? null)}, true)`,
  )
  .join(',\n')}
on conflict (id) do update set
  code = excluded.code, slug = excluded.slug, name = excluded.name, description = excluded.description,
  meaning = excluded.meaning, icon = excluded.icon, area = excluded.area, category_id = excluded.category_id,
  item_type = excluded.item_type, rarity = excluded.rarity, milestone = excluded.milestone,
  unlock_type = excluded.unlock_type, unlock_reference = excluded.unlock_reference, min_level = excluded.min_level,
  sort_order = excluded.sort_order, metadata = excluded.metadata, unlock_title = excluded.unlock_title,
  unlock_message = excluded.unlock_message, active = true;
update public.world_items set active = false where id not in (${worldContent.items.map((it) => q(it.id)).join(', ')});

-- Mundo inicial
update public.worlds
set name = ${q(worldContent.world.name)}, description = ${q(worldContent.world.description)}
where name = 'Meu Mundo' or description is null;

-- Posições padrão dos itens já conquistados seguem o novo layout (em %).
update public.user_world_items uwi
set position_x = (wi.metadata -> 'slot' ->> 'x')::numeric,
    position_y = (wi.metadata -> 'slot' ->> 'y')::numeric
from public.world_items wi
where wi.id = uwi.world_item_id and (uwi.position_x is null or uwi.position_x > 100 or uwi.position_y > 100);

-- Aplica as regras a todos os jogadores (itens iniciais, desbloqueios já merecidos, estágio).
select public.sync_world(user_id) from public.profiles;
`];
fs.writeFileSync(WD_TARGET, wout.join('\n'));
console.log(`${WD_TARGET} gerado: ${worldContent.areas.length} áreas, ${worldContent.stages.length} estágios, ${worldContent.items.length} itens.`);

// =====================================================================
// Meu Lugar (casa 3D): content/place.json → supabase/migrations/27_place_content.sql
// =====================================================================
const PL_SOURCE = 'content/place.json';
const PL_TARGET = 'supabase/migrations/27_place_content.sql';
const placeContent = JSON.parse(fs.readFileSync(PL_SOURCE, 'utf8'));
const PL_CATEGORIES = ['casa', 'educacao', 'natureza', 'agua', 'reciclagem', 'energia', 'biodiversidade', 'comunidade'];
const PL_MODELS = ['table', 'chair', 'bookshelf', 'picture', 'book', 'flower', 'plant', 'tree_small', 'tree_large',
  'vegetable_garden', 'bee', 'butterfly', 'bird', 'pond', 'fountain', 'solar_lamp', 'reuse_vase', 'recycling_bins', 'bench',
  'wardrobe', 'bed', 'broom', 'toy_box', 'sink', 'reading_nook', 'magnifier', 'journal', 'meditation_cushion', 'cow',
  'sofa', 'coffee_table', 'rug', 'armchair', 'stove', 'fridge', 'dining_table', 'water_filter', 'nightstand', 'laundry_basket',
  'desk_lamp', 'corkboard'];
const PL_UNLOCK = ['initial', 'lesson', 'challenge', 'achievement', 'level', 'evidence'];
const placeStageId = (n) => `82000000-0000-4000-8000-${pad(n, 12)}`;

const plProblems = [];
placeContent.stages.forEach((st, i) => {
  if (st.stage !== i + 1) plProblems.push(`estágio da casa ${st.stage}: fora de ordem`);
  if (i === 0 && (st.min_items || st.min_categories)) plProblems.push('o estágio 1 da casa não pode ter requisitos');
});
const plCodes = new Set();
const plIds = new Set();
for (const it of placeContent.items) {
  const where = `objeto ${it.code}`;
  if (!/^[a-z0-9_]+$/.test(it.code ?? '')) plProblems.push(`${where}: código inválido`);
  if (plCodes.has(it.code) || plIds.has(it.id)) plProblems.push(`${where}: código ou id repetido`);
  plCodes.add(it.code);
  plIds.add(it.id);
  if (!PL_CATEGORIES.includes(it.category)) plProblems.push(`${where}: categoria inválida`);
  if (!PL_MODELS.includes(it.model)) plProblems.push(`${where}: modelo inexistente "${it.model}"`);
  if (!PL_UNLOCK.includes(it.unlock_type)) plProblems.push(`${where}: forma de desbloqueio inválida`);
  if (!Array.isArray(it.position) || it.position.length !== 3 || it.position.some((n) => typeof n !== 'number')) plProblems.push(`${where}: posição inválida`);
  if (!(it.scale > 0 && it.scale <= 5)) plProblems.push(`${where}: escala inválida`);
  const ref = it.unlock_reference;
  if (it.unlock_type === 'initial' && ref) plProblems.push(`${where}: item inicial não tem referência`);
  if (it.unlock_type === 'lesson' && !bySlug.has(ref)) plProblems.push(`${where}: lição "${ref}" inexistente`);
  if (it.unlock_type === 'challenge' && !challenges.some((c) => c.slug === ref)) plProblems.push(`${where}: desafio "${ref}" inexistente`);
  if (it.unlock_type === 'achievement' && !achievements.some((a) => a.slug === ref)) plProblems.push(`${where}: conquista "${ref}" inexistente`);
  if (it.unlock_type === 'level' && !levels.some((l) => String(l.level) === ref)) plProblems.push(`${where}: nível "${ref}" inexistente`);
  if (it.unlock_type === 'evidence' && ref !== 'photo') plProblems.push(`${where}: evidência deve ser "photo"`);
  if (!it.meaning || !it.description) plProblems.push(`${where}: falta descrição ou significado`);
}
if (plProblems.length) {
  console.error('Meu Lugar inválido:\n- ' + plProblems.join('\n- '));
  process.exit(1);
}

const pout = [`-- =====================================================================
-- 27 · Meu Lugar (casa 3D): estágios e objetos
-- =====================================================================
-- ARQUIVO GERADO por "npm run content:sql" a partir de content/place.json.
-- Não edite à mão. Idempotente. Objetos que saírem do JSON ficam inativos
-- (quem já tem, continua tendo).

insert into public.place_stages (id, stage_number, name, icon, description, min_items, min_categories) values
${placeContent.stages.map((st) => `  (${q(placeStageId(st.stage))}, ${st.stage}, ${q(st.name)}, ${q(st.icon)}, ${q(st.description)}, ${st.min_items}, ${st.min_categories})`).join(',\n')}
on conflict (id) do update set
  stage_number = excluded.stage_number, name = excluded.name, icon = excluded.icon,
  description = excluded.description, min_items = excluded.min_items, min_categories = excluded.min_categories;
delete from public.place_stages where id not in (${placeContent.stages.map((st) => q(placeStageId(st.stage))).join(', ')});

insert into public.place_items (id, code, name, icon, description, meaning, category, location, model,
  position_x, position_y, position_z, rotation, scale, unlock_type, unlock_reference, sort_order, active) values
${placeContent.items
  .map(
    (it, i) =>
      `  (${q(it.id)}, ${q(it.code)}, ${q(it.name)}, ${q(it.icon)}, ${q(it.description)}, ${q(it.meaning)}, ${q(it.category)}, ${q(it.location)}, ${q(it.model)},
   ${it.position[0]}, ${it.position[1]}, ${it.position[2]}, ${it.rotation ?? 0}, ${it.scale ?? 1}, ${q(it.unlock_type)}, ${q(it.unlock_reference ?? null)}, ${i + 1}, true)`,
  )
  .join(',\n')}
on conflict (id) do update set
  code = excluded.code, name = excluded.name, icon = excluded.icon, description = excluded.description,
  meaning = excluded.meaning, category = excluded.category, location = excluded.location, model = excluded.model,
  position_x = excluded.position_x, position_y = excluded.position_y, position_z = excluded.position_z,
  rotation = excluded.rotation, scale = excluded.scale, unlock_type = excluded.unlock_type,
  unlock_reference = excluded.unlock_reference, sort_order = excluded.sort_order, active = true;
update public.place_items set active = false where id not in (${placeContent.items.map((it) => q(it.id)).join(', ')});

-- Aplica as regras a todos os jogadores (casa inicial + objetos já merecidos).
select public.sync_place(user_id) from public.profiles;
`];
fs.writeFileSync(PL_TARGET, pout.join('\n'));
console.log(`${PL_TARGET} gerado: ${placeContent.stages.length} estágios, ${placeContent.items.length} objetos.`);
