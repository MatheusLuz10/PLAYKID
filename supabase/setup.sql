-- ECO QUEST · script completo gerado por "npm run db:bundle" (não edite; edite supabase/migrations)

-- >>> 01_extensions.sql
-- =====================================================================
-- 01 · Extensões, tipos e utilitários compartilhados
-- =====================================================================
-- gen_random_uuid() é nativo do PostgreSQL 13+, então nenhuma extensão
-- adicional é obrigatória. O pgcrypto já vem habilitado no Supabase.
create extension if not exists pgcrypto with schema extensions;

-- Dificuldade usada por aulas e desafios.
create type public.difficulty_level as enum ('facil', 'medio', 'dificil');

-- Mantém updated_at sempre correto.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Garante que existe um usuário autenticado e devolve o seu id.
-- As mensagens de erro são códigos curtos, traduzidos no frontend.
create or replace function public.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  return v_user;
end;
$$;

-- >>> 02_profiles.sql
-- =====================================================================
-- 02 · Perfis de usuário e papéis (user / admin)
-- =====================================================================

create type public.app_role as enum ('user', 'admin');

create table public.profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users (id) on delete cascade,
  username      text unique,
  display_name  text,
  avatar_url    text,
  -- Avatar em emoji usado pela interface atual (avatar_url fica para fotos futuras).
  avatar_emoji  text not null default '🦊',
  role          public.app_role not null default 'user',
  level         integer not null default 1 check (level >= 1),
  total_xp      integer not null default 0 check (total_xp >= 0),
  knowledge_xp  integer not null default 0 check (knowledge_xp >= 0),
  action_xp     integer not null default 0 check (action_xp >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint profiles_username_format
    check (username is null or username ~ '^[a-z0-9_]{3,24}$'),
  constraint profiles_display_name_length
    check (display_name is null or char_length(btrim(display_name)) between 1 and 40),
  constraint profiles_avatar_emoji_length
    check (char_length(avatar_emoji) <= 16)
);

comment on table public.profiles is 'Perfil público do jogador. XP e nível são mantidos pelo servidor (xp_transactions).';
comment on column public.profiles.role is 'user ou admin. Não pode ser alterado pelo próprio usuário.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria o perfil automaticamente quando alguém se cadastra no Supabase Auth.
-- display_name nulo = perfil ainda não criado pelo jogador (tela "Criar perfil").
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usado pelas políticas RLS e pelo futuro painel administrativo.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  );
$$;

-- >>> 03_categories.sql
-- =====================================================================
-- 03 · Categorias ecológicas
-- =====================================================================

create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  description  text,
  icon         text,
  image_url    text,
  color        text,
  -- Temas exibidos na tela "Aprender" (ex.: Árvores, Flores...).
  topics       text[] not null default '{}',
  order_index  integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index categories_active_order_idx on public.categories (active, order_index);

-- >>> 04_lessons.sql
-- =====================================================================
-- 04 · Conteúdos educativos (aulas) e suas seções
-- =====================================================================

create table public.lessons (
  id                 uuid primary key default gen_random_uuid(),
  category_id        uuid not null references public.categories (id) on delete restrict,
  -- Tema da categoria ao qual a aula pertence (ex.: 'Árvores').
  topic              text,
  title              text not null,
  slug               text not null unique,
  description        text,
  content            text,
  cover_image_url    text,
  difficulty         public.difficulty_level not null default 'facil',
  estimated_minutes  integer not null default 5 check (estimated_minutes > 0),
  xp_reward          integer not null default 50 check (xp_reward >= 0),
  active             boolean not null default true,
  order_index        integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index lessons_category_order_idx on public.lessons (category_id, order_index);

create trigger lessons_set_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

-- Cada seção vira um "cartão" da aula interativa.
-- Formato de content: parágrafo(s) de texto; linhas iniciadas por "- "
-- são exibidas como destaques (checklist).
create table public.lesson_sections (
  id            uuid primary key default gen_random_uuid(),
  lesson_id     uuid not null references public.lessons (id) on delete cascade,
  section_type  text not null default 'content' check (section_type in ('content', 'fun_fact')),
  icon          text,
  title         text not null,
  content       text not null,
  image_url     text,
  video_url     text,
  order_index   integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (lesson_id, order_index)
);

-- >>> 05_quizzes.sql
-- =====================================================================
-- 05 · Quizzes, perguntas, alternativas, tentativas e respostas
-- =====================================================================
-- Segurança: is_correct e as explicações NUNCA são expostos ao frontend
-- por SELECT (ver grants por coluna em 12_rls.sql). A correção acontece
-- no servidor, pela função answer_quiz_question, depois que o jogador responde.

create table public.quizzes (
  id                uuid primary key default gen_random_uuid(),
  lesson_id         uuid not null unique references public.lessons (id) on delete cascade,
  title             text not null,
  description       text,
  -- Percentual mínimo de acerto (0–100) para aprovação.
  passing_score     integer not null default 60 check (passing_score between 0 and 100),
  xp_reward         integer not null default 100 check (xp_reward >= 0),
  -- null = tentativas ilimitadas.
  attempts_allowed  integer check (attempts_allowed is null or attempts_allowed > 0),
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);

create table public.quiz_questions (
  id           uuid primary key default gen_random_uuid(),
  quiz_id      uuid not null references public.quizzes (id) on delete cascade,
  question     text not null,
  explanation  text,
  order_index  integer not null default 0,
  points       integer not null default 1 check (points > 0),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (quiz_id, order_index)
);

create table public.quiz_options (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.quiz_questions (id) on delete cascade,
  option_text  text not null,
  is_correct   boolean not null default false,
  explanation  text,
  order_index  integer not null default 0,
  unique (question_id, order_index)
);

-- No máximo uma alternativa correta por pergunta.
create unique index quiz_options_one_correct_idx on public.quiz_options (question_id) where is_correct;

create table public.quiz_attempts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  quiz_id          uuid not null references public.quizzes (id) on delete cascade,
  -- Percentual de acerto (0–100), ponderado pelos pontos das perguntas.
  score            integer not null default 0 check (score between 0 and 100),
  total_questions  integer not null default 0,
  correct_answers  integer not null default 0,
  passed           boolean not null default false,
  started_at       timestamptz not null default now(),
  completed_at     timestamptz
);

create index quiz_attempts_user_quiz_idx on public.quiz_attempts (user_id, quiz_id);

create table public.quiz_answers (
  id                  uuid primary key default gen_random_uuid(),
  attempt_id          uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id         uuid not null references public.quiz_questions (id) on delete cascade,
  selected_option_id  uuid not null references public.quiz_options (id) on delete cascade,
  is_correct          boolean not null,
  answered_at         timestamptz not null default now(),
  unique (attempt_id, question_id)
);

-- ---------------------------------------------------------------------
-- RPC: iniciar tentativa (exige a aula concluída)
-- ---------------------------------------------------------------------
create or replace function public.start_quiz_attempt(p_quiz_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := public.require_user();
  v_quiz     public.quizzes;
  v_used     integer;
  v_attempt  uuid;
begin
  select * into v_quiz from public.quizzes where id = p_quiz_id and active;
  if not found then
    raise exception 'not_found';
  end if;

  if not exists (
    select 1 from public.user_lesson_progress
    where user_id = v_user and lesson_id = v_quiz.lesson_id and status = 'completed'
  ) then
    raise exception 'lesson_not_completed';
  end if;

  if v_quiz.attempts_allowed is not null then
    select count(*) into v_used from public.quiz_attempts
    where user_id = v_user and quiz_id = p_quiz_id and completed_at is not null;
    if v_used >= v_quiz.attempts_allowed then
      raise exception 'attempts_exhausted';
    end if;
  end if;

  -- Tentativas abandonadas (não concluídas) são descartadas.
  delete from public.quiz_attempts
  where user_id = v_user and quiz_id = p_quiz_id and completed_at is null;

  insert into public.quiz_attempts (user_id, quiz_id, total_questions)
  values (
    v_user,
    p_quiz_id,
    (select count(*) from public.quiz_questions where quiz_id = p_quiz_id and active)
  )
  returning id into v_attempt;

  return v_attempt;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: responder uma pergunta. Só aqui a resposta correta é revelada.
-- ---------------------------------------------------------------------
create or replace function public.answer_quiz_question(
  p_attempt_id  uuid,
  p_question_id uuid,
  p_option_id   uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user      uuid := public.require_user();
  v_attempt   public.quiz_attempts;
  v_question  public.quiz_questions;
  v_option    public.quiz_options;
  v_correct   uuid;
begin
  select * into v_attempt from public.quiz_attempts
  where id = p_attempt_id and user_id = v_user
  for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_attempt.completed_at is not null then
    raise exception 'attempt_closed';
  end if;

  select * into v_question from public.quiz_questions
  where id = p_question_id and quiz_id = v_attempt.quiz_id and active;
  if not found then
    raise exception 'not_found';
  end if;

  select * into v_option from public.quiz_options
  where id = p_option_id and question_id = p_question_id;
  if not found then
    raise exception 'not_found';
  end if;

  select id into v_correct from public.quiz_options
  where question_id = p_question_id and is_correct;

  insert into public.quiz_answers (attempt_id, question_id, selected_option_id, is_correct)
  values (p_attempt_id, p_question_id, p_option_id, v_option.is_correct)
  on conflict (attempt_id, question_id) do nothing;
  if not found then
    raise exception 'already_answered';
  end if;

  return jsonb_build_object(
    'is_correct',         v_option.is_correct,
    'correct_option_id',  v_correct,
    'explanation',        v_question.explanation,
    'option_explanation', v_option.explanation
  );
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: finalizar tentativa → nota, aprovação, XP e conquistas
-- ---------------------------------------------------------------------
create or replace function public.finish_quiz_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user      uuid := public.require_user();
  v_attempt   public.quiz_attempts;
  v_quiz      public.quizzes;
  v_total     integer;
  v_points    integer;
  v_answered  integer;
  v_correct   integer;
  v_earned    integer;
  v_score     integer;
  v_passed    boolean;
  v_xp        integer := 0;
begin
  select * into v_attempt from public.quiz_attempts
  where id = p_attempt_id and user_id = v_user
  for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_attempt.completed_at is not null then
    raise exception 'attempt_closed';
  end if;

  select * into v_quiz from public.quizzes where id = v_attempt.quiz_id;

  select count(*), coalesce(sum(points), 0) into v_total, v_points
  from public.quiz_questions where quiz_id = v_quiz.id and active;

  select count(*),
         count(*) filter (where a.is_correct),
         coalesce(sum(q.points) filter (where a.is_correct), 0)
    into v_answered, v_correct, v_earned
  from public.quiz_answers a
  join public.quiz_questions q on q.id = a.question_id
  where a.attempt_id = p_attempt_id and q.active;

  if v_answered < v_total then
    raise exception 'quiz_incomplete';
  end if;

  v_score  := case when v_points = 0 then 0 else round(v_earned * 100.0 / v_points) end;
  v_passed := v_score >= v_quiz.passing_score;

  update public.quiz_attempts
  set score = v_score,
      total_questions = v_total,
      correct_answers = v_correct,
      passed = v_passed,
      completed_at = now()
  where id = p_attempt_id;

  if v_passed then
    v_xp := public.award_xp(v_user, v_quiz.xp_reward, 'knowledge', 'quiz', v_quiz.id,
                            'Quiz aprovado: ' || v_quiz.title);
  end if;

  return jsonb_build_object(
    'score',           v_score,
    'correct_answers', v_correct,
    'total_questions', v_total,
    'passed',          v_passed,
    'passing_score',   v_quiz.passing_score,
    'xp_awarded',      v_xp,
    'achievements',    public.check_achievements(v_user)
  );
end;
$$;

-- >>> 06_challenges.sql
-- =====================================================================
-- 06 · Desafios, etapas e desafios aceitos pelos usuários
-- =====================================================================
-- Relacionamento pedagógico: LESSON → QUIZ → CHALLENGE.
-- Um desafio só pode ser aceito depois da aula concluída e do quiz aprovado.

create type public.challenge_status as enum (
  'locked', 'available', 'accepted', 'in_progress',
  'waiting_follow_up', 'completed', 'expired', 'cancelled'
);

create type public.challenge_step_type as enum (
  'instruction', 'action', 'evidence', 'follow_up', 'completion'
);

create table public.challenges (
  id                  uuid primary key default gen_random_uuid(),
  category_id         uuid not null references public.categories (id) on delete restrict,
  lesson_id           uuid not null references public.lessons (id) on delete restrict,
  icon                text,
  title               text not null,
  slug                text not null unique,
  description         text not null,
  -- Uma instrução por linha.
  instructions        text,
  -- Cuidados/segurança, uma recomendação por linha.
  safety_notes        text,
  difficulty          public.difficulty_level not null default 'medio',
  deadline_days       integer not null default 15 check (deadline_days > 0),
  xp_reward           integer not null default 500 check (xp_reward >= 0),
  active              boolean not null default true,
  requires_evidence   boolean not null default true,
  requires_follow_up  boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index challenges_lesson_idx on public.challenges (lesson_id);
create index challenges_category_idx on public.challenges (category_id);

create trigger challenges_set_updated_at
  before update on public.challenges
  for each row execute function public.set_updated_at();

create table public.challenge_steps (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references public.challenges (id) on delete cascade,
  title         text not null,
  description   text,
  step_type     public.challenge_step_type not null,
  order_index   integer not null default 0,
  required      boolean not null default true,
  xp_reward     integer not null default 0 check (xp_reward >= 0),
  -- Para follow_up: quantos dias após a realização (Dia 0) o acompanhamento acontece.
  day_offset    integer check (day_offset is null or day_offset >= 0),
  created_at    timestamptz not null default now(),
  unique (challenge_id, order_index),
  constraint challenge_steps_follow_up_day check (step_type <> 'follow_up' or day_offset is not null)
);

create table public.user_challenges (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  challenge_id         uuid not null references public.challenges (id) on delete cascade,
  status               public.challenge_status not null default 'accepted',
  started_at           timestamptz,
  accepted_at          timestamptz,
  deadline_at          timestamptz,
  completed_at         timestamptz,
  progress_percentage  integer not null default 0 check (progress_percentage between 0 and 100),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Um único registro "vivo" por usuário e desafio (expirados/cancelados podem ser refeitos).
create unique index user_challenges_active_uniq
  on public.user_challenges (user_id, challenge_id)
  where status not in ('expired', 'cancelled');
create index user_challenges_user_status_idx on public.user_challenges (user_id, status);

create trigger user_challenges_set_updated_at
  before update on public.user_challenges
  for each row execute function public.set_updated_at();

create table public.user_challenge_steps (
  id                 uuid primary key default gen_random_uuid(),
  user_challenge_id  uuid not null references public.user_challenges (id) on delete cascade,
  challenge_step_id  uuid not null references public.challenge_steps (id) on delete cascade,
  status             text not null default 'pending' check (status in ('pending', 'completed', 'skipped')),
  completed_at       timestamptz,
  notes              text,
  created_at         timestamptz not null default now(),
  unique (user_challenge_id, challenge_step_id)
);

-- ---------------------------------------------------------------------
-- Utilitários internos (sem permissão de execução para usuários)
-- ---------------------------------------------------------------------
create or replace function public.complete_challenge_steps(
  p_user_challenge_id uuid,
  p_types public.challenge_step_type[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.user_challenge_steps ucs
  set status = 'completed', completed_at = now()
  from public.challenge_steps cs
  where cs.id = ucs.challenge_step_id
    and ucs.user_challenge_id = p_user_challenge_id
    and cs.step_type = any (p_types)
    and ucs.status <> 'completed';
end;
$$;

create or replace function public.refresh_user_challenge_progress(p_user_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.user_challenges uc
  set progress_percentage = coalesce((
    select round(100.0 * count(*) filter (where ucs.status = 'completed') / nullif(count(*), 0))
    from public.user_challenge_steps ucs
    join public.challenge_steps cs on cs.id = ucs.challenge_step_id
    where ucs.user_challenge_id = p_user_challenge_id and cs.required
  ), 0)
  where uc.id = p_user_challenge_id;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: aceitar desafio (exige aula concluída e quiz aprovado)
-- ---------------------------------------------------------------------
create or replace function public.accept_challenge(p_challenge_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user       uuid := public.require_user();
  v_challenge  public.challenges;
  v_quiz_id    uuid;
  v_existing   public.user_challenges;
  v_id         uuid;
begin
  select * into v_challenge from public.challenges where id = p_challenge_id and active;
  if not found then
    raise exception 'not_found';
  end if;

  if not exists (
    select 1 from public.user_lesson_progress
    where user_id = v_user and lesson_id = v_challenge.lesson_id and status = 'completed'
  ) then
    raise exception 'lesson_not_completed';
  end if;

  select id into v_quiz_id from public.quizzes where lesson_id = v_challenge.lesson_id and active;
  if v_quiz_id is not null and not exists (
    select 1 from public.quiz_attempts where user_id = v_user and quiz_id = v_quiz_id and passed
  ) then
    raise exception 'quiz_not_passed';
  end if;

  select * into v_existing from public.user_challenges
  where user_id = v_user and challenge_id = p_challenge_id and status not in ('expired', 'cancelled')
  for update;

  if found then
    -- Prazo vencido sem realização: o registro antigo expira e um novo começa.
    if v_existing.status = 'accepted' and v_existing.deadline_at < now() then
      update public.user_challenges set status = 'expired' where id = v_existing.id;
    else
      return v_existing.id;
    end if;
  end if;

  insert into public.user_challenges (user_id, challenge_id, status, accepted_at, deadline_at)
  values (v_user, p_challenge_id, 'accepted', now(), now() + make_interval(days => v_challenge.deadline_days))
  returning id into v_id;

  insert into public.user_challenge_steps (user_challenge_id, challenge_step_id)
  select v_id, cs.id from public.challenge_steps cs where cs.challenge_id = p_challenge_id;

  perform public.refresh_user_challenge_progress(v_id);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: concluir desafio → XP, conquistas e item no mundo
-- ---------------------------------------------------------------------
create or replace function public.complete_challenge(p_user_challenge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user       uuid := public.require_user();
  v_uc         public.user_challenges;
  v_challenge  public.challenges;
  v_pending    integer;
  v_xp         integer;
  v_items      jsonb;
begin
  select * into v_uc from public.user_challenges
  where id = p_user_challenge_id and user_id = v_user
  for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_uc.completed_at is not null then
    raise exception 'challenge_already_completed';
  end if;
  if v_uc.status not in ('accepted', 'in_progress') then
    raise exception 'challenge_not_active';
  end if;

  select * into v_challenge from public.challenges where id = v_uc.challenge_id;

  if v_challenge.requires_evidence and not exists (
    select 1 from public.challenge_evidence
    where user_challenge_id = v_uc.id and followup_id is null
  ) then
    raise exception 'evidence_required';
  end if;

  perform public.complete_challenge_steps(
    v_uc.id, array['instruction', 'action', 'completion']::public.challenge_step_type[]
  );

  select count(*) into v_pending from public.challenge_followups
  where user_challenge_id = v_uc.id and status = 'scheduled';

  update public.user_challenges
  set status = case when v_pending > 0 then 'waiting_follow_up' else 'completed' end::public.challenge_status,
      completed_at = now(),
      started_at = coalesce(started_at, now())
  where id = v_uc.id;

  perform public.refresh_user_challenge_progress(v_uc.id);

  v_xp := public.award_xp(v_user, v_challenge.xp_reward, 'action', 'challenge', v_uc.id,
                          'Desafio concluído: ' || v_challenge.title);
  v_items := public.unlock_world_items_for_challenge(v_user, v_challenge.slug);

  return jsonb_build_object(
    'xp_awarded',   v_xp,
    'world_items',  v_items,
    'achievements', public.check_achievements(v_user)
  );
end;
$$;

-- >>> 07_evidence.sql
-- =====================================================================
-- 07 · Evidências, acompanhamentos (follow-ups) e Storage
-- =====================================================================

create type public.evidence_type as enum ('photo', 'video', 'text');
create type public.evidence_status as enum ('submitted', 'approved', 'rejected');
create type public.followup_status as enum ('scheduled', 'completed', 'missed');

create table public.challenge_followups (
  id                 uuid primary key default gen_random_uuid(),
  user_challenge_id  uuid not null references public.user_challenges (id) on delete cascade,
  -- Etapa (follow_up) do desafio que originou este acompanhamento.
  challenge_step_id  uuid references public.challenge_steps (id) on delete set null,
  title              text not null,
  description        text,
  scheduled_for      timestamptz not null,
  completed_at       timestamptz,
  status             public.followup_status not null default 'scheduled',
  evidence_required  boolean not null default true,
  created_at         timestamptz not null default now(),
  unique (user_challenge_id, challenge_step_id)
);

create index challenge_followups_uc_idx on public.challenge_followups (user_challenge_id, scheduled_for);
-- Preparado para lembretes futuros (ex.: acompanhamentos vencendo).
create index challenge_followups_due_idx on public.challenge_followups (status, scheduled_for);

create table public.challenge_evidence (
  id                 uuid primary key default gen_random_uuid(),
  user_challenge_id  uuid not null references public.user_challenges (id) on delete cascade,
  user_id            uuid not null references auth.users (id) on delete cascade,
  -- null = evidência da realização (Dia 0); preenchido = evidência de um acompanhamento.
  followup_id        uuid references public.challenge_followups (id) on delete cascade,
  evidence_type      public.evidence_type not null default 'photo',
  -- Caminho do arquivo no bucket privado eco-evidence (não é uma URL pública).
  file_url           text,
  thumbnail_url      text,
  description        text check (description is null or char_length(description) <= 500),
  captured_at        timestamptz not null default now(),
  status             public.evidence_status not null default 'submitted',
  created_at         timestamptz not null default now(),
  constraint challenge_evidence_photo_file check (evidence_type <> 'photo' or file_url is not null)
);

create index challenge_evidence_uc_idx on public.challenge_evidence (user_challenge_id);
create unique index challenge_evidence_main_uniq
  on public.challenge_evidence (user_challenge_id) where followup_id is null;
create unique index challenge_evidence_followup_uniq
  on public.challenge_evidence (followup_id) where followup_id is not null;

-- ---------------------------------------------------------------------
-- Storage: bucket privado para as fotos
-- Caminho: users/{user_id}/challenges/{challenge_id}/{arquivo}
-- (políticas de acesso em 12_rls.sql)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('eco-evidence', 'eco-evidence', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Confere se o arquivo pertence ao usuário/desafio e se realmente foi enviado.
create or replace function public.assert_evidence_path(p_user uuid, p_challenge uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_path is null then
    return;
  end if;
  if p_path !~ ('^users/' || p_user::text || '/challenges/' || p_challenge::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'invalid_evidence_path';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'eco-evidence' and name = p_path) then
    raise exception 'evidence_file_missing';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: enviar a evidência da realização (Dia 0)
-- Cria os acompanhamentos agendados a partir das etapas follow_up.
-- ---------------------------------------------------------------------
create or replace function public.submit_challenge_evidence(
  p_user_challenge_id uuid,
  p_file_path         text,
  p_thumbnail_path    text,
  p_description       text,
  p_captured_at       date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user       uuid := public.require_user();
  v_uc         public.user_challenges;
  v_challenge  public.challenges;
  v_id         uuid;
begin
  select * into v_uc from public.user_challenges
  where id = p_user_challenge_id and user_id = v_user
  for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_uc.completed_at is not null or v_uc.status not in ('accepted', 'in_progress') then
    raise exception 'challenge_not_active';
  end if;
  if v_uc.status = 'accepted' and v_uc.deadline_at < now() then
    raise exception 'challenge_expired';
  end if;
  if exists (
    select 1 from public.challenge_evidence
    where user_challenge_id = v_uc.id and followup_id is null
  ) then
    raise exception 'evidence_already_sent';
  end if;

  select * into v_challenge from public.challenges where id = v_uc.challenge_id;

  if v_challenge.requires_evidence and p_file_path is null then
    raise exception 'photo_required';
  end if;
  -- Aceita um dia de folga por causa de fuso horário.
  if p_captured_at is null or p_captured_at > current_date + 1 then
    raise exception 'invalid_date';
  end if;

  perform public.assert_evidence_path(v_user, v_challenge.id, p_file_path);
  perform public.assert_evidence_path(v_user, v_challenge.id, p_thumbnail_path);

  insert into public.challenge_evidence (
    user_challenge_id, user_id, evidence_type, file_url, thumbnail_url, description, captured_at
  )
  values (
    v_uc.id,
    v_user,
    case when p_file_path is null then 'text' else 'photo' end::public.evidence_type,
    p_file_path,
    p_thumbnail_path,
    nullif(btrim(p_description), ''),
    (p_captured_at + time '12:00') at time zone 'UTC'
  )
  returning id into v_id;

  perform public.complete_challenge_steps(
    v_uc.id, array['instruction', 'action', 'evidence']::public.challenge_step_type[]
  );

  update public.user_challenges
  set status = 'in_progress', started_at = coalesce(started_at, now())
  where id = v_uc.id;

  insert into public.challenge_followups (
    user_challenge_id, challenge_step_id, title, description, scheduled_for, evidence_required
  )
  select v_uc.id, cs.id, cs.title, cs.description,
         ((p_captured_at + cs.day_offset) + time '12:00') at time zone 'UTC',
         true
  from public.challenge_steps cs
  where cs.challenge_id = v_challenge.id and cs.step_type = 'follow_up'
  on conflict (user_challenge_id, challenge_step_id) do nothing;

  perform public.refresh_user_challenge_progress(v_uc.id);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: registrar um acompanhamento (somente a partir da data prevista)
-- ---------------------------------------------------------------------
create or replace function public.complete_followup(
  p_followup_id    uuid,
  p_file_path      text,
  p_thumbnail_path text,
  p_description    text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user      uuid := public.require_user();
  v_followup  public.challenge_followups;
  v_uc        public.user_challenges;
  v_step_xp   integer;
  v_xp        integer := 0;
begin
  select f.* into v_followup
  from public.challenge_followups f
  join public.user_challenges uc on uc.id = f.user_challenge_id
  where f.id = p_followup_id and uc.user_id = v_user
  for update of f;
  if not found then
    raise exception 'not_found';
  end if;
  if v_followup.status <> 'scheduled' then
    raise exception 'followup_already_done';
  end if;
  if v_followup.scheduled_for > now() then
    raise exception 'followup_not_due';
  end if;

  select * into v_uc from public.user_challenges where id = v_followup.user_challenge_id for update;

  if v_followup.evidence_required and p_file_path is null then
    raise exception 'photo_required';
  end if;
  perform public.assert_evidence_path(v_user, v_uc.challenge_id, p_file_path);
  perform public.assert_evidence_path(v_user, v_uc.challenge_id, p_thumbnail_path);

  if p_file_path is not null or nullif(btrim(p_description), '') is not null then
    insert into public.challenge_evidence (
      user_challenge_id, user_id, followup_id, evidence_type, file_url, thumbnail_url, description
    )
    values (
      v_uc.id, v_user, p_followup_id,
      case when p_file_path is null then 'text' else 'photo' end::public.evidence_type,
      p_file_path, p_thumbnail_path, nullif(btrim(p_description), '')
    );
  end if;

  update public.challenge_followups
  set status = 'completed', completed_at = now()
  where id = p_followup_id;

  if v_followup.challenge_step_id is not null then
    update public.user_challenge_steps
    set status = 'completed', completed_at = now()
    where user_challenge_id = v_uc.id and challenge_step_id = v_followup.challenge_step_id;

    select xp_reward into v_step_xp from public.challenge_steps where id = v_followup.challenge_step_id;
    v_xp := public.award_xp(v_user, coalesce(v_step_xp, 0), 'follow_up', 'follow_up', p_followup_id,
                            'Acompanhamento: ' || v_followup.title);
  end if;

  -- Último acompanhamento de um desafio já concluído encerra o ciclo do desafio.
  if v_uc.status = 'waiting_follow_up' and not exists (
    select 1 from public.challenge_followups
    where user_challenge_id = v_uc.id and status = 'scheduled'
  ) then
    update public.user_challenges set status = 'completed' where id = v_uc.id;
  end if;

  perform public.refresh_user_challenge_progress(v_uc.id);

  return jsonb_build_object(
    'xp_awarded',   v_xp,
    'achievements', public.check_achievements(v_user)
  );
end;
$$;

-- >>> 08_progress.sql
-- =====================================================================
-- 08 · Progresso nos conteúdos (conhecimentos adquiridos)
-- =====================================================================

create type public.lesson_progress_status as enum ('not_started', 'in_progress', 'completed');

create table public.user_lesson_progress (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  lesson_id            uuid not null references public.lessons (id) on delete cascade,
  status               public.lesson_progress_status not null default 'not_started',
  progress_percentage  integer not null default 0 check (progress_percentage between 0 and 100),
  completed_at         timestamptz,
  last_accessed_at     timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create trigger user_lesson_progress_set_updated_at
  before update on public.user_lesson_progress
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- RPC: registrar o avanço na aula (nunca conclui; máximo 99%)
-- ---------------------------------------------------------------------
create or replace function public.track_lesson_progress(p_lesson_id uuid, p_percentage integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
begin
  if not exists (select 1 from public.lessons where id = p_lesson_id and active) then
    raise exception 'not_found';
  end if;

  insert into public.user_lesson_progress as ulp
    (user_id, lesson_id, status, progress_percentage, last_accessed_at)
  values
    (v_user, p_lesson_id, 'in_progress', least(greatest(coalesce(p_percentage, 0), 0), 99), now())
  on conflict (user_id, lesson_id) do update
  set last_accessed_at = now(),
      progress_percentage = case
        when ulp.status = 'completed' then ulp.progress_percentage
        else greatest(ulp.progress_percentage, excluded.progress_percentage)
      end,
      status = case
        when ulp.status = 'completed' then ulp.status
        else 'in_progress'::public.lesson_progress_status
      end;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: concluir a aula → XP de conhecimento (uma única vez) e conquistas
-- ---------------------------------------------------------------------
create or replace function public.complete_lesson(p_lesson_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := public.require_user();
  v_lesson  public.lessons;
  v_xp      integer;
begin
  select * into v_lesson from public.lessons where id = p_lesson_id and active;
  if not found then
    raise exception 'not_found';
  end if;

  insert into public.user_lesson_progress as ulp
    (user_id, lesson_id, status, progress_percentage, completed_at, last_accessed_at)
  values
    (v_user, p_lesson_id, 'completed', 100, now(), now())
  on conflict (user_id, lesson_id) do update
  set status = 'completed',
      progress_percentage = 100,
      completed_at = coalesce(ulp.completed_at, now()),
      last_accessed_at = now();

  v_xp := public.award_xp(v_user, v_lesson.xp_reward, 'knowledge', 'lesson', v_lesson.id,
                          'Conteúdo concluído: ' || v_lesson.title);

  return jsonb_build_object(
    'xp_awarded',   v_xp,
    'achievements', public.check_achievements(v_user)
  );
end;
$$;

-- >>> 09_xp.sql
-- =====================================================================
-- 09 · XP (histórico auditável) e níveis
-- =====================================================================
-- Toda variação de XP vira uma linha em xp_transactions. Os totais do
-- perfil são apenas um cache mantido por trigger e podem ser recalculados
-- a qualquer momento a partir do histórico (admin_recalculate_xp).

create type public.xp_type as enum ('knowledge', 'action', 'achievement', 'follow_up', 'bonus');

create table public.levels (
  id            uuid primary key default gen_random_uuid(),
  level_number  integer not null unique check (level_number > 0),
  name          text not null,
  xp_required   integer not null unique check (xp_required >= 0),
  description   text,
  reward        text,
  icon          text,
  created_at    timestamptz not null default now()
);

create table public.xp_transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  amount       integer not null check (amount <> 0),
  xp_type      public.xp_type not null,
  -- Origem: lesson, quiz, challenge, follow_up, achievement, bonus...
  source_type  text not null,
  source_id    uuid,
  description  text,
  created_at   timestamptz not null default now()
);

create index xp_transactions_user_created_idx on public.xp_transactions (user_id, created_at desc);
-- Impede XP duplicado pela mesma origem (idempotência).
create unique index xp_transactions_source_uniq
  on public.xp_transactions (user_id, source_type, source_id)
  where source_id is not null;

create or replace function public.level_for_xp(p_xp integer)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(max(level_number), 1) from public.levels where xp_required <= p_xp;
$$;

-- Atualiza o cache de XP/nível do perfil a cada nova transação.
create or replace function public.apply_xp_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles p
  set total_xp     = greatest(p.total_xp + new.amount, 0),
      knowledge_xp = greatest(p.knowledge_xp + case when new.xp_type = 'knowledge' then new.amount else 0 end, 0),
      action_xp    = greatest(p.action_xp + case when new.xp_type in ('action', 'follow_up') then new.amount else 0 end, 0)
  where p.user_id = new.user_id;

  update public.profiles p
  set level = public.level_for_xp(p.total_xp)
  where p.user_id = new.user_id;

  return new;
end;
$$;

create trigger xp_transactions_apply
  after insert on public.xp_transactions
  for each row execute function public.apply_xp_transaction();

-- Função interna: concede XP uma única vez por origem. Retorna o XP concedido (0 se repetido).
create or replace function public.award_xp(
  p_user_id      uuid,
  p_amount       integer,
  p_type         public.xp_type,
  p_source_type  text,
  p_source_id    uuid,
  p_description  text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if coalesce(p_amount, 0) <= 0 then
    return 0;
  end if;

  insert into public.xp_transactions (user_id, amount, xp_type, source_type, source_id, description)
  values (p_user_id, p_amount, p_type, p_source_type, p_source_id, p_description)
  on conflict (user_id, source_type, source_id) where source_id is not null do nothing
  returning id into v_id;

  return case when v_id is null then 0 else p_amount end;
end;
$$;

-- Auditoria (admin): recalcula o cache do perfil a partir do histórico.
create or replace function public.admin_recalculate_xp(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.profiles p
  set total_xp     = greatest(coalesce(t.total, 0), 0),
      knowledge_xp = greatest(coalesce(t.knowledge, 0), 0),
      action_xp    = greatest(coalesce(t.action, 0), 0),
      level        = public.level_for_xp(greatest(coalesce(t.total, 0), 0))
  from (
    select sum(amount)::integer as total,
           (sum(amount) filter (where xp_type = 'knowledge'))::integer as knowledge,
           (sum(amount) filter (where xp_type in ('action', 'follow_up')))::integer as action
    from public.xp_transactions
    where user_id = p_user_id
  ) t
  where p.user_id = p_user_id;
end;
$$;

-- >>> 10_achievements.sql
-- =====================================================================
-- 10 · Conquistas
-- =====================================================================
-- As conquistas são verificadas SOMENTE pelo servidor (check_achievements),
-- chamado ao final de cada ação do jogo. O usuário não pode inseri-las.

create table public.achievements (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  slug               text not null unique,
  description        text,
  icon               text,
  xp_reward          integer not null default 0 check (xp_reward >= 0),
  -- lessons_completed | quizzes_passed | challenges_completed  → requirement_value = quantidade
  -- challenge_completed                                         → requirement_value = slug do desafio
  -- cycles_completed                                            → requirement_value = quantidade
  requirement_type   text not null check (requirement_type in (
    'lessons_completed', 'quizzes_passed', 'challenges_completed',
    'challenge_completed', 'cycles_completed'
  )),
  requirement_value  text not null,
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);

create table public.user_achievements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  achievement_id  uuid not null references public.achievements (id) on delete cascade,
  unlocked_at     timestamptz not null default now(),
  unique (user_id, achievement_id)
);

create or replace function public.achievement_met(p_user uuid, p_type text, p_value text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  case p_type
    when 'lessons_completed' then
      return (select count(*) from public.user_lesson_progress
              where user_id = p_user and status = 'completed') >= p_value::integer;
    when 'quizzes_passed' then
      return (select count(distinct quiz_id) from public.quiz_attempts
              where user_id = p_user and passed) >= p_value::integer;
    when 'challenges_completed' then
      return (select count(*) from public.user_challenges
              where user_id = p_user and completed_at is not null) >= p_value::integer;
    when 'challenge_completed' then
      return exists (
        select 1 from public.user_challenges uc
        join public.challenges c on c.id = uc.challenge_id
        where uc.user_id = p_user and uc.completed_at is not null and c.slug = p_value
      );
    when 'cycles_completed' then
      -- Um ciclo termina quando o item conquistado aparece no mundo do jogador.
      return (select count(*) from public.user_world_items uwi
              join public.worlds w on w.id = uwi.world_id
              where w.user_id = p_user
                and coalesce((uwi.metadata ->> 'revealed')::boolean, false)) >= p_value::integer;
    else
      return false;
  end case;
end;
$$;

-- Função interna: desbloqueia as conquistas atingidas e devolve as novas.
create or replace function public.check_achievements(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r      record;
  v_id   uuid;
  v_new  jsonb := '[]'::jsonb;
begin
  for r in
    select a.* from public.achievements a
    where a.active
      and not exists (
        select 1 from public.user_achievements ua
        where ua.user_id = p_user and ua.achievement_id = a.id
      )
    order by a.created_at, a.slug
  loop
    if public.achievement_met(p_user, r.requirement_type, r.requirement_value) then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user, r.id)
      on conflict (user_id, achievement_id) do nothing
      returning id into v_id;

      if v_id is not null then
        perform public.award_xp(p_user, r.xp_reward, 'achievement', 'achievement', r.id,
                                'Conquista: ' || r.name);
        v_new := v_new || jsonb_build_array(jsonb_build_object(
          'id', r.id, 'slug', r.slug, 'name', r.name, 'icon', r.icon, 'xp_reward', r.xp_reward
        ));
      end if;
    end if;
  end loop;

  return v_new;
end;
$$;

-- >>> 11_world.sql
-- =====================================================================
-- 11 · Mundo do jogador e itens
-- =====================================================================

create type public.world_item_type as enum (
  'tree', 'flower', 'plant', 'animal', 'water', 'building', 'decoration'
);
create type public.item_rarity as enum ('common', 'uncommon', 'rare', 'epic', 'legendary');

create table public.worlds (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique references auth.users (id) on delete cascade,
  name               text not null default 'Meu Mundo',
  level              integer not null default 1 check (level >= 1),
  environment_score  integer not null default 0 check (environment_score >= 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger worlds_set_updated_at
  before update on public.worlds
  for each row execute function public.set_updated_at();

create table public.world_items (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text not null unique,
  type                public.world_item_type not null,
  description         text,
  image_url           text,
  rarity              public.item_rarity not null default 'common',
  -- Ex.: {"type": "challenge_completed", "challenge_slug": "plante-uma-arvore"}
  unlock_requirement  jsonb not null default '{}'::jsonb,
  -- Dados de apresentação. Ex.: {"kind": "tree", "slot": {"x": 200, "y": 196}}
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create table public.user_world_items (
  id             uuid primary key default gen_random_uuid(),
  world_id       uuid not null references public.worlds (id) on delete cascade,
  world_item_id  uuid not null references public.world_items (id) on delete cascade,
  quantity       integer not null default 1 check (quantity > 0),
  unlocked_at    timestamptz not null default now(),
  -- Posição no cenário: preparado para o jogador organizar o mundo no futuro.
  position_x     numeric,
  position_y     numeric,
  -- revealed = o jogador já viu o item surgir no mundo (fecha o ciclo).
  metadata       jsonb not null default '{}'::jsonb,
  unique (world_id, world_item_id)
);

create index user_world_items_world_idx on public.user_world_items (world_id);

-- Todo perfil novo ganha o seu próprio mundo.
create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.worlds (user_id) values (new.user_id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_profile();

-- Função interna: adiciona ao mundo os itens liberados por um desafio.
create or replace function public.unlock_world_items_for_challenge(p_user uuid, p_challenge_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_world  uuid;
  v_score  integer;
  r        record;
  v_items  jsonb := '[]'::jsonb;
begin
  select id into v_world from public.worlds where user_id = p_user;
  if v_world is null then
    insert into public.worlds (user_id) values (p_user) returning id into v_world;
  end if;

  for r in
    select * from public.world_items wi
    where wi.unlock_requirement ->> 'type' = 'challenge_completed'
      and wi.unlock_requirement ->> 'challenge_slug' = p_challenge_slug
  loop
    insert into public.user_world_items as uwi
      (world_id, world_item_id, position_x, position_y, metadata)
    values (
      v_world, r.id,
      (r.metadata -> 'slot' ->> 'x')::numeric,
      (r.metadata -> 'slot' ->> 'y')::numeric,
      jsonb_build_object('revealed', false)
    )
    on conflict (world_id, world_item_id) do update
    set quantity = uwi.quantity + 1;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id', r.id, 'slug', r.slug, 'name', r.name, 'type', r.type
    ));
  end loop;

  select coalesce(sum(quantity), 0) * 10 into v_score
  from public.user_world_items where world_id = v_world;

  update public.worlds
  set environment_score = v_score, level = 1 + v_score / 100
  where id = v_world;

  return v_items;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: o jogador viu os novos itens no mundo → fecha o ciclo
-- ---------------------------------------------------------------------
create or replace function public.reveal_world_items()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := public.require_user();
  v_revealed jsonb;
begin
  with updated as (
    update public.user_world_items uwi
    set metadata = uwi.metadata || '{"revealed": true}'::jsonb
    from public.worlds w
    where w.id = uwi.world_id
      and w.user_id = v_user
      and not coalesce((uwi.metadata ->> 'revealed')::boolean, false)
    returning uwi.world_item_id
  )
  select coalesce(jsonb_agg(world_item_id), '[]'::jsonb) into v_revealed from updated;

  return jsonb_build_object(
    'revealed',     v_revealed,
    'achievements', public.check_achievements(v_user)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: todo o estado do jogador em UMA chamada (evita consultas repetidas).
-- security invoker: as políticas RLS continuam valendo.
-- ---------------------------------------------------------------------
create or replace function public.get_player_state()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
begin
  return jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.user_id = v_user),

    'lessons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'lesson_id', l.lesson_id,
        'status', l.status,
        'progress_percentage', l.progress_percentage,
        'completed_at', l.completed_at
      ))
      from public.user_lesson_progress l where l.user_id = v_user
    ), '[]'::jsonb),

    'quizzes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'quiz_id', b.quiz_id,
        'score', b.score,
        'correct_answers', b.correct_answers,
        'total_questions', b.total_questions,
        'passed', b.passed,
        'completed_at', b.completed_at,
        'attempts', (
          select count(*) from public.quiz_attempts c
          where c.user_id = v_user and c.quiz_id = b.quiz_id and c.completed_at is not null
        )
      ))
      from (
        -- Melhor tentativa concluída de cada quiz.
        select distinct on (a.quiz_id) a.*
        from public.quiz_attempts a
        where a.user_id = v_user and a.completed_at is not null
        order by a.quiz_id, a.passed desc, a.score desc, a.completed_at desc
      ) b
    ), '[]'::jsonb),

    'challenges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', uc.id,
        'challenge_id', uc.challenge_id,
        'status', uc.status,
        'accepted_at', uc.accepted_at,
        'deadline_at', uc.deadline_at,
        'started_at', uc.started_at,
        'completed_at', uc.completed_at,
        'progress_percentage', uc.progress_percentage,
        'steps', coalesce((
          select jsonb_agg(jsonb_build_object(
            'challenge_step_id', s.challenge_step_id, 'status', s.status, 'completed_at', s.completed_at
          ))
          from public.user_challenge_steps s where s.user_challenge_id = uc.id
        ), '[]'::jsonb),
        'followups', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', f.id, 'challenge_step_id', f.challenge_step_id, 'title', f.title,
            'description', f.description, 'scheduled_for', f.scheduled_for,
            'completed_at', f.completed_at, 'status', f.status,
            'evidence_required', f.evidence_required
          ) order by f.scheduled_for)
          from public.challenge_followups f where f.user_challenge_id = uc.id
        ), '[]'::jsonb),
        'evidence', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', e.id, 'followup_id', e.followup_id, 'evidence_type', e.evidence_type,
            'file_url', e.file_url, 'thumbnail_url', e.thumbnail_url,
            'description', e.description, 'captured_at', e.captured_at,
            'status', e.status, 'created_at', e.created_at
          ) order by e.created_at)
          from public.challenge_evidence e where e.user_challenge_id = uc.id
        ), '[]'::jsonb)
      ))
      from public.user_challenges uc
      where uc.user_id = v_user and uc.status not in ('expired', 'cancelled')
    ), '[]'::jsonb),

    'achievements', coalesce((
      select jsonb_agg(jsonb_build_object('achievement_id', ua.achievement_id, 'unlocked_at', ua.unlocked_at))
      from public.user_achievements ua where ua.user_id = v_user
    ), '[]'::jsonb),

    'world', (
      select jsonb_build_object(
        'id', w.id,
        'name', w.name,
        'level', w.level,
        'environment_score', w.environment_score,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', i.id, 'world_item_id', i.world_item_id, 'quantity', i.quantity,
            'position_x', i.position_x, 'position_y', i.position_y,
            'metadata', i.metadata, 'unlocked_at', i.unlocked_at
          ))
          from public.user_world_items i where i.world_id = w.id
        ), '[]'::jsonb)
      )
      from public.worlds w where w.user_id = v_user
    )
  );
end;
$$;

-- >>> 12_rls.sql
-- =====================================================================
-- 12 · Segurança: Row Level Security, permissões e Storage
-- =====================================================================
-- Modelo:
--   • Conteúdo (categorias, aulas, quizzes, desafios, níveis, conquistas,
--     itens do mundo) → leitura pública; escrita somente para admin.
--   • Dados do jogador → cada usuário lê apenas os próprios registros.
--   • NENHUMA escrita direta em progresso, XP, conquistas ou mundo:
--     tudo passa pelas funções RPC (security definer), que validam a ordem
--     do jogo (aula → quiz aprovado → desafio → evidência → conclusão).
--   • Respostas corretas (is_correct) e explicações não são legíveis.

-- ---------------------------------------------------------------------
-- 1. Começa do zero: remove os privilégios padrão do Supabase
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Habilita RLS em todas as tabelas
-- ---------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.categories            enable row level security;
alter table public.lessons               enable row level security;
alter table public.lesson_sections       enable row level security;
alter table public.quizzes               enable row level security;
alter table public.quiz_questions        enable row level security;
alter table public.quiz_options          enable row level security;
alter table public.quiz_attempts         enable row level security;
alter table public.quiz_answers          enable row level security;
alter table public.challenges            enable row level security;
alter table public.challenge_steps       enable row level security;
alter table public.user_challenges       enable row level security;
alter table public.user_challenge_steps  enable row level security;
alter table public.challenge_followups   enable row level security;
alter table public.challenge_evidence    enable row level security;
alter table public.user_lesson_progress  enable row level security;
alter table public.levels                enable row level security;
alter table public.xp_transactions       enable row level security;
alter table public.achievements          enable row level security;
alter table public.user_achievements     enable row level security;
alter table public.worlds                enable row level security;
alter table public.world_items           enable row level security;
alter table public.user_world_items      enable row level security;

-- ---------------------------------------------------------------------
-- 3. Conteúdo público (somente leitura) + escrita para admin
-- ---------------------------------------------------------------------
grant select on public.categories, public.lessons, public.lesson_sections,
                public.quizzes, public.challenges, public.challenge_steps,
                public.levels, public.achievements, public.world_items
  to anon, authenticated;

-- Perguntas e alternativas: SEM explicação e SEM is_correct.
grant select (id, quiz_id, question, order_index, points, active, created_at)
  on public.quiz_questions to anon, authenticated;
grant select (id, question_id, option_text, order_index)
  on public.quiz_options to anon, authenticated;

-- Escrita de conteúdo: o grant existe, mas só passa pela política de admin.
grant insert, update, delete on public.categories, public.lessons, public.lesson_sections,
                                public.quizzes, public.quiz_questions, public.quiz_options,
                                public.challenges, public.challenge_steps, public.levels,
                                public.achievements, public.world_items
  to authenticated;

create policy categories_read on public.categories
  for select to anon, authenticated using (active or (select public.is_admin()));
create policy lessons_read on public.lessons
  for select to anon, authenticated using (active or (select public.is_admin()));
create policy lesson_sections_read on public.lesson_sections
  for select to anon, authenticated using (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.active)
    or (select public.is_admin())
  );
create policy quizzes_read on public.quizzes
  for select to anon, authenticated using (active or (select public.is_admin()));
create policy quiz_questions_read on public.quiz_questions
  for select to anon, authenticated using (active or (select public.is_admin()));
create policy quiz_options_read on public.quiz_options
  for select to anon, authenticated using (true);
create policy challenges_read on public.challenges
  for select to anon, authenticated using (active or (select public.is_admin()));
create policy challenge_steps_read on public.challenge_steps
  for select to anon, authenticated using (true);
create policy levels_read on public.levels
  for select to anon, authenticated using (true);
create policy achievements_read on public.achievements
  for select to anon, authenticated using (active or (select public.is_admin()));
create policy world_items_read on public.world_items
  for select to anon, authenticated using (true);

create policy categories_admin on public.categories
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy lessons_admin on public.lessons
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy lesson_sections_admin on public.lesson_sections
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy quizzes_admin on public.quizzes
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy quiz_questions_admin on public.quiz_questions
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy quiz_options_admin on public.quiz_options
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy challenges_admin on public.challenges
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy challenge_steps_admin on public.challenge_steps
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy levels_admin on public.levels
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy achievements_admin on public.achievements
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy world_items_admin on public.world_items
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Admin (futuro painel) lê o gabarito por uma função que confere o papel.
create or replace function public.admin_quiz_answer_key(p_quiz_id uuid)
returns table (question_id uuid, question text, explanation text, option_id uuid,
               option_text text, is_correct boolean, option_explanation text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select q.id, q.question, q.explanation, o.id, o.option_text, o.is_correct, o.explanation
    from public.quiz_questions q
    join public.quiz_options o on o.question_id = q.id
    where q.quiz_id = p_quiz_id
    order by q.order_index, o.order_index;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Perfil: lê o próprio; altera só campos de apresentação
-- ---------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (username, display_name, avatar_url, avatar_emoji) on public.profiles to authenticated;

create policy profiles_read_own on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 5. Dados do jogador: somente leitura dos próprios registros
--    (escritas acontecem exclusivamente pelas funções RPC)
-- ---------------------------------------------------------------------
grant select on public.quiz_attempts, public.quiz_answers, public.user_lesson_progress,
                public.user_challenges, public.user_challenge_steps, public.challenge_followups,
                public.challenge_evidence, public.xp_transactions, public.user_achievements,
                public.worlds, public.user_world_items
  to authenticated;

create policy quiz_attempts_read_own on public.quiz_attempts
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy quiz_answers_read_own on public.quiz_answers
  for select to authenticated using (
    exists (select 1 from public.quiz_attempts a where a.id = attempt_id and a.user_id = (select auth.uid()))
    or (select public.is_admin())
  );
create policy user_lesson_progress_read_own on public.user_lesson_progress
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy user_challenges_read_own on public.user_challenges
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy user_challenge_steps_read_own on public.user_challenge_steps
  for select to authenticated using (
    exists (select 1 from public.user_challenges uc
            where uc.id = user_challenge_id and uc.user_id = (select auth.uid()))
    or (select public.is_admin())
  );
create policy challenge_followups_read_own on public.challenge_followups
  for select to authenticated using (
    exists (select 1 from public.user_challenges uc
            where uc.id = user_challenge_id and uc.user_id = (select auth.uid()))
    or (select public.is_admin())
  );
create policy challenge_evidence_read_own on public.challenge_evidence
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy xp_transactions_read_own on public.xp_transactions
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy user_achievements_read_own on public.user_achievements
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy worlds_read_own on public.worlds
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy user_world_items_read_own on public.user_world_items
  for select to authenticated using (
    exists (select 1 from public.worlds w where w.id = world_id and w.user_id = (select auth.uid()))
    or (select public.is_admin())
  );

-- ---------------------------------------------------------------------
-- 6. Funções que o frontend pode chamar
--    (award_xp, check_achievements etc. continuam SEM permissão)
-- ---------------------------------------------------------------------
grant execute on function public.is_admin()                 to anon, authenticated;
grant execute on function public.require_user()             to authenticated;
grant execute on function public.get_player_state()         to authenticated;
grant execute on function public.track_lesson_progress(uuid, integer) to authenticated;
grant execute on function public.complete_lesson(uuid)      to authenticated;
grant execute on function public.start_quiz_attempt(uuid)   to authenticated;
grant execute on function public.answer_quiz_question(uuid, uuid, uuid) to authenticated;
grant execute on function public.finish_quiz_attempt(uuid)  to authenticated;
grant execute on function public.accept_challenge(uuid)     to authenticated;
grant execute on function public.submit_challenge_evidence(uuid, text, text, text, date) to authenticated;
grant execute on function public.complete_followup(uuid, text, text, text) to authenticated;
grant execute on function public.complete_challenge(uuid)   to authenticated;
grant execute on function public.reveal_world_items()       to authenticated;
grant execute on function public.admin_quiz_answer_key(uuid) to authenticated;
grant execute on function public.admin_recalculate_xp(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Storage (bucket privado eco-evidence)
--    Caminho obrigatório: users/{auth.uid()}/challenges/{challenge_id}/{arquivo}
--    Upload só para desafios aceitos pelo próprio usuário. Sem update/delete.
-- ---------------------------------------------------------------------
create policy eco_evidence_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'eco-evidence'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and (storage.foldername(name))[3] = 'challenges'
    and exists (
      select 1 from public.user_challenges uc
      where uc.user_id = (select auth.uid())
        and uc.challenge_id::text = (storage.foldername(name))[4]
        and uc.status in ('accepted', 'in_progress', 'waiting_follow_up')
    )
  );

create policy eco_evidence_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'eco-evidence'
    and (
      (storage.foldername(name))[2] = (select auth.uid())::text
      or (select public.is_admin())
    )
  );

-- >>> 13_seed.sql
-- =====================================================================
-- 13 · Dados iniciais (seed)
-- =====================================================================
-- IDs fixos tornam o seed idempotente (on conflict do nothing) e fáceis
-- de referenciar em testes. Prefixos: 1=categoria 2=aula 3=quiz
-- 4=desafio 5=nível 6=conquista 7=item do mundo.

-- ---------------------------------------------------------------------
-- Categorias
-- ---------------------------------------------------------------------
insert into public.categories (id, name, slug, description, icon, color, topics, order_index) values
  ('10000000-0000-4000-8000-000000000001', 'Natureza', 'natureza',
   'Árvores, plantas e o solo que sustenta a vida.', '🌳', '#3f7f4c',
   array['Árvores', 'Flores', 'Plantas', 'Solo', 'Florestas', 'Hortas'], 1),
  ('10000000-0000-4000-8000-000000000002', 'Água', 'agua',
   'Cuidar de cada gota, dos rios à torneira de casa.', '💧', '#2f7fae',
   array['Economia de água', 'Reutilização', 'Chuva', 'Rios', 'Preservação'], 2),
  ('10000000-0000-4000-8000-000000000003', 'Resíduos', 'residuos',
   'Reduzir, reutilizar e dar o destino certo ao lixo.', '♻️', '#5f8a3a',
   array['Reciclagem', 'Reutilização', 'Compostagem', 'Redução de resíduos', 'Plásticos'], 3),
  ('10000000-0000-4000-8000-000000000004', 'Energia', 'energia',
   'Usar energia com consciência e conhecer fontes limpas.', '⚡', '#d0921f',
   array['Economia de energia', 'Consumo consciente', 'Energia solar', 'Fontes renováveis'], 4),
  ('10000000-0000-4000-8000-000000000005', 'Biodiversidade', 'biodiversidade',
   'A enorme variedade de vida que compartilha o planeta.', '🐝', '#b7791f',
   array['Abelhas', 'Borboletas', 'Aves', 'Insetos', 'Animais', 'Ecossistemas'], 5),
  ('10000000-0000-4000-8000-000000000006', 'Comunidade', 'comunidade',
   'Transformações que acontecem quando agimos juntos.', '🌎', '#3b6fa0',
   array['Limpeza', 'Hortas comunitárias', 'Projetos ambientais', 'Educação ambiental', 'Ações coletivas'], 6)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Conteúdo: "Por que as árvores são importantes?"
-- ---------------------------------------------------------------------
insert into public.lessons (id, category_id, topic, title, slug, description, content,
                            difficulty, estimated_minutes, xp_reward, order_index) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Árvores',
   'Por que as árvores são importantes?', 'por-que-as-arvores-sao-importantes',
   'Por que as árvores são essenciais e como plantar do jeito certo.',
   'Uma aula curta sobre a importância das árvores, os ecossistemas, a escolha da espécie, o local de plantio e os cuidados básicos.',
   'facil', 4, 50, 1)
on conflict (id) do nothing;

insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, order_index) values
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'content', '🌳',
   'Por que as árvores importam?',
   'Pela fotossíntese, as árvores absorvem gás carbônico (CO₂) e liberam oxigênio. Elas também fazem sombra, refrescam o ambiente e ajudam a água da chuva a penetrar no solo.
- Absorvem CO₂ e liberam oxigênio
- Fazem sombra e reduzem o calor
- Protegem o solo contra a erosão', 1),
  ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'content', '🐦',
   'Uma casa para muitas vidas',
   'Uma árvore é um pequeno ecossistema. Seus frutos, flores e folhas alimentam aves, insetos e outros animais, e seus galhos e troncos servem de abrigo. As folhas que caem viram adubo e alimentam o solo.
- Alimento: frutos, flores e néctar
- Abrigo para ninhos e insetos
- Folhas caídas nutrem o solo', 2),
  ('21000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'content', '🌱',
   'A espécie certa',
   'Prefira espécies nativas da sua região. Elas já são adaptadas ao clima e ao solo locais e alimentam a fauna que vive ali. Espécies invasoras podem prejudicar as plantas nativas.
- Nativas se adaptam melhor
- Peça orientação em viveiros ou órgãos ambientais', 3),
  ('21000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'content', '📍',
   'O lugar certo',
   'Pense no tamanho que a árvore terá quando adulta. Raízes e copa precisam de espaço. Evite plantar embaixo de fios elétricos, sobre encanamentos ou colado a muros. Em calçadas e praças, consulte a prefeitura antes.
- Espaço para raízes e copa
- Longe de fios e canos
- Autorização em áreas públicas', 4),
  ('21000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 'content', '💧',
   'Cuidados básicos',
   'Os primeiros meses são os mais importantes. Regue com frequência quando não chover, use uma estaca (tutor) para manter a muda firme e cubra o solo ao redor com folhas secas para manter a umidade.
- Rega regular no início
- Tutor para dar firmeza
- Cobertura de folhas secas no solo', 5),
  ('21000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000001', 'fun_fact', '💡',
   'Você sabia?',
   'Nas cidades, ruas arborizadas podem ficar vários graus mais frescas do que ruas sem árvores. Por isso as árvores são grandes aliadas contra as chamadas “ilhas de calor”.', 6)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Quiz (5 perguntas, aprovação com 60%)
-- ---------------------------------------------------------------------
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, attempts_allowed) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
   'Quiz: Por que as árvores são importantes?',
   '5 perguntas sobre a aula. Acerte pelo menos 3 para liberar o desafio.', 60, 100, null)
on conflict (id) do nothing;

insert into public.quiz_questions (id, quiz_id, question, explanation, order_index, points) values
  ('31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
   'Qual destes é um benefício das árvores para o ambiente?',
   'Pela fotossíntese, as árvores absorvem CO₂ e liberam oxigênio. A sombra da copa também ajuda a refrescar o ambiente.', 1, 1),
  ('31000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001',
   'Por que as árvores são importantes para os ecossistemas?',
   'Árvores podem fornecer alimento e abrigo para diversas espécies e participam de processos importantes dos ecossistemas, como a formação de matéria orgânica no solo.', 2, 1),
  ('31000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001',
   'Que tipo de espécie é mais indicado para plantar?',
   'Espécies nativas já são adaptadas ao clima e ao solo do lugar e alimentam a fauna local. Espécies invasoras podem competir com as nativas e prejudicá-las.', 3, 1),
  ('31000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000001',
   'Qual é o melhor local para plantar uma árvore?',
   'Uma árvore adulta precisa de espaço. Longe de fios, canos e muros ela cresce saudável sem causar problemas — e em áreas públicas é preciso autorização da prefeitura.', 4, 1),
  ('31000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000001',
   'Qual cuidado é essencial nos primeiros meses após o plantio?',
   'No início a muda ainda está criando raízes. Rega regular (principalmente sem chuva) e um tutor para dar firmeza aumentam muito as chances de ela sobreviver.', 5, 1)
on conflict (id) do nothing;

insert into public.quiz_options (id, question_id, option_text, is_correct, order_index) values
  ('32000000-0000-4000-8000-000000000011', '31000000-0000-4000-8000-000000000001', 'Aumentam a erosão do solo', false, 1),
  ('32000000-0000-4000-8000-000000000012', '31000000-0000-4000-8000-000000000001', 'Absorvem CO₂ e fazem sombra', true, 2),
  ('32000000-0000-4000-8000-000000000013', '31000000-0000-4000-8000-000000000001', 'Deixam a água da chuva escorrer mais rápido', false, 3),
  ('32000000-0000-4000-8000-000000000014', '31000000-0000-4000-8000-000000000001', 'Aumentam a temperatura ao redor', false, 4),

  ('32000000-0000-4000-8000-000000000021', '31000000-0000-4000-8000-000000000002', 'Porque afastam todos os animais', false, 1),
  ('32000000-0000-4000-8000-000000000022', '31000000-0000-4000-8000-000000000002', 'Porque só servem de decoração', false, 2),
  ('32000000-0000-4000-8000-000000000023', '31000000-0000-4000-8000-000000000002', 'Porque fornecem alimento e abrigo para muitas espécies', true, 3),
  ('32000000-0000-4000-8000-000000000024', '31000000-0000-4000-8000-000000000002', 'Porque não interagem com outros seres vivos', false, 4),

  ('32000000-0000-4000-8000-000000000031', '31000000-0000-4000-8000-000000000003', 'Uma espécie nativa da sua região', true, 1),
  ('32000000-0000-4000-8000-000000000032', '31000000-0000-4000-8000-000000000003', 'Qualquer espécie, tanto faz', false, 2),
  ('32000000-0000-4000-8000-000000000033', '31000000-0000-4000-8000-000000000003', 'Uma espécie invasora que cresce rápido', false, 3),
  ('32000000-0000-4000-8000-000000000034', '31000000-0000-4000-8000-000000000003', 'A espécie mais rara que existir', false, 4),

  ('32000000-0000-4000-8000-000000000041', '31000000-0000-4000-8000-000000000004', 'Embaixo de fios elétricos', false, 1),
  ('32000000-0000-4000-8000-000000000042', '31000000-0000-4000-8000-000000000004', 'Colada a um muro ou sobre um cano', false, 2),
  ('32000000-0000-4000-8000-000000000043', '31000000-0000-4000-8000-000000000004', 'Em qualquer calçada, sem consultar ninguém', false, 3),
  ('32000000-0000-4000-8000-000000000044', '31000000-0000-4000-8000-000000000004', 'Um lugar com espaço para as raízes e a copa crescerem', true, 4),

  ('32000000-0000-4000-8000-000000000051', '31000000-0000-4000-8000-000000000005', 'Não regar nunca, para a raiz ficar forte', false, 1),
  ('32000000-0000-4000-8000-000000000052', '31000000-0000-4000-8000-000000000005', 'Regar com frequência e manter a muda firme com um tutor', true, 2),
  ('32000000-0000-4000-8000-000000000053', '31000000-0000-4000-8000-000000000005', 'Retirar todas as folhas da muda', false, 3),
  ('32000000-0000-4000-8000-000000000054', '31000000-0000-4000-8000-000000000005', 'Cobrir a muda com plástico', false, 4)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Desafio: Plante uma árvore (+ etapas)
-- ---------------------------------------------------------------------
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions,
                               safety_notes, difficulty, deadline_days, xp_reward,
                               requires_evidence, requires_follow_up) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001', '🌳', 'Plante uma árvore', 'plante-uma-arvore',
   'Plante uma árvore ou uma muda adequada ao local onde você vive.',
   'Escolha uma espécie nativa da sua região (peça ajuda em um viveiro).
Escolha um local com espaço, sol e, se for área pública, com autorização.
Cave uma cova um pouco maior que o torrão da muda.
Posicione a muda sem enterrar o caule, cubra com terra e firme bem.
Regue bem e prenda a muda a uma estaca (tutor).
Registre a realização com uma fotografia.',
   'Crianças devem plantar com a ajuda de um adulto.
Use luvas e ferramentas adequadas.
Não plante em áreas de preservação ou em terrenos alheios sem permissão.
Regue com frequência nos primeiros meses, principalmente sem chuva.',
   'medio', 15, 500, true, true)
on conflict (id) do nothing;

insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index,
                                    required, xp_reward, day_offset) values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
   'Escolha a espécie e o local', 'Espécie nativa, espaço para crescer e autorização quando necessário.',
   'instruction', 1, true, 0, null),
  ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001',
   'Plante a muda', 'Cave, posicione, cubra com terra, regue e coloque o tutor.',
   'action', 2, true, 0, null),
  ('41000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001',
   'Plantio', 'Registro da muda no dia em que foi plantada.',
   'evidence', 3, true, 0, 0),
  ('41000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000001',
   'Concluir o desafio', 'Confirme a realização para receber a recompensa.',
   'completion', 4, true, 0, null),
  ('41000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000001',
   'Primeiro acompanhamento', 'A muda pegou? Registre como ela está depois de um mês.',
   'follow_up', 5, true, 100, 30),
  ('41000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000001',
   'Segundo acompanhamento', 'Três meses de cuidado! Registre o crescimento.',
   'follow_up', 6, true, 100, 90),
  ('41000000-0000-4000-8000-000000000007', '40000000-0000-4000-8000-000000000001',
   'Terceiro acompanhamento', 'Seis meses! Registre como sua árvore está.',
   'follow_up', 7, true, 100, 180)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Níveis (1 a 5)
-- ---------------------------------------------------------------------
insert into public.levels (id, level_number, name, xp_required, description, reward, icon) values
  ('50000000-0000-4000-8000-000000000001', 1, 'Explorador', 0,
   'Começando a descobrir o mundo natural.', 'Seu mundo ecológico', '🌱'),
  ('50000000-0000-4000-8000-000000000002', 2, 'Aprendiz da Natureza', 100,
   'Já entende como a natureza funciona.', null, '🌿'),
  ('50000000-0000-4000-8000-000000000003', 3, 'Cuidador', 400,
   'Transforma conhecimento em cuidado real.', null, '🌳'),
  ('50000000-0000-4000-8000-000000000004', 4, 'Protetor da Biodiversidade', 800,
   'Protege a vida em todas as suas formas.', null, '🐝'),
  ('50000000-0000-4000-8000-000000000005', 5, 'Guardião do Ecossistema', 1500,
   'Uma referência em ações ambientais.', null, '🏞️')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Conquistas
-- ---------------------------------------------------------------------
insert into public.achievements (id, name, slug, description, icon, xp_reward, requirement_type, requirement_value) values
  ('60000000-0000-4000-8000-000000000001', 'Primeira Semente', 'primeira-semente',
   'Concluir o primeiro conteúdo.', '🌱', 0, 'lessons_completed', '1'),
  ('60000000-0000-4000-8000-000000000002', 'Primeiro Conhecimento', 'primeiro-conhecimento',
   'Ser aprovado no primeiro quiz.', '🧠', 0, 'quizzes_passed', '1'),
  ('60000000-0000-4000-8000-000000000003', 'Primeira Árvore', 'primeira-arvore',
   'Completar o desafio “Plante uma árvore”.', '🌳', 0, 'challenge_completed', 'plante-uma-arvore'),
  ('60000000-0000-4000-8000-000000000004', 'Primeiro Desafio', 'primeiro-desafio',
   'Completar o primeiro desafio.', '🎯', 0, 'challenges_completed', '1'),
  ('60000000-0000-4000-8000-000000000005', 'Primeiro Ciclo Completo', 'primeiro-ciclo-completo',
   'Aprender, agir e ver o seu mundo evoluir pela primeira vez.', '🌎', 0, 'cycles_completed', '1')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Itens do mundo
-- ---------------------------------------------------------------------
insert into public.world_items (id, name, slug, type, description, rarity, unlock_requirement, metadata) values
  ('70000000-0000-4000-8000-000000000001', 'Primeira Árvore', 'primeira-arvore', 'tree',
   'A árvore que nasceu do seu primeiro plantio real.', 'common',
   '{"type": "challenge_completed", "challenge_slug": "plante-uma-arvore"}',
   '{"kind": "tree", "emoji": "🌳", "slot": {"x": 200, "y": 196}}')
on conflict (id) do nothing;

-- >>> 14_learning_schema.sql
-- =====================================================================
-- 14 · Sistema de aprendizagem (Etapa 3)
-- =====================================================================
-- • Níveis de conteúdo: beginner / intermediate / advanced
-- • Seções com blocos interativos (curiosidade, observe, pense, dica, escolha)
-- • Resumo "Você aprendeu", pré-requisitos e busca sem acentos
-- • Retomada da aula (last_section_index) em user_lesson_progress
-- • Favoritos e conteúdos relacionados
-- O progresso continua em user_lesson_progress (nenhuma tabela nova para isso).

-- ---------------------------------------------------------------------
-- 1. Níveis de dificuldade das aulas
-- ---------------------------------------------------------------------
create type public.lesson_level as enum ('beginner', 'intermediate', 'advanced');

alter table public.lessons alter column difficulty drop default;
alter table public.lessons
  alter column difficulty type public.lesson_level
  using (case difficulty::text
           when 'facil' then 'beginner'
           when 'medio' then 'intermediate'
           else 'advanced'
         end)::public.lesson_level;
alter table public.lessons alter column difficulty set default 'beginner';

-- ---------------------------------------------------------------------
-- 2. Novos campos das aulas e seções
-- ---------------------------------------------------------------------
alter table public.lessons
  add column prerequisite_lesson_id uuid references public.lessons (id) on delete set null,
  -- [{"icon": "🌳", "text": "..."}] — tela "Você aprendeu"
  add column summary_points jsonb not null default '[]'::jsonb
    check (jsonb_typeof(summary_points) = 'array'),
  add constraint lessons_prerequisite_not_self check (prerequisite_lesson_id is null or prerequisite_lesson_id <> id);

-- Texto normalizado (minúsculas, sem acentos) para a busca.
alter table public.lessons
  add column search_text text generated always as (
    translate(
      lower(coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(topic, '')),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'
    )
  ) stored;

create index lessons_prerequisite_idx on public.lessons (prerequisite_lesson_id);

alter table public.lesson_sections
  add column image_alt text,
  -- Blocos interativos da seção (ver content/lessons.json para o formato):
  -- fun_fact | observe | think | tip | choice
  add column blocks jsonb not null default '[]'::jsonb
    check (jsonb_typeof(blocks) = 'array');

comment on column public.lesson_sections.blocks is
  'Blocos interativos: [{"type":"fun_fact"|"observe"|"think"|"tip"|"choice", ...}]';

-- Retomada da aula: última parte em que o jogador estava.
alter table public.user_lesson_progress
  add column last_section_index integer not null default 0 check (last_section_index >= 0);

-- ---------------------------------------------------------------------
-- 3. Conteúdos relacionados ("Você também pode aprender")
-- ---------------------------------------------------------------------
create table public.lesson_related (
  lesson_id          uuid not null references public.lessons (id) on delete cascade,
  related_lesson_id  uuid not null references public.lessons (id) on delete cascade,
  order_index        integer not null default 0,
  primary key (lesson_id, related_lesson_id),
  constraint lesson_related_not_self check (lesson_id <> related_lesson_id)
);

-- ---------------------------------------------------------------------
-- 4. Favoritos
-- ---------------------------------------------------------------------
create table public.user_lesson_favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_id   uuid not null references public.lessons (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, lesson_id)
);

-- ---------------------------------------------------------------------
-- 5. Regras de acesso às aulas
-- ---------------------------------------------------------------------
-- Aula liberada = ativa e com o pré-requisito (se houver) concluído.
create or replace function public.lesson_is_unlocked(p_user uuid, p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.lessons l
    where l.id = p_lesson_id
      and l.active
      and (
        l.prerequisite_lesson_id is null
        or exists (
          select 1 from public.user_lesson_progress p
          where p.user_id = p_user and p.lesson_id = l.prerequisite_lesson_id and p.status = 'completed'
        )
      )
  );
$$;

create or replace function public.lesson_section_count(p_lesson_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.lesson_sections
  where lesson_id = p_lesson_id and section_type = 'content';
$$;

-- ---------------------------------------------------------------------
-- 6. RPC: registrar a parte da aula em que o jogador está
--    O percentual é calculado pelo SERVIDOR a partir do índice da seção
--    (máx. 99% — só complete_lesson chega a 100%).
-- ---------------------------------------------------------------------
drop function public.track_lesson_progress(uuid, integer);

create function public.track_lesson_progress(p_lesson_id uuid, p_section_index integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := public.require_user();
  v_total  integer;
  v_index  integer;
  v_pct    integer;
  v_row    public.user_lesson_progress;
begin
  if not exists (select 1 from public.lessons where id = p_lesson_id and active) then
    raise exception 'not_found';
  end if;
  if not public.lesson_is_unlocked(v_user, p_lesson_id) then
    raise exception 'lesson_locked';
  end if;

  v_total := greatest(public.lesson_section_count(p_lesson_id), 1);
  v_index := least(greatest(coalesce(p_section_index, 0), 0), v_total - 1);
  v_pct   := least(99, round((v_index + 1) * 100.0 / v_total));

  insert into public.user_lesson_progress as ulp
    (user_id, lesson_id, status, progress_percentage, last_section_index, last_accessed_at)
  values
    (v_user, p_lesson_id, 'in_progress', v_pct, v_index, now())
  on conflict (user_id, lesson_id) do update
  set last_accessed_at = now(),
      last_section_index = excluded.last_section_index,
      progress_percentage = case
        when ulp.status = 'completed' then ulp.progress_percentage
        else greatest(ulp.progress_percentage, excluded.progress_percentage)
      end,
      status = case
        when ulp.status = 'completed' then ulp.status
        else 'in_progress'::public.lesson_progress_status
      end
  returning * into v_row;

  return jsonb_build_object(
    'status', v_row.status,
    'progress_percentage', v_row.progress_percentage,
    'last_section_index', v_row.last_section_index,
    'completed_at', v_row.completed_at
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 7. RPC: concluir aula — exige ter chegado à última parte
-- ---------------------------------------------------------------------
create or replace function public.complete_lesson(p_lesson_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := public.require_user();
  v_lesson  public.lessons;
  v_total   integer;
  v_xp      integer;
begin
  select * into v_lesson from public.lessons where id = p_lesson_id and active;
  if not found then
    raise exception 'not_found';
  end if;
  if not public.lesson_is_unlocked(v_user, p_lesson_id) then
    raise exception 'lesson_locked';
  end if;

  v_total := public.lesson_section_count(p_lesson_id);
  if not exists (
    select 1 from public.user_lesson_progress
    where user_id = v_user and lesson_id = p_lesson_id
      and (status = 'completed' or last_section_index >= v_total - 1)
  ) then
    raise exception 'lesson_not_finished';
  end if;

  update public.user_lesson_progress
  set status = 'completed',
      progress_percentage = 100,
      completed_at = coalesce(completed_at, now()),
      last_accessed_at = now()
  where user_id = v_user and lesson_id = p_lesson_id;

  v_xp := public.award_xp(v_user, v_lesson.xp_reward, 'knowledge', 'lesson', v_lesson.id,
                          'Conteúdo concluído: ' || v_lesson.title);

  return jsonb_build_object(
    'xp_awarded',   v_xp,
    'achievements', public.check_achievements(v_user)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 8. Estado do jogador: inclui a parte atual de cada aula e os favoritos
-- ---------------------------------------------------------------------
create or replace function public.get_player_state()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
begin
  return jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.user_id = v_user),

    'lessons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'lesson_id', l.lesson_id,
        'status', l.status,
        'progress_percentage', l.progress_percentage,
        'last_section_index', l.last_section_index,
        'last_accessed_at', l.last_accessed_at,
        'completed_at', l.completed_at
      ))
      from public.user_lesson_progress l where l.user_id = v_user
    ), '[]'::jsonb),

    'favorites', coalesce((
      select jsonb_agg(f.lesson_id order by f.created_at desc)
      from public.user_lesson_favorites f where f.user_id = v_user
    ), '[]'::jsonb),

    'quizzes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'quiz_id', b.quiz_id,
        'score', b.score,
        'correct_answers', b.correct_answers,
        'total_questions', b.total_questions,
        'passed', b.passed,
        'completed_at', b.completed_at,
        'attempts', (
          select count(*) from public.quiz_attempts c
          where c.user_id = v_user and c.quiz_id = b.quiz_id and c.completed_at is not null
        )
      ))
      from (
        select distinct on (a.quiz_id) a.*
        from public.quiz_attempts a
        where a.user_id = v_user and a.completed_at is not null
        order by a.quiz_id, a.passed desc, a.score desc, a.completed_at desc
      ) b
    ), '[]'::jsonb),

    'challenges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', uc.id,
        'challenge_id', uc.challenge_id,
        'status', uc.status,
        'accepted_at', uc.accepted_at,
        'deadline_at', uc.deadline_at,
        'started_at', uc.started_at,
        'completed_at', uc.completed_at,
        'progress_percentage', uc.progress_percentage,
        'steps', coalesce((
          select jsonb_agg(jsonb_build_object(
            'challenge_step_id', s.challenge_step_id, 'status', s.status, 'completed_at', s.completed_at
          ))
          from public.user_challenge_steps s where s.user_challenge_id = uc.id
        ), '[]'::jsonb),
        'followups', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', f.id, 'challenge_step_id', f.challenge_step_id, 'title', f.title,
            'description', f.description, 'scheduled_for', f.scheduled_for,
            'completed_at', f.completed_at, 'status', f.status,
            'evidence_required', f.evidence_required
          ) order by f.scheduled_for)
          from public.challenge_followups f where f.user_challenge_id = uc.id
        ), '[]'::jsonb),
        'evidence', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', e.id, 'followup_id', e.followup_id, 'evidence_type', e.evidence_type,
            'file_url', e.file_url, 'thumbnail_url', e.thumbnail_url,
            'description', e.description, 'captured_at', e.captured_at,
            'status', e.status, 'created_at', e.created_at
          ) order by e.created_at)
          from public.challenge_evidence e where e.user_challenge_id = uc.id
        ), '[]'::jsonb)
      ))
      from public.user_challenges uc
      where uc.user_id = v_user and uc.status not in ('expired', 'cancelled')
    ), '[]'::jsonb),

    'achievements', coalesce((
      select jsonb_agg(jsonb_build_object('achievement_id', ua.achievement_id, 'unlocked_at', ua.unlocked_at))
      from public.user_achievements ua where ua.user_id = v_user
    ), '[]'::jsonb),

    'world', (
      select jsonb_build_object(
        'id', w.id,
        'name', w.name,
        'level', w.level,
        'environment_score', w.environment_score,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', i.id, 'world_item_id', i.world_item_id, 'quantity', i.quantity,
            'position_x', i.position_x, 'position_y', i.position_y,
            'metadata', i.metadata, 'unlocked_at', i.unlocked_at
          ))
          from public.user_world_items i where i.world_id = w.id
        ), '[]'::jsonb)
      )
      from public.worlds w where w.user_id = v_user
    )
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Segurança das novas estruturas
-- ---------------------------------------------------------------------
alter table public.lesson_related        enable row level security;
alter table public.user_lesson_favorites enable row level security;

revoke all on public.lesson_related, public.user_lesson_favorites from anon, authenticated;
revoke execute on function public.lesson_is_unlocked(uuid, uuid),
                           public.lesson_section_count(uuid),
                           public.track_lesson_progress(uuid, integer)
  from public, anon, authenticated;

-- Relacionados: conteúdo público; escrita só admin.
grant select on public.lesson_related to anon, authenticated;
grant insert, update, delete on public.lesson_related to authenticated;
create policy lesson_related_read on public.lesson_related
  for select to anon, authenticated using (true);
create policy lesson_related_admin on public.lesson_related
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Favoritos: cada usuário vê, cria e remove apenas os próprios.
grant select, insert, delete on public.user_lesson_favorites to authenticated;
create policy favorites_read_own on public.user_lesson_favorites
  for select to authenticated using (user_id = (select auth.uid()));
create policy favorites_insert_own on public.user_lesson_favorites
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy favorites_delete_own on public.user_lesson_favorites
  for delete to authenticated using (user_id = (select auth.uid()));

grant execute on function public.track_lesson_progress(uuid, integer) to authenticated;
grant execute on function public.complete_lesson(uuid) to authenticated;
grant execute on function public.get_player_state() to authenticated;

-- >>> 15_learning_content.sql
-- =====================================================================
-- 15 · Conteúdos educativos (Etapa 3)
-- =====================================================================
-- ARQUIVO GERADO por "npm run content:sql" a partir de content/lessons.json.
-- Não edite à mão: edite o JSON e gere novamente.

-- Aulas (upsert)
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Árvores', 'Por que as árvores são importantes?', 'por-que-as-arvores-sao-importantes', 'Descubra o papel das árvores nos ecossistemas, na vida dos animais, na água e no solo — e o que pensar antes de plantar.', 'beginner', 5, 20, 1, '[{"icon":"🌳","text":"Árvores fazem parte de ecossistemas."},{"icon":"💧","text":"Vegetação está relacionada ao solo e à água."},{"icon":"🐦","text":"Árvores podem fornecer recursos para diferentes espécies."},{"icon":"🌱","text":"A escolha do local e da espécie é importante no plantio."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Plantas', 'Como uma planta cresce?', 'como-uma-planta-cresce', 'Da semente à planta: o que ela precisa para germinar e crescer.', 'beginner', 3, 20, 2, '[{"icon":"🌰","text":"A semente guarda uma planta em miniatura e reservas de alimento."},{"icon":"☀️","text":"Com luz, água e ar, a planta produz o próprio alimento pela fotossíntese."},{"icon":"🌿","text":"Solo, espaço e rega na medida certa ajudam no crescimento."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Hortas', 'O que é uma horta?', 'o-que-e-uma-horta', 'Onde começar, o que plantar e como manter uma horta cheia de vida.', 'beginner', 3, 20, 3, '[{"icon":"🥬","text":"Uma horta pode existir em quintais, escolas, vasos ou espaços comunitários."},{"icon":"☀️","text":"Sol, água por perto e solo com matéria orgânica são o ponto de partida."},{"icon":"🐞","text":"Uma horta saudável convive com insetos que ajudam as plantas."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'Economia de água', 'Por que precisamos economizar água?', 'por-que-precisamos-economizar-agua', 'Água doce é pouca, dá trabalho para chegar até a torneira — e pequenas atitudes fazem diferença.', 'beginner', 3, 20, 1, '[{"icon":"🌍","text":"A maior parte da água do planeta é salgada; a água doce é uma pequena parte."},{"icon":"🚰","text":"Tratar e distribuir água usa energia e recursos."},{"icon":"💧","text":"Pequenas atitudes do dia a dia evitam desperdício."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', 'Chuva', 'O que acontece com a água da chuva?', 'o-que-acontece-com-a-agua-da-chuva', 'O caminho da chuva no campo e na cidade, e como aproveitá-la com segurança.', 'beginner', 3, 20, 2, '[{"icon":"🌧️","text":"A chuva pode infiltrar no solo, escorrer para os rios ou evaporar."},{"icon":"🏙️","text":"Superfícies impermeáveis aumentam o escoamento e o risco de alagamentos."},{"icon":"🪣","text":"Água da chuva pode ser reaproveitada, sempre em recipientes tampados."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000003', 'Reciclagem', 'O que é reciclagem?', 'o-que-e-reciclagem', 'Como materiais usados viram matéria-prima para novos produtos — e por que separar certo faz diferença.', 'beginner', 3, 20, 1, '[{"icon":"♻️","text":"Reciclar é transformar materiais usados em matéria-prima para novos produtos."},{"icon":"🗑️","text":"Separar recicláveis limpos e secos facilita a coleta seletiva."},{"icon":"🔁","text":"Antes de reciclar, vale reduzir e reutilizar."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000003', 'Reutilização', 'O que significa reutilizar?', 'o-que-significa-reutilizar', 'Dar uma nova vida aos objetos antes de pensar em descartá-los.', 'beginner', 3, 20, 2, '[{"icon":"🔄","text":"Reutilizar é usar de novo um objeto, sem transformá-lo industrialmente."},{"icon":"💡","text":"Consertar, doar e dar nova função são formas de reutilizar."},{"icon":"🌎","text":"Reutilizar economiza recursos e reduz o lixo."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000004', 'Economia de energia', 'Por que economizar energia?', 'por-que-economizar-energia', 'De onde vem a eletricidade, onde mais gastamos em casa e como economizar.', 'beginner', 3, 20, 1, '[{"icon":"⚡","text":"Toda forma de gerar eletricidade causa algum impacto ambiental."},{"icon":"🏠","text":"Alguns aparelhos consomem mais energia do que outros."},{"icon":"👣","text":"Atitudes simples reduzem o consumo."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000004', 'Fontes renováveis', 'O que são fontes renováveis?', 'o-que-sao-fontes-renovaveis', 'Sol, vento, água e biomassa: fontes que se renovam na natureza — e seus limites.', 'intermediate', 4, 20, 2, '[{"icon":"🔋","text":"Fontes renováveis se renovam na natureza; as não renováveis podem se esgotar."},{"icon":"☀️","text":"Solar, eólica, hidrelétrica e biomassa são exemplos de fontes renováveis."},{"icon":"⚖️","text":"Nenhuma fonte é livre de impactos — a energia mais limpa é a que não é desperdiçada."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000005', 'Ecossistemas', 'O que é biodiversidade?', 'o-que-e-biodiversidade', 'A variedade de vida no planeta, como tudo está conectado e o que ameaça essa riqueza.', 'beginner', 3, 20, 1, '[{"icon":"🦋","text":"Biodiversidade é a variedade de vida: espécies, genes e ecossistemas."},{"icon":"🕸️","text":"Os seres vivos dependem uns dos outros."},{"icon":"🛡️","text":"Proteger a vegetação nativa ajuda a conservar a biodiversidade."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000005', 'Abelhas', 'Por que os polinizadores são importantes?', 'por-que-os-polinizadores-sao-importantes', 'Abelhas, borboletas, aves e morcegos: quem são os polinizadores e por que dependemos deles.', 'intermediate', 4, 20, 2, '[{"icon":"🌸","text":"Polinização é o transporte de pólen que permite a formação de frutos e sementes."},{"icon":"🐝","text":"Abelhas, borboletas, aves e morcegos estão entre os polinizadores."},{"icon":"🍎","text":"Muitos alimentos dependem, em algum grau, dos polinizadores."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000006', 'Ações coletivas', 'O que é uma ação ambiental comunitária?', 'o-que-e-uma-acao-ambiental-comunitaria', 'Como pessoas se organizam para cuidar juntas do lugar onde vivem.', 'beginner', 3, 20, 1, '[{"icon":"🤝","text":"Ações comunitárias reúnem pessoas em torno de um objetivo ambiental comum."},{"icon":"🗺️","text":"Tudo começa identificando um problema e conversando com as pessoas."},{"icon":"🎉","text":"Cuidar do resultado e celebrar mantém a comunidade engajada."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000001', 'Alimentação e animais', 'A vaca e os derivados do leite', 'a-vaca-e-os-derivados-do-leite', 'Descubra de onde vem o leite, quais alimentos podem ser feitos com ele e como respeitar os animais.', 'beginner', 5, 20, 13, '[{"icon":"🐄","text":"Vacas são animais que precisam de cuidado, espaço, água e alimento."},{"icon":"🥛","text":"O leite pode ser transformado em diferentes alimentos."},{"icon":"🧀","text":"Queijo, iogurte e manteiga são exemplos de derivados do leite."},{"icon":"🌱","text":"Escolhas conscientes valorizam o bem-estar animal e evitam desperdício."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;

-- Pré-requisitos (depois que todas as aulas existem)
update public.lessons set prerequisite_lesson_id = null where id = '20000000-0000-4000-8000-000000000001';
update public.lessons set prerequisite_lesson_id = null where id = '20000000-0000-4000-8000-000000000002';
update public.lessons set prerequisite_lesson_id = '20000000-0000-4000-8000-000000000002' where id = '20000000-0000-4000-8000-000000000003';
update public.lessons set prerequisite_lesson_id = null where id = '20000000-0000-4000-8000-000000000004';
update public.lessons set prerequisite_lesson_id = '20000000-0000-4000-8000-000000000004' where id = '20000000-0000-4000-8000-000000000005';
update public.lessons set prerequisite_lesson_id = null where id = '20000000-0000-4000-8000-000000000006';
update public.lessons set prerequisite_lesson_id = '20000000-0000-4000-8000-000000000006' where id = '20000000-0000-4000-8000-000000000007';
update public.lessons set prerequisite_lesson_id = null where id = '20000000-0000-4000-8000-000000000008';
update public.lessons set prerequisite_lesson_id = '20000000-0000-4000-8000-000000000008' where id = '20000000-0000-4000-8000-000000000009';
update public.lessons set prerequisite_lesson_id = null where id = '20000000-0000-4000-8000-000000000010';
update public.lessons set prerequisite_lesson_id = '20000000-0000-4000-8000-000000000010' where id = '20000000-0000-4000-8000-000000000011';
update public.lessons set prerequisite_lesson_id = null where id = '20000000-0000-4000-8000-000000000012';
update public.lessons set prerequisite_lesson_id = null where id = '20000000-0000-4000-8000-000000000013';

-- Seções (recriadas)
delete from public.lesson_sections where lesson_id in ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000013');
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000001001', '20000000-0000-4000-8000-000000000001', 'content', '🌳', 'Muito mais do que paisagem', 'Uma árvore é muito mais do que um elemento da paisagem.
Árvores são plantas com tronco lenhoso que podem viver por muitos anos. Pela fotossíntese, elas usam a luz do sol para absorver gás carbônico (CO₂) do ar e liberar oxigênio.
Também fazem sombra e deixam o ambiente ao redor mais fresco.
- Absorvem CO₂ e liberam oxigênio
- Fazem sombra e refrescam o ambiente
- Podem viver por muitos anos', '/lessons/arvores-1.svg', 'Ilustração de uma árvore grande ao lado de uma casa, com o sol ao fundo e sombra sobre o gramado.', '[{"type":"think","prompt":"Quantas árvores você consegue encontrar no caminho até sua casa?"}]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000001002', '20000000-0000-4000-8000-000000000001', 'content', '🌎', 'Ecossistemas', 'Um ecossistema é o conjunto de seres vivos de um lugar e das relações entre eles e o ambiente: luz, água, ar e solo.
A árvore participa dessas relações o tempo todo. Ela retira água e nutrientes do solo, recebe luz do sol e devolve folhas, galhos e frutos que caem no chão.
Fungos, bactérias e pequenos animais decompõem esse material, que volta a nutrir o solo.
- A árvore recebe luz, água e nutrientes
- Folhas caídas são decompostas
- Os nutrientes voltam para o solo', '/lessons/arvores-2.svg', 'Ciclo com setas: o sol ilumina a árvore, folhas caem no solo, são decompostas e os nutrientes voltam às raízes.', '[{"type":"fun_fact","title":"Você sabia?","text":"Nas cidades, ruas arborizadas costumam ser mais frescas do que ruas sem árvores. Por isso as árvores são aliadas contra as chamadas “ilhas de calor”."}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000001003', '20000000-0000-4000-8000-000000000001', 'content', '🐦', 'Vida', 'Uma única árvore pode ser casa e alimento para muitos seres vivos.
Suas flores oferecem néctar e pólen para abelhas e borboletas. Os frutos alimentam aves e outros animais — que depois espalham as sementes. Galhos e ocos do tronco viram abrigo e lugar de ninho.
- Flores: néctar e pólen
- Frutos: alimento e dispersão de sementes
- Galhos e troncos: abrigo e ninhos', null, null, '[{"type":"observe","prompt":"Observe a ilustração. Quantos seres vivos estão usando esta árvore?","image_url":"/lessons/arvores-3.svg","image_alt":"Árvore com um ninho de pássaro em um galho, uma abelha visitando uma flor e uma lagarta comendo uma folha.","answer":"Três: um pássaro no ninho, uma abelha na flor e uma lagarta na folha. A mesma árvore oferece abrigo, néctar e alimento."}]'::jsonb, 3),
  ('21000000-0000-4000-8000-000000001004', '20000000-0000-4000-8000-000000000001', 'content', '💧', 'Água e solo', 'As raízes seguram a terra e ajudam a diminuir a erosão, que acontece quando a chuva e o vento levam o solo embora.
A copa amortece a força das gotas de chuva, e as folhas caídas cobrem o chão. Assim, mais água consegue penetrar no solo em vez de escorrer pela superfície.
- Raízes seguram o solo
- A copa amortece a chuva
- Mais água infiltra no solo', '/lessons/arvores-4.svg', 'Corte do solo mostrando raízes de uma árvore e gotas de chuva infiltrando na terra.', '[{"type":"fun_fact","title":"Você sabia?","text":"Pelas folhas, as plantas liberam vapor d’água para o ar. Esse processo se chama transpiração e faz parte do ciclo da água."}]'::jsonb, 4),
  ('21000000-0000-4000-8000-000000001005', '20000000-0000-4000-8000-000000000001', 'content', '🌱', 'Antes de plantar', 'Não basta colocar uma árvore em qualquer lugar. Antes de plantar, vale pensar em alguns pontos:
- Espécie: prefira espécies nativas da sua região
- Espaço: imagine o tamanho da árvore adulta
- Solo: a terra precisa receber as raízes
- Água: a muda precisa de rega nos primeiros meses
- Clima: a espécie deve combinar com o clima local
- Futuro: raízes e copa não podem atrapalhar fios, canos e muros', null, null, '[{"type":"choice","prompt":"🌳 Escolha o local: onde você plantaria uma árvore que vai ficar grande?","options":[{"id":"fiacao","icon":"⚡","label":"Embaixo da fiação elétrica da rua","is_best":false,"feedback":"Quando crescer, a copa vai alcançar os fios e precisará de podas frequentes. Para árvores grandes, procure um lugar sem fiação."},{"id":"quintal","icon":"☀️","label":"Em um espaço aberto e ensolarado, longe de muros e canos","is_best":true,"feedback":"Boa escolha! Com espaço para a copa e as raízes, a árvore cresce saudável sem causar problemas."},{"id":"muro","icon":"🧱","label":"Colada ao muro da casa","is_best":false,"feedback":"Sem espaço, as raízes podem danificar o muro e a copa cresce torta. Deixe uma boa distância de construções."}]},{"type":"tip","text":"Antes de plantar, pergunte em um viveiro ou na secretaria de meio ambiente da sua cidade quais espécies nativas combinam com a sua região."}]'::jsonb, 5);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000002001', '20000000-0000-4000-8000-000000000002', 'content', '🌰', 'Tudo começa na semente', 'Dentro da semente existe um embrião — uma plantinha em miniatura — e uma reserva de alimento.
Quando encontra água e temperatura adequada, a semente germina: primeiro surge a raiz, depois o caule e as primeiras folhas.
- A raiz aparece primeiro
- Depois surgem caule e folhas', null, null, '[]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000002002', '20000000-0000-4000-8000-000000000002', 'content', '☀️', 'Luz, água e ar', 'As folhas usam a luz do sol, a água que vem das raízes e o gás carbônico do ar para produzir açúcares. Isso é a fotossíntese.
Esses açúcares são o alimento que faz a planta crescer. Nesse processo, a planta libera oxigênio.', null, null, '[{"type":"fun_fact","title":"Você sabia?","text":"Muitas plantas crescem em direção à luz. Esse movimento se chama fototropismo — repare nas plantas perto de janelas."}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000002003', '20000000-0000-4000-8000-000000000002', 'content', '🌿', 'Cuidando do crescimento', 'Além de luz, a planta precisa de solo com nutrientes e espaço para as raízes.
A água deve vir na medida certa: terra encharcada o tempo todo também faz mal, porque as raízes precisam de ar.', null, null, '[{"type":"think","prompt":"Que plantas você vê crescendo perto de você? De onde elas recebem luz?"},{"type":"tip","text":"Quer ver a germinação de perto? Coloque um grão de feijão em algodão úmido e observe por alguns dias."}]'::jsonb, 3);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000003001', '20000000-0000-4000-8000-000000000003', 'content', '🥬', 'Um pedaço de terra que alimenta', 'Horta é um espaço para cultivar hortaliças, temperos e ervas.
Ela pode estar no quintal, na escola, em vasos na varanda ou em um terreno da comunidade.
- Quintais e varandas
- Escolas
- Hortas comunitárias', null, null, '[]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000003002', '20000000-0000-4000-8000-000000000003', 'content', '📍', 'Onde e como começar', 'A maioria das hortaliças precisa de algumas horas de sol direto por dia.
Ter água por perto facilita a rega, e um solo fofo com matéria orgânica ajuda as raízes.
Para começar, escolha plantas fáceis, como cebolinha, alface e manjericão.', null, null, '[{"type":"choice","prompt":"Onde você começaria uma horta?","options":[{"id":"sombra","icon":"🌑","label":"Em um canto que fica na sombra o dia todo","is_best":false,"feedback":"Sem sol, a maioria das hortaliças cresce fraca. Procure um lugar iluminado."},{"id":"sol","icon":"🚰","label":"Em um lugar com sol pela manhã e uma torneira perto","is_best":true,"feedback":"Ótimo! Sol e água por perto são os melhores aliados de uma horta."},{"id":"entulho","icon":"🧱","label":"Sobre terra compactada e restos de obra","is_best":false,"feedback":"Solo duro e com entulho dificulta as raízes. Seria preciso preparar a terra antes."}]}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000003003', '20000000-0000-4000-8000-000000000003', 'content', '🐞', 'Uma horta cheia de vida', 'Flores perto da horta atraem polinizadores, e alguns insetos ajudam a controlar pragas.
Restos de frutas e verduras podem virar adubo por meio da compostagem.', null, null, '[{"type":"fun_fact","title":"Você sabia?","text":"Joaninhas se alimentam de pulgões, pequenos insetos que atacam as plantas. Por isso são consideradas aliadas das hortas."},{"type":"tip","text":"Comece pequeno: um vaso de temperos já é uma horta e ensina muito sobre cuidar das plantas."}]'::jsonb, 3);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000004001', '20000000-0000-4000-8000-000000000004', 'content', '🌍', 'Pouca água doce', 'Parece que água é o que não falta: ela cobre a maior parte da superfície da Terra.
Mas quase toda essa água é salgada. A água doce é uma pequena parte, e muito dela está congelada em geleiras ou escondida no subsolo.', null, null, '[{"type":"fun_fact","title":"Você sabia?","text":"Segundo o Serviço Geológico dos Estados Unidos (USGS), cerca de 97% da água da Terra é salgada."}]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000004002', '20000000-0000-4000-8000-000000000004', 'content', '🚰', 'Da natureza até a torneira', 'Antes de chegar à sua casa, a água é captada de rios ou represas, tratada e bombeada por canos.
Depois de usada, vira esgoto, que também precisa de tratamento.
Todo esse caminho usa energia e recursos. Economizar água também é economizar energia.', null, null, '[]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000004003', '20000000-0000-4000-8000-000000000004', 'content', '💧', 'Pequenas atitudes', '- Fechar a torneira enquanto escova os dentes
- Tomar banhos mais curtos
- Consertar vazamentos
- Usar vassoura em vez de mangueira para limpar a calçada
- Reaproveitar a água da máquina de lavar para limpar o quintal', null, null, '[{"type":"think","prompt":"Em quais momentos do seu dia você usa água? Em qual deles daria para economizar?"},{"type":"tip","text":"Uma torneira pingando o dia inteiro desperdiça muita água. Se encontrar um vazamento, avise um adulto."}]'::jsonb, 3);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000005001', '20000000-0000-4000-8000-000000000005', 'content', '🌧️', 'O caminho da chuva', 'Quando a chuva cai, a água pode seguir caminhos diferentes:
- Infiltrar no solo e abastecer a água subterrânea
- Escorrer pela superfície até rios e lagos
- Evaporar e voltar para a atmosfera
Esses caminhos fazem parte do ciclo da água.', null, null, '[]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000005002', '20000000-0000-4000-8000-000000000005', 'content', '🏙️', 'Chuva na cidade', 'Asfalto, concreto e telhados não deixam a água infiltrar. Por isso, nas cidades, mais água escorre pelas ruas, o que aumenta o risco de alagamentos.
Lixo jogado na rua entope bueiros e piora o problema.', null, null, '[{"type":"choice","prompt":"Em qual destes lugares a água da chuva infiltra melhor?","options":[{"id":"asfalto","icon":"🛣️","label":"Rua asfaltada","is_best":false,"feedback":"O asfalto é impermeável: a água escorre em vez de infiltrar."},{"id":"jardim","icon":"🌿","label":"Jardim com solo e plantas","is_best":true,"feedback":"Isso! Solo coberto por plantas deixa a água penetrar e ainda segura a terra."},{"id":"concreto","icon":"🏢","label":"Pátio de concreto","is_best":false,"feedback":"O concreto também impede a infiltração. Áreas verdes ajudam muito a cidade."}]}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000005003', '20000000-0000-4000-8000-000000000005', 'content', '🪣', 'Aproveitar a chuva', 'A água da chuva pode ser guardada em cisternas e usada para regar plantas e limpar áreas externas.
Ela não deve ser bebida sem tratamento adequado.', null, null, '[{"type":"tip","text":"Todo recipiente com água parada precisa ficar tampado: aberto, ele pode virar criadouro do mosquito Aedes aegypti."}]'::jsonb, 3);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000006001', '20000000-0000-4000-8000-000000000006', 'content', '♻️', 'Um novo começo para os materiais', 'Reciclar é transformar materiais já usados em matéria-prima para fabricar novos produtos.
Papel, plástico, metal e vidro estão entre os materiais mais recicláveis.', null, null, '[]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000006002', '20000000-0000-4000-8000-000000000006', 'content', '🗑️', 'Separar certo', 'A reciclagem começa em casa: separe os recicláveis dos restos de comida.
Na coleta seletiva, o Brasil usa um padrão de cores (Resolução CONAMA nº 275/2001):
- Azul: papel
- Vermelho: plástico
- Verde: vidro
- Amarelo: metal
- Marrom: resíduos orgânicos', null, null, '[{"type":"choice","prompt":"Em qual lixeira vai uma lata de alumínio?","options":[{"id":"azul","icon":"🔵","label":"Azul","is_best":false,"feedback":"A azul é para papel. Metais vão em outra cor."},{"id":"amarela","icon":"🟡","label":"Amarela","is_best":true,"feedback":"Isso mesmo! Amarelo é a cor dos metais, como latas de alumínio."},{"id":"verde","icon":"🟢","label":"Verde","is_best":false,"feedback":"A verde é para vidro. A lata vai na amarela."}]}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000006003', '20000000-0000-4000-8000-000000000006', 'content', '🔁', 'Reciclar é o último passo', 'Antes de reciclar, pense em reduzir o que você consome e em reutilizar o que já tem. Reciclar é importante, mas gerar menos resíduo é ainda melhor.', null, null, '[{"type":"fun_fact","title":"Você sabia?","text":"O alumínio pode ser reciclado muitas vezes sem perder suas propriedades."},{"type":"tip","text":"Lave e seque as embalagens antes de separá-las: isso facilita o trabalho das cooperativas de reciclagem."}]'::jsonb, 3);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000007001', '20000000-0000-4000-8000-000000000007', 'content', '🔄', 'Usar de novo', 'Reutilizar é usar novamente um objeto, com a mesma função ou com uma nova, sem que ele precise passar por uma fábrica.
É diferente de reciclar, em que o material é transformado em matéria-prima.', null, null, '[]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000007002', '20000000-0000-4000-8000-000000000007', 'content', '💡', 'Ideias para reutilizar', '- Potes de vidro para guardar alimentos
- Embalagens como vasos para mudas
- Doar roupas, livros e brinquedos
- Consertar em vez de jogar fora', null, null, '[{"type":"think","prompt":"Que objeto da sua casa poderia ganhar uma nova função?"}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000007003', '20000000-0000-4000-8000-000000000007', 'content', '🌎', 'Por que isso importa', 'Cada objeto reutilizado é um objeto novo que não precisou ser fabricado e um a menos no lixo. Isso economiza matéria-prima, água e energia.', null, null, '[{"type":"choice","prompt":"Qual destas atitudes é um exemplo de reutilizar?","options":[{"id":"descartar","icon":"🗑️","label":"Colocar o pote vazio na lixeira de recicláveis","is_best":false,"feedback":"Isso é encaminhar para a reciclagem — importante, mas não é reutilizar."},{"id":"guardar","icon":"🫙","label":"Usar o pote de vidro para guardar grãos","is_best":true,"feedback":"Exatamente! O pote ganhou uma nova função sem precisar ser fabricado de novo."},{"id":"comprar","icon":"🛒","label":"Comprar um pote novo","is_best":false,"feedback":"Comprar um novo gera mais consumo. Reutilizar é aproveitar o que já existe."}]}]'::jsonb, 3);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000008001', '20000000-0000-4000-8000-000000000008', 'content', '⚡', 'De onde vem a energia', 'A eletricidade é gerada em usinas — hidrelétricas, eólicas, solares, termelétricas — e viaja por linhas de transmissão até as casas.
Toda forma de geração tem algum impacto: represas alagam áreas, termelétricas queimam combustíveis.', null, null, '[]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000008002', '20000000-0000-4000-8000-000000000008', 'content', '🏠', 'Consumo em casa', 'Chuveiro elétrico, ar-condicionado e geladeira estão entre os aparelhos que mais consomem energia em uma casa.
Aparelhos em modo de espera (standby) também continuam gastando um pouco.', null, null, '[{"type":"fun_fact","title":"Você sabia?","text":"Lâmpadas de LED gastam bem menos energia do que as incandescentes para iluminar o mesmo ambiente."}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000008003', '20000000-0000-4000-8000-000000000008', 'content', '👣', 'Atitudes que fazem diferença', '- Apagar a luz ao sair do cômodo
- Tirar da tomada carregadores que não estão em uso
- Não deixar a porta da geladeira aberta
- Tomar banhos mais curtos', null, null, '[{"type":"tip","text":"Aproveite a luz do dia: abrir cortinas e janelas pode dispensar lâmpadas acesas."}]'::jsonb, 3);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000009001', '20000000-0000-4000-8000-000000000009', 'content', '🔋', 'Renováveis e não renováveis', 'Fontes renováveis se renovam naturalmente: a luz do sol, o vento, o movimento da água e a biomassa (como o bagaço da cana).
Fontes não renováveis, como petróleo, carvão e gás natural, existem em quantidade limitada e liberam gases de efeito estufa quando queimadas.', null, null, '[]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000009002', '20000000-0000-4000-8000-000000000009', 'content', '☀️', 'Conhecendo as fontes', '- Solar: painéis transformam a luz do sol em eletricidade
- Eólica: turbinas giram com o vento
- Hidrelétrica: a força da água dos rios move turbinas
- Biomassa: restos vegetais são usados para gerar energia', null, null, '[{"type":"fun_fact","title":"Você sabia?","text":"No Brasil, a maior parte da eletricidade vem de fontes renováveis, principalmente das usinas hidrelétricas."}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000009003', '20000000-0000-4000-8000-000000000009', 'content', '⚖️', 'Nenhuma fonte é perfeita', 'Hidrelétricas alagam grandes áreas, parques eólicos mudam a paisagem e podem afetar aves, e painéis solares precisam de materiais para serem fabricados.
Por isso, além de escolher fontes renováveis, é importante não desperdiçar energia.', null, null, '[{"type":"choice","prompt":"Qual destas fontes é renovável?","options":[{"id":"carvao","icon":"⛏️","label":"Carvão mineral","is_best":false,"feedback":"O carvão levou milhões de anos para se formar e pode se esgotar: é não renovável."},{"id":"vento","icon":"🌬️","label":"Vento","is_best":true,"feedback":"Isso! O vento se renova naturalmente e move as turbinas eólicas."},{"id":"petroleo","icon":"🛢️","label":"Petróleo","is_best":false,"feedback":"O petróleo é um combustível fóssil, portanto não renovável."}]}]'::jsonb, 3);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000010001', '20000000-0000-4000-8000-000000000010', 'content', '🦋', 'A variedade da vida', 'Biodiversidade é a variedade de vida na Terra. Ela inclui:
- A diversidade de espécies
- A diversidade genética dentro de cada espécie
- A diversidade de ecossistemas, como florestas, rios e cerrados', null, null, '[]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000010002', '20000000-0000-4000-8000-000000000010', 'content', '🕸️', 'Tudo conectado', 'Os seres vivos dependem uns dos outros: plantas alimentam animais, animais espalham sementes, fungos decompõem restos e devolvem nutrientes ao solo.
Quando uma espécie desaparece, outras podem ser afetadas.', null, null, '[{"type":"fun_fact","title":"Você sabia?","text":"O Brasil é considerado um dos países com maior biodiversidade do mundo, com biomas como a Amazônia, o Cerrado e a Mata Atlântica."}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000010003', '20000000-0000-4000-8000-000000000010', 'content', '🛡️', 'Ameaças e cuidados', 'A destruição de habitats, a poluição e as espécies invasoras estão entre as principais ameaças à biodiversidade.
Proteger a vegetação nativa e nunca retirar animais silvestres da natureza são formas de cuidar.', null, null, '[{"type":"think","prompt":"Quantos tipos diferentes de seres vivos você consegue ver hoje, contando plantas, insetos e aves?"}]'::jsonb, 3);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000011001', '20000000-0000-4000-8000-000000000011', 'content', '🌸', 'O que é polinização', 'Para formar frutos e sementes, muitas plantas precisam que o pólen de uma flor chegue a outra.
Esse transporte se chama polinização. Às vezes é feito pelo vento, mas muitas plantas dependem de animais.', null, null, '[]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000011002', '20000000-0000-4000-8000-000000000011', 'content', '🐝', 'Quem poliniza', '- Abelhas, incluindo as abelhas nativas sem ferrão
- Borboletas e mariposas
- Besouros
- Beija-flores
- Morcegos', null, null, '[{"type":"think","prompt":"Da próxima vez que vir uma flor, observe: algum animal a visita?"}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000011003', '20000000-0000-4000-8000-000000000011', 'content', '🍎', 'Alimento e natureza', 'Sem polinizadores, muitas plantas produziriam menos frutos e sementes — o que afeta tanto a natureza quanto a nossa alimentação.
O uso excessivo de agrotóxicos e a perda de áreas naturais estão entre as ameaças a esses animais.', null, null, '[{"type":"fun_fact","title":"Você sabia?","text":"Segundo a IPBES, plataforma científica internacional sobre biodiversidade, cerca de 75% dos tipos de cultivos alimentares do mundo dependem, em algum grau, da polinização por animais."},{"type":"tip","text":"Plantar flores variadas e evitar agrotóxicos no jardim ajuda os polinizadores."}]'::jsonb, 3);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000000012', 'content', '🤝', 'Juntos pelo lugar onde vivemos', 'Uma ação ambiental comunitária acontece quando um grupo de pessoas se organiza para cuidar do ambiente onde vive.
- Mutirões de limpeza
- Hortas comunitárias
- Plantio de árvores em praças', null, null, '[]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000012002', '20000000-0000-4000-8000-000000000012', 'content', '🗺️', 'Como começar', 'Identifique um problema, converse com vizinhos, escola ou associação do bairro e planejem juntos: materiais, segurança e, quando necessário, autorização da prefeitura.', null, null, '[{"type":"choice","prompt":"Qual costuma ser o primeiro passo de uma ação comunitária?","options":[{"id":"comprar","icon":"🛒","label":"Comprar materiais","is_best":false,"feedback":"Materiais vêm depois do planejamento. Primeiro é preciso saber o que fazer e com quem."},{"id":"conversar","icon":"💬","label":"Identificar o problema e conversar com as pessoas","is_best":true,"feedback":"Isso! Uma ação comunitária nasce do diálogo sobre um problema comum."},{"id":"sozinho","icon":"🙈","label":"Fazer tudo sozinho, sem avisar ninguém","is_best":false,"feedback":"Sozinho não é comunitário, e sem combinar com as pessoas a ação pode não se manter."}]}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000012003', '20000000-0000-4000-8000-000000000012', 'content', '🎉', 'Depois da ação', 'O cuidado continua depois do mutirão: regar as mudas, manter o lugar limpo, compartilhar os resultados e celebrar juntos.', null, null, '[{"type":"tip","text":"Em ações de limpeza, use luvas e nunca recolha objetos cortantes ou perigosos com as mãos. Crianças sempre acompanhadas de adultos."}]'::jsonb, 3);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000013001', '20000000-0000-4000-8000-000000000013', 'content', '🐄', 'Conhecendo a vaca', 'A vaca é um mamífero: quando filhote, alimenta-se do leite da mãe. Em fazendas, as vacas precisam de água limpa, alimento, abrigo, espaço e cuidados de pessoas responsáveis.
- É um mamífero
- Precisa de água, alimento e descanso
- Deve ser tratada com respeito e cuidado', null, null, '[{"type":"think","prompt":"O que um animal precisa para viver bem?"}]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000013002', '20000000-0000-4000-8000-000000000013', 'content', '🥛', 'Do leite aos alimentos', 'O leite pode ser usado para fazer alimentos como queijo, iogurte, manteiga e coalhada. Esses alimentos são chamados de derivados do leite. Cada um passa por uma preparação diferente.
- Leite pode virar queijo
- Leite pode virar iogurte
- Leite pode virar manteiga', null, null, '[{"type":"choice","prompt":"Qual destes é um derivado do leite?","options":[{"id":"arroz","icon":"🍚","label":"Arroz","is_best":false,"feedback":"Arroz é um grão, não um derivado do leite."},{"id":"queijo","icon":"🧀","label":"Queijo","is_best":true,"feedback":"Isso! O queijo pode ser produzido a partir do leite."},{"id":"maca","icon":"🍎","label":"Maçã","is_best":false,"feedback":"A maçã é uma fruta, não um derivado do leite."}]}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000013003', '20000000-0000-4000-8000-000000000013', 'content', '💚', 'Cuidar e não desperdiçar', 'Conhecer a origem dos alimentos ajuda a agradecer o trabalho das pessoas e a respeitar os animais. Podemos servir apenas o que vamos comer, guardar corretamente o que sobrar e conversar com um adulto sobre escolhas alimentares.', null, null, '[{"type":"tip","text":"Nunca entre em uma fazenda, toque ou alimente um animal sem a autorização e a presença de um adulto responsável."}]'::jsonb, 3);

-- Conteúdos relacionados (recriados)
delete from public.lesson_related where lesson_id in ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000013');
insert into public.lesson_related (lesson_id, related_lesson_id, order_index) values
  ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 1),
  ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', 2),
  ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000005', 3),
  ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 4),
  ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', 1),
  ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 2),
  ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000010', 3),
  ('20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 1),
  ('20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000011', 2),
  ('20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000007', 3),
  ('20000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000005', 1),
  ('20000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000008', 2),
  ('20000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000007', 3),
  ('20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000004', 1),
  ('20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 2),
  ('20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000012', 3),
  ('20000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000007', 1),
  ('20000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000012', 2),
  ('20000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000008', 3),
  ('20000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000006', 1),
  ('20000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000003', 2),
  ('20000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000012', 3),
  ('20000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000009', 1),
  ('20000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000004', 2),
  ('20000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000006', 3),
  ('20000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000008', 1),
  ('20000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000010', 2),
  ('20000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000005', 3),
  ('20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000011', 1),
  ('20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000001', 2),
  ('20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000002', 3),
  ('20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000010', 1),
  ('20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000003', 2),
  ('20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000001', 3),
  ('20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000006', 1),
  ('20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000003', 2),
  ('20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000001', 3),
  ('20000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000012', 1),
  ('20000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000003', 2);

-- >>> 16_quiz_improvements.sql
-- =====================================================================
-- 16 · Sistema de quiz e validação de conhecimento (Etapa 4)
-- =====================================================================
-- Reutiliza quizzes / quiz_questions / quiz_options / quiz_attempts / quiz_answers.
-- • Tentativas com status (started / completed / abandoned), número e pontos
-- • Retomada de tentativa abandonada
-- • Feedback por alternativa (quiz_options.explanation), revelado só após responder
-- • Resultado 100% calculado no servidor, com revisão das respostas
-- • XP: recompensa principal só na 1ª aprovação + bônus de melhoria configurável
-- • Tópico por pergunta (tela "O que você aprendeu") e tipo de pergunta (futuro: múltipla escolha)

-- ---------------------------------------------------------------------
-- 1. Campos novos (somente os indispensáveis)
-- ---------------------------------------------------------------------
alter table public.quiz_attempts
  add column status text not null default 'started'
    check (status in ('started', 'completed', 'abandoned')),
  add column attempt_number integer not null default 1 check (attempt_number > 0),
  add column points_earned integer not null default 0 check (points_earned >= 0),
  add column points_total integer not null default 0 check (points_total >= 0);

-- Tentativas antigas (Etapa 2): concluídas ou abandonadas.
update public.quiz_attempts set status = case when completed_at is not null then 'completed' else 'abandoned' end;
with numbered as (
  select id, row_number() over (partition by user_id, quiz_id order by started_at) as n
  from public.quiz_attempts
)
update public.quiz_attempts a set attempt_number = numbered.n from numbered where numbered.id = a.id;

-- Uma única tentativa em andamento por jogador e quiz.
create unique index quiz_attempts_one_started_idx
  on public.quiz_attempts (user_id, quiz_id) where status = 'started';

alter table public.quizzes
  -- XP extra quando uma nova aprovação supera a melhor nota anterior (0 = desligado).
  -- Como a nota máxima é 100%, o bônus é limitado e não pode ser repetido indefinidamente.
  add column improvement_xp_reward integer not null default 0 check (improvement_xp_reward >= 0);

alter table public.quiz_questions
  -- Conceito avaliado (ex.: "💧 Água e solo") — usado na revisão do resultado.
  add column topic text,
  -- Preparado para outros formatos; nesta etapa, apenas resposta única.
  add column question_type text not null default 'single_choice' check (question_type in ('single_choice'));

-- Colunas públicas novas (não revelam gabarito).
grant select (topic, question_type) on public.quiz_questions to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Utilitários internos
-- ---------------------------------------------------------------------
create or replace function public.get_owned_attempt(p_attempt_id uuid, p_user uuid)
returns public.quiz_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.quiz_attempts;
begin
  select * into v_attempt from public.quiz_attempts
  where id = p_attempt_id and user_id = p_user
  for update;
  if not found then
    raise exception 'not_found';
  end if;
  return v_attempt;
end;
$$;

-- Correção de uma pergunta respondida (usada após a resposta e no resultado).
create or replace function public.quiz_answer_review(p_attempt_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'question_id', q.id,
    'is_correct', a.is_correct,
    'selected_option_id', a.selected_option_id,
    'correct_option_id', (select o.id from public.quiz_options o where o.question_id = q.id and o.is_correct),
    'explanation', q.explanation,
    'option_explanation', (select o.explanation from public.quiz_options o where o.id = a.selected_option_id)
  ) order by q.order_index), '[]'::jsonb)
  from public.quiz_answers a
  join public.quiz_questions q on q.id = a.question_id
  where a.attempt_id = p_attempt_id;
$$;

-- ---------------------------------------------------------------------
-- 3. RPC: iniciar tentativa
--    Exige a aula concluída. Uma tentativa em andamento anterior é marcada
--    como abandonada (o histórico nunca é apagado).
-- ---------------------------------------------------------------------
drop function public.start_quiz_attempt(uuid);

create function public.start_quiz_attempt(p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := public.require_user();
  v_quiz     public.quizzes;
  v_used     integer;
  v_number   integer;
  v_total    integer;
  v_points   integer;
  v_attempt  uuid;
begin
  select * into v_quiz from public.quizzes where id = p_quiz_id and active;
  if not found then
    raise exception 'not_found';
  end if;

  if not exists (
    select 1 from public.user_lesson_progress
    where user_id = v_user and lesson_id = v_quiz.lesson_id and status = 'completed'
  ) then
    raise exception 'lesson_not_completed';
  end if;

  if v_quiz.attempts_allowed is not null then
    select count(*) into v_used from public.quiz_attempts
    where user_id = v_user and quiz_id = p_quiz_id and status = 'completed';
    if v_used >= v_quiz.attempts_allowed then
      raise exception 'attempts_exhausted';
    end if;
  end if;

  update public.quiz_attempts set status = 'abandoned'
  where user_id = v_user and quiz_id = p_quiz_id and status = 'started';

  select count(*) + 1 into v_number from public.quiz_attempts
  where user_id = v_user and quiz_id = p_quiz_id;

  select count(*), coalesce(sum(points), 0) into v_total, v_points
  from public.quiz_questions where quiz_id = p_quiz_id and active;

  insert into public.quiz_attempts (user_id, quiz_id, status, attempt_number, total_questions, points_total)
  values (v_user, p_quiz_id, 'started', v_number, v_total, v_points)
  returning id into v_attempt;

  return jsonb_build_object('attempt_id', v_attempt, 'attempt_number', v_number);
end;
$$;

-- ---------------------------------------------------------------------
-- 4. RPC: tentativa em andamento (para retomar depois de sair do quiz)
-- ---------------------------------------------------------------------
create or replace function public.get_active_quiz_attempt(p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := public.require_user();
  v_attempt  public.quiz_attempts;
begin
  select * into v_attempt from public.quiz_attempts
  where user_id = v_user and quiz_id = p_quiz_id and status = 'started';
  if not found then
    return null;
  end if;
  -- Só as perguntas JÁ respondidas trazem a correção.
  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'attempt_number', v_attempt.attempt_number,
    'answers', public.quiz_answer_review(v_attempt.id)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 5. RPC: responder — grava e devolve a correção desta pergunta
--    (resposta definitiva: não pode ser alterada)
-- ---------------------------------------------------------------------
create or replace function public.answer_quiz_question(
  p_attempt_id  uuid,
  p_question_id uuid,
  p_option_id   uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user      uuid := public.require_user();
  v_attempt   public.quiz_attempts := public.get_owned_attempt(p_attempt_id, v_user);
  v_question  public.quiz_questions;
  v_option    public.quiz_options;
  v_correct   uuid;
begin
  if v_attempt.status <> 'started' then
    raise exception 'attempt_closed';
  end if;

  select * into v_question from public.quiz_questions
  where id = p_question_id and quiz_id = v_attempt.quiz_id and active;
  if not found then
    raise exception 'not_found';
  end if;

  select * into v_option from public.quiz_options
  where id = p_option_id and question_id = p_question_id;
  if not found then
    raise exception 'not_found';
  end if;

  select id into v_correct from public.quiz_options where question_id = p_question_id and is_correct;

  insert into public.quiz_answers (attempt_id, question_id, selected_option_id, is_correct)
  values (p_attempt_id, p_question_id, p_option_id, v_option.is_correct)
  on conflict (attempt_id, question_id) do nothing;
  if not found then
    raise exception 'already_answered';
  end if;

  return jsonb_build_object(
    'is_correct',         v_option.is_correct,
    'correct_option_id',  v_correct,
    'explanation',        v_question.explanation,
    'option_explanation', v_option.explanation
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 6. RPC: finalizar — nota, aprovação, XP, conquistas e desafio liberado
--    Tudo calculado aqui; o cliente só pede para finalizar.
-- ---------------------------------------------------------------------
create or replace function public.finish_quiz_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user        uuid := public.require_user();
  v_attempt     public.quiz_attempts := public.get_owned_attempt(p_attempt_id, v_user);
  v_quiz        public.quizzes;
  v_total       integer;
  v_points      integer;
  v_answered    integer;
  v_correct     integer;
  v_earned      integer;
  v_score       integer;
  v_passed      boolean;
  v_prev_best   integer;
  v_first_pass  boolean;
  v_xp          integer := 0;
  v_challenge   jsonb;
begin
  if v_attempt.status <> 'started' then
    raise exception 'attempt_closed';
  end if;

  select * into v_quiz from public.quizzes where id = v_attempt.quiz_id;

  select count(*), coalesce(sum(points), 0) into v_total, v_points
  from public.quiz_questions where quiz_id = v_quiz.id and active;

  select count(*),
         count(*) filter (where a.is_correct),
         coalesce(sum(q.points) filter (where a.is_correct), 0)
    into v_answered, v_correct, v_earned
  from public.quiz_answers a
  join public.quiz_questions q on q.id = a.question_id
  where a.attempt_id = p_attempt_id and q.active;

  if v_answered < v_total then
    raise exception 'quiz_incomplete';
  end if;

  v_score  := case when v_points = 0 then 0 else round(v_earned * 100.0 / v_points) end;
  v_passed := v_score >= v_quiz.passing_score;  -- nota mínima configurada no banco

  select max(score) into v_prev_best from public.quiz_attempts
  where user_id = v_user and quiz_id = v_quiz.id and status = 'completed';
  v_first_pass := v_passed and not exists (
    select 1 from public.quiz_attempts
    where user_id = v_user and quiz_id = v_quiz.id and status = 'completed' and passed
  );

  update public.quiz_attempts
  set status = 'completed',
      score = v_score,
      total_questions = v_total,
      correct_answers = v_correct,
      points_earned = v_earned,
      points_total = v_points,
      passed = v_passed,
      completed_at = now()
  where id = p_attempt_id;

  if v_passed then
    -- Recompensa principal: uma única vez por quiz (índice único em xp_transactions).
    v_xp := public.award_xp(v_user, v_quiz.xp_reward, 'knowledge', 'quiz', v_quiz.id,
                            'Quiz aprovado: ' || v_quiz.title);
    -- Bônus opcional por superar a própria melhor nota (limitado: a nota máxima é 100%).
    if not v_first_pass and v_quiz.improvement_xp_reward > 0 and v_score > coalesce(v_prev_best, 0) then
      v_xp := v_xp + public.award_xp(v_user, v_quiz.improvement_xp_reward, 'knowledge', 'quiz_improvement',
                                     p_attempt_id, 'Nova melhor nota: ' || v_quiz.title);
    end if;

    select jsonb_build_object('id', c.id, 'slug', c.slug, 'title', c.title, 'icon', c.icon)
      into v_challenge
    from public.challenges c
    where c.lesson_id = v_quiz.lesson_id and c.active
    order by c.created_at
    limit 1;
  end if;

  return jsonb_build_object(
    'attempt_id',         p_attempt_id,
    'attempt_number',     v_attempt.attempt_number,
    'score',              v_score,
    'correct_answers',    v_correct,
    'incorrect_answers',  v_total - v_correct,
    'total_questions',    v_total,
    'points_earned',      v_earned,
    'points_total',       v_points,
    'passed',             v_passed,
    'passing_score',      v_quiz.passing_score,
    'first_pass',         v_first_pass,
    'previous_best',      v_prev_best,
    'xp_awarded',         v_xp,
    'review',             public.quiz_answer_review(p_attempt_id),
    'challenge_unlocked', v_challenge,
    'achievements',       public.check_achievements(v_user)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Desafio disponível = aula concluída + quiz aprovado
--    Regra já garantida no servidor por accept_challenge (06_challenges.sql):
--    lesson_not_completed / quiz_not_passed. Nada muda aqui.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 8. Conquista preparada para testar a progressão de quizzes
-- ---------------------------------------------------------------------
insert into public.achievements (id, name, slug, description, icon, xp_reward, requirement_type, requirement_value)
values ('60000000-0000-4000-8000-000000000006', '5 Quizzes Aprovados', 'cinco-quizzes-aprovados',
        'Ser aprovado em 5 quizzes diferentes.', '🧠', 0, 'quizzes_passed', '5')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 9. Permissões
-- ---------------------------------------------------------------------
revoke execute on function public.get_owned_attempt(uuid, uuid),
                           public.quiz_answer_review(uuid),
                           public.start_quiz_attempt(uuid),
                           public.get_active_quiz_attempt(uuid)
  from public, anon, authenticated;

grant execute on function public.start_quiz_attempt(uuid)          to authenticated;
grant execute on function public.get_active_quiz_attempt(uuid)     to authenticated;
grant execute on function public.answer_quiz_question(uuid, uuid, uuid) to authenticated;
grant execute on function public.finish_quiz_attempt(uuid)         to authenticated;

-- >>> 17_quiz_content.sql
-- =====================================================================
-- 17 · Quizzes (Etapa 4)
-- =====================================================================
-- ARQUIVO GERADO por "npm run content:sql" a partir de content/quizzes.json.
-- Não edite à mão. Idempotente: atualiza perguntas/alternativas existentes
-- (mantendo os IDs e o histórico de respostas) e desativa perguntas removidas.

-- Quiz: Por que as árvores são importantes?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Quiz: Por que as árvores são importantes?', '5 perguntas sobre biodiversidade, ecossistemas, água, solo e planejamento do plantio.', 70, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000001' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000001' and id not in ('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000004', '31000000-0000-4000-8000-000000000005');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Por que uma árvore pode ser importante para a biodiversidade?', 'Uma única árvore pode ser casa e alimento para muitos seres vivos: abelhas visitam as flores, aves comem os frutos e fazem ninhos, lagartas se alimentam das folhas.', '🐦 Biodiversidade e habitat', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'O que acontece com as folhas que caem de uma árvore em um ambiente natural?', 'Fungos, bactérias e pequenos animais decompõem folhas e galhos caídos. Os nutrientes voltam para o solo e ajudam novas plantas a crescer.', '🌎 Ecossistemas e solo', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', 'Como as árvores ajudam na relação entre a chuva e o solo?', 'As raízes seguram a terra e diminuem a erosão. A copa amortece as gotas e as folhas caídas cobrem o chão, então mais água consegue penetrar no solo.', '💧 Água e solo', 'single_choice', 3, 1, true),
  ('31000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000001', 'Por que é recomendado escolher uma espécie nativa da sua região?', 'Cada espécie tem necessidades próprias. As nativas da região já são adaptadas ao clima e ao solo do lugar e alimentam a fauna que vive ali.', '🌱 Escolha da espécie', 'single_choice', 4, 1, true),
  ('31000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000001', 'Qual aspecto deve ser considerado antes de plantar uma árvore?', 'Antes de plantar, pense na árvore adulta: ela vai precisar de espaço para raízes e copa, longe de fios, canos e muros, em solo e clima adequados.', '📍 Planejamento do plantio', 'single_choice', 5, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000004', '31000000-0000-4000-8000-000000000005') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-000000000011', '31000000-0000-4000-8000-000000000001', 'Porque afasta os insetos e deixa o ambiente mais limpo', false, 'Na verdade, árvores atraem e abrigam insetos, como abelhas e lagartas, que fazem parte do ecossistema.', 1),
  ('32000000-0000-4000-8000-000000000012', '31000000-0000-4000-8000-000000000001', 'Porque oferece abrigo e recursos, como flores, frutos e lugar para ninhos, a diferentes espécies', true, 'Isso mesmo: flores, frutos, galhos e ocos do tronco sustentam muitos seres vivos diferentes.', 2),
  ('32000000-0000-4000-8000-000000000013', '31000000-0000-4000-8000-000000000001', 'Porque é usada apenas por aves, que dependem só dela', false, 'Aves usam árvores, mas insetos, mamíferos, fungos e muitos outros seres também dependem delas.', 3),
  ('32000000-0000-4000-8000-000000000014', '31000000-0000-4000-8000-000000000001', 'Porque cresce sozinha, sem depender de nenhum outro ser vivo', false, 'A árvore também depende de outros seres: animais espalham suas sementes e decompositores reciclam nutrientes.', 4),
  ('32000000-0000-4000-8000-000000000021', '31000000-0000-4000-8000-000000000002', 'Viram lixo que precisa ser retirado do ambiente', false, 'Em ambientes naturais, folhas caídas não são lixo: elas fazem parte do ciclo de nutrientes.', 1),
  ('32000000-0000-4000-8000-000000000022', '31000000-0000-4000-8000-000000000002', 'Deixam o solo mais pobre em nutrientes', false, 'É o contrário: a decomposição das folhas devolve nutrientes ao solo.', 2),
  ('32000000-0000-4000-8000-000000000023', '31000000-0000-4000-8000-000000000002', 'São decompostas e seus nutrientes voltam para o solo', true, 'Exato: decompositores transformam as folhas em matéria orgânica que nutre o solo.', 3),
  ('32000000-0000-4000-8000-000000000024', '31000000-0000-4000-8000-000000000002', 'Ficam no chão para sempre, sem se transformar', false, 'Com o tempo, fungos, bactérias e pequenos animais transformam as folhas em matéria orgânica.', 4),
  ('32000000-0000-4000-8000-000000000031', '31000000-0000-4000-8000-000000000003', 'As raízes seguram o solo e mais água consegue infiltrar na terra', true, 'Isso: raízes, copa e folhas caídas diminuem a erosão e ajudam a água a penetrar no solo.', 1),
  ('32000000-0000-4000-8000-000000000032', '31000000-0000-4000-8000-000000000003', 'A copa impede que a água da chuva chegue ao chão', false, 'A copa amortece a força das gotas, mas a água continua chegando ao solo.', 2),
  ('32000000-0000-4000-8000-000000000033', '31000000-0000-4000-8000-000000000003', 'As raízes soltam a terra para a chuva levá-la embora', false, 'É o contrário: as raízes seguram a terra e ajudam a diminuir a erosão.', 3),
  ('32000000-0000-4000-8000-000000000034', '31000000-0000-4000-8000-000000000003', 'Elas fazem a água escorrer mais rápido pela superfície', false, 'Com vegetação, a água escorre menos pela superfície e infiltra mais no solo.', 4),
  ('32000000-0000-4000-8000-000000000041', '31000000-0000-4000-8000-000000000004', 'Porque é sempre a árvore que cresce mais rápido', false, 'Crescer rápido não é o critério principal — e muitas espécies nativas crescem devagar.', 1),
  ('32000000-0000-4000-8000-000000000042', '31000000-0000-4000-8000-000000000004', 'Porque não precisa de nenhum cuidado depois do plantio', false, 'Mesmo espécies nativas precisam de rega e proteção nos primeiros meses.', 2),
  ('32000000-0000-4000-8000-000000000043', '31000000-0000-4000-8000-000000000004', 'Porque qualquer espécie nativa do Brasil serve para qualquer lugar', false, 'O importante é ser nativa da sua região: o Brasil tem biomas muito diferentes, cada um com suas espécies.', 3),
  ('32000000-0000-4000-8000-000000000044', '31000000-0000-4000-8000-000000000004', 'Porque já é adaptada ao clima e ao solo do lugar e alimenta a fauna local', true, 'Exatamente: adaptada ao ambiente, a espécie nativa tem mais chance de crescer bem e ajuda os animais da região.', 4),
  ('32000000-0000-4000-8000-000000000051', '31000000-0000-4000-8000-000000000005', 'Somente a aparência da muda', false, 'Além da aparência, é importante considerar a espécie, o espaço disponível, o solo e as condições do local.', 1),
  ('32000000-0000-4000-8000-000000000052', '31000000-0000-4000-8000-000000000005', 'O tamanho que a árvore terá quando adulta e o espaço para raízes e copa', true, 'Isso: planejar pensando na árvore adulta evita problemas com fios, canos e construções.', 2),
  ('32000000-0000-4000-8000-000000000053', '31000000-0000-4000-8000-000000000005', 'Plantar o mais perto possível do muro, para a árvore ficar protegida', false, 'Colada ao muro, as raízes podem danificar a construção e a copa cresce sem espaço.', 3),
  ('32000000-0000-4000-8000-000000000054', '31000000-0000-4000-8000-000000000005', 'Escolher um lugar embaixo da fiação, onde há mais sombra', false, 'Embaixo da fiação, a copa vai alcançar os fios e precisará de podas frequentes.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: Como uma planta cresce?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Quiz: Como uma planta cresce?', '3 perguntas sobre germinação, fotossíntese e cuidados.', 60, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000002' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000002' and id not in ('31000000-0000-4000-8000-002000000001', '31000000-0000-4000-8000-002000000002', '31000000-0000-4000-8000-002000000003');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-002000000001', '30000000-0000-4000-8000-000000000002', 'Quando uma semente germina, o que costuma aparecer primeiro?', 'Na germinação, a raiz surge primeiro: ela fixa a plantinha e começa a absorver água. Depois aparecem o caule e as primeiras folhas.', '🌰 Germinação', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-002000000002', '30000000-0000-4000-8000-000000000002', 'O que a planta usa na fotossíntese para produzir o próprio alimento?', 'Na fotossíntese, as folhas usam luz do sol, água vinda das raízes e gás carbônico do ar para produzir açúcares — e liberam oxigênio.', '☀️ Fotossíntese', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-002000000003', '30000000-0000-4000-8000-000000000002', 'Por que regar demais também pode fazer mal a uma planta?', 'As raízes precisam de ar. Em um solo encharcado o tempo todo, elas ficam sem oxigênio e podem apodrecer.', '🌿 Cuidados', 'single_choice', 3, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-002000000001', '31000000-0000-4000-8000-002000000002', '31000000-0000-4000-8000-002000000003') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-002000001001', '31000000-0000-4000-8000-002000000001', 'As folhas', false, 'As folhas aparecem depois. Primeiro a planta precisa se fixar e buscar água.', 1),
  ('32000000-0000-4000-8000-002000001002', '31000000-0000-4000-8000-002000000001', 'A raiz', true, 'Isso: a raiz é a primeira a sair da semente.', 2),
  ('32000000-0000-4000-8000-002000001003', '31000000-0000-4000-8000-002000000001', 'As flores', false, 'Flores surgem muito depois, quando a planta já está desenvolvida.', 3),
  ('32000000-0000-4000-8000-002000001004', '31000000-0000-4000-8000-002000000001', 'Os frutos', false, 'Frutos vêm depois das flores, na planta adulta.', 4),
  ('32000000-0000-4000-8000-002000002001', '31000000-0000-4000-8000-002000000002', 'Apenas a água da chuva', false, 'A água é importante, mas sozinha não basta: a planta também precisa de luz e gás carbônico.', 1),
  ('32000000-0000-4000-8000-002000002002', '31000000-0000-4000-8000-002000000002', 'Apenas os nutrientes da terra', false, 'Nutrientes ajudam, mas o alimento (açúcares) é produzido com luz, água e gás carbônico.', 2),
  ('32000000-0000-4000-8000-002000002003', '31000000-0000-4000-8000-002000000002', 'Luz, água e gás carbônico do ar', true, 'Exato: esses três ingredientes formam os açúcares que fazem a planta crescer.', 3),
  ('32000000-0000-4000-8000-002000002004', '31000000-0000-4000-8000-002000000002', 'Oxigênio e escuridão', false, 'A fotossíntese precisa de luz, e o oxigênio é liberado por ela, não usado.', 4),
  ('32000000-0000-4000-8000-002000003001', '31000000-0000-4000-8000-002000000003', 'Porque as raízes também precisam de ar, e o solo encharcado atrapalha', true, 'Isso: água na medida certa mantém as raízes saudáveis.', 1),
  ('32000000-0000-4000-8000-002000003002', '31000000-0000-4000-8000-002000000003', 'Porque plantas só precisam de água uma vez na vida', false, 'Plantas precisam de água regularmente — só não em excesso.', 2),
  ('32000000-0000-4000-8000-002000003003', '31000000-0000-4000-8000-002000000003', 'Porque a água em excesso faz a planta crescer rápido demais', false, 'O problema do excesso é a falta de ar para as raízes, não o crescimento rápido.', 3),
  ('32000000-0000-4000-8000-002000003004', '31000000-0000-4000-8000-002000000003', 'Porque a água impede a luz de chegar às folhas', false, 'A água do solo não bloqueia a luz. O problema é o encharcamento das raízes.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: O que é uma horta?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 'Quiz: O que é uma horta?', '3 perguntas sobre onde e como começar uma horta.', 60, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000003' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000003' and id not in ('31000000-0000-4000-8000-003000000001', '31000000-0000-4000-8000-003000000002', '31000000-0000-4000-8000-003000000003');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-003000000001', '30000000-0000-4000-8000-000000000003', 'Do que a maioria das hortaliças precisa para crescer bem?', 'A maioria das hortaliças precisa de algumas horas de sol direto por dia, além de água e solo com matéria orgânica.', '☀️ Luz', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-003000000002', '30000000-0000-4000-8000-000000000003', 'Qual destes lugares é uma boa opção para começar uma horta?', 'Um lugar com sol e água por perto facilita os cuidados diários e ajuda as plantas a crescer.', '📍 Onde começar', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-003000000003', '30000000-0000-4000-8000-000000000003', 'Como restos de frutas e verduras podem ajudar uma horta?', 'Pela compostagem, restos orgânicos se transformam em adubo, que devolve nutrientes ao solo.', '🐞 Horta viva', 'single_choice', 3, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-003000000001', '31000000-0000-4000-8000-003000000002', '31000000-0000-4000-8000-003000000003') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-003000001001', '31000000-0000-4000-8000-003000000001', 'Ficar na sombra o dia inteiro', false, 'Sem sol, a maioria das hortaliças cresce fraca.', 1),
  ('32000000-0000-4000-8000-003000001002', '31000000-0000-4000-8000-003000000001', 'Algumas horas de sol direto por dia', true, 'Isso: a luz do sol é essencial para a fotossíntese.', 2),
  ('32000000-0000-4000-8000-003000001003', '31000000-0000-4000-8000-003000000001', 'Solo bem compactado e duro', false, 'Solo duro dificulta as raízes. O ideal é terra fofa e com matéria orgânica.', 3),
  ('32000000-0000-4000-8000-003000001004', '31000000-0000-4000-8000-003000000001', 'Água apenas uma vez por mês', false, 'Hortaliças precisam de rega frequente, principalmente em dias secos.', 4),
  ('32000000-0000-4000-8000-003000002001', '31000000-0000-4000-8000-003000000002', 'Um canto que fica sem sol o dia todo', false, 'Falta de luz é um dos principais problemas das hortas.', 1),
  ('32000000-0000-4000-8000-003000002002', '31000000-0000-4000-8000-003000000002', 'Um terreno cheio de entulho, sem preparar a terra', false, 'Seria preciso preparar o solo antes: entulho atrapalha as raízes.', 2),
  ('32000000-0000-4000-8000-003000002003', '31000000-0000-4000-8000-003000000002', 'Um lugar com sol pela manhã e uma torneira perto', true, 'Ótimo: sol e água por perto são os melhores aliados de uma horta.', 3),
  ('32000000-0000-4000-8000-003000002004', '31000000-0000-4000-8000-003000000002', 'Qualquer lugar, desde que fique escondido', false, 'Ficar escondido não ajuda: o que importa é luz, água e bom solo.', 4),
  ('32000000-0000-4000-8000-003000003001', '31000000-0000-4000-8000-003000000003', 'Virando adubo por meio da compostagem', true, 'Isso: a compostagem transforma restos em adubo rico em nutrientes.', 1),
  ('32000000-0000-4000-8000-003000003002', '31000000-0000-4000-8000-003000000003', 'Sendo jogados inteiros sobre as folhas das plantas', false, 'Restos sobre as folhas podem atrair pragas. O caminho é a compostagem.', 2),
  ('32000000-0000-4000-8000-003000003003', '31000000-0000-4000-8000-003000000003', 'Sendo queimados perto da horta', false, 'Queimar polui o ar e desperdiça os nutrientes que poderiam virar adubo.', 3),
  ('32000000-0000-4000-8000-003000003004', '31000000-0000-4000-8000-003000000003', 'Eles não ajudam em nada', false, 'Ajudam, sim: bem compostados, viram adubo para a horta.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: Por que precisamos economizar água?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', 'Quiz: Por que precisamos economizar água?', '3 perguntas sobre água doce, energia e atitudes do dia a dia.', 60, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000004' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000004' and id not in ('31000000-0000-4000-8000-004000000001', '31000000-0000-4000-8000-004000000002', '31000000-0000-4000-8000-004000000003');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-004000000001', '30000000-0000-4000-8000-000000000004', 'Por que é importante economizar água doce?', 'A maior parte da água do planeta é salgada. A água doce é uma pequena parte, e muito dela está congelada ou no subsolo.', '🌍 Água doce', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-004000000002', '30000000-0000-4000-8000-000000000004', 'Por que economizar água também ajuda a economizar energia?', 'Captar, tratar e bombear a água até as casas — e depois tratar o esgoto — usa energia e recursos.', '🚰 Água e energia', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-004000000003', '30000000-0000-4000-8000-000000000004', 'Qual destas atitudes ajuda a economizar água?', 'Fechar a torneira ao escovar os dentes, tomar banhos curtos e consertar vazamentos são atitudes simples que evitam desperdício.', '💧 Atitudes', 'single_choice', 3, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-004000000001', '31000000-0000-4000-8000-004000000002', '31000000-0000-4000-8000-004000000003') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-004000001001', '31000000-0000-4000-8000-004000000001', 'Porque a água salgada acabou', false, 'A água salgada é a maior parte da água do planeta — o que é pouco é a água doce.', 1),
  ('32000000-0000-4000-8000-004000001002', '31000000-0000-4000-8000-004000000001', 'Porque a água doce é uma pequena parte da água do planeta', true, 'Isso: e só uma parte dela está facilmente disponível em rios e lagos.', 2),
  ('32000000-0000-4000-8000-004000001003', '31000000-0000-4000-8000-004000000001', 'Porque a água doce só existe em garrafas', false, 'A água doce está em rios, lagos, geleiras e no subsolo.', 3),
  ('32000000-0000-4000-8000-004000001004', '31000000-0000-4000-8000-004000000001', 'Porque a água doce não faz parte do ciclo da água', false, 'Ela faz parte do ciclo da água — mas a quantidade disponível é pequena.', 4),
  ('32000000-0000-4000-8000-004000002001', '31000000-0000-4000-8000-004000000002', 'Porque as torneiras funcionam com pilhas', false, 'Torneiras não usam pilhas. A energia é gasta no tratamento e no bombeamento da água.', 1),
  ('32000000-0000-4000-8000-004000002002', '31000000-0000-4000-8000-004000000002', 'Porque não existe nenhuma relação entre água e energia', false, 'Existe, sim: levar água tratada até sua casa consome energia.', 2),
  ('32000000-0000-4000-8000-004000002003', '31000000-0000-4000-8000-004000000002', 'Porque captar, tratar e bombear a água usa energia', true, 'Exato: menos água desperdiçada significa menos energia gasta.', 3),
  ('32000000-0000-4000-8000-004000002004', '31000000-0000-4000-8000-004000000002', 'Porque a água da torneira gera eletricidade em casa', false, 'A água da torneira não gera eletricidade. É o contrário: fazê-la chegar usa energia.', 4),
  ('32000000-0000-4000-8000-004000003001', '31000000-0000-4000-8000-004000000003', 'Lavar a calçada com a mangueira', false, 'A mangueira gasta muita água. Uma vassoura resolve na maioria das vezes.', 1),
  ('32000000-0000-4000-8000-004000003002', '31000000-0000-4000-8000-004000000003', 'Deixar pequenos vazamentos para consertar depois', false, 'Um pingo contínuo desperdiça muita água ao longo do dia.', 2),
  ('32000000-0000-4000-8000-004000003003', '31000000-0000-4000-8000-004000000003', 'Tomar banhos longos', false, 'Banhos mais curtos economizam água e energia.', 3),
  ('32000000-0000-4000-8000-004000003004', '31000000-0000-4000-8000-004000000003', 'Fechar a torneira enquanto escova os dentes', true, 'Isso: uma atitude simples que evita desperdício todos os dias.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: O que acontece com a água da chuva?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000005', 'Quiz: O que acontece com a água da chuva?', '3 perguntas sobre o caminho da chuva e seu aproveitamento.', 60, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000005' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000005' and id not in ('31000000-0000-4000-8000-005000000001', '31000000-0000-4000-8000-005000000002', '31000000-0000-4000-8000-005000000003');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-005000000001', '30000000-0000-4000-8000-000000000005', 'Que caminhos a água da chuva pode seguir ao cair?', 'A chuva pode infiltrar no solo, escorrer pela superfície até rios e lagos ou evaporar — caminhos que fazem parte do ciclo da água.', '🌧️ Ciclo da água', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-005000000002', '30000000-0000-4000-8000-000000000005', 'Por que as cidades costumam ter mais risco de alagamentos?', 'Asfalto, concreto e telhados não deixam a água infiltrar. Mais água escorre pelas ruas — e lixo nos bueiros piora o problema.', '🏙️ Chuva na cidade', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-005000000003', '30000000-0000-4000-8000-000000000005', 'Qual cuidado é essencial ao guardar água da chuva?', 'Recipientes com água parada precisam ficar tampados, senão podem virar criadouro do mosquito Aedes aegypti. E a água da chuva não deve ser bebida sem tratamento.', '🪣 Aproveitamento', 'single_choice', 3, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-005000000001', '31000000-0000-4000-8000-005000000002', '31000000-0000-4000-8000-005000000003') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-005000001001', '31000000-0000-4000-8000-005000000001', 'Ela sempre evapora imediatamente', false, 'Parte evapora, mas outra parte infiltra no solo ou escorre até rios.', 1),
  ('32000000-0000-4000-8000-005000001002', '31000000-0000-4000-8000-005000000001', 'Infiltrar no solo, escorrer até rios ou evaporar', true, 'Isso: esses caminhos fazem parte do ciclo da água.', 2),
  ('32000000-0000-4000-8000-005000001003', '31000000-0000-4000-8000-005000000001', 'Ela desaparece depois de tocar o chão', false, 'A água não desaparece: ela muda de lugar ou de estado.', 3),
  ('32000000-0000-4000-8000-005000001004', '31000000-0000-4000-8000-005000000001', 'Ela sempre vai direto para o mar', false, 'Parte chega aos rios e ao mar, mas outra infiltra ou evapora.', 4),
  ('32000000-0000-4000-8000-005000002001', '31000000-0000-4000-8000-005000000002', 'Porque chove sempre mais nas cidades', false, 'O principal problema é a água não conseguir infiltrar no solo.', 1),
  ('32000000-0000-4000-8000-005000002002', '31000000-0000-4000-8000-005000000002', 'Porque as árvores das cidades causam enchentes', false, 'Árvores e áreas verdes ajudam a absorver água, diminuindo alagamentos.', 2),
  ('32000000-0000-4000-8000-005000002003', '31000000-0000-4000-8000-005000000002', 'Porque os bueiros absorvem toda a água', false, 'Bueiros escoam parte da água, e entupidos por lixo pioram o problema.', 3),
  ('32000000-0000-4000-8000-005000002004', '31000000-0000-4000-8000-005000000002', 'Porque asfalto e concreto impedem a água de infiltrar no solo', true, 'Exato: superfícies impermeáveis aumentam o escoamento.', 4),
  ('32000000-0000-4000-8000-005000003001', '31000000-0000-4000-8000-005000000003', 'Manter o recipiente bem tampado', true, 'Isso: tampar evita a criação do mosquito Aedes aegypti.', 1),
  ('32000000-0000-4000-8000-005000003002', '31000000-0000-4000-8000-005000000003', 'Deixar o recipiente aberto para juntar mais água', false, 'Água parada aberta pode virar criadouro de mosquitos.', 2),
  ('32000000-0000-4000-8000-005000003003', '31000000-0000-4000-8000-005000000003', 'Usar para beber sem nenhum tratamento', false, 'A água da chuva guardada serve para regar e limpar, não para beber sem tratamento.', 3),
  ('32000000-0000-4000-8000-005000003004', '31000000-0000-4000-8000-005000000003', 'Não há nenhum cuidado necessário', false, 'Há, sim: o principal é manter o recipiente tampado.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: O que é reciclagem?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000006', 'Quiz: O que é reciclagem?', '3 perguntas sobre reciclagem e coleta seletiva.', 60, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000006' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000006' and id not in ('31000000-0000-4000-8000-006000000001', '31000000-0000-4000-8000-006000000002', '31000000-0000-4000-8000-006000000003');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-006000000001', '30000000-0000-4000-8000-000000000006', 'O que significa reciclar?', 'Reciclar é transformar materiais já usados em matéria-prima para fabricar novos produtos.', '♻️ Reciclagem', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-006000000002', '30000000-0000-4000-8000-000000000006', 'No padrão brasileiro de coleta seletiva, qual é a cor da lixeira para plástico?', 'Pela Resolução CONAMA nº 275/2001: azul para papel, vermelho para plástico, verde para vidro, amarelo para metal e marrom para orgânicos.', '🗑️ Coleta seletiva', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-006000000003', '30000000-0000-4000-8000-000000000006', 'Qual atitude facilita o trabalho da reciclagem?', 'Embalagens limpas e secas, separadas dos restos de comida, são mais fáceis de triar e reciclar.', '🧼 Separação', 'single_choice', 3, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-006000000001', '31000000-0000-4000-8000-006000000002', '31000000-0000-4000-8000-006000000003') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-006000001001', '31000000-0000-4000-8000-006000000001', 'Usar o mesmo pote de novo para guardar alimentos', false, 'Isso é reutilizar. Reciclar envolve transformar o material.', 1),
  ('32000000-0000-4000-8000-006000001002', '31000000-0000-4000-8000-006000000001', 'Transformar materiais usados em matéria-prima para novos produtos', true, 'Isso mesmo.', 2),
  ('32000000-0000-4000-8000-006000001003', '31000000-0000-4000-8000-006000000001', 'Jogar todo o lixo no mesmo saco', false, 'Misturar tudo dificulta a reciclagem. É preciso separar.', 3),
  ('32000000-0000-4000-8000-006000001004', '31000000-0000-4000-8000-006000000001', 'Queimar o lixo em casa', false, 'Queimar polui o ar e não recicla nada.', 4),
  ('32000000-0000-4000-8000-006000002001', '31000000-0000-4000-8000-006000000002', 'Azul', false, 'Azul é para papel.', 1),
  ('32000000-0000-4000-8000-006000002002', '31000000-0000-4000-8000-006000000002', 'Verde', false, 'Verde é para vidro.', 2),
  ('32000000-0000-4000-8000-006000002003', '31000000-0000-4000-8000-006000000002', 'Vermelha', true, 'Isso: vermelho é a cor do plástico.', 3),
  ('32000000-0000-4000-8000-006000002004', '31000000-0000-4000-8000-006000000002', 'Amarela', false, 'Amarelo é para metal.', 4),
  ('32000000-0000-4000-8000-006000003001', '31000000-0000-4000-8000-006000000003', 'Misturar restos de comida com os recicláveis', false, 'Restos de comida sujam os recicláveis e dificultam o reaproveitamento.', 1),
  ('32000000-0000-4000-8000-006000003002', '31000000-0000-4000-8000-006000000003', 'Separar embalagens limpas e secas', true, 'Isso ajuda muito as cooperativas de reciclagem.', 2),
  ('32000000-0000-4000-8000-006000003003', '31000000-0000-4000-8000-006000000003', 'Colocar tudo no lixo comum', false, 'No lixo comum, o material reciclável se perde.', 3),
  ('32000000-0000-4000-8000-006000003004', '31000000-0000-4000-8000-006000000003', 'Descartar vidro quebrado solto na lixeira', false, 'Vidro quebrado deve ser embrulhado para proteger quem faz a coleta.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: O que significa reutilizar?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000007', 'Quiz: O que significa reutilizar?', '3 perguntas sobre reutilização.', 60, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000007' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000007' and id not in ('31000000-0000-4000-8000-007000000001', '31000000-0000-4000-8000-007000000002', '31000000-0000-4000-8000-007000000003');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-007000000001', '30000000-0000-4000-8000-000000000007', 'Qual é a diferença entre reutilizar e reciclar?', 'Reutilizar é usar o objeto de novo, sem transformação industrial. Reciclar é transformar o material em matéria-prima.', '🔄 Reutilizar x reciclar', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-007000000002', '30000000-0000-4000-8000-000000000007', 'Qual destas atitudes é um exemplo de reutilização?', 'Doar, consertar e dar nova função a objetos são formas de reutilizar.', '💡 Exemplos', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-007000000003', '30000000-0000-4000-8000-000000000007', 'Por que reutilizar ajuda o ambiente?', 'Cada objeto reutilizado evita a fabricação de um novo, economizando matéria-prima, água e energia, e reduz o lixo.', '🌎 Benefícios', 'single_choice', 3, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-007000000001', '31000000-0000-4000-8000-007000000002', '31000000-0000-4000-8000-007000000003') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-007000001001', '31000000-0000-4000-8000-007000000001', 'São exatamente a mesma coisa', false, 'São diferentes: um usa o objeto de novo, o outro transforma o material.', 1),
  ('32000000-0000-4000-8000-007000001002', '31000000-0000-4000-8000-007000000001', 'Reciclar é jogar fora e reutilizar é comprar de novo', false, 'Nenhum dos dois significa jogar fora ou comprar de novo.', 2),
  ('32000000-0000-4000-8000-007000001003', '31000000-0000-4000-8000-007000000001', 'Reutilizar exige uma fábrica; reciclar não', false, 'É o contrário: quem normalmente precisa de indústria é a reciclagem.', 3),
  ('32000000-0000-4000-8000-007000001004', '31000000-0000-4000-8000-007000000001', 'Reutilizar é usar o objeto de novo; reciclar transforma o material', true, 'Exato.', 4),
  ('32000000-0000-4000-8000-007000002001', '31000000-0000-4000-8000-007000000002', 'Doar roupas que não servem mais', true, 'Isso: a roupa continua sendo usada por outra pessoa.', 1),
  ('32000000-0000-4000-8000-007000002002', '31000000-0000-4000-8000-007000000002', 'Comprar roupas novas toda semana', false, 'Comprar mais aumenta o consumo; reutilizar é aproveitar o que já existe.', 2),
  ('32000000-0000-4000-8000-007000002003', '31000000-0000-4000-8000-007000000002', 'Jogar potes no lixo comum', false, 'Assim o pote não é reutilizado nem reciclado.', 3),
  ('32000000-0000-4000-8000-007000002004', '31000000-0000-4000-8000-007000000002', 'Queimar caixas de papelão', false, 'Queimar polui e desperdiça um material que poderia ter nova função.', 4),
  ('32000000-0000-4000-8000-007000003001', '31000000-0000-4000-8000-007000000003', 'Porque aumenta a quantidade de lixo', false, 'Reutilizar diminui o lixo.', 1),
  ('32000000-0000-4000-8000-007000003002', '31000000-0000-4000-8000-007000000003', 'Porque economiza matéria-prima, água e energia', true, 'Isso: menos fabricação, menos recursos usados.', 2),
  ('32000000-0000-4000-8000-007000003003', '31000000-0000-4000-8000-007000000003', 'Porque gasta mais energia do que fabricar algo novo', false, 'Em geral é o contrário: reutilizar evita a energia gasta na fabricação.', 3),
  ('32000000-0000-4000-8000-007000003004', '31000000-0000-4000-8000-007000000003', 'Não faz diferença para o ambiente', false, 'Faz diferença, sim: menos consumo e menos lixo.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: Por que economizar energia?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000008', 'Quiz: Por que economizar energia?', '3 perguntas sobre impacto e consumo de energia.', 60, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000008' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000008' and id not in ('31000000-0000-4000-8000-008000000001', '31000000-0000-4000-8000-008000000002', '31000000-0000-4000-8000-008000000003');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-008000000001', '30000000-0000-4000-8000-000000000008', 'Por que gerar eletricidade causa impactos ambientais?', 'Toda forma de geração tem algum impacto: hidrelétricas alagam áreas, termelétricas queimam combustíveis, e até eólicas e solares usam recursos.', '⚡ Impactos', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-008000000002', '30000000-0000-4000-8000-000000000008', 'Qual tipo de lâmpada gasta menos energia para iluminar o mesmo ambiente?', 'Lâmpadas de LED gastam bem menos energia do que as incandescentes para produzir a mesma iluminação.', '💡 Iluminação', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-008000000003', '30000000-0000-4000-8000-000000000008', 'Qual destas atitudes economiza energia em casa?', 'Apagar luzes, tirar carregadores da tomada e não deixar a geladeira aberta são atitudes simples de economia.', '👣 Atitudes', 'single_choice', 3, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-008000000001', '31000000-0000-4000-8000-008000000002', '31000000-0000-4000-8000-008000000003') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-008000001001', '31000000-0000-4000-8000-008000000001', 'Porque toda forma de geração tem algum impacto', true, 'Isso: por isso a energia mais limpa é a que não é desperdiçada.', 1),
  ('32000000-0000-4000-8000-008000001002', '31000000-0000-4000-8000-008000000001', 'Porque só as usinas solares causam impacto', false, 'Todas as formas de geração têm algum impacto, não só a solar.', 2),
  ('32000000-0000-4000-8000-008000001003', '31000000-0000-4000-8000-008000000001', 'Porque a eletricidade não causa impacto nenhum', false, 'Toda geração de energia causa algum impacto.', 3),
  ('32000000-0000-4000-8000-008000001004', '31000000-0000-4000-8000-008000000001', 'Porque a eletricidade só causa impacto à noite', false, 'O impacto está na geração, a qualquer hora.', 4),
  ('32000000-0000-4000-8000-008000002001', '31000000-0000-4000-8000-008000000002', 'Incandescente', false, 'A incandescente transforma boa parte da energia em calor, não em luz.', 1),
  ('32000000-0000-4000-8000-008000002002', '31000000-0000-4000-8000-008000000002', 'Todas gastam a mesma energia', false, 'Há grande diferença de consumo entre os tipos de lâmpada.', 2),
  ('32000000-0000-4000-8000-008000002003', '31000000-0000-4000-8000-008000000002', 'LED', true, 'Isso: o LED ilumina gastando bem menos energia.', 3),
  ('32000000-0000-4000-8000-008000002004', '31000000-0000-4000-8000-008000000002', 'Qualquer lâmpada acesa durante o dia', false, 'Durante o dia, o melhor é aproveitar a luz natural.', 4),
  ('32000000-0000-4000-8000-008000003001', '31000000-0000-4000-8000-008000000003', 'Deixar carregadores sempre na tomada', false, 'Aparelhos na tomada podem continuar consumindo um pouco de energia.', 1),
  ('32000000-0000-4000-8000-008000003002', '31000000-0000-4000-8000-008000000003', 'Abrir a geladeira várias vezes sem necessidade', false, 'Cada abertura faz a geladeira gastar mais para esfriar de novo.', 2),
  ('32000000-0000-4000-8000-008000003003', '31000000-0000-4000-8000-008000000003', 'Tomar banhos bem longos no chuveiro elétrico', false, 'O chuveiro elétrico é um dos aparelhos que mais consomem energia.', 3),
  ('32000000-0000-4000-8000-008000003004', '31000000-0000-4000-8000-008000000003', 'Apagar a luz ao sair do cômodo', true, 'Isso: um hábito simples que economiza todos os dias.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: O que são fontes renováveis?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000009', 'Quiz: O que são fontes renováveis?', '3 perguntas sobre fontes de energia.', 60, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000009' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000009' and id not in ('31000000-0000-4000-8000-009000000001', '31000000-0000-4000-8000-009000000002', '31000000-0000-4000-8000-009000000003');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-009000000001', '30000000-0000-4000-8000-000000000009', 'O que caracteriza uma fonte de energia renovável?', 'Fontes renováveis se renovam naturalmente, como a luz do sol, o vento, o movimento da água e a biomassa.', '🔋 Fontes renováveis', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-009000000002', '30000000-0000-4000-8000-000000000009', 'Qual destas fontes é NÃO renovável?', 'Gás natural, petróleo e carvão são combustíveis fósseis: existem em quantidade limitada e liberam gases de efeito estufa quando queimados.', '🛢️ Não renováveis', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-009000000003', '30000000-0000-4000-8000-000000000009', 'Por que ainda é importante economizar energia vinda de fontes renováveis?', 'Nenhuma fonte é livre de impactos: hidrelétricas alagam áreas, parques eólicos mudam a paisagem, painéis precisam de materiais.', '⚖️ Impactos', 'single_choice', 3, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-009000000001', '31000000-0000-4000-8000-009000000002', '31000000-0000-4000-8000-009000000003') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-009000001001', '31000000-0000-4000-8000-009000000001', 'Ela se renova naturalmente, como o sol e o vento', true, 'Isso mesmo.', 1),
  ('32000000-0000-4000-8000-009000001002', '31000000-0000-4000-8000-009000000001', 'Ela existe em quantidade limitada e pode acabar', false, 'Essa é a característica das fontes não renováveis.', 2),
  ('32000000-0000-4000-8000-009000001003', '31000000-0000-4000-8000-009000000001', 'Ela só funciona durante a noite', false, 'Ser renovável não tem a ver com horário de funcionamento.', 3),
  ('32000000-0000-4000-8000-009000001004', '31000000-0000-4000-8000-009000000001', 'Ela sempre vem do petróleo', false, 'O petróleo é um combustível fóssil, não renovável.', 4),
  ('32000000-0000-4000-8000-009000002001', '31000000-0000-4000-8000-009000000002', 'Solar', false, 'A luz do sol se renova todos os dias.', 1),
  ('32000000-0000-4000-8000-009000002002', '31000000-0000-4000-8000-009000000002', 'Eólica', false, 'O vento é uma fonte renovável.', 2),
  ('32000000-0000-4000-8000-009000002003', '31000000-0000-4000-8000-009000000002', 'Biomassa', false, 'Biomassa, como o bagaço de cana, é considerada renovável.', 3),
  ('32000000-0000-4000-8000-009000002004', '31000000-0000-4000-8000-009000000002', 'Gás natural', true, 'Isso: é um combustível fóssil, portanto não renovável.', 4),
  ('32000000-0000-4000-8000-009000003001', '31000000-0000-4000-8000-009000000003', 'Porque renováveis poluem mais do que o carvão', false, 'Em geral, renováveis emitem bem menos do que o carvão.', 1),
  ('32000000-0000-4000-8000-009000003002', '31000000-0000-4000-8000-009000000003', 'Porque nenhuma fonte de energia é livre de impactos', true, 'Exato: a energia mais limpa é a que não é desperdiçada.', 2),
  ('32000000-0000-4000-8000-009000003003', '31000000-0000-4000-8000-009000000003', 'Porque as fontes renováveis vão acabar em breve', false, 'Elas se renovam — o motivo é o impacto que toda geração causa.', 3),
  ('32000000-0000-4000-8000-009000003004', '31000000-0000-4000-8000-009000000003', 'Não é importante economizar', false, 'É importante: toda geração tem algum impacto.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: O que é biodiversidade?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000010', 'Quiz: O que é biodiversidade?', '3 perguntas sobre a variedade da vida.', 60, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000010' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000010' and id not in ('31000000-0000-4000-8000-010000000001', '31000000-0000-4000-8000-010000000002', '31000000-0000-4000-8000-010000000003');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-010000000001', '30000000-0000-4000-8000-000000000010', 'O que é biodiversidade?', 'Biodiversidade é a variedade de vida: diversidade de espécies, diversidade genética e diversidade de ecossistemas.', '🦋 Biodiversidade', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-010000000002', '30000000-0000-4000-8000-000000000010', 'O que pode acontecer quando uma espécie desaparece de um ecossistema?', 'Os seres vivos dependem uns dos outros. Quando uma espécie desaparece, outras que dependiam dela podem ser afetadas.', '🕸️ Conexões', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-010000000003', '30000000-0000-4000-8000-000000000010', 'Qual destas é uma ameaça à biodiversidade?', 'Destruição de habitats, poluição e espécies invasoras estão entre as principais ameaças.', '🛡️ Ameaças', 'single_choice', 3, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-010000000001', '31000000-0000-4000-8000-010000000002', '31000000-0000-4000-8000-010000000003') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-010000001001', '31000000-0000-4000-8000-010000000001', 'Apenas o número de árvores de uma cidade', false, 'Biodiversidade inclui todos os seres vivos, não só árvores.', 1),
  ('32000000-0000-4000-8000-010000001002', '31000000-0000-4000-8000-010000000001', 'Somente os animais ameaçados de extinção', false, 'Ela inclui todas as formas de vida, ameaçadas ou não.', 2),
  ('32000000-0000-4000-8000-010000001003', '31000000-0000-4000-8000-010000000001', 'A variedade de vida: espécies, genes e ecossistemas', true, 'Isso mesmo.', 3),
  ('32000000-0000-4000-8000-010000001004', '31000000-0000-4000-8000-010000000001', 'Os tipos de rochas de uma região', false, 'Rochas não são seres vivos. Biodiversidade é a variedade da vida.', 4),
  ('32000000-0000-4000-8000-010000002001', '31000000-0000-4000-8000-010000000002', 'Outras espécies podem ser afetadas', true, 'Isso: na natureza tudo está conectado.', 1),
  ('32000000-0000-4000-8000-010000002002', '31000000-0000-4000-8000-010000000002', 'Nada muda no ecossistema', false, 'As relações entre espécies fazem com que a perda de uma afete outras.', 2),
  ('32000000-0000-4000-8000-010000002003', '31000000-0000-4000-8000-010000000002', 'O ecossistema sempre fica mais forte', false, 'Perder espécies costuma deixar o ecossistema mais frágil.', 3),
  ('32000000-0000-4000-8000-010000002004', '31000000-0000-4000-8000-010000000002', 'As outras espécies passam a viver para sempre', false, 'Não há relação desse tipo. O mais comum é outras espécies serem prejudicadas.', 4),
  ('32000000-0000-4000-8000-010000003001', '31000000-0000-4000-8000-010000000003', 'Proteger a vegetação nativa', false, 'Proteger a vegetação nativa é uma forma de conservar a biodiversidade.', 1),
  ('32000000-0000-4000-8000-010000003002', '31000000-0000-4000-8000-010000000003', 'Criar áreas protegidas', false, 'Áreas protegidas ajudam a conservar espécies.', 2),
  ('32000000-0000-4000-8000-010000003003', '31000000-0000-4000-8000-010000000003', 'Destruir habitats naturais', true, 'Isso: sem habitat, muitas espécies não sobrevivem.', 3),
  ('32000000-0000-4000-8000-010000003004', '31000000-0000-4000-8000-010000000003', 'Plantar espécies nativas', false, 'Plantar nativas ajuda a biodiversidade local.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: Por que os polinizadores são importantes?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000011', 'Quiz: Por que os polinizadores são importantes?', '3 perguntas sobre polinização e polinizadores.', 60, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000011' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000011' and id not in ('31000000-0000-4000-8000-011000000001', '31000000-0000-4000-8000-011000000002', '31000000-0000-4000-8000-011000000003');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-011000000001', '30000000-0000-4000-8000-000000000011', 'O que é polinização?', 'Polinização é o transporte de pólen de uma flor para outra, o que permite a formação de frutos e sementes.', '🌸 Polinização', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-011000000002', '30000000-0000-4000-8000-000000000011', 'Qual destes animais pode atuar como polinizador?', 'Abelhas, borboletas, besouros, beija-flores e morcegos estão entre os polinizadores.', '🐝 Polinizadores', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-011000000003', '30000000-0000-4000-8000-000000000011', 'Como podemos ajudar os polinizadores?', 'Plantar flores variadas e evitar agrotóxicos no jardim oferece alimento e reduz ameaças aos polinizadores.', '🌼 Como ajudar', 'single_choice', 3, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-011000000001', '31000000-0000-4000-8000-011000000002', '31000000-0000-4000-8000-011000000003') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-011000001001', '31000000-0000-4000-8000-011000000001', 'A queda das folhas no outono', false, 'Queda de folhas é outro processo. Polinização envolve o pólen das flores.', 1),
  ('32000000-0000-4000-8000-011000001002', '31000000-0000-4000-8000-011000000001', 'O transporte de pólen entre flores, que permite frutos e sementes', true, 'Isso mesmo.', 2),
  ('32000000-0000-4000-8000-011000001003', '31000000-0000-4000-8000-011000000001', 'A produção de mel pelas abelhas', false, 'O mel é produzido pelas abelhas, mas polinização é o transporte de pólen.', 3),
  ('32000000-0000-4000-8000-011000001004', '31000000-0000-4000-8000-011000000001', 'A rega das plantas pela chuva', false, 'A chuva rega as plantas; polinização é o transporte de pólen.', 4),
  ('32000000-0000-4000-8000-011000002001', '31000000-0000-4000-8000-011000000002', 'Minhoca', false, 'Minhocas ajudam o solo, mas não visitam flores para transportar pólen.', 1),
  ('32000000-0000-4000-8000-011000002002', '31000000-0000-4000-8000-011000000002', 'Peixe', false, 'Peixes não costumam visitar flores.', 2),
  ('32000000-0000-4000-8000-011000002003', '31000000-0000-4000-8000-011000000002', 'Tartaruga', false, 'Tartarugas não são conhecidas como polinizadoras.', 3),
  ('32000000-0000-4000-8000-011000002004', '31000000-0000-4000-8000-011000000002', 'Beija-flor', true, 'Isso: ao buscar néctar, o beija-flor leva pólen de flor em flor.', 4),
  ('32000000-0000-4000-8000-011000003001', '31000000-0000-4000-8000-011000000003', 'Plantando flores variadas e evitando agrotóxicos', true, 'Isso: alimento disponível e menos veneno ajudam muito.', 1),
  ('32000000-0000-4000-8000-011000003002', '31000000-0000-4000-8000-011000000003', 'Usando mais agrotóxicos no jardim', false, 'Agrotóxicos estão entre as ameaças aos polinizadores.', 2),
  ('32000000-0000-4000-8000-011000003003', '31000000-0000-4000-8000-011000000003', 'Retirando as flores do jardim', false, 'Sem flores, os polinizadores ficam sem alimento.', 3),
  ('32000000-0000-4000-8000-011000003004', '31000000-0000-4000-8000-011000000003', 'Removendo ninhos de abelhas nativas', false, 'Abelhas nativas sem ferrão são importantes polinizadoras e devem ser protegidas.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: O que é uma ação ambiental comunitária?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000012', 'Quiz: O que é uma ação ambiental comunitária?', '3 perguntas sobre ações coletivas.', 60, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000012' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000012' and id not in ('31000000-0000-4000-8000-012000000001', '31000000-0000-4000-8000-012000000002', '31000000-0000-4000-8000-012000000003');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-012000000001', '30000000-0000-4000-8000-000000000012', 'O que é uma ação ambiental comunitária?', 'É quando um grupo de pessoas se organiza para cuidar do ambiente onde vive, como em mutirões, hortas comunitárias ou plantios.', '🤝 Ação comunitária', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-012000000002', '30000000-0000-4000-8000-000000000012', 'Qual costuma ser o primeiro passo de uma ação comunitária?', 'Tudo começa identificando um problema e conversando com as pessoas envolvidas. Depois vêm o planejamento e os materiais.', '🗺️ Planejamento', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-012000000003', '30000000-0000-4000-8000-000000000012', 'Qual cuidado de segurança é importante em um mutirão de limpeza?', 'Use luvas, não recolha objetos cortantes ou perigosos com as mãos e mantenha crianças sempre acompanhadas de adultos.', '🧤 Segurança', 'single_choice', 3, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-012000000001', '31000000-0000-4000-8000-012000000002', '31000000-0000-4000-8000-012000000003') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-012000001001', '31000000-0000-4000-8000-012000000001', 'Uma ação feita por uma pessoa sozinha, sem avisar ninguém', false, 'Ação comunitária envolve pessoas se organizando juntas.', 1),
  ('32000000-0000-4000-8000-012000001002', '31000000-0000-4000-8000-012000000001', 'Um grupo de pessoas organizado para cuidar do ambiente onde vive', true, 'Isso mesmo.', 2),
  ('32000000-0000-4000-8000-012000001003', '31000000-0000-4000-8000-012000000001', 'A compra de produtos ecológicos', false, 'Comprar produtos é uma escolha individual, não uma ação comunitária.', 3),
  ('32000000-0000-4000-8000-012000001004', '31000000-0000-4000-8000-012000000001', 'Algo que só o governo pode fazer', false, 'A comunidade também pode se organizar e agir.', 4),
  ('32000000-0000-4000-8000-012000002001', '31000000-0000-4000-8000-012000000002', 'Comprar os materiais', false, 'Materiais vêm depois de saber o que será feito e com quem.', 1),
  ('32000000-0000-4000-8000-012000002002', '31000000-0000-4000-8000-012000000002', 'Começar sem nenhum planejamento', false, 'Sem planejar, a ação pode não ser segura nem se manter.', 2),
  ('32000000-0000-4000-8000-012000002003', '31000000-0000-4000-8000-012000000002', 'Esperar que outras pessoas façam', false, 'Esperar não inicia a mudança.', 3),
  ('32000000-0000-4000-8000-012000002004', '31000000-0000-4000-8000-012000000002', 'Identificar o problema e conversar com as pessoas', true, 'Isso: a ação nasce do diálogo sobre um problema comum.', 4),
  ('32000000-0000-4000-8000-012000003001', '31000000-0000-4000-8000-012000000003', 'Recolher vidro quebrado com as mãos', false, 'Objetos cortantes nunca devem ser recolhidos com as mãos.', 1),
  ('32000000-0000-4000-8000-012000003002', '31000000-0000-4000-8000-012000000003', 'Usar luvas e não pegar objetos cortantes com as mãos', true, 'Isso: segurança em primeiro lugar.', 2),
  ('32000000-0000-4000-8000-012000003003', '31000000-0000-4000-8000-012000000003', 'Deixar crianças trabalhando sozinhas', false, 'Crianças devem estar sempre acompanhadas de adultos.', 3),
  ('32000000-0000-4000-8000-012000003004', '31000000-0000-4000-8000-012000000003', 'Dispensar as luvas para trabalhar mais rápido', false, 'Luvas protegem contra cortes e contaminação.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: A vaca e os derivados do leite
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000013', 'Quiz: A vaca e os derivados do leite', '4 perguntas sobre vacas, leite, derivados e cuidado com os animais.', 70, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000013' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000013' and id not in ('31000000-0000-4000-8000-013000000001', '31000000-0000-4000-8000-013000000002', '31000000-0000-4000-8000-013000000003', '31000000-0000-4000-8000-013000000004');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-013000000001', '30000000-0000-4000-8000-000000000013', 'O que é importante para uma vaca viver bem?', 'Vacas precisam de água, alimento, espaço, abrigo e cuidados responsáveis.', '🐄 Animais', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-013000000002', '30000000-0000-4000-8000-000000000013', 'Qual alimento pode ser feito a partir do leite?', 'Queijo é um derivado do leite.', '🥛 Leite', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-013000000003', '30000000-0000-4000-8000-000000000013', 'Qual opção apresenta apenas derivados do leite?', 'Queijo, iogurte e manteiga podem ser produzidos a partir do leite.', '🧀 Derivados', 'single_choice', 3, 1, true),
  ('31000000-0000-4000-8000-013000000004', '30000000-0000-4000-8000-000000000013', 'Como uma criança deve agir perto de uma vaca desconhecida?', 'A criança deve observar à distância e pedir orientação a um adulto.', '💚 Cuidado', 'single_choice', 4, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-013000000001', '31000000-0000-4000-8000-013000000002', '31000000-0000-4000-8000-013000000003', '31000000-0000-4000-8000-013000000004') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-013000001001', '31000000-0000-4000-8000-013000000001', 'Água, alimento, espaço e cuidado', true, 'Correto! Todo animal precisa de cuidados e condições adequadas.', 1),
  ('32000000-0000-4000-8000-013000001002', '31000000-0000-4000-8000-013000000001', 'Ficar sempre sozinha e sem água', false, 'Animais precisam de água, alimento e condições adequadas.', 2),
  ('32000000-0000-4000-8000-013000001003', '31000000-0000-4000-8000-013000000001', 'Comer apenas doces', false, 'Doces não substituem a alimentação adequada do animal.', 3),
  ('32000000-0000-4000-8000-013000001004', '31000000-0000-4000-8000-013000000001', 'Viver sem descanso', false, 'Descanso também faz parte do cuidado com os animais.', 4),
  ('32000000-0000-4000-8000-013000002001', '31000000-0000-4000-8000-013000000002', 'Queijo', true, 'Isso! Queijo é um derivado do leite.', 1),
  ('32000000-0000-4000-8000-013000002002', '31000000-0000-4000-8000-013000000002', 'Cenoura', false, 'Cenoura é uma raiz, não um derivado do leite.', 2),
  ('32000000-0000-4000-8000-013000002003', '31000000-0000-4000-8000-013000000002', 'Arroz', false, 'Arroz é um grão, não um derivado do leite.', 3),
  ('32000000-0000-4000-8000-013000002004', '31000000-0000-4000-8000-013000000002', 'Maçã', false, 'Maçã é uma fruta, não um derivado do leite.', 4),
  ('32000000-0000-4000-8000-013000003001', '31000000-0000-4000-8000-013000000003', 'Queijo, iogurte e manteiga', true, 'Correto! Os três são derivados do leite.', 1),
  ('32000000-0000-4000-8000-013000003002', '31000000-0000-4000-8000-013000000003', 'Banana, maçã e pera', false, 'Esses alimentos são frutas.', 2),
  ('32000000-0000-4000-8000-013000003003', '31000000-0000-4000-8000-013000000003', 'Arroz, feijão e milho', false, 'Esses alimentos são grãos ou sementes.', 3),
  ('32000000-0000-4000-8000-013000003004', '31000000-0000-4000-8000-013000000003', 'Cenoura, batata e mandioca', false, 'Esses alimentos são raízes ou tubérculos.', 4),
  ('32000000-0000-4000-8000-013000004001', '31000000-0000-4000-8000-013000000004', 'Observar e pedir ajuda a um adulto', true, 'Isso! Segurança e respeito vêm primeiro.', 1),
  ('32000000-0000-4000-8000-013000004002', '31000000-0000-4000-8000-013000000004', 'Correr atrás dela', false, 'Correr atrás pode assustar o animal e causar acidentes.', 2),
  ('32000000-0000-4000-8000-013000004003', '31000000-0000-4000-8000-013000000004', 'Oferecer qualquer comida', false, 'Nunca alimente um animal sem autorização de um adulto responsável.', 3),
  ('32000000-0000-4000-8000-013000004004', '31000000-0000-4000-8000-013000000004', 'Entrar sozinho no cercado', false, 'Crianças não devem entrar sozinhas em cercados.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- >>> 18_mission_schedule.sql
-- =====================================================================
-- 18 · Calendário da missão (etapas liberadas só perto da data)
-- =====================================================================
-- Regra: se a missão foi registrada no dia X, cada acompanhamento só pode ser
-- registrado a partir de (X + dias da etapa − janela de antecedência).
-- • Datas calculadas SEMPRE com o relógio do servidor (current_date/now()).
--   Mudar o relógio do celular ou digitar outra data não adianta.
-- • A data informada no registro não pode ser anterior ao aceite da missão
--   nem futura, e não altera o calendário dos acompanhamentos.

alter table public.challenge_steps
  -- Quantos dias ANTES da data prevista o acompanhamento já pode ser registrado.
  add column early_window_days integer not null default 2 check (early_window_days >= 0);

-- ---------------------------------------------------------------------
-- Registro da realização (Dia 0)
-- ---------------------------------------------------------------------
create or replace function public.submit_challenge_evidence(
  p_user_challenge_id uuid,
  p_file_path         text,
  p_thumbnail_path    text,
  p_description       text,
  p_captured_at       date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user       uuid := public.require_user();
  v_uc         public.user_challenges;
  v_challenge  public.challenges;
  v_id         uuid;
begin
  select * into v_uc from public.user_challenges
  where id = p_user_challenge_id and user_id = v_user
  for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_uc.completed_at is not null or v_uc.status not in ('accepted', 'in_progress') then
    raise exception 'challenge_not_active';
  end if;
  if v_uc.status = 'accepted' and v_uc.deadline_at < now() then
    raise exception 'challenge_expired';
  end if;
  if exists (
    select 1 from public.challenge_evidence
    where user_challenge_id = v_uc.id and followup_id is null
  ) then
    raise exception 'evidence_already_sent';
  end if;

  select * into v_challenge from public.challenges where id = v_uc.challenge_id;

  if v_challenge.requires_evidence and p_file_path is null then
    raise exception 'photo_required';
  end if;
  -- A data da realização precisa estar entre o aceite da missão e hoje
  -- (1 dia de folga por causa de fuso horário).
  if p_captured_at is null
     or p_captured_at > current_date + 1
     or p_captured_at < (v_uc.accepted_at at time zone 'UTC')::date - 1 then
    raise exception 'invalid_date';
  end if;

  perform public.assert_evidence_path(v_user, v_challenge.id, p_file_path);
  perform public.assert_evidence_path(v_user, v_challenge.id, p_thumbnail_path);

  insert into public.challenge_evidence (
    user_challenge_id, user_id, evidence_type, file_url, thumbnail_url, description, captured_at
  )
  values (
    v_uc.id, v_user,
    case when p_file_path is null then 'text' else 'photo' end::public.evidence_type,
    p_file_path, p_thumbnail_path, nullif(btrim(p_description), ''),
    (p_captured_at + time '12:00') at time zone 'UTC'
  )
  returning id into v_id;

  perform public.complete_challenge_steps(
    v_uc.id, array['instruction', 'action', 'evidence']::public.challenge_step_type[]
  );

  update public.user_challenges
  set status = 'in_progress', started_at = coalesce(started_at, now())
  where id = v_uc.id;

  -- Calendário a partir da data do REGISTRO no servidor (não da data digitada).
  insert into public.challenge_followups (
    user_challenge_id, challenge_step_id, title, description, scheduled_for, evidence_required
  )
  select v_uc.id, cs.id, cs.title, cs.description,
         ((current_date + cs.day_offset) + time '12:00') at time zone 'UTC',
         true
  from public.challenge_steps cs
  where cs.challenge_id = v_challenge.id and cs.step_type = 'follow_up'
  on conflict (user_challenge_id, challenge_step_id) do nothing;

  perform public.refresh_user_challenge_progress(v_uc.id);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Acompanhamento: só dentro da janela (data prevista − antecedência)
-- ---------------------------------------------------------------------
create or replace function public.complete_followup(
  p_followup_id    uuid,
  p_file_path      text,
  p_thumbnail_path text,
  p_description    text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user      uuid := public.require_user();
  v_followup  public.challenge_followups;
  v_uc        public.user_challenges;
  v_step      public.challenge_steps;
  v_xp        integer := 0;
begin
  select f.* into v_followup
  from public.challenge_followups f
  join public.user_challenges uc on uc.id = f.user_challenge_id
  where f.id = p_followup_id and uc.user_id = v_user
  for update of f;
  if not found then
    raise exception 'not_found';
  end if;
  if v_followup.status <> 'scheduled' then
    raise exception 'followup_already_done';
  end if;

  select * into v_step from public.challenge_steps where id = v_followup.challenge_step_id;
  if v_followup.scheduled_for - make_interval(days => coalesce(v_step.early_window_days, 0)) > now() then
    raise exception 'followup_not_due';
  end if;

  select * into v_uc from public.user_challenges where id = v_followup.user_challenge_id for update;

  if v_followup.evidence_required and p_file_path is null then
    raise exception 'photo_required';
  end if;
  perform public.assert_evidence_path(v_user, v_uc.challenge_id, p_file_path);
  perform public.assert_evidence_path(v_user, v_uc.challenge_id, p_thumbnail_path);

  if p_file_path is not null or nullif(btrim(p_description), '') is not null then
    insert into public.challenge_evidence (
      user_challenge_id, user_id, followup_id, evidence_type, file_url, thumbnail_url, description
    )
    values (
      v_uc.id, v_user, p_followup_id,
      case when p_file_path is null then 'text' else 'photo' end::public.evidence_type,
      p_file_path, p_thumbnail_path, nullif(btrim(p_description), '')
    );
  end if;

  update public.challenge_followups
  set status = 'completed', completed_at = now()
  where id = p_followup_id;

  if v_followup.challenge_step_id is not null then
    update public.user_challenge_steps
    set status = 'completed', completed_at = now()
    where user_challenge_id = v_uc.id and challenge_step_id = v_followup.challenge_step_id;

    v_xp := public.award_xp(v_user, coalesce(v_step.xp_reward, 0), 'follow_up', 'follow_up', p_followup_id,
                            'Acompanhamento: ' || v_followup.title);
  end if;

  if v_uc.status = 'waiting_follow_up' and not exists (
    select 1 from public.challenge_followups
    where user_challenge_id = v_uc.id and status = 'scheduled'
  ) then
    update public.user_challenges set status = 'completed' where id = v_uc.id;
  end if;

  perform public.refresh_user_challenge_progress(v_uc.id);

  return jsonb_build_object(
    'xp_awarded',   v_xp,
    'achievements', public.check_achievements(v_user)
  );
end;
$$;

-- >>> 19_challenges_system.sql
-- =====================================================================
-- 19 · Sistema de desafios ecológicos (Etapa 5)
-- =====================================================================
-- Fluxo: aula → quiz aprovado → desafio disponível → aceitar → checklist
--        (etapas com foto/texto) → acompanhamentos → conclusão → recompensa.
--
-- Transições do desafio do usuário (todas no servidor):
--   accepted → in_progress → [waiting_follow_up] → completed
--   accepted/in_progress fora do prazo → expired   ·   qualquer ativo → cancelled
--
-- Regras:
--   • O progresso é calculado pelo servidor (etapas obrigatórias concluídas / total).
--   • Etapas principais em ordem; foto/texto exigidos conforme evidence_kind.
--   • Acompanhamentos agendados quando as etapas principais terminam
--     (relógio do servidor) e liberados só perto da data.
--   • XP, conquistas e item do mundo só na conclusão DEFINITIVA, uma única vez.

-- ---------------------------------------------------------------------
-- 1. Estrutura
-- ---------------------------------------------------------------------
update storage.buckets set file_size_limit = 10485760 where id = 'eco-evidence'; -- 10 MB

alter table public.challenges
  add column why_it_matters text,
  add column materials text,               -- um item por linha
  add column evidence_instructions text,
  add column duration_label text;

alter table public.challenge_steps
  add column evidence_kind text not null default 'none' check (evidence_kind in ('none', 'photo', 'text')),
  add column deadline_offset_days integer check (deadline_offset_days is null or deadline_offset_days > 0),
  add column active boolean not null default true;

-- Etapas da Etapa 2 que já pediam evidência continuam pedindo foto.
update public.challenge_steps set evidence_kind = 'photo' where step_type in ('evidence', 'follow_up');

alter type public.evidence_status add value if not exists 'pending';
alter type public.evidence_status add value if not exists 'uploaded';
alter type public.evidence_status add value if not exists 'cancelled';

alter table public.challenge_evidence
  add column challenge_step_id uuid references public.challenge_steps (id) on delete set null,
  add column file_name text check (file_name is null or char_length(file_name) <= 200),
  add column mime_type text check (mime_type is null or mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  add column file_size bigint check (file_size is null or (file_size > 0 and file_size <= 10485760)),
  add column uploaded_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

create trigger challenge_evidence_set_updated_at
  before update on public.challenge_evidence
  for each row execute function public.set_updated_at();

-- Agora cada etapa tem a sua evidência (antes: uma única "principal").
drop index if exists public.challenge_evidence_main_uniq;
create unique index challenge_evidence_step_uniq
  on public.challenge_evidence (user_challenge_id, challenge_step_id)
  where challenge_step_id is not null and followup_id is null;
create index challenge_steps_challenge_idx on public.challenge_steps (challenge_id, order_index);
create index user_challenge_steps_uc_idx on public.user_challenge_steps (user_challenge_id);

-- ---------------------------------------------------------------------
-- 2. Regras centrais (funções internas)
-- ---------------------------------------------------------------------

-- "Hoje" no calendário do jogo (horário de Brasília), independente do fuso do
-- servidor. Evita que o Dia 0 vire o dia seguinte depois das 21h.
create or replace function public.game_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- Texto do usuário: sem caracteres de controle, sem espaços nas pontas, até 500 caracteres.
create or replace function public.sanitize_note(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(left(btrim(regexp_replace(coalesce(p_text, ''), '[[:cntrl:]]', ' ', 'g')), 500), '');
$$;

-- Etapas principais (não acompanhamento) obrigatórias já concluídas?
create or replace function public.challenge_main_steps_done(p_user_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.user_challenges uc
    join public.challenge_steps cs on cs.challenge_id = uc.challenge_id
    left join public.user_challenge_steps ucs
      on ucs.user_challenge_id = uc.id and ucs.challenge_step_id = cs.id
    where uc.id = p_user_challenge_id
      and cs.active and cs.required and cs.step_type <> 'follow_up'
      and coalesce(ucs.status, 'pending') <> 'completed'
  );
$$;

-- Prazo vencido antes de terminar a parte principal?
create or replace function public.challenge_is_overdue(p_user_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_challenges uc
    where uc.id = p_user_challenge_id
      and uc.status in ('accepted', 'in_progress')
      and uc.deadline_at < now()
      and not public.challenge_main_steps_done(uc.id)
  );
$$;

create or replace function public.refresh_user_challenge_progress(p_user_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.user_challenges uc
  set progress_percentage = coalesce((
    select round(100.0 * count(*) filter (where ucs.status = 'completed') / nullif(count(*), 0))
    from public.user_challenge_steps ucs
    join public.challenge_steps cs on cs.id = ucs.challenge_step_id
    where ucs.user_challenge_id = p_user_challenge_id and cs.required and cs.active
  ), 0)
  where uc.id = p_user_challenge_id;
end;
$$;

-- Registro de evidência com validação de caminho, tipo e tamanho.
create or replace function public.insert_challenge_evidence(
  p_uc            public.user_challenges,
  p_step_id       uuid,
  p_followup_id   uuid,
  p_file_path     text,
  p_thumb_path    text,
  p_file_name     text,
  p_mime          text,
  p_size          bigint,
  p_note          text,
  p_captured_at   date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_file_path is not null then
    if p_mime is null or p_mime not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'image_invalid';
    end if;
    if p_size is null or p_size <= 0 or p_size > 10485760 then
      raise exception 'image_too_large';
    end if;
  end if;
  -- O arquivo precisa existir no Storage, na pasta do próprio usuário (upload interrompido = sem registro).
  perform public.assert_evidence_path(p_uc.user_id, p_uc.challenge_id, p_file_path);
  perform public.assert_evidence_path(p_uc.user_id, p_uc.challenge_id, p_thumb_path);

  insert into public.challenge_evidence (
    user_challenge_id, user_id, challenge_step_id, followup_id, evidence_type,
    file_url, thumbnail_url, file_name, mime_type, file_size, description, captured_at, status
  )
  values (
    p_uc.id, p_uc.user_id, p_step_id, p_followup_id,
    case when p_file_path is null then 'text' else 'photo' end::public.evidence_type,
    p_file_path, p_thumb_path,
    case when p_file_path is null then null else left(p_file_name, 200) end,
    case when p_file_path is null then null else p_mime end,
    case when p_file_path is null then null else p_size end,
    public.sanitize_note(p_note),
    (coalesce(p_captured_at, public.game_today()) + time '12:00') at time zone 'UTC',
    'submitted'
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Evidência exigida pela etapa (foto e/ou texto).
create or replace function public.assert_step_evidence(p_kind text, p_file_path text, p_note text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_kind = 'photo' and p_file_path is null then
    raise exception 'photo_required';
  end if;
  if p_kind = 'text' and char_length(coalesce(public.sanitize_note(p_note), '')) < 3 then
    raise exception 'observation_required';
  end if;
end;
$$;

-- Parte principal terminou: agenda acompanhamentos (se houver) e muda o status.
create or replace function public.advance_challenge_after_steps(p_user_challenge_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uc      public.user_challenges;
  v_follow  integer;
begin
  select * into v_uc from public.user_challenges where id = p_user_challenge_id;
  if v_uc.status not in ('accepted', 'in_progress') or not public.challenge_main_steps_done(v_uc.id) then
    return v_uc.status::text;
  end if;

  select count(*) into v_follow from public.challenge_steps
  where challenge_id = v_uc.challenge_id and step_type = 'follow_up' and active;

  if v_follow = 0 then
    update public.user_challenges set status = 'in_progress' where id = v_uc.id;
    return 'in_progress';
  end if;

  -- Calendário a partir de HOJE no servidor (não da data digitada pelo usuário).
  insert into public.challenge_followups (
    user_challenge_id, challenge_step_id, title, description, scheduled_for, evidence_required
  )
  select v_uc.id, cs.id, cs.title, cs.description,
         ((public.game_today() + cs.day_offset) + time '12:00') at time zone 'UTC',
         cs.evidence_kind = 'photo'
  from public.challenge_steps cs
  where cs.challenge_id = v_uc.challenge_id and cs.step_type = 'follow_up' and cs.active
  on conflict (user_challenge_id, challenge_step_id) do nothing;

  update public.user_challenges set status = 'waiting_follow_up' where id = v_uc.id;
  return 'waiting_follow_up';
end;
$$;

-- ---------------------------------------------------------------------
-- 3. RPC: aceitar desafio
-- ---------------------------------------------------------------------
create or replace function public.accept_challenge(p_challenge_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user       uuid := public.require_user();
  v_challenge  public.challenges;
  v_quiz_id    uuid;
  v_existing   public.user_challenges;
  v_id         uuid;
begin
  select * into v_challenge from public.challenges where id = p_challenge_id and active;
  if not found then
    raise exception 'not_found';
  end if;

  if not exists (
    select 1 from public.user_lesson_progress
    where user_id = v_user and lesson_id = v_challenge.lesson_id and status = 'completed'
  ) then
    raise exception 'lesson_not_completed';
  end if;

  select id into v_quiz_id from public.quizzes where lesson_id = v_challenge.lesson_id and active;
  if v_quiz_id is not null and not exists (
    select 1 from public.quiz_attempts where user_id = v_user and quiz_id = v_quiz_id and passed
  ) then
    raise exception 'quiz_not_passed';
  end if;

  select * into v_existing from public.user_challenges
  where user_id = v_user and challenge_id = p_challenge_id and status not in ('expired', 'cancelled')
  for update;

  if found then
    if public.challenge_is_overdue(v_existing.id) then
      -- Prazo vencido: o registro antigo expira e um novo começa.
      update public.user_challenges set status = 'expired' where id = v_existing.id;
    else
      return v_existing.id; -- já existe um ativo/concluído: não duplica
    end if;
  end if;

  insert into public.user_challenges (user_id, challenge_id, status, accepted_at, deadline_at)
  values (v_user, p_challenge_id, 'accepted', now(), now() + make_interval(days => v_challenge.deadline_days))
  returning id into v_id;

  insert into public.user_challenge_steps (user_challenge_id, challenge_step_id)
  select v_id, cs.id from public.challenge_steps cs where cs.challenge_id = p_challenge_id and cs.active;

  perform public.refresh_user_challenge_progress(v_id);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. RPC: concluir uma etapa do checklist (com foto/texto quando exigido)
-- ---------------------------------------------------------------------
create or replace function public.complete_challenge_step(
  p_user_challenge_id uuid,
  p_step_id           uuid,
  p_file_path         text,
  p_thumbnail_path    text,
  p_file_name         text,
  p_mime_type         text,
  p_file_size         bigint,
  p_observation       text,
  p_captured_at       date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := public.require_user();
  v_uc      public.user_challenges;
  v_step    public.challenge_steps;
  v_ucs     public.user_challenge_steps;
  v_status  text;
  v_xp      integer := 0;
begin
  select * into v_uc from public.user_challenges
  where id = p_user_challenge_id and user_id = v_user
  for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_uc.status not in ('accepted', 'in_progress') then
    raise exception 'challenge_not_active';
  end if;
  if public.challenge_is_overdue(v_uc.id) then
    raise exception 'challenge_expired';
  end if;

  select * into v_step from public.challenge_steps
  where id = p_step_id and challenge_id = v_uc.challenge_id and active;
  if not found or v_step.step_type = 'follow_up' then
    raise exception 'invalid_step';
  end if;

  select * into v_ucs from public.user_challenge_steps
  where user_challenge_id = v_uc.id and challenge_step_id = v_step.id
  for update;
  if not found then
    insert into public.user_challenge_steps (user_challenge_id, challenge_step_id)
    values (v_uc.id, v_step.id) returning * into v_ucs;
  end if;
  if v_ucs.status = 'completed' then
    raise exception 'step_already_completed';
  end if;

  -- Checklist em ordem: etapas obrigatórias anteriores precisam estar concluídas.
  if exists (
    select 1 from public.challenge_steps cs
    left join public.user_challenge_steps ucs
      on ucs.user_challenge_id = v_uc.id and ucs.challenge_step_id = cs.id
    where cs.challenge_id = v_uc.challenge_id and cs.active and cs.required
      and cs.step_type <> 'follow_up' and cs.order_index < v_step.order_index
      and coalesce(ucs.status, 'pending') <> 'completed'
  ) then
    raise exception 'previous_steps_pending';
  end if;

  if p_captured_at is not null and (
    p_captured_at > public.game_today() + 1
    or p_captured_at < (v_uc.accepted_at at time zone 'America/Sao_Paulo')::date - 1
  ) then
    raise exception 'invalid_date';
  end if;

  perform public.assert_step_evidence(v_step.evidence_kind, p_file_path, p_observation);
  if v_step.evidence_kind <> 'none' then
    perform public.insert_challenge_evidence(
      v_uc, v_step.id, null, p_file_path, p_thumbnail_path, p_file_name, p_mime_type, p_file_size,
      p_observation, p_captured_at
    );
  end if;

  update public.user_challenge_steps
  set status = 'completed', completed_at = now(), notes = public.sanitize_note(p_observation)
  where id = v_ucs.id;

  update public.user_challenges
  set status = 'in_progress', started_at = coalesce(started_at, now())
  where id = v_uc.id and status = 'accepted';

  v_xp := public.award_xp(v_user, v_step.xp_reward, 'action', 'challenge_step', v_ucs.id,
                          'Etapa concluída: ' || v_step.title);

  v_status := public.advance_challenge_after_steps(v_uc.id);
  perform public.refresh_user_challenge_progress(v_uc.id);

  return jsonb_build_object(
    'status', v_status,
    'progress_percentage', (select progress_percentage from public.user_challenges where id = v_uc.id),
    'xp_awarded', v_xp
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 5. RPC: acompanhamento (liberado só perto da data, pelo relógio do servidor)
-- ---------------------------------------------------------------------
drop function public.complete_followup(uuid, text, text, text);

create function public.complete_followup(
  p_followup_id    uuid,
  p_file_path      text,
  p_thumbnail_path text,
  p_file_name      text,
  p_mime_type      text,
  p_file_size      bigint,
  p_observation    text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user      uuid := public.require_user();
  v_followup  public.challenge_followups;
  v_uc        public.user_challenges;
  v_step      public.challenge_steps;
  v_kind      text;
  v_xp        integer := 0;
begin
  select f.* into v_followup
  from public.challenge_followups f
  join public.user_challenges uc on uc.id = f.user_challenge_id
  where f.id = p_followup_id and uc.user_id = v_user
  for update of f;
  if not found then
    raise exception 'not_found';
  end if;
  if v_followup.status <> 'scheduled' then
    raise exception 'followup_already_done';
  end if;

  select * into v_uc from public.user_challenges where id = v_followup.user_challenge_id for update;
  if v_uc.status <> 'waiting_follow_up' then
    raise exception 'challenge_not_active';
  end if;

  select * into v_step from public.challenge_steps where id = v_followup.challenge_step_id;
  if v_followup.scheduled_for - make_interval(days => coalesce(v_step.early_window_days, 0)) > now() then
    raise exception 'followup_not_due';
  end if;

  v_kind := coalesce(v_step.evidence_kind, case when v_followup.evidence_required then 'photo' else 'text' end);
  perform public.assert_step_evidence(v_kind, p_file_path, p_observation);
  if p_file_path is not null or public.sanitize_note(p_observation) is not null then
    perform public.insert_challenge_evidence(
      v_uc, v_followup.challenge_step_id, p_followup_id, p_file_path, p_thumbnail_path,
      p_file_name, p_mime_type, p_file_size, p_observation, public.game_today()
    );
  end if;

  update public.challenge_followups
  set status = 'completed', completed_at = now()
  where id = p_followup_id;

  if v_followup.challenge_step_id is not null then
    update public.user_challenge_steps
    set status = 'completed', completed_at = now(), notes = public.sanitize_note(p_observation)
    where user_challenge_id = v_uc.id and challenge_step_id = v_followup.challenge_step_id;

    v_xp := public.award_xp(v_user, coalesce(v_step.xp_reward, 0), 'follow_up', 'follow_up', p_followup_id,
                            'Acompanhamento: ' || v_followup.title);
  end if;

  perform public.refresh_user_challenge_progress(v_uc.id);

  return jsonb_build_object(
    'xp_awarded', v_xp,
    'pending_followups', (select count(*) from public.challenge_followups
                          where user_challenge_id = v_uc.id and status = 'scheduled'),
    'achievements', public.check_achievements(v_user)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 6. RPC: concluir desafio — valida tudo e recompensa UMA vez (idempotente)
-- ---------------------------------------------------------------------
create or replace function public.complete_challenge(p_user_challenge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user       uuid := public.require_user();
  v_uc         public.user_challenges;
  v_challenge  public.challenges;
  v_xp         integer;
  v_items      jsonb;
begin
  -- Trava a linha: cliques simultâneos esperam e veem o desafio já concluído.
  select * into v_uc from public.user_challenges
  where id = p_user_challenge_id and user_id = v_user
  for update;
  if not found then
    raise exception 'not_found';
  end if;

  if v_uc.status = 'completed' then
    return jsonb_build_object('already_completed', true, 'xp_awarded', 0,
                              'world_items', '[]'::jsonb, 'achievements', '[]'::jsonb);
  end if;
  if v_uc.status not in ('accepted', 'in_progress', 'waiting_follow_up') then
    raise exception 'challenge_not_active';
  end if;
  if public.challenge_is_overdue(v_uc.id) then
    raise exception 'challenge_expired';
  end if;
  if not public.challenge_main_steps_done(v_uc.id) then
    raise exception 'steps_pending';
  end if;
  if exists (
    select 1 from public.challenge_followups f
    join public.challenge_steps cs on cs.id = f.challenge_step_id
    where f.user_challenge_id = v_uc.id and f.status <> 'completed' and cs.required and cs.active
  ) or exists (
    -- acompanhamentos obrigatórios ainda nem agendados
    select 1 from public.challenge_steps cs
    where cs.challenge_id = v_uc.challenge_id and cs.step_type = 'follow_up' and cs.active and cs.required
      and not exists (select 1 from public.challenge_followups f
                      where f.user_challenge_id = v_uc.id and f.challenge_step_id = cs.id)
  ) then
    raise exception 'followups_pending';
  end if;

  select * into v_challenge from public.challenges where id = v_uc.challenge_id;

  update public.user_challenge_steps ucs
  set status = 'completed', completed_at = now()
  from public.challenge_steps cs
  where cs.id = ucs.challenge_step_id and ucs.user_challenge_id = v_uc.id
    and cs.step_type = 'completion' and ucs.status <> 'completed';

  update public.user_challenges
  set status = 'completed',
      completed_at = coalesce(completed_at, now()),
      started_at = coalesce(started_at, now())
  where id = v_uc.id;
  perform public.refresh_user_challenge_progress(v_uc.id);

  -- Recompensa: idempotente por (usuário, 'challenge', user_challenge).
  v_xp := public.award_xp(v_user, v_challenge.xp_reward, 'action', 'challenge', v_uc.id,
                          'Desafio concluído: ' || v_challenge.title);
  v_items := public.unlock_world_items_for_challenge(v_user, v_challenge.slug);

  return jsonb_build_object(
    'already_completed', false,
    'xp_awarded',   v_xp,
    'world_items',  v_items,
    'achievements', public.check_achievements(v_user)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 7. RPC: encerrar (cancelar) um desafio ativo
-- ---------------------------------------------------------------------
create or replace function public.cancel_challenge(p_user_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
begin
  update public.user_challenges
  set status = 'cancelled'
  where id = p_user_challenge_id and user_id = v_user
    and status in ('accepted', 'in_progress', 'waiting_follow_up');
  if not found then
    raise exception 'challenge_not_active';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. Manutenção (para um agendamento futuro, ex.: pg_cron) — sem acesso do usuário
-- ---------------------------------------------------------------------
create or replace function public.expire_overdue_challenges()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.user_challenges uc set status = 'expired'
  where uc.status in ('accepted', 'in_progress')
    and uc.deadline_at < now()
    and not public.challenge_main_steps_done(uc.id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- O envio antigo do "Dia 0" foi substituído pelo checklist.
drop function if exists public.submit_challenge_evidence(uuid, text, text, text, date);

-- ---------------------------------------------------------------------
-- 9. Estado do jogador: etapas com notas, evidências com metadados, hora do servidor
-- ---------------------------------------------------------------------
create or replace function public.get_player_state()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
begin
  return jsonb_build_object(
    'server_time', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.user_id = v_user),

    'lessons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'lesson_id', l.lesson_id, 'status', l.status, 'progress_percentage', l.progress_percentage,
        'last_section_index', l.last_section_index, 'last_accessed_at', l.last_accessed_at,
        'completed_at', l.completed_at
      ))
      from public.user_lesson_progress l where l.user_id = v_user
    ), '[]'::jsonb),

    'favorites', coalesce((
      select jsonb_agg(f.lesson_id order by f.created_at desc)
      from public.user_lesson_favorites f where f.user_id = v_user
    ), '[]'::jsonb),

    'quizzes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'quiz_id', b.quiz_id, 'score', b.score, 'correct_answers', b.correct_answers,
        'total_questions', b.total_questions, 'passed', b.passed, 'completed_at', b.completed_at,
        'attempts', (select count(*) from public.quiz_attempts c
                     where c.user_id = v_user and c.quiz_id = b.quiz_id and c.completed_at is not null)
      ))
      from (
        select distinct on (a.quiz_id) a.*
        from public.quiz_attempts a
        where a.user_id = v_user and a.completed_at is not null
        order by a.quiz_id, a.passed desc, a.score desc, a.completed_at desc
      ) b
    ), '[]'::jsonb),

    'challenges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', uc.id, 'challenge_id', uc.challenge_id, 'status', uc.status,
        'accepted_at', uc.accepted_at, 'deadline_at', uc.deadline_at, 'started_at', uc.started_at,
        'completed_at', uc.completed_at, 'progress_percentage', uc.progress_percentage,
        'steps', coalesce((
          select jsonb_agg(jsonb_build_object(
            'challenge_step_id', s.challenge_step_id, 'status', s.status,
            'completed_at', s.completed_at, 'notes', s.notes
          ))
          from public.user_challenge_steps s where s.user_challenge_id = uc.id
        ), '[]'::jsonb),
        'followups', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', f.id, 'challenge_step_id', f.challenge_step_id, 'title', f.title,
            'description', f.description, 'scheduled_for', f.scheduled_for,
            'completed_at', f.completed_at, 'status', f.status, 'evidence_required', f.evidence_required
          ) order by f.scheduled_for)
          from public.challenge_followups f where f.user_challenge_id = uc.id
        ), '[]'::jsonb),
        'evidence', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', e.id, 'followup_id', e.followup_id, 'challenge_step_id', e.challenge_step_id,
            'evidence_type', e.evidence_type, 'file_url', e.file_url, 'thumbnail_url', e.thumbnail_url,
            'file_name', e.file_name, 'mime_type', e.mime_type, 'file_size', e.file_size,
            'description', e.description, 'captured_at', e.captured_at, 'uploaded_at', e.uploaded_at,
            'status', e.status, 'created_at', e.created_at
          ) order by e.created_at)
          from public.challenge_evidence e where e.user_challenge_id = uc.id
        ), '[]'::jsonb)
      ))
      from public.user_challenges uc
      where uc.user_id = v_user and uc.status not in ('expired', 'cancelled')
    ), '[]'::jsonb),

    'achievements', coalesce((
      select jsonb_agg(jsonb_build_object('achievement_id', ua.achievement_id, 'unlocked_at', ua.unlocked_at))
      from public.user_achievements ua where ua.user_id = v_user
    ), '[]'::jsonb),

    'world', (
      select jsonb_build_object(
        'id', w.id, 'name', w.name, 'level', w.level, 'environment_score', w.environment_score,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', i.id, 'world_item_id', i.world_item_id, 'quantity', i.quantity,
            'position_x', i.position_x, 'position_y', i.position_y,
            'metadata', i.metadata, 'unlocked_at', i.unlocked_at
          ))
          from public.user_world_items i where i.world_id = w.id
        ), '[]'::jsonb)
      )
      from public.worlds w where w.user_id = v_user
    )
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 10. Permissões
-- ---------------------------------------------------------------------
revoke execute on function public.game_today(),
                           public.sanitize_note(text),
                           public.challenge_main_steps_done(uuid),
                           public.challenge_is_overdue(uuid),
                           public.insert_challenge_evidence(public.user_challenges, uuid, uuid, text, text, text, text, bigint, text, date),
                           public.assert_step_evidence(text, text, text),
                           public.advance_challenge_after_steps(uuid),
                           public.expire_overdue_challenges(),
                           public.complete_challenge_step(uuid, uuid, text, text, text, text, bigint, text, date),
                           public.complete_followup(uuid, text, text, text, text, bigint, text),
                           public.cancel_challenge(uuid)
  from public, anon, authenticated;

grant execute on function public.complete_challenge_step(uuid, uuid, text, text, text, text, bigint, text, date) to authenticated;
grant execute on function public.complete_followup(uuid, text, text, text, text, bigint, text) to authenticated;
grant execute on function public.cancel_challenge(uuid) to authenticated;
grant execute on function public.accept_challenge(uuid) to authenticated;
grant execute on function public.complete_challenge(uuid) to authenticated;
grant execute on function public.get_player_state() to authenticated;

-- >>> 20_challenge_content.sql
-- =====================================================================
-- 20 · Desafios ecológicos (Etapa 5)
-- =====================================================================
-- ARQUIVO GERADO por "npm run content:sql" a partir de content/challenges.json.
-- Não edite à mão. Idempotente: atualiza desafios e etapas existentes (mantendo
-- os IDs e o progresso dos jogadores); etapas removidas ficam inativas.

-- Plante uma árvore
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '🌳', 'Plante uma árvore', 'plante-uma-arvore',
  'Plante uma árvore adequada ao ambiente disponível e acompanhe o desenvolvimento dela por seis meses.', 'Um lugar com sol, espaço para a árvore adulta e longe de fios, canos e muros.
Prefira uma espécie nativa da sua região. Peça orientação em um viveiro.
Cave uma cova um pouco maior que o torrão da muda e solte a terra.
Posicione a muda sem enterrar o caule, cubra com terra, firme, regue e prenda ao tutor.
Tire uma foto da muda plantada.
Informe a data do plantio, a espécie e o local.', 'Crianças devem plantar com a ajuda de um adulto.
Não plante em áreas de preservação ou em terrenos alheios sem permissão.
Em calçadas e praças, consulte a prefeitura antes.',
  'medio', 15, 100, true, true, true,
  'Árvores oferecem sombra, abrigo e alimento para muitas espécies, protegem o solo e ajudam a água da chuva a infiltrar. Uma muda bem escolhida e bem cuidada pode viver por muitos anos.', 'Uma muda de espécie nativa da sua região
Um local com espaço para raízes e copa
Pá ou ferramenta para cavar
Água para regar
Uma estaca (tutor) e barbante
Luvas', 'Envie uma foto da muda plantada e informe a data, a espécie e o local. Nos acompanhamentos, envie uma nova foto mostrando como a árvore está.', '1 dia + acompanhamentos (30, 90 e 180 dias)')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000001') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000001') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000001' and id not in ('41000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000008', '41000000-0000-4000-8000-000000000009', '41000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000010', '41000000-0000-4000-8000-000000000005', '41000000-0000-4000-8000-000000000006', '41000000-0000-4000-8000-000000000007');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Escolher o local', 'Um lugar com sol, espaço para a árvore adulta e longe de fios, canos e muros.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-000000000008', '40000000-0000-4000-8000-000000000001', 'Escolher a espécie', 'Prefira uma espécie nativa da sua região. Peça orientação em um viveiro.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-000000000009', '40000000-0000-4000-8000-000000000001', 'Preparar o solo', 'Cave uma cova um pouco maior que o torrão da muda e solte a terra.', 'action', 3, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 'Plantar a muda', 'Posicione a muda sem enterrar o caule, cubra com terra, firme, regue e prenda ao tutor.', 'action', 4, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001', 'Registrar fotografia', 'Tire uma foto da muda plantada.', 'evidence', 5, true, 5, null, 2, 'photo', null, true),
  ('41000000-0000-4000-8000-000000000010', '40000000-0000-4000-8000-000000000001', 'Registrar informações', 'Informe a data do plantio, a espécie e o local.', 'evidence', 6, true, 5, null, 2, 'text', null, true),
  ('41000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000001', 'Primeiro acompanhamento', 'A muda sobreviveu? Envie uma foto de como ela está depois de um mês.', 'follow_up', 7, true, 20, 30, 2, 'photo', null, true),
  ('41000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000001', 'Segundo acompanhamento', 'Três meses de cuidado! Registre o crescimento.', 'follow_up', 8, true, 20, 90, 2, 'photo', null, true),
  ('41000000-0000-4000-8000-000000000007', '40000000-0000-4000-8000-000000000001', 'Acompanhamento final', 'Seis meses! Registre como a árvore se desenvolveu.', 'follow_up', 9, true, 20, 180, 2, 'photo', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Cultive uma flor
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '🌸', 'Cultive uma flor', 'cultive-uma-flor',
  'Cultive uma flor, cuide dela e observe o desenvolvimento durante um mês.', 'Escolha uma flor adequada ao clima e à luz que você tem disponível.
Use um vaso com furos ou um canteiro com terra fofa.
Plante as sementes ou a muda na profundidade indicada e regue.
Tire uma foto do que você plantou.
Conte qual flor você escolheu e onde ela ficou.', 'Prefira espécies adequadas ao seu clima.
Evite regar demais: o solo encharcado prejudica as raízes.',
  'facil', 10, 100, true, true, true,
  'Flores alimentam abelhas, borboletas e outros polinizadores. Cuidar de uma planta desde o início ensina na prática o que ela precisa para crescer.', 'Sementes ou muda de uma flor
Vaso com furos ou um canteiro
Terra com matéria orgânica
Água', 'Envie uma foto da flor plantada e, depois de um mês, uma nova foto mostrando o desenvolvimento.', '1 dia + acompanhamento de 30 dias')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000002') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000002') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000002' and id not in ('41000000-0000-4000-8000-002000000001', '41000000-0000-4000-8000-002000000002', '41000000-0000-4000-8000-002000000003', '41000000-0000-4000-8000-002000000004', '41000000-0000-4000-8000-002000000005', '41000000-0000-4000-8000-002000000006');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-002000000001', '40000000-0000-4000-8000-000000000002', 'Escolher a espécie', 'Escolha uma flor adequada ao clima e à luz que você tem disponível.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-002000000002', '40000000-0000-4000-8000-000000000002', 'Preparar o recipiente ou o solo', 'Use um vaso com furos ou um canteiro com terra fofa.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-002000000003', '40000000-0000-4000-8000-000000000002', 'Plantar', 'Plante as sementes ou a muda na profundidade indicada e regue.', 'action', 3, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-002000000004', '40000000-0000-4000-8000-000000000002', 'Fotografar', 'Tire uma foto do que você plantou.', 'evidence', 4, true, 5, null, 2, 'photo', null, true),
  ('41000000-0000-4000-8000-002000000005', '40000000-0000-4000-8000-000000000002', 'Registrar observações', 'Conte qual flor você escolheu e onde ela ficou.', 'evidence', 5, true, 5, null, 2, 'text', null, true),
  ('41000000-0000-4000-8000-002000000006', '40000000-0000-4000-8000-000000000002', 'Acompanhamento de 30 dias', 'Como a flor se desenvolveu? Envie uma nova foto.', 'follow_up', 6, true, 20, 30, 2, 'photo', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Crie uma pequena horta
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', '🥬', 'Crie uma pequena horta', 'crie-uma-pequena-horta',
  'Crie uma pequena área para cultivar alimentos, como temperos ou hortaliças, e registre a evolução.', 'Um lugar com sol e água por perto.
Use terra fofa e com matéria orgânica.
Comece com plantas fáceis, como cebolinha, alface e manjericão.
Plante e regue.
Envie uma foto da horta pronta.', 'Escolha um lugar com algumas horas de sol direto.
Crianças devem usar ferramentas com a ajuda de um adulto.',
  'medio', 14, 100, true, true, true,
  'Uma horta aproxima você da origem dos alimentos, reaproveita restos orgânicos como adubo e pode atrair polinizadores.', 'Vasos, caixotes ou um canteiro
Terra com matéria orgânica
Mudas ou sementes (cebolinha, alface, manjericão…)
Água', 'Envie uma foto da horta pronta e, três semanas depois, uma foto mostrando a evolução.', '2 dias + acompanhamento de 21 dias')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000003') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000003') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000003' and id not in ('41000000-0000-4000-8000-003000000001', '41000000-0000-4000-8000-003000000002', '41000000-0000-4000-8000-003000000003', '41000000-0000-4000-8000-003000000004', '41000000-0000-4000-8000-003000000005', '41000000-0000-4000-8000-003000000006');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-003000000001', '40000000-0000-4000-8000-000000000003', 'Escolher o espaço', 'Um lugar com sol e água por perto.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-003000000002', '40000000-0000-4000-8000-000000000003', 'Preparar recipiente ou solo', 'Use terra fofa e com matéria orgânica.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-003000000003', '40000000-0000-4000-8000-000000000003', 'Escolher as plantas', 'Comece com plantas fáceis, como cebolinha, alface e manjericão.', 'action', 3, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-003000000004', '40000000-0000-4000-8000-000000000003', 'Plantar', 'Plante e regue.', 'action', 4, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-003000000005', '40000000-0000-4000-8000-000000000003', 'Registrar a horta', 'Envie uma foto da horta pronta.', 'evidence', 5, true, 5, null, 2, 'photo', null, true),
  ('41000000-0000-4000-8000-003000000006', '40000000-0000-4000-8000-000000000003', 'Registrar evolução', 'Três semanas depois: como estão as plantas?', 'follow_up', 6, true, 20, 21, 2, 'photo', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Reduza o desperdício de água
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000004', '💧', 'Reduza o desperdício de água', 'reduza-o-desperdicio-de-agua',
  'Identifique desperdícios de água em casa, aplique medidas de economia e avalie o resultado depois de alguns dias.', 'Observe torneiras, chuveiro, descarga, mangueira e vazamentos. Anote o que encontrou.
Escolha pelo menos duas medidas de economia para aplicar.
Coloque as medidas em prática e fotografe uma delas.
Conte quais medidas você aplicou e quem participou.', 'Vazamentos devem ser consertados por um adulto ou profissional.',
  'facil', 7, 100, true, true, true,
  'A água doce disponível é uma pequena parte da água do planeta, e tratá-la e bombeá-la até as casas usa energia. Pequenas mudanças de hábito evitam desperdício todos os dias.', 'Papel e caneta (ou o celular) para anotar
Atenção aos hábitos da casa', 'Descreva os desperdícios encontrados e as medidas aplicadas. Envie uma foto de uma das medidas (opcional na avaliação).', '1 dia + avaliação após 5 dias')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000004') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000004') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000004' and id not in ('41000000-0000-4000-8000-004000000001', '41000000-0000-4000-8000-004000000002', '41000000-0000-4000-8000-004000000003', '41000000-0000-4000-8000-004000000004', '41000000-0000-4000-8000-004000000005');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-004000000001', '40000000-0000-4000-8000-000000000004', 'Identificar desperdícios', 'Observe torneiras, chuveiro, descarga, mangueira e vazamentos. Anote o que encontrou.', 'evidence', 1, true, 5, null, 2, 'text', null, true),
  ('41000000-0000-4000-8000-004000000002', '40000000-0000-4000-8000-000000000004', 'Escolher medidas', 'Escolha pelo menos duas medidas de economia para aplicar.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-004000000003', '40000000-0000-4000-8000-000000000004', 'Aplicar as medidas', 'Coloque as medidas em prática e fotografe uma delas.', 'evidence', 3, true, 5, null, 2, 'photo', null, true),
  ('41000000-0000-4000-8000-004000000004', '40000000-0000-4000-8000-000000000004', 'Registrar ações', 'Conte quais medidas você aplicou e quem participou.', 'evidence', 4, true, 5, null, 2, 'text', null, true),
  ('41000000-0000-4000-8000-004000000005', '40000000-0000-4000-8000-000000000004', 'Avaliação após alguns dias', 'As medidas continuaram? O que funcionou melhor?', 'follow_up', 5, true, 20, 5, 0, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Separe seus resíduos por 7 dias
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000006', '♻️', 'Separe seus resíduos por 7 dias', 'separe-seus-residuos-por-7-dias',
  'Durante 7 dias, separe recicláveis, orgânicos e rejeitos e registre diariamente o que observou.', 'Prepare recipientes para recicláveis, orgânicos e rejeitos.
Tire uma foto dos recipientes prontos.', 'Não manipule vidro quebrado ou objetos cortantes com as mãos.
Lave e seque as embalagens antes de separá-las.',
  'medio', 3, 100, true, true, true,
  'Separar os resíduos permite que os recicláveis voltem à indústria como matéria-prima e mostra, na prática, quanto lixo produzimos — o primeiro passo para reduzir.', 'Dois ou três recipientes para separar os resíduos
Etiquetas ou identificação das cores da coleta seletiva', 'Envie uma foto dos recipientes de separação e, a cada dia, uma observação sobre recicláveis, orgânicos, rejeitos e ações de redução ou reutilização.', '7 dias com registro diário')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000005') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000005') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000005' and id not in ('41000000-0000-4000-8000-005000000001', '41000000-0000-4000-8000-005000000002', '41000000-0000-4000-8000-005000000003', '41000000-0000-4000-8000-005000000004', '41000000-0000-4000-8000-005000000005', '41000000-0000-4000-8000-005000000006', '41000000-0000-4000-8000-005000000007', '41000000-0000-4000-8000-005000000008', '41000000-0000-4000-8000-005000000009');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-005000000001', '40000000-0000-4000-8000-000000000005', 'Organizar a separação', 'Prepare recipientes para recicláveis, orgânicos e rejeitos.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-005000000002', '40000000-0000-4000-8000-000000000005', 'Fotografar a separação', 'Tire uma foto dos recipientes prontos.', 'evidence', 2, true, 5, null, 2, 'photo', null, true),
  ('41000000-0000-4000-8000-005000000003', '40000000-0000-4000-8000-000000000005', 'Registro do dia 1', 'O que você separou hoje? Houve alguma ação de redução ou reutilização?', 'follow_up', 3, true, 5, 1, 0, 'text', null, true),
  ('41000000-0000-4000-8000-005000000004', '40000000-0000-4000-8000-000000000005', 'Registro do dia 2', 'O que você separou hoje?', 'follow_up', 4, true, 5, 2, 0, 'text', null, true),
  ('41000000-0000-4000-8000-005000000005', '40000000-0000-4000-8000-000000000005', 'Registro do dia 3', 'O que você separou hoje?', 'follow_up', 5, true, 5, 3, 0, 'text', null, true),
  ('41000000-0000-4000-8000-005000000006', '40000000-0000-4000-8000-000000000005', 'Registro do dia 4', 'O que você separou hoje?', 'follow_up', 6, true, 5, 4, 0, 'text', null, true),
  ('41000000-0000-4000-8000-005000000007', '40000000-0000-4000-8000-000000000005', 'Registro do dia 5', 'O que você separou hoje?', 'follow_up', 7, true, 5, 5, 0, 'text', null, true),
  ('41000000-0000-4000-8000-005000000008', '40000000-0000-4000-8000-000000000005', 'Registro do dia 6', 'O que você separou hoje?', 'follow_up', 8, true, 5, 6, 0, 'text', null, true),
  ('41000000-0000-4000-8000-005000000009', '40000000-0000-4000-8000-000000000005', 'Registro do dia 7', 'Último dia! O que mudou na sua forma de descartar?', 'follow_up', 9, true, 5, 7, 0, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Semana do consumo consciente
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000008', '⚡', 'Semana do consumo consciente', 'semana-do-consumo-consciente',
  'Durante 7 dias, observe seus hábitos de consumo de energia e reduza desperdícios.', 'Observe luzes acesas, aparelhos em standby, banhos longos e a geladeira. Anote o que encontrou.
Escolha pelo menos duas metas para a semana (ex.: apagar luzes, tirar carregadores da tomada).', 'Não mexa em instalações elétricas: peça ajuda a um adulto.',
  'facil', 3, 100, true, true, true,
  'Toda forma de gerar eletricidade causa algum impacto. Perceber onde a energia é desperdiçada é o caminho mais simples para consumir menos.', 'Atenção aos aparelhos e hábitos da casa
Papel e caneta (ou o celular) para anotar', 'Registre os hábitos observados, as metas escolhidas e, a cada dia, uma observação sobre o que você fez.', '7 dias com registro diário')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000006') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000006') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000006' and id not in ('41000000-0000-4000-8000-006000000001', '41000000-0000-4000-8000-006000000002', '41000000-0000-4000-8000-006000000003', '41000000-0000-4000-8000-006000000004', '41000000-0000-4000-8000-006000000005', '41000000-0000-4000-8000-006000000006', '41000000-0000-4000-8000-006000000007', '41000000-0000-4000-8000-006000000008', '41000000-0000-4000-8000-006000000009');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-006000000001', '40000000-0000-4000-8000-000000000006', 'Identificar hábitos', 'Observe luzes acesas, aparelhos em standby, banhos longos e a geladeira. Anote o que encontrou.', 'evidence', 1, true, 5, null, 2, 'text', null, true),
  ('41000000-0000-4000-8000-006000000002', '40000000-0000-4000-8000-000000000006', 'Escolher metas', 'Escolha pelo menos duas metas para a semana (ex.: apagar luzes, tirar carregadores da tomada).', 'evidence', 2, true, 5, null, 2, 'text', null, true),
  ('41000000-0000-4000-8000-006000000003', '40000000-0000-4000-8000-000000000006', 'Registro do dia 1', 'Como foi o dia? Você cumpriu suas metas?', 'follow_up', 3, true, 5, 1, 0, 'text', null, true),
  ('41000000-0000-4000-8000-006000000004', '40000000-0000-4000-8000-000000000006', 'Registro do dia 2', 'Como foi o dia?', 'follow_up', 4, true, 5, 2, 0, 'text', null, true),
  ('41000000-0000-4000-8000-006000000005', '40000000-0000-4000-8000-000000000006', 'Registro do dia 3', 'Como foi o dia?', 'follow_up', 5, true, 5, 3, 0, 'text', null, true),
  ('41000000-0000-4000-8000-006000000006', '40000000-0000-4000-8000-000000000006', 'Registro do dia 4', 'Como foi o dia?', 'follow_up', 6, true, 5, 4, 0, 'text', null, true),
  ('41000000-0000-4000-8000-006000000007', '40000000-0000-4000-8000-000000000006', 'Registro do dia 5', 'Como foi o dia?', 'follow_up', 7, true, 5, 5, 0, 'text', null, true),
  ('41000000-0000-4000-8000-006000000008', '40000000-0000-4000-8000-000000000006', 'Registro do dia 6', 'Como foi o dia?', 'follow_up', 8, true, 5, 6, 0, 'text', null, true),
  ('41000000-0000-4000-8000-006000000009', '40000000-0000-4000-8000-000000000006', 'Registro do dia 7', 'Último dia! Quais hábitos você pretende manter?', 'follow_up', 9, true, 5, 7, 0, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Crie um espaço para polinizadores
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000011', '🐝', 'Crie um espaço para polinizadores', 'crie-um-espaco-para-polinizadores',
  'Crie um pequeno espaço com plantas floríferas que possam favorecer abelhas, borboletas e outros polinizadores.', 'Um lugar com sol, protegido de vento forte.
Prefira flores variadas, de preferência nativas, que floresçam em épocas diferentes.
Plante e regue.
Tire uma foto do espaço pronto.', 'Não use agrotóxicos no espaço.
Observe os insetos de longe e sem tocar neles.
Troque a água do pratinho com frequência para não acumular mosquitos.',
  'medio', 14, 100, true, true, true,
  'Polinizadores dependem de flores para se alimentar, e muitas plantas — inclusive alimentos — dependem deles. Mesmo um vaso com flores variadas ajuda.', 'Vasos ou um canteiro
Mudas ou sementes de flores variadas (de preferência nativas)
Terra e água
Um pratinho raso com pedrinhas e água (opcional)', 'Registre o local, as plantas escolhidas e uma foto do espaço. Depois de um mês, conte o que observou e envie uma nova foto.', '2 dias + acompanhamento de 30 dias')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000007') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000007') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000007' and id not in ('41000000-0000-4000-8000-007000000001', '41000000-0000-4000-8000-007000000002', '41000000-0000-4000-8000-007000000003', '41000000-0000-4000-8000-007000000004', '41000000-0000-4000-8000-007000000005');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-007000000001', '40000000-0000-4000-8000-000000000007', 'Escolher o local', 'Um lugar com sol, protegido de vento forte.', 'evidence', 1, true, 5, null, 2, 'text', null, true),
  ('41000000-0000-4000-8000-007000000002', '40000000-0000-4000-8000-000000000007', 'Escolher as plantas', 'Prefira flores variadas, de preferência nativas, que floresçam em épocas diferentes.', 'evidence', 2, true, 5, null, 2, 'text', null, true),
  ('41000000-0000-4000-8000-007000000003', '40000000-0000-4000-8000-000000000007', 'Plantar', 'Plante e regue.', 'action', 3, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-007000000004', '40000000-0000-4000-8000-000000000007', 'Fotografar o espaço', 'Tire uma foto do espaço pronto.', 'evidence', 4, true, 5, null, 2, 'photo', null, true),
  ('41000000-0000-4000-8000-007000000005', '40000000-0000-4000-8000-000000000007', 'Registrar evolução', 'Depois de um mês: as plantas floresceram? Algum polinizador apareceu?', 'follow_up', 5, true, 20, 30, 2, 'photo', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Participe de uma ação ambiental
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000012', '🤝', 'Participe de uma ação ambiental', 'participe-de-uma-acao-ambiental',
  'Participe de uma ação ambiental real na sua comunidade: limpeza, plantio coletivo, horta comunitária, ação educativa ou recuperação de área.', 'Procure uma ação na escola, no bairro, em associações ou em projetos ambientais.
Participe da ação e tire uma foto.
Conte o que foi feito, onde e com quem.', 'Crianças sempre acompanhadas de adultos.
Use luvas e nunca recolha objetos cortantes com as mãos.',
  'medio', 30, 100, true, true, false,
  'Ações coletivas transformam lugares que ninguém cuidaria sozinho — e fortalecem a comunidade.', 'Luvas
Roupas adequadas e protetor solar
Água para beber', 'Envie uma foto da ação e descreva o que foi feito, onde e com quem.', '1 dia')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000008') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000008') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000008' and id not in ('41000000-0000-4000-8000-008000000001', '41000000-0000-4000-8000-008000000002', '41000000-0000-4000-8000-008000000003');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-008000000001', '40000000-0000-4000-8000-000000000008', 'Encontrar uma ação', 'Procure uma ação na escola, no bairro, em associações ou em projetos ambientais.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-008000000002', '40000000-0000-4000-8000-000000000008', 'Participar', 'Participe da ação e tire uma foto.', 'evidence', 2, true, 5, null, 2, 'photo', null, true),
  ('41000000-0000-4000-8000-008000000003', '40000000-0000-4000-8000-000000000008', 'Descrever a ação', 'Conte o que foi feito, onde e com quem.', 'evidence', 3, true, 5, null, 2, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Dobre suas roupas
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000012', '👕', 'Dobre suas roupas', 'dobre-suas-roupas',
  'Dobre e guarde suas roupas limpas para ajudar a manter a casa organizada.', 'Junte as roupas limpas que precisam ser dobradas.
Dobre cada peça com cuidado.
Conte quais roupas você dobrou e onde guardou.', 'Peça ajuda a um adulto para alcançar lugares altos.',
  'facil', 3, 35, true, true, false,
  'Cuidar das próprias coisas ajuda a dividir as tarefas de casa e evita que as roupas fiquem amassadas ou se percam.', 'Roupas limpas
Uma gaveta, prateleira ou armário', 'Conte quais roupas você dobrou e onde guardou.', '1 dia')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000009') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000009') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000009' and id not in ('41000000-0000-4000-8000-009000000001', '41000000-0000-4000-8000-009000000002', '41000000-0000-4000-8000-009000000003');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-009000000001', '40000000-0000-4000-8000-000000000009', 'Separar as roupas', 'Junte as roupas limpas que precisam ser dobradas.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-009000000002', '40000000-0000-4000-8000-000000000009', 'Dobrar as roupas', 'Dobre cada peça com cuidado.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-009000000003', '40000000-0000-4000-8000-000000000009', 'Registrar a tarefa', 'Conte quais roupas você dobrou e onde guardou.', 'evidence', 3, true, 5, null, 2, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Arrume sua cama
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000012', '🛏️', 'Arrume sua cama', 'arrume-sua-cama',
  'Ao acordar, deixe sua cama organizada para começar o dia cuidando do seu espaço.', 'Estique o lençol sobre o colchão.
Dobre ou estique o cobertor e coloque o travesseiro no lugar.
Conte como ficou sua cama depois de arrumada.', 'Peça ajuda a um adulto se precisar subir ou alcançar uma cama alta.',
  'facil', 2, 30, true, true, false,
  'Pequenas responsabilidades diárias deixam o ambiente mais agradável e mostram como cada pessoa pode colaborar em casa.', 'Lençol
Cobertor
Travesseiro', 'Conte como você arrumou sua cama.', '1 dia')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000010') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000010') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000010' and id not in ('41000000-0000-4000-8000-010000000001', '41000000-0000-4000-8000-010000000002', '41000000-0000-4000-8000-010000000003');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-010000000001', '40000000-0000-4000-8000-000000000010', 'Organizar o lençol', 'Estique o lençol sobre o colchão.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-010000000002', '40000000-0000-4000-8000-000000000010', 'Arrumar cobertor e travesseiro', 'Dobre ou estique o cobertor e coloque o travesseiro no lugar.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-010000000003', '40000000-0000-4000-8000-000000000010', 'Registrar a tarefa', 'Conte como ficou sua cama depois de arrumada.', 'evidence', 3, true, 5, null, 2, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Varra um cômodo da casa
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000012', '🧹', 'Varra um cômodo da casa', 'varra-um-comodo-da-casa',
  'Ajude a limpar um cômodo varrendo o chão com atenção e cuidado.', 'Combine com um adulto qual cômodo você pode varrer.
Passe a vassoura devagar, juntando a sujeira em um canto.
Use a pá e descarte a sujeira no lugar combinado.
Conte qual cômodo você varreu e o que encontrou.', 'Peça ajuda a um adulto e não use produtos de limpeza sem autorização.
Não recolha objetos cortantes ou desconhecidos com as mãos.',
  'facil', 3, 40, true, true, false,
  'Manter os espaços limpos é uma forma concreta de cuidar do lugar onde todos vivem.', 'Vassoura
Pá de lixo
Saco de lixo', 'Conte qual cômodo você varreu e o que encontrou no chão.', '1 dia')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000011') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000011') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000011' and id not in ('41000000-0000-4000-8000-011000000001', '41000000-0000-4000-8000-011000000002', '41000000-0000-4000-8000-011000000003', '41000000-0000-4000-8000-011000000004');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-011000000001', '40000000-0000-4000-8000-000000000011', 'Escolher o cômodo', 'Combine com um adulto qual cômodo você pode varrer.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-011000000002', '40000000-0000-4000-8000-000000000011', 'Varrer o chão', 'Passe a vassoura devagar, juntando a sujeira em um canto.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-011000000003', '40000000-0000-4000-8000-000000000011', 'Guardar a sujeira', 'Use a pá e descarte a sujeira no lugar combinado.', 'action', 3, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-011000000004', '40000000-0000-4000-8000-000000000011', 'Registrar a tarefa', 'Conte qual cômodo você varreu e o que encontrou.', 'evidence', 4, true, 5, null, 2, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Organize seus brinquedos
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000012', '🧸', 'Organize seus brinquedos', 'organize-seus-brinquedos',
  'Separe, guarde e deixe seus brinquedos prontos para a próxima brincadeira.', 'Junte os brinquedos espalhados e separe os que são parecidos.
Coloque cada grupo na caixa, no cesto ou na prateleira combinada.
Conte como você organizou seus brinquedos.', 'Peça ajuda a um adulto para guardar objetos pesados ou em lugares altos.',
  'facil', 3, 35, true, true, false,
  'Organizar e cuidar dos brinquedos ajuda a conservá-los e facilita encontrar o que você precisa sem comprar outro.', 'Brinquedos
Caixas, cestos ou prateleiras', 'Conte como você separou e guardou seus brinquedos.', '1 dia')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000012') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000012') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000012' and id not in ('41000000-0000-4000-8000-012000000001', '41000000-0000-4000-8000-012000000002', '41000000-0000-4000-8000-012000000003');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-012000000001', '40000000-0000-4000-8000-000000000012', 'Separar os brinquedos', 'Junte os brinquedos espalhados e separe os que são parecidos.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-012000000002', '40000000-0000-4000-8000-000000000012', 'Guardar cada grupo', 'Coloque cada grupo na caixa, no cesto ou na prateleira combinada.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-012000000003', '40000000-0000-4000-8000-000000000012', 'Registrar a tarefa', 'Conte como você organizou seus brinquedos.', 'evidence', 3, true, 5, null, 2, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Ajude a lavar a louça
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000012', '🍽️', 'Ajude a lavar a louça', 'ajude-a-lavar-a-louca',
  'Ajude a deixar a louça limpa e a cozinha organizada depois de uma refeição.', 'Com um adulto, separe apenas os itens que você pode lavar.
Use pouca água e detergente, sempre seguindo a orientação do adulto.
Coloque os itens no escorredor ou no local combinado.
Conte como você ajudou e como evitou gastar água sem necessidade.', 'Faça a tarefa com um adulto.
Não mexa com facas, copos quebrados, água quente ou produtos sem autorização.',
  'medio', 3, 45, true, true, false,
  'Colaborar com as tarefas da casa economiza água quando fazemos tudo com atenção e divide o cuidado entre todos.', 'Esponja
Detergente
Escorredor de louça', 'Conte como você ajudou e como evitou gastar água sem necessidade.', '1 dia')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000013') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000013') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000013' and id not in ('41000000-0000-4000-8000-013000000001', '41000000-0000-4000-8000-013000000002', '41000000-0000-4000-8000-013000000003', '41000000-0000-4000-8000-013000000004');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-013000000001', '40000000-0000-4000-8000-000000000013', 'Separar a louça segura', 'Com um adulto, separe apenas os itens que você pode lavar.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-013000000002', '40000000-0000-4000-8000-000000000013', 'Lavar e enxaguar', 'Use pouca água e detergente, sempre seguindo a orientação do adulto.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-013000000003', '40000000-0000-4000-8000-000000000013', 'Guardar a louça', 'Coloque os itens no escorredor ou no local combinado.', 'action', 3, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-013000000004', '40000000-0000-4000-8000-000000000013', 'Registrar a tarefa', 'Conte como você ajudou e como evitou gastar água sem necessidade.', 'evidence', 4, true, 5, null, 2, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Leia por 15 minutos
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '📖', 'Leia por 15 minutos', 'leia-por-15-minutos',
  'Escolha um livro, leia por quinze minutos e registre uma ideia que descobriu.', 'Escolha um livro ou texto que desperte sua curiosidade.
Leia por pelo menos quinze minutos, em um lugar confortável.
Conte o título e uma ideia ou personagem de que você gostou.', null,
  'facil', 3, 35, true, true, false,
  'A leitura aumenta a imaginação, amplia o vocabulário e ajuda você a conhecer novos pontos de vista.', 'Um livro adequado para sua idade
Um lugar confortável', 'Conte o título do livro e uma ideia ou personagem de que você gostou.', '15 minutos')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000014') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000014') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000014' and id not in ('41000000-0000-4000-8000-014000000001', '41000000-0000-4000-8000-014000000002', '41000000-0000-4000-8000-014000000003');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-014000000001', '40000000-0000-4000-8000-000000000014', 'Escolher a leitura', 'Escolha um livro ou texto que desperte sua curiosidade.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-014000000002', '40000000-0000-4000-8000-000000000014', 'Ler com atenção', 'Leia por pelo menos quinze minutos, em um lugar confortável.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-014000000003', '40000000-0000-4000-8000-000000000014', 'Registrar o que aprendeu', 'Conte o título e uma ideia ou personagem de que você gostou.', 'evidence', 3, true, 5, null, 2, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Analise uma paisagem
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '🔍', 'Analise uma paisagem', 'analise-uma-paisagem',
  'Observe uma paisagem por alguns minutos e descubra os elementos naturais e construídos que fazem parte dela.', 'Escolha uma janela, praça ou outro lugar onde possa observar com segurança.
Passe alguns minutos percebendo plantas, animais, água, pessoas e construções.
Descreva três coisas que viu, o que era natural e o que poderia melhorar.', 'Observe sempre acompanhado por um adulto e sem entrar em locais perigosos.
Não se aproxime de ruas, animais desconhecidos ou terrenos particulares.',
  'facil', 3, 40, true, true, false,
  'Observar com atenção ajuda a perceber relações entre plantas, animais, água, pessoas e construções.', 'Uma janela, praça ou lugar seguro para observar
Papel e lápis, se quiser desenhar', 'Descreva três coisas que viu, o que era natural e o que poderia melhorar naquele lugar.', '10 minutos')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000015') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000015') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000015' and id not in ('41000000-0000-4000-8000-015000000001', '41000000-0000-4000-8000-015000000002', '41000000-0000-4000-8000-015000000003');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-015000000001', '40000000-0000-4000-8000-000000000015', 'Escolher um lugar seguro', 'Escolha uma janela, praça ou outro lugar onde possa observar com segurança.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-015000000002', '40000000-0000-4000-8000-000000000015', 'Observar a paisagem', 'Passe alguns minutos percebendo plantas, animais, água, pessoas e construções.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-015000000003', '40000000-0000-4000-8000-000000000015', 'Registrar suas descobertas', 'Descreva três coisas que viu, o que era natural e o que poderia melhorar.', 'evidence', 3, true, 5, null, 2, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Escreva no seu diário
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000012', '✍️', 'Escreva no seu diário', 'escreva-no-diario',
  'Escreva sobre algo que você sentiu, aprendeu ou gostaria de melhorar hoje.', 'Pense em algo que sentiu, aprendeu ou gostaria de melhorar.
Escreva livremente por alguns minutos, sem se preocupar em escrever perfeito.
Compartilhe uma frase sobre o tema, sem incluir informações pessoais.', 'Não compartilhe endereço, telefone, senhas ou informações pessoais.',
  'facil', 3, 35, true, true, false,
  'Colocar pensamentos no papel ajuda a reconhecer sentimentos, organizar ideias e perceber seu próprio crescimento.', 'Caderno ou diário
Lápis ou caneta', 'Compartilhe apenas o que se sentir confortável: escreva uma frase sobre o tema escolhido.', '10 minutos')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000016') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000016') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000016' and id not in ('41000000-0000-4000-8000-016000000001', '41000000-0000-4000-8000-016000000002', '41000000-0000-4000-8000-016000000003');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-016000000001', '40000000-0000-4000-8000-000000000016', 'Escolher um tema', 'Pense em algo que sentiu, aprendeu ou gostaria de melhorar.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-016000000002', '40000000-0000-4000-8000-000000000016', 'Escrever no diário', 'Escreva livremente por alguns minutos, sem se preocupar em escrever perfeito.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-016000000003', '40000000-0000-4000-8000-000000000016', 'Registrar a reflexão', 'Compartilhe uma frase sobre o tema, sem incluir informações pessoais.', 'evidence', 3, true, 5, null, 2, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Pratique atenção por cinco minutos
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000017', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000012', '🧘', 'Pratique atenção por cinco minutos', 'pratique-atencao-por-cinco-minutos',
  'Pare por alguns minutos, respire com calma e perceba os sons e sensações ao seu redor.', 'Sente-se em um lugar confortável e seguro.
Respire com calma e perceba os sons, as sensações e os pensamentos sem julgá-los.
Conte um som, uma sensação ou um pensamento que percebeu.', 'Faça sentado ou em uma posição confortável e pare se sentir desconforto.
Esta atividade não substitui a ajuda de um adulto ou profissional quando você precisar.',
  'facil', 3, 35, true, true, false,
  'A atenção ajuda a desacelerar, perceber como você está e agir com mais cuidado consigo e com as outras pessoas.', 'Um lugar tranquilo
Cinco minutos', 'Conte o que percebeu durante a prática: um som, uma sensação ou um pensamento.', '5 minutos')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000017') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000017') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000017' and id not in ('41000000-0000-4000-8000-017000000001', '41000000-0000-4000-8000-017000000002', '41000000-0000-4000-8000-017000000003');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-017000000001', '40000000-0000-4000-8000-000000000017', 'Encontrar um lugar tranquilo', 'Sente-se em um lugar confortável e seguro.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-017000000002', '40000000-0000-4000-8000-000000000017', 'Respirar e observar', 'Respire com calma e perceba os sons, as sensações e os pensamentos sem julgá-los.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-017000000003', '40000000-0000-4000-8000-000000000017', 'Registrar o momento', 'Conte um som, uma sensação ou um pensamento que percebeu.', 'evidence', 3, true, 5, null, 2, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Conheça a vaca e os derivados do leite
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000018', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000013', '🐄', 'Conheça a vaca e os derivados do leite', 'conheca-a-vaca-e-os-derivados-do-leite',
  'Observe uma imagem, vídeo educativo ou visita autorizada e descubra como o leite vira outros alimentos.', 'Use um livro, imagem ou vídeo educativo; uma visita só pode acontecer com autorização e acompanhamento de um adulto.
Descubra o que a vaca precisa para viver bem e como o leite pode virar outros alimentos.
Desenhe uma vaca ou escreva uma coisa que aprendeu.
Conte uma coisa que aprendeu sobre a vaca e cite dois derivados do leite.', 'Crianças devem observar animais somente com um adulto responsável.
Não toque, alimente ou entre em cercados sem autorização.',
  'facil', 7, 45, true, true, false,
  'Entender a origem dos alimentos ajuda a respeitar os animais, valorizar o trabalho das pessoas e evitar desperdícios.', 'Um livro, imagem ou vídeo educativo
Papel e lápis para desenhar', 'Conte uma coisa que aprendeu sobre a vaca e cite dois derivados do leite.', '20 minutos')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000018') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000018') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000018' and id not in ('41000000-0000-4000-8000-018000000001', '41000000-0000-4000-8000-018000000002', '41000000-0000-4000-8000-018000000003', '41000000-0000-4000-8000-018000000004');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-018000000001', '40000000-0000-4000-8000-000000000018', 'Escolher uma fonte segura', 'Use um livro, imagem ou vídeo educativo; uma visita só pode acontecer com autorização e acompanhamento de um adulto.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-018000000002', '40000000-0000-4000-8000-000000000018', 'Observar e aprender', 'Descubra o que a vaca precisa para viver bem e como o leite pode virar outros alimentos.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-018000000003', '40000000-0000-4000-8000-000000000018', 'Desenhar ou registrar', 'Desenhe uma vaca ou escreva uma coisa que aprendeu.', 'action', 3, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-018000000004', '40000000-0000-4000-8000-000000000018', 'Registrar a descoberta', 'Conte uma coisa que aprendeu sobre a vaca e cite dois derivados do leite.', 'evidence', 4, true, 5, null, 2, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- >>> 21_gamification.sql
-- =====================================================================
-- 21 · Gamificação: XP, níveis, conquistas e eventos (Etapa 6)
-- =====================================================================
-- Todo XP nasce de um EVENTO verificado pelo servidor:
--
--   RPC do jogo (aula, quiz, desafio…)
--     → process_gamification_event   valida o evento, evita duplicação,
--                                     busca o valor configurado no banco
--     → xp_transactions               (trigger: totais do perfil, nível e
--                                     eventos level_reached)
--     → check_achievements            conquistas atingidas → achievement_unlocked
--
-- O cliente apenas pede a ação. Ele nunca informa XP, nível, conquista ou
-- recompensa, e não tem permissão para escrever nessas tabelas.

-- ---------------------------------------------------------------------
-- 1. Perfil: XP separado por categoria
--    Conhecimento = knowledge · Ações = action + follow_up
--    Conquistas = achievement · Bônus = bonus
-- ---------------------------------------------------------------------
alter table public.profiles
  add column achievement_xp integer not null default 0 check (achievement_xp >= 0),
  add column bonus_xp       integer not null default 0 check (bonus_xp >= 0);

-- ---------------------------------------------------------------------
-- 2. Configuração das recompensas (valores no banco, não no código)
--    lessons.xp_reward · quizzes.xp_reward · challenges.start_xp_reward
--    challenges.xp_reward · challenge_steps.xp_reward · achievements.xp_reward
-- ---------------------------------------------------------------------
alter table public.challenges
  add column start_xp_reward integer not null default 0 check (start_xp_reward >= 0);

-- ---------------------------------------------------------------------
-- 3. Eventos de gamificação (um por acontecimento real, nunca repetido)
-- ---------------------------------------------------------------------
create table public.gamification_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  event_type    text not null check (event_type in (
    'lesson_completed', 'quiz_passed', 'quiz_improved', 'challenge_started',
    'challenge_step_completed', 'followup_completed', 'challenge_completed',
    'achievement_unlocked', 'level_reached', 'bonus'
  )),
  -- aula, quiz, desafio, etapa, conquista ou nível a que o evento se refere
  reference_id  uuid not null,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (user_id, event_type, reference_id)
);
create index gamification_events_user_created_idx on public.gamification_events (user_id, created_at desc);

comment on table public.gamification_events is
  'Histórico de eventos do jogo. A chave única (usuário, tipo, referência) impede recompensa duplicada.';

-- ---------------------------------------------------------------------
-- 4. Transações de XP: metadados, XP sempre positivo e origens conhecidas
-- ---------------------------------------------------------------------
alter table public.xp_transactions
  add column metadata jsonb not null default '{}'::jsonb;
alter table public.xp_transactions drop constraint xp_transactions_amount_check;
alter table public.xp_transactions add constraint xp_transactions_amount_check check (amount > 0);

-- Origens antigas → nomes de evento. As recompensas de desafio passam a ser
-- presas ao DESAFIO/ETAPA (e não ao registro do usuário): recomeçar ou
-- encerrar um desafio não gera o mesmo XP de novo.
with mapped as (
  select t.id, t.user_id, t.created_at,
    case t.source_type
      when 'lesson'           then 'lesson_completed'
      when 'quiz'             then 'quiz_passed'
      when 'quiz_improvement' then 'quiz_improved'
      when 'challenge_step'   then 'challenge_step_completed'
      when 'follow_up'        then 'followup_completed'
      when 'challenge'        then 'challenge_completed'
      when 'achievement'      then 'achievement_unlocked'
      else t.source_type
    end as new_type,
    coalesce(case t.source_type
      when 'quiz_improvement' then (select a.quiz_id from public.quiz_attempts a where a.id = t.source_id)
      when 'challenge_step'   then (select s.challenge_step_id from public.user_challenge_steps s where s.id = t.source_id)
      when 'follow_up'        then (select f.challenge_step_id from public.challenge_followups f where f.id = t.source_id)
      when 'challenge'        then (select uc.challenge_id from public.user_challenges uc where uc.id = t.source_id)
    end, t.source_id) as new_source
  from public.xp_transactions t
), ranked as (
  select m.*, row_number() over (partition by m.user_id, m.new_type, m.new_source order by m.created_at, m.id) as rn
  from mapped m
)
update public.xp_transactions t
set source_type = case when r.rn = 1 then r.new_type else 'legacy_' || r.new_type end,
    source_id   = case when r.rn = 1 then r.new_source else t.source_id end
from ranked r
where r.id = t.id;

-- A origem aparece como rótulo na interface; a descrição guarda só o nome.
update public.xp_transactions
set description = regexp_replace(description,
  '^(Conteúdo concluído|Quiz aprovado|Nova melhor nota|Etapa concluída|Acompanhamento|Desafio concluído|Conquista): ', '')
where description is not null;

alter table public.xp_transactions add constraint xp_transactions_source_type_check check (
  source_type in ('lesson_completed', 'quiz_passed', 'quiz_improved', 'challenge_started',
                  'challenge_step_completed', 'followup_completed', 'challenge_completed',
                  'achievement_unlocked', 'bonus')
  or source_type like 'legacy\_%'
);

insert into public.gamification_events (user_id, event_type, reference_id, created_at)
select user_id, source_type, source_id, created_at
from public.xp_transactions
where source_id is not null and source_type not like 'legacy\_%'
on conflict (user_id, event_type, reference_id) do nothing;

insert into public.gamification_events (user_id, event_type, reference_id, created_at)
select user_id, 'achievement_unlocked', achievement_id, unlocked_at
from public.user_achievements
on conflict (user_id, event_type, reference_id) do nothing;

-- ---------------------------------------------------------------------
-- 5. Conquistas: categoria, quantidade exigida, ordem e novas condições
-- ---------------------------------------------------------------------
alter table public.achievements
  add column category text not null default 'special' check (category in (
    'knowledge', 'first_actions', 'nature', 'water', 'waste', 'energy', 'biodiversity', 'community', 'special'
  )),
  add column requirement_count integer not null default 1 check (requirement_count > 0),
  add column order_index integer not null default 0;

update public.achievements
set requirement_count = requirement_value::integer
where requirement_type in ('lessons_completed', 'quizzes_passed', 'challenges_completed', 'cycles_completed')
  and requirement_value ~ '^[0-9]+$' and requirement_value::integer > 0;

alter table public.achievements drop constraint achievements_requirement_type_check;
-- lessons_completed | quizzes_passed | challenges_completed | categories_explored
-- level_reached | cycles_completed          → requirement_count
-- challenge_completed                       → requirement_value = slug do desafio
-- category_challenges_completed
-- category_actions_completed                → requirement_value = slugs de categoria
--                                             (separados por vírgula) + requirement_count
alter table public.achievements add constraint achievements_requirement_type_check check (requirement_type in (
  'lessons_completed', 'quizzes_passed', 'challenges_completed', 'challenge_completed',
  'category_challenges_completed', 'category_actions_completed', 'categories_explored',
  'level_reached', 'cycles_completed'
));

-- ---------------------------------------------------------------------
-- 6. Níveis: cálculo central a partir da tabela levels
-- ---------------------------------------------------------------------
-- XP nulo ou negativo conta como 0 (nunca quebra o cálculo).
create or replace function public.level_for_xp(p_xp integer)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(max(level_number), 1) from public.levels
  where xp_required <= greatest(coalesce(p_xp, 0), 0);
$$;

-- Faixa de XP de cada nível (o máximo é o mínimo do próximo − 1).
create view public.level_ranges
with (security_invoker = true) as
  select level_number, name, icon, description,
         xp_required as xp_min,
         lead(xp_required) over (order by level_number) - 1 as xp_max
  from public.levels;

-- calculateUserLevel: nível atual, próximo nível e progresso dentro da faixa.
create or replace function public.calculate_user_level(p_xp integer)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with v as (select greatest(coalesce(p_xp, 0), 0) as xp),
  cur as (
    select l.* from public.levels l, v where l.xp_required <= v.xp
    order by l.level_number desc limit 1
  ),
  nxt as (
    select l.* from public.levels l, v where l.xp_required > v.xp
    order by l.level_number limit 1
  )
  select jsonb_build_object(
    'xp',            v.xp,
    'level',         coalesce(cur.level_number, 1),
    'title',         cur.name,
    'icon',          cur.icon,
    'xp_min',        coalesce(cur.xp_required, 0),
    'xp_max',        nxt.xp_required - 1,
    'next_level',    nxt.level_number,
    'next_title',    nxt.name,
    'next_level_xp', nxt.xp_required,
    'xp_in_level',   v.xp - coalesce(cur.xp_required, 0),
    'xp_for_next',   nxt.xp_required - coalesce(cur.xp_required, 0),
    'xp_to_next',    nxt.xp_required - v.xp
  )
  from v left join cur on true left join nxt on true;
$$;

-- ---------------------------------------------------------------------
-- 7. Totais do perfil (cache do histórico) e subida de nível
-- ---------------------------------------------------------------------
create or replace function public.recalculate_profile_xp(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles p
  set total_xp       = coalesce(t.total, 0),
      knowledge_xp   = coalesce(t.knowledge, 0),
      action_xp      = coalesce(t.action, 0),
      achievement_xp = coalesce(t.achievement, 0),
      bonus_xp       = coalesce(t.bonus, 0),
      level          = public.level_for_xp(coalesce(t.total, 0))
  from (
    select sum(amount)::integer as total,
           (sum(amount) filter (where xp_type = 'knowledge'))::integer as knowledge,
           (sum(amount) filter (where xp_type in ('action', 'follow_up')))::integer as action,
           (sum(amount) filter (where xp_type = 'achievement'))::integer as achievement,
           (sum(amount) filter (where xp_type = 'bonus'))::integer as bonus
    from public.xp_transactions
    where user_id = p_user_id
  ) t
  where p.user_id = p_user_id;
end;
$$;

create or replace function public.admin_recalculate_xp(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform public.recalculate_profile_xp(p_user_id);
end;
$$;

-- A cada transação: soma no perfil, recalcula o nível e registra cada nível
-- alcançado (vários de uma vez, se o XP recebido for grande).
create or replace function public.apply_xp_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old integer;
  v_new integer;
begin
  select level into v_old from public.profiles where user_id = new.user_id for update;

  update public.profiles p
  set total_xp       = p.total_xp + new.amount,
      knowledge_xp   = p.knowledge_xp + case when new.xp_type = 'knowledge' then new.amount else 0 end,
      action_xp      = p.action_xp + case when new.xp_type in ('action', 'follow_up') then new.amount else 0 end,
      achievement_xp = p.achievement_xp + case when new.xp_type = 'achievement' then new.amount else 0 end,
      bonus_xp       = p.bonus_xp + case when new.xp_type = 'bonus' then new.amount else 0 end,
      level          = public.level_for_xp(p.total_xp + new.amount)
  where p.user_id = new.user_id
  returning level into v_new;

  if v_new > coalesce(v_old, 1) then
    insert into public.gamification_events (user_id, event_type, reference_id, metadata)
    select new.user_id, 'level_reached', l.id,
           jsonb_build_object('level', l.level_number, 'name', l.name, 'xp_transaction_id', new.id)
    from public.levels l
    where l.level_number > coalesce(v_old, 1) and l.level_number <= v_new
    on conflict (user_id, event_type, reference_id) do nothing;
  end if;

  return new;
end;
$$;

-- Os totais passam a incluir conquistas e bônus.
select public.recalculate_profile_xp(user_id) from public.profiles;

-- ---------------------------------------------------------------------
-- 8. Registro de XP (interno) e processamento central de eventos
-- ---------------------------------------------------------------------
drop function public.award_xp(uuid, integer, public.xp_type, text, uuid, text);

create function public.award_xp(
  p_user_id      uuid,
  p_amount       integer,
  p_type         public.xp_type,
  p_source_type  text,
  p_source_id    uuid,
  p_description  text,
  p_metadata     jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if coalesce(p_amount, 0) <= 0 then
    return 0;
  end if;

  insert into public.xp_transactions (user_id, amount, xp_type, source_type, source_id, description, metadata)
  values (p_user_id, p_amount, p_type, p_source_type, p_source_id, p_description, coalesce(p_metadata, '{}'::jsonb))
  on conflict (user_id, source_type, source_id) where source_id is not null do nothing
  returning id into v_id;

  return case when v_id is null then 0 else p_amount end;
end;
$$;

-- processGamificationEvent: EVENTO → valida usuário → valida evento (o fato
-- aconteceu de verdade?) → verifica duplicação → registra XP (o trigger
-- recalcula o nível). Devolve o XP concedido (0 se o evento já existia).
-- As conquistas são verificadas por check_achievements ao fim de cada ação.
create or replace function public.process_gamification_event(
  p_user_id    uuid,
  p_event_type text,
  p_reference  uuid,
  p_metadata   jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_amount   integer;
  v_type     public.xp_type;
  v_desc     text;
  v_event    uuid;
begin
  if p_user_id is null or p_reference is null
     or not exists (select 1 from public.profiles where user_id = p_user_id) then
    raise exception 'invalid_event';
  end if;

  case p_event_type
    when 'lesson_completed' then
      v_type := 'knowledge';
      select l.xp_reward, l.title into v_amount, v_desc
      from public.lessons l
      join public.user_lesson_progress p on p.lesson_id = l.id and p.user_id = p_user_id and p.status = 'completed'
      where l.id = p_reference;

    when 'quiz_passed' then
      v_type := 'knowledge';
      select q.xp_reward, q.title into v_amount, v_desc
      from public.quizzes q
      where q.id = p_reference
        and exists (select 1 from public.quiz_attempts a
                    where a.quiz_id = q.id and a.user_id = p_user_id and a.status = 'completed' and a.passed);

    when 'quiz_improved' then
      v_type := 'knowledge';
      select q.improvement_xp_reward, q.title into v_amount, v_desc
      from public.quizzes q
      where q.id = p_reference
        and (select count(*) from public.quiz_attempts a
             where a.quiz_id = q.id and a.user_id = p_user_id and a.status = 'completed' and a.passed) >= 2;

    when 'challenge_started' then
      v_type := 'action';
      select c.start_xp_reward, c.title into v_amount, v_desc
      from public.challenges c
      where c.id = p_reference
        and exists (select 1 from public.user_challenges uc
                    where uc.challenge_id = c.id and uc.user_id = p_user_id);

    when 'challenge_step_completed' then
      v_type := 'action';
      select cs.xp_reward, cs.title || ' · ' || c.title into v_amount, v_desc
      from public.challenge_steps cs
      join public.challenges c on c.id = cs.challenge_id
      where cs.id = p_reference and cs.step_type <> 'follow_up'
        and exists (select 1 from public.user_challenge_steps ucs
                    join public.user_challenges uc on uc.id = ucs.user_challenge_id
                    where ucs.challenge_step_id = cs.id and uc.user_id = p_user_id and ucs.status = 'completed');

    when 'followup_completed' then
      v_type := 'follow_up';
      select cs.xp_reward, cs.title || ' · ' || c.title into v_amount, v_desc
      from public.challenge_steps cs
      join public.challenges c on c.id = cs.challenge_id
      where cs.id = p_reference and cs.step_type = 'follow_up'
        and exists (select 1 from public.challenge_followups f
                    join public.user_challenges uc on uc.id = f.user_challenge_id
                    where f.challenge_step_id = cs.id and uc.user_id = p_user_id and f.status = 'completed');

    when 'challenge_completed' then
      v_type := 'action';
      select c.xp_reward, c.title into v_amount, v_desc
      from public.challenges c
      where c.id = p_reference
        and exists (select 1 from public.user_challenges uc
                    where uc.challenge_id = c.id and uc.user_id = p_user_id and uc.status = 'completed');

    when 'achievement_unlocked' then
      v_type := 'achievement';
      select a.xp_reward, a.name into v_amount, v_desc
      from public.achievements a
      where a.id = p_reference
        and exists (select 1 from public.user_achievements ua
                    where ua.achievement_id = a.id and ua.user_id = p_user_id);

    else
      raise exception 'invalid_event';
  end case;

  -- O fato não aconteceu (ou não é deste usuário): nada é registrado.
  if v_desc is null then
    raise exception 'event_not_verified';
  end if;

  insert into public.gamification_events (user_id, event_type, reference_id, metadata)
  values (p_user_id, p_event_type, p_reference, coalesce(p_metadata, '{}'::jsonb))
  on conflict (user_id, event_type, reference_id) do nothing
  returning id into v_event;

  if v_event is null then
    return 0; -- evento repetido (atualização, clique duplo, chamada simultânea)
  end if;

  return public.award_xp(p_user_id, v_amount, v_type, p_event_type, p_reference, v_desc,
                         coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('event_id', v_event));
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Conquistas: progresso calculado dos dados reais (nada é salvo)
-- ---------------------------------------------------------------------
drop function public.achievement_met(uuid, text, text);

create or replace function public.achievement_progress(p_user uuid, p_type text, p_value text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_categories text[] := string_to_array(replace(coalesce(p_value, ''), ' ', ''), ',');
begin
  case p_type
    when 'lessons_completed' then
      return (select count(*) from public.user_lesson_progress
              where user_id = p_user and status = 'completed');
    when 'quizzes_passed' then
      return (select count(distinct quiz_id) from public.quiz_attempts
              where user_id = p_user and passed);
    when 'challenges_completed' then
      return (select count(distinct challenge_id) from public.user_challenges
              where user_id = p_user and status = 'completed');
    when 'challenge_completed' then
      return (select count(distinct uc.challenge_id) from public.user_challenges uc
              join public.challenges c on c.id = uc.challenge_id
              where uc.user_id = p_user and uc.status = 'completed' and c.slug = p_value);
    when 'category_challenges_completed' then
      return (select count(distinct uc.challenge_id) from public.user_challenges uc
              join public.challenges c on c.id = uc.challenge_id
              join public.categories cat on cat.id = c.category_id
              where uc.user_id = p_user and uc.status = 'completed' and cat.slug = any (v_categories));
    when 'category_actions_completed' then
      -- ação = desafio concluído ou acompanhamento realizado na categoria
      return (select count(distinct uc.challenge_id) from public.user_challenges uc
              join public.challenges c on c.id = uc.challenge_id
              join public.categories cat on cat.id = c.category_id
              where uc.user_id = p_user and uc.status = 'completed' and cat.slug = any (v_categories))
           + (select count(distinct f.challenge_step_id) from public.challenge_followups f
              join public.user_challenges uc on uc.id = f.user_challenge_id
              join public.challenges c on c.id = uc.challenge_id
              join public.categories cat on cat.id = c.category_id
              where uc.user_id = p_user and f.status = 'completed' and cat.slug = any (v_categories)
                and uc.status not in ('cancelled', 'expired'));
    when 'categories_explored' then
      -- categoria explorada = pelo menos uma lição ou um desafio concluído nela
      return (select count(distinct category_id) from (
                select l.category_id from public.user_lesson_progress p
                join public.lessons l on l.id = p.lesson_id
                where p.user_id = p_user and p.status = 'completed'
                union
                select c.category_id from public.user_challenges uc
                join public.challenges c on c.id = uc.challenge_id
                where uc.user_id = p_user and uc.status = 'completed'
              ) x);
    when 'level_reached' then
      return (select level from public.profiles where user_id = p_user);
    when 'cycles_completed' then
      -- Um ciclo termina quando o item conquistado aparece no mundo do jogador.
      return (select count(*) from public.user_world_items uwi
              join public.worlds w on w.id = uwi.world_id
              where w.user_id = p_user
                and coalesce((uwi.metadata ->> 'revealed')::boolean, false));
    else
      return 0;
  end case;
end;
$$;

-- Desbloqueia as conquistas atingidas e devolve as novas. Repete a verificação
-- enquanto houver desbloqueios: o XP de uma conquista pode subir o nível e
-- liberar outra (ex.: "Em Evolução").
create or replace function public.check_achievements(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r        record;
  v_id     uuid;
  v_new    jsonb := '[]'::jsonb;
  v_round  integer;
begin
  loop
    v_round := 0;
    for r in
      select a.* from public.achievements a
      where a.active
        and not exists (
          select 1 from public.user_achievements ua
          where ua.user_id = p_user and ua.achievement_id = a.id
        )
      order by a.order_index, a.slug
    loop
      if public.achievement_progress(p_user, r.requirement_type, r.requirement_value) >= r.requirement_count then
        insert into public.user_achievements (user_id, achievement_id)
        values (p_user, r.id)
        on conflict (user_id, achievement_id) do nothing
        returning id into v_id;

        if v_id is not null then
          perform public.process_gamification_event(p_user, 'achievement_unlocked', r.id);
          v_new := v_new || jsonb_build_array(jsonb_build_object(
            'id', r.id, 'slug', r.slug, 'name', r.name, 'icon', r.icon, 'xp_reward', r.xp_reward
          ));
          v_round := v_round + 1;
        end if;
      end if;
    end loop;
    exit when v_round = 0;
  end loop;

  return v_new;
end;
$$;

-- ---------------------------------------------------------------------
-- 10. Ações do jogo passam pelo evento central
--     (mesmas regras das etapas anteriores; muda só a forma de dar XP)
-- ---------------------------------------------------------------------
create or replace function public.complete_lesson(p_lesson_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := public.require_user();
  v_lesson  public.lessons;
  v_total   integer;
  v_xp      integer;
begin
  select * into v_lesson from public.lessons where id = p_lesson_id and active;
  if not found then
    raise exception 'not_found';
  end if;
  if not public.lesson_is_unlocked(v_user, p_lesson_id) then
    raise exception 'lesson_locked';
  end if;

  v_total := public.lesson_section_count(p_lesson_id);
  if not exists (
    select 1 from public.user_lesson_progress
    where user_id = v_user and lesson_id = p_lesson_id
      and (status = 'completed' or last_section_index >= v_total - 1)
  ) then
    raise exception 'lesson_not_finished';
  end if;

  update public.user_lesson_progress
  set status = 'completed',
      progress_percentage = 100,
      completed_at = coalesce(completed_at, now()),
      last_accessed_at = now()
  where user_id = v_user and lesson_id = p_lesson_id;

  v_xp := public.process_gamification_event(v_user, 'lesson_completed', v_lesson.id);

  return jsonb_build_object(
    'xp_awarded',   v_xp,
    'achievements', public.check_achievements(v_user)
  );
end;
$$;

create or replace function public.finish_quiz_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user        uuid := public.require_user();
  v_attempt     public.quiz_attempts := public.get_owned_attempt(p_attempt_id, v_user);
  v_quiz        public.quizzes;
  v_total       integer;
  v_points      integer;
  v_answered    integer;
  v_correct     integer;
  v_earned      integer;
  v_score       integer;
  v_passed      boolean;
  v_prev_best   integer;
  v_first_pass  boolean;
  v_xp          integer := 0;
  v_challenge   jsonb;
begin
  if v_attempt.status <> 'started' then
    raise exception 'attempt_closed';
  end if;

  select * into v_quiz from public.quizzes where id = v_attempt.quiz_id;

  select count(*), coalesce(sum(points), 0) into v_total, v_points
  from public.quiz_questions where quiz_id = v_quiz.id and active;

  select count(*),
         count(*) filter (where a.is_correct),
         coalesce(sum(q.points) filter (where a.is_correct), 0)
    into v_answered, v_correct, v_earned
  from public.quiz_answers a
  join public.quiz_questions q on q.id = a.question_id
  where a.attempt_id = p_attempt_id and q.active;

  if v_answered < v_total then
    raise exception 'quiz_incomplete';
  end if;

  v_score  := case when v_points = 0 then 0 else round(v_earned * 100.0 / v_points) end;
  v_passed := v_score >= v_quiz.passing_score;  -- nota mínima configurada no banco

  select max(score) into v_prev_best from public.quiz_attempts
  where user_id = v_user and quiz_id = v_quiz.id and status = 'completed';
  v_first_pass := v_passed and not exists (
    select 1 from public.quiz_attempts
    where user_id = v_user and quiz_id = v_quiz.id and status = 'completed' and passed
  );

  update public.quiz_attempts
  set status = 'completed',
      score = v_score,
      total_questions = v_total,
      correct_answers = v_correct,
      points_earned = v_earned,
      points_total = v_points,
      passed = v_passed,
      completed_at = now()
  where id = p_attempt_id;

  if v_passed then
    -- Recompensa principal: uma única vez por quiz (índice único em xp_transactions).
    v_xp := public.process_gamification_event(v_user, 'quiz_passed', v_quiz.id);
    -- Bônus opcional por superar a própria melhor nota: uma única vez por quiz.
    if not v_first_pass and v_quiz.improvement_xp_reward > 0 and v_score > coalesce(v_prev_best, 0) then
      v_xp := v_xp + public.process_gamification_event(v_user, 'quiz_improved', v_quiz.id,
                                                       jsonb_build_object('attempt_id', p_attempt_id));
    end if;

    select jsonb_build_object('id', c.id, 'slug', c.slug, 'title', c.title, 'icon', c.icon)
      into v_challenge
    from public.challenges c
    where c.lesson_id = v_quiz.lesson_id and c.active
    order by c.created_at
    limit 1;
  end if;

  return jsonb_build_object(
    'attempt_id',         p_attempt_id,
    'attempt_number',     v_attempt.attempt_number,
    'score',              v_score,
    'correct_answers',    v_correct,
    'incorrect_answers',  v_total - v_correct,
    'total_questions',    v_total,
    'points_earned',      v_earned,
    'points_total',       v_points,
    'passed',             v_passed,
    'passing_score',      v_quiz.passing_score,
    'first_pass',         v_first_pass,
    'previous_best',      v_prev_best,
    'xp_awarded',         v_xp,
    'review',             public.quiz_answer_review(p_attempt_id),
    'challenge_unlocked', v_challenge,
    'achievements',       public.check_achievements(v_user)
  );
end;
$$;

create or replace function public.accept_challenge(p_challenge_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user       uuid := public.require_user();
  v_challenge  public.challenges;
  v_quiz_id    uuid;
  v_existing   public.user_challenges;
  v_id         uuid;
begin
  select * into v_challenge from public.challenges where id = p_challenge_id and active;
  if not found then
    raise exception 'not_found';
  end if;

  if not exists (
    select 1 from public.user_lesson_progress
    where user_id = v_user and lesson_id = v_challenge.lesson_id and status = 'completed'
  ) then
    raise exception 'lesson_not_completed';
  end if;

  select id into v_quiz_id from public.quizzes where lesson_id = v_challenge.lesson_id and active;
  if v_quiz_id is not null and not exists (
    select 1 from public.quiz_attempts where user_id = v_user and quiz_id = v_quiz_id and passed
  ) then
    raise exception 'quiz_not_passed';
  end if;

  select * into v_existing from public.user_challenges
  where user_id = v_user and challenge_id = p_challenge_id and status not in ('expired', 'cancelled')
  for update;

  if found then
    if public.challenge_is_overdue(v_existing.id) then
      -- Prazo vencido: o registro antigo expira e um novo começa.
      update public.user_challenges set status = 'expired' where id = v_existing.id;
    else
      return v_existing.id; -- já existe um ativo/concluído: não duplica
    end if;
  end if;

  insert into public.user_challenges (user_id, challenge_id, status, accepted_at, deadline_at)
  values (v_user, p_challenge_id, 'accepted', now(), now() + make_interval(days => v_challenge.deadline_days))
  returning id into v_id;

  insert into public.user_challenge_steps (user_challenge_id, challenge_step_id)
  select v_id, cs.id from public.challenge_steps cs where cs.challenge_id = p_challenge_id and cs.active;

  perform public.refresh_user_challenge_progress(v_id);
  -- XP de início: uma vez por desafio (recomeçar ou encerrar não repete).
  perform public.process_gamification_event(v_user, 'challenge_started', p_challenge_id);
  perform public.check_achievements(v_user);
  return v_id;
end;
$$;

create or replace function public.complete_challenge_step(
  p_user_challenge_id uuid,
  p_step_id           uuid,
  p_file_path         text,
  p_thumbnail_path    text,
  p_file_name         text,
  p_mime_type         text,
  p_file_size         bigint,
  p_observation       text,
  p_captured_at       date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := public.require_user();
  v_uc      public.user_challenges;
  v_step    public.challenge_steps;
  v_ucs     public.user_challenge_steps;
  v_status  text;
  v_xp      integer := 0;
begin
  select * into v_uc from public.user_challenges
  where id = p_user_challenge_id and user_id = v_user
  for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_uc.status not in ('accepted', 'in_progress') then
    raise exception 'challenge_not_active';
  end if;
  if public.challenge_is_overdue(v_uc.id) then
    raise exception 'challenge_expired';
  end if;

  select * into v_step from public.challenge_steps
  where id = p_step_id and challenge_id = v_uc.challenge_id and active;
  if not found or v_step.step_type = 'follow_up' then
    raise exception 'invalid_step';
  end if;

  select * into v_ucs from public.user_challenge_steps
  where user_challenge_id = v_uc.id and challenge_step_id = v_step.id
  for update;
  if not found then
    insert into public.user_challenge_steps (user_challenge_id, challenge_step_id)
    values (v_uc.id, v_step.id) returning * into v_ucs;
  end if;
  if v_ucs.status = 'completed' then
    raise exception 'step_already_completed';
  end if;

  -- Checklist em ordem: etapas obrigatórias anteriores precisam estar concluídas.
  if exists (
    select 1 from public.challenge_steps cs
    left join public.user_challenge_steps ucs
      on ucs.user_challenge_id = v_uc.id and ucs.challenge_step_id = cs.id
    where cs.challenge_id = v_uc.challenge_id and cs.active and cs.required
      and cs.step_type <> 'follow_up' and cs.order_index < v_step.order_index
      and coalesce(ucs.status, 'pending') <> 'completed'
  ) then
    raise exception 'previous_steps_pending';
  end if;

  if p_captured_at is not null and (
    p_captured_at > public.game_today() + 1
    or p_captured_at < (v_uc.accepted_at at time zone 'America/Sao_Paulo')::date - 1
  ) then
    raise exception 'invalid_date';
  end if;

  perform public.assert_step_evidence(v_step.evidence_kind, p_file_path, p_observation);
  if v_step.evidence_kind <> 'none' then
    perform public.insert_challenge_evidence(
      v_uc, v_step.id, null, p_file_path, p_thumbnail_path, p_file_name, p_mime_type, p_file_size,
      p_observation, p_captured_at
    );
  end if;

  update public.user_challenge_steps
  set status = 'completed', completed_at = now(), notes = public.sanitize_note(p_observation)
  where id = v_ucs.id;

  update public.user_challenges
  set status = 'in_progress', started_at = coalesce(started_at, now())
  where id = v_uc.id and status = 'accepted';

  -- XP da etapa: preso à etapa do desafio (não ao registro), uma única vez.
  v_xp := public.process_gamification_event(v_user, 'challenge_step_completed', v_step.id);

  v_status := public.advance_challenge_after_steps(v_uc.id);
  perform public.refresh_user_challenge_progress(v_uc.id);

  return jsonb_build_object(
    'status', v_status,
    'progress_percentage', (select progress_percentage from public.user_challenges where id = v_uc.id),
    'xp_awarded', v_xp,
    'achievements', public.check_achievements(v_user)
  );
end;
$$;

create or replace function public.complete_followup(
  p_followup_id    uuid,
  p_file_path      text,
  p_thumbnail_path text,
  p_file_name      text,
  p_mime_type      text,
  p_file_size      bigint,
  p_observation    text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user      uuid := public.require_user();
  v_followup  public.challenge_followups;
  v_uc        public.user_challenges;
  v_step      public.challenge_steps;
  v_kind      text;
  v_xp        integer := 0;
begin
  select f.* into v_followup
  from public.challenge_followups f
  join public.user_challenges uc on uc.id = f.user_challenge_id
  where f.id = p_followup_id and uc.user_id = v_user
  for update of f;
  if not found then
    raise exception 'not_found';
  end if;
  if v_followup.status <> 'scheduled' then
    raise exception 'followup_already_done';
  end if;

  select * into v_uc from public.user_challenges where id = v_followup.user_challenge_id for update;
  if v_uc.status <> 'waiting_follow_up' then
    raise exception 'challenge_not_active';
  end if;

  select * into v_step from public.challenge_steps where id = v_followup.challenge_step_id;
  if v_followup.scheduled_for - make_interval(days => coalesce(v_step.early_window_days, 0)) > now() then
    raise exception 'followup_not_due';
  end if;

  v_kind := coalesce(v_step.evidence_kind, case when v_followup.evidence_required then 'photo' else 'text' end);
  perform public.assert_step_evidence(v_kind, p_file_path, p_observation);
  if p_file_path is not null or public.sanitize_note(p_observation) is not null then
    perform public.insert_challenge_evidence(
      v_uc, v_followup.challenge_step_id, p_followup_id, p_file_path, p_thumbnail_path,
      p_file_name, p_mime_type, p_file_size, p_observation, public.game_today()
    );
  end if;

  update public.challenge_followups
  set status = 'completed', completed_at = now()
  where id = p_followup_id;

  if v_followup.challenge_step_id is not null then
    update public.user_challenge_steps
    set status = 'completed', completed_at = now(), notes = public.sanitize_note(p_observation)
    where user_challenge_id = v_uc.id and challenge_step_id = v_followup.challenge_step_id;

    v_xp := public.process_gamification_event(v_user, 'followup_completed', v_followup.challenge_step_id);
  end if;

  perform public.refresh_user_challenge_progress(v_uc.id);

  return jsonb_build_object(
    'xp_awarded', v_xp,
    'pending_followups', (select count(*) from public.challenge_followups
                          where user_challenge_id = v_uc.id and status = 'scheduled'),
    'achievements', public.check_achievements(v_user)
  );
end;
$$;

create or replace function public.complete_challenge(p_user_challenge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user       uuid := public.require_user();
  v_uc         public.user_challenges;
  v_challenge  public.challenges;
  v_xp         integer;
  v_items      jsonb;
begin
  -- Trava a linha: cliques simultâneos esperam e veem o desafio já concluído.
  select * into v_uc from public.user_challenges
  where id = p_user_challenge_id and user_id = v_user
  for update;
  if not found then
    raise exception 'not_found';
  end if;

  if v_uc.status = 'completed' then
    return jsonb_build_object('already_completed', true, 'xp_awarded', 0,
                              'world_items', '[]'::jsonb, 'achievements', '[]'::jsonb);
  end if;
  if v_uc.status not in ('accepted', 'in_progress', 'waiting_follow_up') then
    raise exception 'challenge_not_active';
  end if;
  if public.challenge_is_overdue(v_uc.id) then
    raise exception 'challenge_expired';
  end if;
  if not public.challenge_main_steps_done(v_uc.id) then
    raise exception 'steps_pending';
  end if;
  if exists (
    select 1 from public.challenge_followups f
    join public.challenge_steps cs on cs.id = f.challenge_step_id
    where f.user_challenge_id = v_uc.id and f.status <> 'completed' and cs.required and cs.active
  ) or exists (
    -- acompanhamentos obrigatórios ainda nem agendados
    select 1 from public.challenge_steps cs
    where cs.challenge_id = v_uc.challenge_id and cs.step_type = 'follow_up' and cs.active and cs.required
      and not exists (select 1 from public.challenge_followups f
                      where f.user_challenge_id = v_uc.id and f.challenge_step_id = cs.id)
  ) then
    raise exception 'followups_pending';
  end if;

  select * into v_challenge from public.challenges where id = v_uc.challenge_id;

  update public.user_challenge_steps ucs
  set status = 'completed', completed_at = now()
  from public.challenge_steps cs
  where cs.id = ucs.challenge_step_id and ucs.user_challenge_id = v_uc.id
    and cs.step_type = 'completion' and ucs.status <> 'completed';

  update public.user_challenges
  set status = 'completed',
      completed_at = coalesce(completed_at, now()),
      started_at = coalesce(started_at, now())
  where id = v_uc.id;
  perform public.refresh_user_challenge_progress(v_uc.id);

  -- Recompensa: idempotente por (usuário, 'challenge_completed', desafio).
  v_xp := public.process_gamification_event(v_user, 'challenge_completed', v_challenge.id);
  v_items := public.unlock_world_items_for_challenge(v_user, v_challenge.slug);

  return jsonb_build_object(
    'already_completed', false,
    'xp_awarded',   v_xp,
    'world_items',  v_items,
    'achievements', public.check_achievements(v_user)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 11. RLS e permissões
-- ---------------------------------------------------------------------
alter table public.gamification_events enable row level security;
-- Tabelas novas recebem os privilégios padrão do Supabase: remove tudo e
-- libera só a leitura. Eventos são gravados apenas pelas funções do servidor.
revoke all on public.gamification_events, public.level_ranges from anon, authenticated;
grant select on public.gamification_events to authenticated;
create policy gamification_events_read_own on public.gamification_events
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Colunas novas do perfil: somente leitura (o grant de update continua
-- restrito a username, display_name, avatar_url e avatar_emoji).
grant select on public.level_ranges to anon, authenticated;

revoke execute on function public.recalculate_profile_xp(uuid),
                           public.award_xp(uuid, integer, public.xp_type, text, uuid, text, jsonb),
                           public.process_gamification_event(uuid, text, uuid, jsonb),
                           public.achievement_progress(uuid, text, text),
                           public.check_achievements(uuid),
                           public.apply_xp_transaction(),
                           public.calculate_user_level(integer),
                           public.level_for_xp(integer)
  from public, anon, authenticated;

grant execute on function public.calculate_user_level(integer) to anon, authenticated;
grant execute on function public.level_for_xp(integer) to anon, authenticated;

-- >>> 22_gamification_content.sql
-- =====================================================================
-- 22 · Níveis e conquistas (Etapa 6)
-- =====================================================================
-- ARQUIVO GERADO por "npm run content:sql" a partir de content/gamification.json.
-- Não edite à mão. Idempotente: pode ser executado de novo depois de editar o JSON.

-- Níveis: a faixa de cada um vai do seu xp_required até o do próximo − 1.
-- Afasta os valores antigos antes do upsert para não esbarrar nos índices únicos.
update public.levels set level_number = level_number + 100000, xp_required = xp_required + 100000000;
insert into public.levels (id, level_number, name, xp_required, description, icon) values
  ('50000000-0000-4000-8000-000000000001', 1, 'Explorador', 0, 'Começando a descobrir o mundo natural.', '🌱'),
  ('50000000-0000-4000-8000-000000000002', 2, 'Aprendiz da Natureza', 100, 'Já entende como a natureza funciona.', '🌿'),
  ('50000000-0000-4000-8000-000000000003', 3, 'Observador', 250, 'Percebe os detalhes do ambiente ao redor.', '🔎'),
  ('50000000-0000-4000-8000-000000000004', 4, 'Cuidador', 450, 'Transforma conhecimento em cuidado real.', '🪴'),
  ('50000000-0000-4000-8000-000000000005', 5, 'Protetor', 700, 'Protege o que aprendeu a valorizar.', '🛡️'),
  ('50000000-0000-4000-8000-000000000006', 6, 'Guardião das Plantas', 1000, 'Cuida das plantas com constância.', '🌳'),
  ('50000000-0000-4000-8000-000000000007', 7, 'Guardião da Água', 1350, 'Sabe que cada gota importa.', '💧'),
  ('50000000-0000-4000-8000-000000000008', 8, 'Guardião dos Recursos', 1750, 'Usa os recursos do planeta com consciência.', '♻️'),
  ('50000000-0000-4000-8000-000000000009', 9, 'Amigo da Biodiversidade', 2200, 'Protege a vida em todas as suas formas.', '🐝'),
  ('50000000-0000-4000-8000-000000000010', 10, 'Guardião da Natureza', 2700, 'Uma referência em cuidar da natureza.', '🏞️'),
  ('50000000-0000-4000-8000-000000000011', 11, 'Protetor dos Ecossistemas', 3250, 'Entende como tudo está conectado.', '🌾'),
  ('50000000-0000-4000-8000-000000000012', 12, 'Agente Ambiental', 3850, 'Age e inspira quem está por perto.', '🧭'),
  ('50000000-0000-4000-8000-000000000013', 13, 'Defensor da Vida', 4500, 'Defende os seres vivos e seus lares.', '🦋'),
  ('50000000-0000-4000-8000-000000000014', 14, 'Guardião do Planeta', 5200, 'Pensa no planeta em cada escolha.', '🌍'),
  ('50000000-0000-4000-8000-000000000015', 15, 'Mestre da Sustentabilidade', 5950, 'Domina hábitos sustentáveis no dia a dia.', '🌞'),
  ('50000000-0000-4000-8000-000000000016', 16, 'Embaixador Ambiental', 6750, 'Leva a causa ambiental para a comunidade.', '🤝'),
  ('50000000-0000-4000-8000-000000000017', 17, 'Guardião dos Ecossistemas', 7600, 'Cuida de ecossistemas inteiros.', '🌲'),
  ('50000000-0000-4000-8000-000000000018', 18, 'Protetor da Biodiversidade', 8500, 'Um aliado de todas as espécies.', '🦜'),
  ('50000000-0000-4000-8000-000000000019', 19, 'Guardião do Futuro', 9450, 'Planta hoje o que o futuro vai colher.', '🌅'),
  ('50000000-0000-4000-8000-000000000020', 20, 'Lenda ECO', 10450, 'Uma lenda da jornada ECO QUEST.', '🏆')
on conflict (id) do update set
  level_number = excluded.level_number, name = excluded.name, xp_required = excluded.xp_required,
  description = excluded.description, icon = excluded.icon;
delete from public.levels where id not in ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000006', '50000000-0000-4000-8000-000000000007', '50000000-0000-4000-8000-000000000008', '50000000-0000-4000-8000-000000000009', '50000000-0000-4000-8000-000000000010', '50000000-0000-4000-8000-000000000011', '50000000-0000-4000-8000-000000000012', '50000000-0000-4000-8000-000000000013', '50000000-0000-4000-8000-000000000014', '50000000-0000-4000-8000-000000000015', '50000000-0000-4000-8000-000000000016', '50000000-0000-4000-8000-000000000017', '50000000-0000-4000-8000-000000000018', '50000000-0000-4000-8000-000000000019', '50000000-0000-4000-8000-000000000020');

-- Conquistas: as que saírem do JSON ficam inativas (quem já tem, continua tendo).
insert into public.achievements (id, name, slug, description, icon, category, requirement_type, requirement_value,
  requirement_count, xp_reward, order_index, active) values
  ('60000000-0000-4000-8000-000000000001', 'Primeiro Aprendizado', 'primeiro-aprendizado', 'Conclua sua primeira lição.', '📚', 'knowledge', 'lessons_completed', '', 1, 10, 1, true),
  ('60000000-0000-4000-8000-000000000002', 'Primeiro Conhecimento', 'primeiro-conhecimento', 'Seja aprovado no seu primeiro quiz.', '🧠', 'knowledge', 'quizzes_passed', '', 1, 10, 2, true),
  ('60000000-0000-4000-8000-000000000007', 'Curioso', 'curioso', 'Conclua 5 lições.', '📚', 'knowledge', 'lessons_completed', '', 5, 30, 3, true),
  ('60000000-0000-4000-8000-000000000008', 'Estudante da Natureza', 'estudante-da-natureza', 'Conclua 10 lições.', '🧠', 'knowledge', 'lessons_completed', '', 10, 50, 4, true),
  ('60000000-0000-4000-8000-000000000006', 'Aprendiz Dedicado', 'aprendiz-dedicado', 'Conclua 5 quizzes.', '🏆', 'knowledge', 'quizzes_passed', '', 5, 50, 5, true),
  ('60000000-0000-4000-8000-000000000004', 'Primeiro Passo', 'primeiro-passo', 'Conclua sua primeira ação ambiental.', '🌱', 'first_actions', 'challenges_completed', '', 1, 50, 6, true),
  ('60000000-0000-4000-8000-000000000003', 'Primeira Árvore', 'primeira-arvore', 'Conclua o desafio de plantar uma árvore.', '🌳', 'nature', 'challenge_completed', 'plante-uma-arvore', 1, 50, 7, true),
  ('60000000-0000-4000-8000-000000000009', 'Primeira Flor', 'primeira-flor', 'Conclua o desafio de cultivar uma flor.', '🌼', 'nature', 'challenge_completed', 'cultive-uma-flor', 1, 30, 8, true),
  ('60000000-0000-4000-8000-000000000010', 'Pequeno Jardineiro', 'pequeno-jardineiro', 'Conclua 3 desafios relacionados à Natureza.', '🌱', 'nature', 'category_challenges_completed', 'natureza', 3, 50, 9, true),
  ('60000000-0000-4000-8000-000000000011', 'Guardião das Plantas', 'guardiao-das-plantas', 'Conclua 5 ações relacionadas à Natureza (desafios concluídos e acompanhamentos realizados).', '🌳', 'nature', 'category_actions_completed', 'natureza', 5, 80, 10, true),
  ('60000000-0000-4000-8000-000000000012', 'Amigo da Água', 'amigo-da-agua', 'Conclua 3 desafios relacionados à Água.', '💧', 'water', 'category_challenges_completed', 'agua', 3, 50, 11, true),
  ('60000000-0000-4000-8000-000000000013', 'Consumo Consciente', 'consumo-consciente', 'Conclua 3 desafios relacionados a Resíduos ou Consumo.', '♻️', 'waste', 'category_challenges_completed', 'residuos,energia', 3, 50, 12, true),
  ('60000000-0000-4000-8000-000000000014', 'Amigo dos Polinizadores', 'amigo-dos-polinizadores', 'Conclua um desafio relacionado à Biodiversidade.', '🐝', 'biodiversity', 'category_challenges_completed', 'biodiversidade', 1, 30, 13, true),
  ('60000000-0000-4000-8000-000000000015', 'Ação em Comunidade', 'acao-em-comunidade', 'Conclua uma ação da categoria Comunidade.', '🤝', 'community', 'category_challenges_completed', 'comunidade', 1, 30, 14, true),
  ('60000000-0000-4000-8000-000000000016', 'Explorador ECO', 'explorador-eco', 'Explore pelo menos 4 categorias ambientais (conclua uma lição ou um desafio em cada).', '🌎', 'special', 'categories_explored', '', 4, 50, 15, true),
  ('60000000-0000-4000-8000-000000000005', 'Primeiro Ciclo Completo', 'primeiro-ciclo-completo', 'Aprenda, aja e veja o seu mundo evoluir pela primeira vez.', '🌎', 'special', 'cycles_completed', '', 1, 30, 16, true),
  ('60000000-0000-4000-8000-000000000017', 'Em Evolução', 'em-evolucao', 'Alcance o nível 5.', '🔥', 'special', 'level_reached', '', 5, 0, 17, true),
  ('60000000-0000-4000-8000-000000000018', 'Guardião do Planeta', 'guardiao-do-planeta', 'Alcance o nível 10.', '🌎', 'special', 'level_reached', '', 10, 0, 18, true)
on conflict (id) do update set
  name = excluded.name, slug = excluded.slug, description = excluded.description, icon = excluded.icon,
  category = excluded.category, requirement_type = excluded.requirement_type,
  requirement_value = excluded.requirement_value, requirement_count = excluded.requirement_count,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, active = true;
update public.achievements set active = false where id not in ('60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000007', '60000000-0000-4000-8000-000000000008', '60000000-0000-4000-8000-000000000006', '60000000-0000-4000-8000-000000000004', '60000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000009', '60000000-0000-4000-8000-000000000010', '60000000-0000-4000-8000-000000000011', '60000000-0000-4000-8000-000000000012', '60000000-0000-4000-8000-000000000013', '60000000-0000-4000-8000-000000000014', '60000000-0000-4000-8000-000000000015', '60000000-0000-4000-8000-000000000016', '60000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000017', '60000000-0000-4000-8000-000000000018');

-- XP por iniciar cada desafio (content/challenges.json → start_xp_reward).
update public.challenges set start_xp_reward = 5 where id = '40000000-0000-4000-8000-000000000001';
update public.challenges set start_xp_reward = 5 where id = '40000000-0000-4000-8000-000000000002';
update public.challenges set start_xp_reward = 5 where id = '40000000-0000-4000-8000-000000000003';
update public.challenges set start_xp_reward = 5 where id = '40000000-0000-4000-8000-000000000004';
update public.challenges set start_xp_reward = 5 where id = '40000000-0000-4000-8000-000000000005';
update public.challenges set start_xp_reward = 5 where id = '40000000-0000-4000-8000-000000000006';
update public.challenges set start_xp_reward = 5 where id = '40000000-0000-4000-8000-000000000007';
update public.challenges set start_xp_reward = 5 where id = '40000000-0000-4000-8000-000000000008';
update public.challenges set start_xp_reward = 3 where id = '40000000-0000-4000-8000-000000000009';
update public.challenges set start_xp_reward = 3 where id = '40000000-0000-4000-8000-000000000010';
update public.challenges set start_xp_reward = 3 where id = '40000000-0000-4000-8000-000000000011';
update public.challenges set start_xp_reward = 3 where id = '40000000-0000-4000-8000-000000000012';
update public.challenges set start_xp_reward = 3 where id = '40000000-0000-4000-8000-000000000013';
update public.challenges set start_xp_reward = 3 where id = '40000000-0000-4000-8000-000000000014';
update public.challenges set start_xp_reward = 3 where id = '40000000-0000-4000-8000-000000000015';
update public.challenges set start_xp_reward = 3 where id = '40000000-0000-4000-8000-000000000016';
update public.challenges set start_xp_reward = 3 where id = '40000000-0000-4000-8000-000000000017';
update public.challenges set start_xp_reward = 3 where id = '40000000-0000-4000-8000-000000000018';

-- Nível guardado no perfil segue a nova tabela de níveis.
update public.profiles set level = public.level_for_xp(total_xp);

-- >>> 23_world_system.sql
-- =====================================================================
-- 23 · Mundo virtual ecológico e evolução do mundo (Etapa 7)
-- =====================================================================
-- O mundo é CONSEQUÊNCIA das ações do jogador. Nada aqui pode ser feito
-- pelo cliente: todo desbloqueio nasce de um evento verificado (Etapa 6).
--
--   evento (lição, desafio, conquista, nível…)  → gamification_events
--     → trigger → sync_world(usuário)
--         → confere as regras de cada item (world_items.unlock_type)
--         → user_world_items (sem duplicar)
--         → refresh_world: estágio, estado e progresso (world_progress)
--         → world_stage_reached (história do mundo)

-- ---------------------------------------------------------------------
-- 1. Áreas e estágios (configuráveis)
-- ---------------------------------------------------------------------
create table public.world_areas (
  code         text primary key check (code ~ '^[a-z_]+$'),
  name         text not null,
  icon         text,
  description  text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

-- Estágio = o maior cujos três mínimos foram atingidos (itens conquistados,
-- desafios concluídos e categorias exploradas). XP não entra na conta.
create table public.world_stages (
  id              uuid primary key default gen_random_uuid(),
  stage_number    integer not null unique check (stage_number > 0),
  name            text not null,
  icon            text,
  description     text,
  -- empty (vazio) · evolving (em evolução) · developed (desenvolvido) · rich (rico) · ecosystem
  status          text not null check (status in ('empty', 'evolving', 'developed', 'rich', 'ecosystem')),
  min_items       integer not null default 0 check (min_items >= 0),
  min_challenges  integer not null default 0 check (min_challenges >= 0),
  min_categories  integer not null default 0 check (min_categories >= 0),
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. worlds: descrição, estado, estágio e progresso (cache do servidor)
-- ---------------------------------------------------------------------
alter table public.worlds
  add column description    text default 'Este mundo cresce conforme você aprende e transforma suas ações em atitudes reais.',
  add column status         text not null default 'empty'
    check (status in ('empty', 'evolving', 'developed', 'rich', 'ecosystem')),
  add column stage          integer not null default 1 check (stage >= 1),
  add column progress       integer not null default 0 check (progress between 0 and 100),
  add column background     text not null default 'meadow',
  add column theme          text not null default 'natural',
  add column configuration  jsonb not null default '{}'::jsonb,
  add column version        integer not null default 1 check (version >= 1);
alter table public.worlds alter column name set default 'Meu Primeiro Ecossistema';

comment on column public.worlds.stage is 'Calculado pelo servidor (refresh_world). O jogador não altera.';

-- ---------------------------------------------------------------------
-- 3. world_items: código, área, categoria, regra de desbloqueio e narrativa
-- ---------------------------------------------------------------------
alter table public.world_items rename column type to item_type;
alter table public.world_items rename column image_url to asset_url;
alter table public.world_items
  add column code              text,
  add column meaning           text,
  add column icon              text,
  add column area              text references public.world_areas (code),
  add column category_id       uuid references public.categories (id),
  add column milestone         boolean not null default false,
  -- initial | lesson (slug) | challenge (slug) | achievement (código) | level (número)
  add column unlock_type       text,
  add column unlock_reference  text,
  -- Nível mínimo extra (opcional). A ação real continua sendo exigida.
  add column min_level         integer check (min_level is null or min_level >= 1),
  add column sort_order        integer not null default 0,
  add column active            boolean not null default true,
  -- Mensagem mostrada quando o item surge (ex.: "Seu mundo cresceu!").
  add column unlock_title      text,
  add column unlock_message    text,
  add column updated_at        timestamptz not null default now();

update public.world_items
set code = replace(slug, '-', '_'),
    unlock_type = case when unlock_requirement ->> 'type' = 'challenge_completed' then 'challenge' else 'initial' end,
    unlock_reference = unlock_requirement ->> 'challenge_slug';

-- ---------------------------------------------------------------------
-- 4. user_world_items: dono, origem do desbloqueio, rotação e datas
-- ---------------------------------------------------------------------
alter table public.user_world_items
  add column user_id      uuid references auth.users (id) on delete cascade,
  add column source_type  text,
  add column source_id    uuid,
  add column rotation     numeric not null default 0 check (rotation between -360 and 360),
  add column created_at   timestamptz not null default now(),
  add column updated_at   timestamptz not null default now();

update public.user_world_items u
set user_id = w.user_id,
    source_type = wi.unlock_type,
    source_id = (select c.id from public.challenges c where c.slug = wi.unlock_reference),
    created_at = u.unlocked_at,
    -- posições antigas (cena 400×260) são refeitas em % pelo conteúdo (24)
    position_x = null,
    position_y = null
from public.worlds w, public.world_items wi
where w.id = u.world_id and wi.id = u.world_item_id;

alter table public.world_items
  drop column unlock_requirement,
  alter column code set not null,
  add constraint world_items_code_key unique (code),
  add constraint world_items_code_format check (code ~ '^[a-z0-9_]+$'),
  alter column unlock_type set not null,
  add constraint world_items_unlock_type_check
    check (unlock_type in ('initial', 'lesson', 'challenge', 'achievement', 'level')),
  add constraint world_items_unlock_reference_check
    check ((unlock_type = 'initial') = (unlock_reference is null));

alter table public.user_world_items
  alter column user_id set not null,
  alter column source_type set not null,
  add constraint user_world_items_source_type_check
    check (source_type in ('initial', 'lesson', 'challenge', 'achievement', 'level')),
  -- posição em % dentro da área
  add constraint user_world_items_position_check
    check ((position_x is null or position_x between 0 and 100) and (position_y is null or position_y between 0 and 100));

create index user_world_items_user_idx on public.user_world_items (user_id);
create index user_world_items_item_idx on public.user_world_items (world_item_id);
create index user_world_items_source_idx on public.user_world_items (source_type, source_id);
create index world_items_unlock_idx on public.world_items (unlock_type, unlock_reference);
create index world_items_area_idx on public.world_items (area);

create trigger world_items_set_updated_at
  before update on public.world_items
  for each row execute function public.set_updated_at();
create trigger user_world_items_set_updated_at
  before update on public.user_world_items
  for each row execute function public.set_updated_at();

-- A história do mundo registra cada estágio alcançado.
alter table public.gamification_events drop constraint gamification_events_event_type_check;
alter table public.gamification_events add constraint gamification_events_event_type_check check (event_type in (
  'lesson_completed', 'quiz_passed', 'quiz_improved', 'challenge_started',
  'challenge_step_completed', 'followup_completed', 'challenge_completed',
  'achievement_unlocked', 'level_reached', 'world_stage_reached', 'bonus'
));

-- ---------------------------------------------------------------------
-- 5. calculateWorldStage: progresso do mundo a partir de dados reais
-- ---------------------------------------------------------------------
-- progresso (%) = 50% itens conquistados + 30% desafios concluídos
--               + 20% categorias exploradas. Itens do mundo inicial não contam.
create or replace function public.world_progress(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_items       integer;
  v_items_total integer;
  v_ch          integer;
  v_ch_total    integer;
  v_cat         integer;
  v_cat_total   integer;
  v_stage       public.world_stages;
  v_next        public.world_stages;
  v_progress    integer;
begin
  select count(*) into v_items_total from public.world_items where active and unlock_type <> 'initial';
  select count(*) into v_items
  from public.user_world_items u join public.world_items wi on wi.id = u.world_item_id
  where u.user_id = p_user and wi.unlock_type <> 'initial';

  select count(*) into v_ch_total from public.challenges where active;
  select count(distinct challenge_id) into v_ch
  from public.user_challenges where user_id = p_user and status = 'completed';

  select count(*) into v_cat_total from public.categories;
  select count(distinct category_id) into v_cat from (
    select l.category_id from public.user_lesson_progress p
    join public.lessons l on l.id = p.lesson_id
    where p.user_id = p_user and p.status = 'completed'
    union
    select c.category_id from public.user_challenges uc
    join public.challenges c on c.id = uc.challenge_id
    where uc.user_id = p_user and uc.status = 'completed'
  ) x;

  select * into v_stage from public.world_stages
  where min_items <= v_items and min_challenges <= v_ch and min_categories <= v_cat
  order by stage_number desc limit 1;
  select * into v_next from public.world_stages
  where stage_number > coalesce(v_stage.stage_number, 0)
  order by stage_number limit 1;

  v_progress := least(100, round(100 * (
      0.5 * v_items::numeric / greatest(v_items_total, 1)
    + 0.3 * v_ch::numeric / greatest(v_ch_total, 1)
    + 0.2 * v_cat::numeric / greatest(v_cat_total, 1))));

  return jsonb_build_object(
    'stage',                coalesce(v_stage.stage_number, 1),
    'stage_name',           v_stage.name,
    'status',               coalesce(v_stage.status, 'empty'),
    'progress',             v_progress,
    'items_unlocked',       v_items,
    'items_total',          v_items_total,
    'challenges_completed', v_ch,
    'challenges_total',     v_ch_total,
    'categories_explored',  v_cat,
    'categories_total',     v_cat_total,
    'next_stage', case when v_next.id is null then null else jsonb_build_object(
      'stage', v_next.stage_number, 'name', v_next.name, 'min_items', v_next.min_items,
      'min_challenges', v_next.min_challenges, 'min_categories', v_next.min_categories) end
  );
end;
$$;

-- Atualiza o estágio guardado no mundo e registra cada estágio novo.
create or replace function public.refresh_world(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old   integer;
  v_p     jsonb := public.world_progress(p_user);
  v_new   integer := (v_p ->> 'stage')::integer;
begin
  select stage into v_old from public.worlds where user_id = p_user for update;
  update public.worlds
  set stage = v_new,
      status = v_p ->> 'status',
      progress = (v_p ->> 'progress')::integer,
      level = v_new,
      environment_score = (v_p ->> 'progress')::integer
  where user_id = p_user;

  if v_new > coalesce(v_old, 1) then
    insert into public.gamification_events (user_id, event_type, reference_id, metadata)
    select p_user, 'world_stage_reached', s.id, jsonb_build_object('stage', s.stage_number, 'name', s.name)
    from public.world_stages s
    where s.stage_number > coalesce(v_old, 1) and s.stage_number <= v_new
    on conflict (user_id, event_type, reference_id) do nothing;
  end if;
  return v_p;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Desbloqueio: confere as regras de cada item e insere sem duplicar
-- ---------------------------------------------------------------------
create or replace function public.sync_world(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_world  uuid;
  v_level  integer;
  r        record;
  v_src    uuid;
  v_ok     boolean;
  v_id     uuid;
  v_new    jsonb := '[]'::jsonb;
begin
  select level into v_level from public.profiles where user_id = p_user;
  if v_level is null then
    return v_new; -- sem perfil, sem mundo
  end if;

  insert into public.worlds (user_id) values (p_user) on conflict (user_id) do nothing;
  select id into v_world from public.worlds where user_id = p_user;

  for r in
    select wi.* from public.world_items wi
    where wi.active
      and not exists (select 1 from public.user_world_items u
                      where u.world_id = v_world and u.world_item_id = wi.id)
    order by wi.sort_order
  loop
    v_src := null;
    v_ok := r.min_level is null or v_level >= r.min_level;
    if v_ok then
      case r.unlock_type
        when 'initial' then
          v_ok := true;
        when 'lesson' then
          select l.id into v_src from public.lessons l
          join public.user_lesson_progress p on p.lesson_id = l.id and p.user_id = p_user and p.status = 'completed'
          where l.slug = r.unlock_reference;
          v_ok := v_src is not null;
        when 'challenge' then
          select c.id into v_src from public.challenges c
          where c.slug = r.unlock_reference
            and exists (select 1 from public.user_challenges uc
                        where uc.challenge_id = c.id and uc.user_id = p_user and uc.status = 'completed');
          v_ok := v_src is not null;
        when 'achievement' then
          select a.id into v_src from public.achievements a
          join public.user_achievements ua on ua.achievement_id = a.id and ua.user_id = p_user
          where a.slug = r.unlock_reference;
          v_ok := v_src is not null;
        when 'level' then
          select l.id into v_src from public.levels l
          where l.level_number = r.unlock_reference::integer and l.level_number <= v_level;
          v_ok := v_src is not null;
        else
          v_ok := false;
      end case;
    end if;

    continue when not v_ok;

    insert into public.user_world_items
      (user_id, world_id, world_item_id, position_x, position_y, source_type, source_id, metadata)
    values (
      p_user, v_world, r.id,
      (r.metadata -> 'slot' ->> 'x')::numeric,
      (r.metadata -> 'slot' ->> 'y')::numeric,
      r.unlock_type, v_src,
      -- itens do mundo inicial já nascem vistos (não "surgem")
      jsonb_build_object('revealed', r.unlock_type = 'initial')
    )
    on conflict (world_id, world_item_id) do nothing
    returning id into v_id;

    if v_id is not null then
      v_new := v_new || jsonb_build_array(jsonb_build_object(
        'id', r.id, 'code', r.code, 'slug', r.slug, 'name', r.name, 'type', r.item_type, 'icon', r.icon
      ));
    end if;
  end loop;

  perform public.refresh_world(p_user);
  return v_new;
end;
$$;

-- Itens liberados nesta mesma transação (a ação atual), por qualquer regra.
create or replace function public.world_items_unlocked_now(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', wi.id, 'code', wi.code, 'slug', wi.slug, 'name', wi.name, 'type', wi.item_type, 'icon', wi.icon
  ) order by wi.sort_order), '[]'::jsonb)
  from public.user_world_items u
  join public.world_items wi on wi.id = u.world_item_id
  where u.user_id = p_user and u.unlocked_at = now() and u.source_type <> 'initial';
$$;

-- Integração com a Etapa 6: todo evento real atualiza o mundo.
create or replace function public.on_gamification_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_type <> 'world_stage_reached' then
    perform public.sync_world(new.user_id);
  end if;
  return new;
end;
$$;

create trigger gamification_events_world
  after insert on public.gamification_events
  for each row execute function public.on_gamification_event();

-- Todo perfil novo ganha o seu mundo inicial.
create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.worlds (user_id) values (new.user_id)
  on conflict (user_id) do nothing;
  perform public.sync_world(new.user_id);
  return new;
end;
$$;

drop function public.unlock_world_items_for_challenge(uuid, text);

-- ---------------------------------------------------------------------
-- 7. Funções existentes ajustadas
-- ---------------------------------------------------------------------
create or replace function public.achievement_progress(p_user uuid, p_type text, p_value text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_categories text[] := string_to_array(replace(coalesce(p_value, ''), ' ', ''), ',');
begin
  case p_type
    when 'lessons_completed' then
      return (select count(*) from public.user_lesson_progress
              where user_id = p_user and status = 'completed');
    when 'quizzes_passed' then
      return (select count(distinct quiz_id) from public.quiz_attempts
              where user_id = p_user and passed);
    when 'challenges_completed' then
      return (select count(distinct challenge_id) from public.user_challenges
              where user_id = p_user and status = 'completed');
    when 'challenge_completed' then
      return (select count(distinct uc.challenge_id) from public.user_challenges uc
              join public.challenges c on c.id = uc.challenge_id
              where uc.user_id = p_user and uc.status = 'completed' and c.slug = p_value);
    when 'category_challenges_completed' then
      return (select count(distinct uc.challenge_id) from public.user_challenges uc
              join public.challenges c on c.id = uc.challenge_id
              join public.categories cat on cat.id = c.category_id
              where uc.user_id = p_user and uc.status = 'completed' and cat.slug = any (v_categories));
    when 'category_actions_completed' then
      -- ação = desafio concluído ou acompanhamento realizado na categoria
      return (select count(distinct uc.challenge_id) from public.user_challenges uc
              join public.challenges c on c.id = uc.challenge_id
              join public.categories cat on cat.id = c.category_id
              where uc.user_id = p_user and uc.status = 'completed' and cat.slug = any (v_categories))
           + (select count(distinct f.challenge_step_id) from public.challenge_followups f
              join public.user_challenges uc on uc.id = f.user_challenge_id
              join public.challenges c on c.id = uc.challenge_id
              join public.categories cat on cat.id = c.category_id
              where uc.user_id = p_user and f.status = 'completed' and cat.slug = any (v_categories)
                and uc.status not in ('cancelled', 'expired'));
    when 'categories_explored' then
      -- categoria explorada = pelo menos uma lição ou um desafio concluído nela
      return (select count(distinct category_id) from (
                select l.category_id from public.user_lesson_progress p
                join public.lessons l on l.id = p.lesson_id
                where p.user_id = p_user and p.status = 'completed'
                union
                select c.category_id from public.user_challenges uc
                join public.challenges c on c.id = uc.challenge_id
                where uc.user_id = p_user and uc.status = 'completed'
              ) x);
    when 'level_reached' then
      return (select level from public.profiles where user_id = p_user);
    when 'cycles_completed' then
      -- Um ciclo termina quando o item conquistado por um desafio aparece no mundo.
      return (select count(*) from public.user_world_items uwi
              where uwi.user_id = p_user and uwi.source_type = 'challenge'
                and coalesce((uwi.metadata ->> 'revealed')::boolean, false));
    else
      return 0;
  end case;
end;
$$;

create or replace function public.complete_challenge(p_user_challenge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user       uuid := public.require_user();
  v_uc         public.user_challenges;
  v_challenge  public.challenges;
  v_xp         integer;
  v_items      jsonb;
  v_ach        jsonb;
begin
  -- Trava a linha: cliques simultâneos esperam e veem o desafio já concluído.
  select * into v_uc from public.user_challenges
  where id = p_user_challenge_id and user_id = v_user
  for update;
  if not found then
    raise exception 'not_found';
  end if;

  if v_uc.status = 'completed' then
    return jsonb_build_object('already_completed', true, 'xp_awarded', 0,
                              'world_items', '[]'::jsonb, 'achievements', '[]'::jsonb);
  end if;
  if v_uc.status not in ('accepted', 'in_progress', 'waiting_follow_up') then
    raise exception 'challenge_not_active';
  end if;
  if public.challenge_is_overdue(v_uc.id) then
    raise exception 'challenge_expired';
  end if;
  if not public.challenge_main_steps_done(v_uc.id) then
    raise exception 'steps_pending';
  end if;
  if exists (
    select 1 from public.challenge_followups f
    join public.challenge_steps cs on cs.id = f.challenge_step_id
    where f.user_challenge_id = v_uc.id and f.status <> 'completed' and cs.required and cs.active
  ) or exists (
    -- acompanhamentos obrigatórios ainda nem agendados
    select 1 from public.challenge_steps cs
    where cs.challenge_id = v_uc.challenge_id and cs.step_type = 'follow_up' and cs.active and cs.required
      and not exists (select 1 from public.challenge_followups f
                      where f.user_challenge_id = v_uc.id and f.challenge_step_id = cs.id)
  ) then
    raise exception 'followups_pending';
  end if;

  select * into v_challenge from public.challenges where id = v_uc.challenge_id;

  update public.user_challenge_steps ucs
  set status = 'completed', completed_at = now()
  from public.challenge_steps cs
  where cs.id = ucs.challenge_step_id and ucs.user_challenge_id = v_uc.id
    and cs.step_type = 'completion' and ucs.status <> 'completed';

  update public.user_challenges
  set status = 'completed',
      completed_at = coalesce(completed_at, now()),
      started_at = coalesce(started_at, now())
  where id = v_uc.id;
  perform public.refresh_user_challenge_progress(v_uc.id);

  -- Recompensa: idempotente por (usuário, 'challenge_completed', desafio).
  v_xp := public.process_gamification_event(v_user, 'challenge_completed', v_challenge.id);
  -- O item do mundo é liberado pelo evento (trigger → sync_world), não por aqui.
  v_ach := public.check_achievements(v_user);
  v_items := public.world_items_unlocked_now(v_user);

  return jsonb_build_object(
    'already_completed', false,
    'xp_awarded',   v_xp,
    'world_items',  v_items,
    'achievements', v_ach
  );
end;
$$;

create or replace function public.get_player_state()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
begin
  return jsonb_build_object(
    'server_time', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.user_id = v_user),

    'lessons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'lesson_id', l.lesson_id, 'status', l.status, 'progress_percentage', l.progress_percentage,
        'last_section_index', l.last_section_index, 'last_accessed_at', l.last_accessed_at,
        'completed_at', l.completed_at
      ))
      from public.user_lesson_progress l where l.user_id = v_user
    ), '[]'::jsonb),

    'favorites', coalesce((
      select jsonb_agg(f.lesson_id order by f.created_at desc)
      from public.user_lesson_favorites f where f.user_id = v_user
    ), '[]'::jsonb),

    'quizzes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'quiz_id', b.quiz_id, 'score', b.score, 'correct_answers', b.correct_answers,
        'total_questions', b.total_questions, 'passed', b.passed, 'completed_at', b.completed_at,
        'attempts', (select count(*) from public.quiz_attempts c
                     where c.user_id = v_user and c.quiz_id = b.quiz_id and c.completed_at is not null)
      ))
      from (
        select distinct on (a.quiz_id) a.*
        from public.quiz_attempts a
        where a.user_id = v_user and a.completed_at is not null
        order by a.quiz_id, a.passed desc, a.score desc, a.completed_at desc
      ) b
    ), '[]'::jsonb),

    'challenges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', uc.id, 'challenge_id', uc.challenge_id, 'status', uc.status,
        'accepted_at', uc.accepted_at, 'deadline_at', uc.deadline_at, 'started_at', uc.started_at,
        'completed_at', uc.completed_at, 'progress_percentage', uc.progress_percentage,
        'steps', coalesce((
          select jsonb_agg(jsonb_build_object(
            'challenge_step_id', s.challenge_step_id, 'status', s.status,
            'completed_at', s.completed_at, 'notes', s.notes
          ))
          from public.user_challenge_steps s where s.user_challenge_id = uc.id
        ), '[]'::jsonb),
        'followups', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', f.id, 'challenge_step_id', f.challenge_step_id, 'title', f.title,
            'description', f.description, 'scheduled_for', f.scheduled_for,
            'completed_at', f.completed_at, 'status', f.status, 'evidence_required', f.evidence_required
          ) order by f.scheduled_for)
          from public.challenge_followups f where f.user_challenge_id = uc.id
        ), '[]'::jsonb),
        'evidence', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', e.id, 'followup_id', e.followup_id, 'challenge_step_id', e.challenge_step_id,
            'evidence_type', e.evidence_type, 'file_url', e.file_url, 'thumbnail_url', e.thumbnail_url,
            'file_name', e.file_name, 'mime_type', e.mime_type, 'file_size', e.file_size,
            'description', e.description, 'captured_at', e.captured_at, 'uploaded_at', e.uploaded_at,
            'status', e.status, 'created_at', e.created_at
          ) order by e.created_at)
          from public.challenge_evidence e where e.user_challenge_id = uc.id
        ), '[]'::jsonb)
      ))
      from public.user_challenges uc
      where uc.user_id = v_user and uc.status not in ('expired', 'cancelled')
    ), '[]'::jsonb),

    'achievements', coalesce((
      select jsonb_agg(jsonb_build_object('achievement_id', ua.achievement_id, 'unlocked_at', ua.unlocked_at))
      from public.user_achievements ua where ua.user_id = v_user
    ), '[]'::jsonb),

    'world', (
      select jsonb_build_object(
        'id', w.id, 'name', w.name, 'description', w.description,
        'stage', w.stage, 'status', w.status, 'progress', w.progress,
        'background', w.background, 'theme', w.theme,
        'level', w.level, 'environment_score', w.environment_score,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', i.id, 'world_item_id', i.world_item_id, 'quantity', i.quantity,
            'position_x', i.position_x, 'position_y', i.position_y, 'rotation', i.rotation,
            'source_type', i.source_type, 'source_id', i.source_id,
            'metadata', i.metadata, 'unlocked_at', i.unlocked_at
          ) order by i.unlocked_at)
          from public.user_world_items i where i.world_id = w.id
        ), '[]'::jsonb),
        -- história do mundo: cada estágio alcançado
        'stage_history', coalesce((
          select jsonb_agg(jsonb_build_object(
            'stage', (e.metadata ->> 'stage')::integer, 'reached_at', e.created_at
          ) order by e.created_at)
          from public.gamification_events e
          where e.user_id = v_user and e.event_type = 'world_stage_reached'
        ), '[]'::jsonb)
      )
      from public.worlds w where w.user_id = v_user
    )
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 8. RLS e permissões
-- ---------------------------------------------------------------------
alter table public.world_areas enable row level security;
alter table public.world_stages enable row level security;
revoke all on public.world_areas, public.world_stages from anon, authenticated;
grant select on public.world_areas, public.world_stages to anon, authenticated;
grant insert, update, delete on public.world_areas, public.world_stages to authenticated;
create policy world_areas_read on public.world_areas for select to anon, authenticated using (true);
create policy world_stages_read on public.world_stages for select to anon, authenticated using (true);
create policy world_areas_admin on public.world_areas for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy world_stages_admin on public.world_stages for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Itens do jogador: leitura só dos próprios (agora direto por user_id).
drop policy user_world_items_read_own on public.user_world_items;
create policy user_world_items_read_own on public.user_world_items
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

revoke execute on function public.world_progress(uuid),
                           public.refresh_world(uuid),
                           public.sync_world(uuid),
                           public.world_items_unlocked_now(uuid),
                           public.on_gamification_event(),
                           public.handle_new_profile()
  from public, anon, authenticated;

-- >>> 24_world_content.sql
-- =====================================================================
-- 24 · Mundo virtual: áreas, estágios e itens (Etapa 7)
-- =====================================================================
-- ARQUIVO GERADO por "npm run content:sql" a partir de content/world.json.
-- Não edite à mão. Idempotente: pode ser executado de novo depois de editar o JSON.
-- Itens que saírem do JSON ficam inativos (quem já tem, continua tendo).

insert into public.world_areas (code, name, icon, description, sort_order) values
  ('natural', 'Área natural', '🌳', 'Árvores, flores, plantas e o solo que sustenta a vida.', 1),
  ('water', 'Área da água', '💧', 'Lago, rio, nascente e a vegetação perto da água.', 2),
  ('garden', 'Horta', '🥕', 'Canteiros, hortaliças, ervas e compostagem.', 3),
  ('pollinators', 'Jardim dos polinizadores', '🐝', 'Flores, abelhas, borboletas e pequenos insetos.', 4),
  ('community', 'Área comunitária', '🤝', 'Praça, jardins e espaços coletivos.', 5)
on conflict (code) do update set
  name = excluded.name, icon = excluded.icon, description = excluded.description, sort_order = excluded.sort_order;

insert into public.world_stages (id, stage_number, name, icon, description, status, min_items, min_challenges, min_categories) values
  ('72000000-0000-4000-8000-000000000001', 1, 'Terreno', '🟫', 'Um terreno simples, com poucas plantas, esperando cuidado.', 'empty', 0, 0, 0),
  ('72000000-0000-4000-8000-000000000002', 2, 'Primeiras plantas', '🌱', 'O que você aprendeu começa a brotar.', 'evolving', 1, 0, 1),
  ('72000000-0000-4000-8000-000000000003', 3, 'Ecossistema', '🌳', 'Árvores e flores nascidas de ações reais.', 'evolving', 3, 1, 1),
  ('72000000-0000-4000-8000-000000000004', 4, 'Biodiversidade', '🐝', 'Animais e polinizadores chegam ao seu mundo.', 'developed', 6, 2, 2),
  ('72000000-0000-4000-8000-000000000005', 5, 'Recursos', '💧', 'Água e horta sustentam a vida.', 'rich', 10, 3, 3),
  ('72000000-0000-4000-8000-000000000006', 6, 'Comunidade', '🤝', 'Espaços coletivos cuidados por todos.', 'rich', 14, 4, 4),
  ('72000000-0000-4000-8000-000000000007', 7, 'Ecossistema vivo', '🌎', 'Um mundo completo e diversificado.', 'ecosystem', 20, 6, 5)
on conflict (id) do update set
  stage_number = excluded.stage_number, name = excluded.name, icon = excluded.icon, description = excluded.description,
  status = excluded.status, min_items = excluded.min_items, min_challenges = excluded.min_challenges,
  min_categories = excluded.min_categories;
delete from public.world_stages where id not in ('72000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000004', '72000000-0000-4000-8000-000000000005', '72000000-0000-4000-8000-000000000006', '72000000-0000-4000-8000-000000000007');

-- Códigos antigos liberados antes do upsert (os itens mantêm os mesmos IDs).
update public.world_items set code = 'old_' || replace(id::text, '-', '_'), slug = 'old-' || id::text
where id in ('70000000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000006', '70000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000007', '70000000-0000-4000-8000-000000000008', '70000000-0000-4000-8000-000000000009', '70000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000010', '70000000-0000-4000-8000-000000000011', '70000000-0000-4000-8000-000000000012', '70000000-0000-4000-8000-000000000013', '70000000-0000-4000-8000-000000000014', '70000000-0000-4000-8000-000000000015', '70000000-0000-4000-8000-000000000016', '70000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000017', '70000000-0000-4000-8000-000000000018', '70000000-0000-4000-8000-000000000019', '70000000-0000-4000-8000-000000000004', '70000000-0000-4000-8000-000000000020', '70000000-0000-4000-8000-000000000021', '70000000-0000-4000-8000-000000000022', '70000000-0000-4000-8000-000000000023', '70000000-0000-4000-8000-000000000024', '70000000-0000-4000-8000-000000000025', '70000000-0000-4000-8000-000000000026', '70000000-0000-4000-8000-000000000027', '70000000-0000-4000-8000-000000000028', '70000000-0000-4000-8000-000000000029', '70000000-0000-4000-8000-000000000030', '70000000-0000-4000-8000-000000000031', '70000000-0000-4000-8000-000000000032', '70000000-0000-0000-0000-000000000033');
insert into public.world_items (id, code, slug, name, description, meaning, icon, area, category_id, item_type, rarity,
  milestone, unlock_type, unlock_reference, min_level, sort_order, metadata, unlock_title, unlock_message, active) values
  ('70000000-0000-4000-8000-000000000005', 'plant_small', 'plant_small', 'Pequena planta', 'Um broto que já estava no terreno.', 'O começo da sua jornada: todo ecossistema começa pequeno.', '🌱', 'natural', '10000000-0000-4000-8000-000000000001', 'plant', 'common',
   false, 'initial', null, null, 1, '{"slot":{"x":10,"y":88}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000006', 'bush_basic', 'bush_basic', 'Arbusto', 'Vegetação que cresce com o conhecimento.', 'Sua primeira lição concluída: aprender também faz o mundo crescer.', '🌿', 'natural', '10000000-0000-4000-8000-000000000001', 'plant', 'common',
   false, 'achievement', 'primeiro-aprendizado', null, 2, '{"slot":{"x":88,"y":58}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000001', 'tree_basic', 'tree_basic', 'Árvore jovem', 'A árvore que nasceu do seu plantio real.', 'O plantio que você fez no mundo real e acompanhou por seis meses.', '🌳', 'natural', '10000000-0000-4000-8000-000000000001', 'tree', 'common',
   false, 'challenge', 'plante-uma-arvore', null, 3, '{"slot":{"x":55,"y":88}}'::jsonb, 'Seu mundo cresceu!', 'Você realizou uma ação no mundo real. Agora existe uma nova árvore no seu mundo ECO QUEST.', true),
  ('70000000-0000-4000-8000-000000000007', 'tree_first_step', 'tree_first_step', 'Árvore do Primeiro Passo', 'Marco especial da sua primeira ação ambiental.', 'O dia em que você transformou conhecimento em ação pela primeira vez.', '🌳', 'natural', '10000000-0000-4000-8000-000000000001', 'tree', 'rare',
   true, 'achievement', 'primeiro-passo', null, 4, '{"slot":{"x":68,"y":56}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000008', 'tree_large', 'tree_large', 'Árvore grande', 'Uma árvore que cresceu com a sua jornada.', 'Sua constância: chegar ao nível 5 mostra que você continua cuidando.', '🌳', 'natural', '10000000-0000-4000-8000-000000000001', 'tree', 'uncommon',
   false, 'level', '5', null, 5, '{"slot":{"x":42,"y":54}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000009', 'tree_special', 'tree_special', 'Árvore especial', 'Árvore rara do Guardião das Plantas.', 'Cinco ações pela natureza: plantios, cultivos e acompanhamentos.', '🌲', 'natural', '10000000-0000-4000-8000-000000000001', 'tree', 'epic',
   true, 'achievement', 'guardiao-das-plantas', null, 6, '{"slot":{"x":16,"y":52}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000002', 'flower_basic', 'flower_basic', 'Flor', 'Uma flor cultivada por você.', 'A flor que você cultivou e acompanhou no mundo real.', '🌸', 'natural', '10000000-0000-4000-8000-000000000001', 'flower', 'common',
   false, 'challenge', 'cultive-uma-flor', null, 7, '{"slot":{"x":30,"y":90}}'::jsonb, 'Nova vida no seu mundo!', 'Seu mundo ganhou uma nova espécie vegetal.', true),
  ('70000000-0000-4000-8000-000000000010', 'flowerbed', 'flowerbed', 'Canteiro de flores', 'Um canteiro cheio de cor.', 'Três desafios de natureza concluídos: você virou um pequeno jardineiro.', '🌼', 'natural', '10000000-0000-4000-8000-000000000001', 'flower', 'uncommon',
   false, 'achievement', 'pequeno-jardineiro', null, 8, '{"slot":{"x":80,"y":90}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000011', 'riverbank', 'riverbank', 'Vegetação de margem', 'Plantas que protegem as margens.', 'O que você aprendeu sobre por que economizar água.', '🌾', 'water', '10000000-0000-4000-8000-000000000002', 'plant', 'common',
   false, 'lesson', 'por-que-precisamos-economizar-agua', null, 9, '{"slot":{"x":12,"y":88}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000012', 'pond', 'pond', 'Lago', 'Um pequeno lago de água limpa.', 'O que você aprendeu sobre o caminho da água da chuva.', '🪷', 'water', '10000000-0000-4000-8000-000000000002', 'water', 'common',
   false, 'lesson', 'o-que-acontece-com-a-agua-da-chuva', null, 10, '{"slot":{"x":38,"y":74}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000013', 'water_basic', 'water_basic', 'Pequeno ponto de água', 'Água cuidada gota a gota.', 'O desperdício de água que você reduziu em casa.', '💧', 'water', '10000000-0000-4000-8000-000000000002', 'water', 'common',
   false, 'challenge', 'reduza-o-desperdicio-de-agua', null, 11, '{"slot":{"x":64,"y":88}}'::jsonb, 'A água chegou ao seu mundo!', 'Cada gota que você economizou virou vida no seu ecossistema.', true),
  ('70000000-0000-4000-8000-000000000014', 'river', 'river', 'Rio', 'Um rio que atravessa o seu mundo.', 'Uma jornada longa: o nível 7 mostra o quanto você já cuidou.', '🌊', 'water', '10000000-0000-4000-8000-000000000002', 'water', 'rare',
   false, 'level', '7', null, 12, '{"slot":{"x":86,"y":58}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000015', 'garden_bed', 'garden_bed', 'Canteiro', 'Terra preparada para o cultivo.', 'O que você aprendeu sobre como funciona uma horta.', '🌱', 'garden', '10000000-0000-4000-8000-000000000001', 'plant', 'common',
   false, 'lesson', 'o-que-e-uma-horta', null, 13, '{"slot":{"x":12,"y":88}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000016', 'herbs', 'herbs', 'Ervas', 'Ervas aromáticas.', 'O que você aprendeu sobre como uma planta cresce.', '🌿', 'garden', '10000000-0000-4000-8000-000000000001', 'plant', 'common',
   false, 'lesson', 'como-uma-planta-cresce', null, 14, '{"slot":{"x":30,"y":62}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000003', 'garden_basic', 'garden_basic', 'Horta Inicial', 'Sua primeira horta com hortaliças.', 'A horta que você montou e cuidou no mundo real.', '🥬', 'garden', '10000000-0000-4000-8000-000000000001', 'plant', 'rare',
   true, 'challenge', 'crie-uma-pequena-horta', null, 15, '{"slot":{"x":48,"y":88}}'::jsonb, 'Sua horta nasceu!', 'Seu mundo agora tem uma horta cultivada por você.', true),
  ('70000000-0000-4000-8000-000000000017', 'carrot', 'carrot', 'Cenoura', 'Cenouras crescendo no canteiro.', 'O alimento que nasce do cuidado com a terra.', '🥕', 'garden', '10000000-0000-4000-8000-000000000001', 'plant', 'common',
   false, 'challenge', 'crie-uma-pequena-horta', null, 16, '{"slot":{"x":66,"y":64}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000018', 'tomato', 'tomato', 'Tomate', 'Tomates maduros.', 'Sua evolução: o nível 4 trouxe a primeira colheita.', '🍅', 'garden', '10000000-0000-4000-8000-000000000001', 'plant', 'common',
   false, 'level', '4', null, 17, '{"slot":{"x":84,"y":88}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000019', 'compost', 'compost', 'Composteira', 'Restos orgânicos virando adubo.', 'A semana em que você separou os seus resíduos.', '♻️', 'garden', '10000000-0000-4000-8000-000000000003', 'decoration', 'common',
   false, 'challenge', 'separe-seus-residuos-por-7-dias', null, 18, '{"slot":{"x":88,"y":52}}'::jsonb, 'Nada se perde!', 'Seus resíduos separados viraram uma composteira no seu mundo.', true),
  ('70000000-0000-4000-8000-000000000004', 'flower_pollinator', 'flower_pollinator', 'Flores para polinizadores', 'Flores que atraem abelhas e borboletas.', 'O espaço para polinizadores que você criou no mundo real.', '🌺', 'pollinators', '10000000-0000-4000-8000-000000000005', 'flower', 'common',
   false, 'challenge', 'crie-um-espaco-para-polinizadores', null, 19, '{"slot":{"x":14,"y":88}}'::jsonb, 'A vida está chegando!', 'Seu mundo agora possui um espaço para polinizadores.', true),
  ('70000000-0000-4000-8000-000000000020', 'bee', 'bee', 'Abelha', 'Uma abelha visitando as flores.', 'As flores que você plantou atraíram polinizadores.', '🐝', 'pollinators', '10000000-0000-4000-8000-000000000005', 'animal', 'common',
   false, 'challenge', 'crie-um-espaco-para-polinizadores', null, 20, '{"slot":{"x":28,"y":50}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000021', 'butterfly', 'butterfly', 'Borboleta', 'Uma borboleta de passagem.', 'Um ambiente acolhedor para a vida.', '🦋', 'pollinators', '10000000-0000-4000-8000-000000000005', 'animal', 'common',
   false, 'challenge', 'crie-um-espaco-para-polinizadores', null, 21, '{"slot":{"x":58,"y":44}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000022', 'pollinator_garden', 'pollinator_garden', 'Jardim da Vida', 'Jardim especial dos polinizadores.', 'Seu primeiro desafio de biodiversidade concluído.', '🌻', 'pollinators', '10000000-0000-4000-8000-000000000005', 'flower', 'epic',
   true, 'achievement', 'amigo-dos-polinizadores', null, 22, '{"slot":{"x":40,"y":86}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000023', 'ladybug', 'ladybug', 'Joaninha', 'Uma joaninha nas folhas.', 'O que você aprendeu sobre biodiversidade.', '🐞', 'pollinators', '10000000-0000-4000-8000-000000000005', 'animal', 'common',
   false, 'lesson', 'o-que-e-biodiversidade', null, 23, '{"slot":{"x":64,"y":88}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000024', 'insect', 'insect', 'Pequeno inseto', 'Pequenos seres que movem o ecossistema.', 'O que você aprendeu sobre a importância dos polinizadores.', '🐛', 'pollinators', '10000000-0000-4000-8000-000000000005', 'animal', 'common',
   false, 'lesson', 'por-que-os-polinizadores-sao-importantes', null, 24, '{"slot":{"x":86,"y":88}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000025', 'bird', 'bird', 'Pássaro', 'Um pássaro que encontrou abrigo.', 'Você explorou quatro temas ambientais e o seu mundo ficou mais diverso.', '🐦', 'pollinators', '10000000-0000-4000-8000-000000000005', 'animal', 'uncommon',
   false, 'achievement', 'explorador-eco', null, 25, '{"slot":{"x":84,"y":36}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000026', 'community_tree', 'community_tree', 'Árvore comunitária', 'Uma árvore cuidada por todos.', 'A ação ambiental coletiva de que você participou.', '🌳', 'community', '10000000-0000-4000-8000-000000000006', 'tree', 'common',
   false, 'challenge', 'participe-de-uma-acao-ambiental', null, 26, '{"slot":{"x":14,"y":76}}'::jsonb, 'Juntos fazemos mais!', 'Sua participação numa ação coletiva trouxe uma árvore comunitária para o seu mundo.', true),
  ('70000000-0000-4000-8000-000000000027', 'green_square', 'green_square', 'Praça Verde', 'Praça especial da comunidade.', 'Sua primeira ação comunitária.', '🏞️', 'community', '10000000-0000-4000-8000-000000000006', 'building', 'epic',
   true, 'achievement', 'acao-em-comunidade', null, 27, '{"slot":{"x":38,"y":88}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000028', 'community_garden', 'community_garden', 'Jardim', 'Um jardim aberto a todos.', 'Sua evolução: o nível 3 trouxe um jardim para a comunidade.', '🌷', 'community', '10000000-0000-4000-8000-000000000006', 'flower', 'common',
   false, 'level', '3', null, 28, '{"slot":{"x":62,"y":88}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000029', 'green_area', 'green_area', 'Área verde reaproveitada', 'Vasos feitos com materiais reutilizados.', 'O que você aprendeu sobre reutilizar.', '🪴', 'community', '10000000-0000-4000-8000-000000000003', 'decoration', 'common',
   false, 'lesson', 'o-que-significa-reutilizar', null, 29, '{"slot":{"x":86,"y":88}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000030', 'solar_panel', 'solar_panel', 'Painel solar', 'Energia limpa para a comunidade.', 'A semana de consumo consciente que você completou.', '☀️', 'community', '10000000-0000-4000-8000-000000000004', 'building', 'common',
   false, 'challenge', 'semana-do-consumo-consciente', null, 30, '{"slot":{"x":34,"y":52}}'::jsonb, 'Energia limpa!', 'Seu consumo consciente trouxe um painel solar para o seu mundo.', true),
  ('70000000-0000-4000-8000-000000000031', 'sustainable_light', 'sustainable_light', 'Iluminação sustentável', 'Luz que economiza energia.', 'O que você aprendeu sobre fontes renováveis.', '💡', 'community', '10000000-0000-4000-8000-000000000004', 'building', 'common',
   false, 'lesson', 'o-que-sao-fontes-renovaveis', null, 31, '{"slot":{"x":58,"y":56}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000032', 'community_space', 'community_space', 'Centro ecológico', 'Um espaço para aprender e agir juntos.', 'Nível 10: uma referência em cuidar do planeta.', '🏡', 'community', '10000000-0000-4000-8000-000000000006', 'building', 'legendary',
   false, 'level', '10', null, 32, '{"slot":{"x":82,"y":54}}'::jsonb, null, null, true),
  ('70000000-0000-0000-0000-000000000033', 'cow_pasture', 'cow_pasture', 'Vaca no pasto', 'Uma vaca em um espaço verde e seguro.', 'Você aprendeu sobre os animais e a origem dos derivados do leite.', '🐄', 'natural', '10000000-0000-4000-8000-000000000001', 'animal', 'common',
   false, 'challenge', 'conheca-a-vaca-e-os-derivados-do-leite', null, 33, '{"slot":{"x":74,"y":82}}'::jsonb, null, null, true)
on conflict (id) do update set
  code = excluded.code, slug = excluded.slug, name = excluded.name, description = excluded.description,
  meaning = excluded.meaning, icon = excluded.icon, area = excluded.area, category_id = excluded.category_id,
  item_type = excluded.item_type, rarity = excluded.rarity, milestone = excluded.milestone,
  unlock_type = excluded.unlock_type, unlock_reference = excluded.unlock_reference, min_level = excluded.min_level,
  sort_order = excluded.sort_order, metadata = excluded.metadata, unlock_title = excluded.unlock_title,
  unlock_message = excluded.unlock_message, active = true;
update public.world_items set active = false where id not in ('70000000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000006', '70000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000007', '70000000-0000-4000-8000-000000000008', '70000000-0000-4000-8000-000000000009', '70000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000010', '70000000-0000-4000-8000-000000000011', '70000000-0000-4000-8000-000000000012', '70000000-0000-4000-8000-000000000013', '70000000-0000-4000-8000-000000000014', '70000000-0000-4000-8000-000000000015', '70000000-0000-4000-8000-000000000016', '70000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000017', '70000000-0000-4000-8000-000000000018', '70000000-0000-4000-8000-000000000019', '70000000-0000-4000-8000-000000000004', '70000000-0000-4000-8000-000000000020', '70000000-0000-4000-8000-000000000021', '70000000-0000-4000-8000-000000000022', '70000000-0000-4000-8000-000000000023', '70000000-0000-4000-8000-000000000024', '70000000-0000-4000-8000-000000000025', '70000000-0000-4000-8000-000000000026', '70000000-0000-4000-8000-000000000027', '70000000-0000-4000-8000-000000000028', '70000000-0000-4000-8000-000000000029', '70000000-0000-4000-8000-000000000030', '70000000-0000-4000-8000-000000000031', '70000000-0000-4000-8000-000000000032', '70000000-0000-0000-0000-000000000033');

-- Mundo inicial
update public.worlds
set name = 'Meu Primeiro Ecossistema', description = 'Este mundo cresce conforme você aprende e transforma suas ações em atitudes reais.'
where name = 'Meu Mundo' or description is null;

-- Posições padrão dos itens já conquistados seguem o novo layout (em %).
update public.user_world_items uwi
set position_x = (wi.metadata -> 'slot' ->> 'x')::numeric,
    position_y = (wi.metadata -> 'slot' ->> 'y')::numeric
from public.world_items wi
where wi.id = uwi.world_item_id and (uwi.position_x is null or uwi.position_x > 100 or uwi.position_y > 100);

-- Aplica as regras a todos os jogadores (itens iniciais, desbloqueios já merecidos, estágio).
select public.sync_world(user_id) from public.profiles;

-- >>> 25_final_hardening.sql
-- =====================================================================
-- 25 · Integração final: segurança, administração, conta e logs (Etapa 8)
-- =====================================================================
-- Não apaga nem recria nada existente. Só acrescenta:
--   1. índices para as consultas/políticas mais usadas;
--   2. histórico preservado quando um conteúdo é desativado;
--   3. registro de erros (monitoramento) sem dados sensíveis;
--   4. exclusão da própria conta (com confirmação em duas etapas);
--   5. funções de administração (sempre conferindo o papel no servidor).

-- ---------------------------------------------------------------------
-- 1. Índices (chaves usadas pelo RLS e pela validação de eventos)
-- ---------------------------------------------------------------------
create index if not exists challenge_evidence_user_idx on public.challenge_evidence (user_id);
create index if not exists user_challenge_steps_step_idx on public.user_challenge_steps (challenge_step_id);
create index if not exists challenge_followups_step_idx on public.challenge_followups (challenge_step_id);
create index if not exists user_achievements_achievement_idx on public.user_achievements (achievement_id);
create index if not exists gamification_events_created_idx on public.gamification_events (created_at);

-- ---------------------------------------------------------------------
-- 2. Conteúdo desativado (active = false) some para quem não o usou,
--    mas continua visível para quem já tem histórico com ele.
-- ---------------------------------------------------------------------
-- O jogador tem histórico com este conteúdo? (anônimo: nunca)
create or replace function public.has_content_history(p_kind text, p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then false
    when p_kind = 'lesson' then exists (select 1 from public.user_lesson_progress where lesson_id = p_id and user_id = auth.uid())
    when p_kind = 'quiz' then exists (select 1 from public.quiz_attempts where quiz_id = p_id and user_id = auth.uid())
    when p_kind = 'challenge' then exists (select 1 from public.user_challenges where challenge_id = p_id and user_id = auth.uid())
    when p_kind = 'achievement' then exists (select 1 from public.user_achievements where achievement_id = p_id and user_id = auth.uid())
    else false
  end;
$$;

drop policy lessons_read on public.lessons;
create policy lessons_read on public.lessons
  for select to anon, authenticated
  using (active or (select public.is_admin()) or public.has_content_history('lesson', id));

drop policy quizzes_read on public.quizzes;
create policy quizzes_read on public.quizzes
  for select to anon, authenticated
  using (active or (select public.is_admin()) or public.has_content_history('quiz', id));

drop policy challenges_read on public.challenges;
create policy challenges_read on public.challenges
  for select to anon, authenticated
  using (active or (select public.is_admin()) or public.has_content_history('challenge', id));

drop policy achievements_read on public.achievements;
create policy achievements_read on public.achievements
  for select to anon, authenticated
  using (active or (select public.is_admin()) or public.has_content_history('achievement', id));

-- ---------------------------------------------------------------------
-- 3. Registro de erros (preparado para monitoramento)
--    Nunca guarda senha, token ou chave: o texto é limpo antes de salvar.
-- ---------------------------------------------------------------------
create table public.app_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete set null,
  level       text not null default 'error' check (level in ('error', 'warn', 'info')),
  operation   text not null check (char_length(operation) between 1 and 80),
  code        text check (char_length(code) <= 80),
  message     text check (char_length(message) <= 500),
  context     jsonb not null default '{}'::jsonb check (pg_column_size(context) <= 4000),
  created_at  timestamptz not null default now()
);
create index app_logs_created_idx on public.app_logs (created_at desc);
create index app_logs_user_created_idx on public.app_logs (user_id, created_at desc);

comment on table public.app_logs is 'Erros e ações administrativas. Leitura só por admin. Sem dados sensíveis.';

-- Remove tokens JWT, chaves do Supabase e e-mails de um texto.
create or replace function public.redact_sensitive(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(coalesce(p_text, ''), 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*', '[token]', 'g'),
             'sb_(secret|publishable)_[A-Za-z0-9_-]+', '[chave]', 'g'),
           '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[email]', 'g');
$$;

create or replace function public.write_log(
  p_user uuid, p_level text, p_operation text, p_code text, p_message text, p_context jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.app_logs (user_id, level, operation, code, message, context)
  values (
    p_user, p_level,
    left(public.redact_sensitive(p_operation), 80),
    left(public.redact_sensitive(p_code), 80),
    left(public.redact_sensitive(p_message), 500),
    -- contexto grande demais é descartado (cortar o texto quebraria o JSON)
    case when char_length(coalesce(p_context, '{}'::jsonb)::text) > 3500 then '{}'::jsonb
         else public.redact_sensitive(coalesce(p_context, '{}'::jsonb)::text)::jsonb end
  );
$$;

-- RPC: o app registra um erro do jogador (limite de 20 por minuto por usuário).
create or replace function public.log_client_error(
  p_operation text, p_code text, p_message text, p_context jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
begin
  if (select count(*) from public.app_logs
      where user_id = v_user and created_at > now() - interval '1 minute') >= 20 then
    return; -- evita inundar o registro
  end if;
  if jsonb_typeof(coalesce(p_context, '{}'::jsonb)) <> 'object' then
    p_context := '{}'::jsonb;
  end if;
  perform public.write_log(v_user, 'error', coalesce(nullif(btrim(p_operation), ''), 'unknown'), p_code, p_message, p_context);
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Excluir minha conta
--    (1) request_account_deletion: marca o pedido (o app mostra a confirmação antes);
--    (2) o app remove as fotos pelo Storage (a política abaixo passa a permitir);
--    (3) delete_my_account: apaga o usuário. Tudo o que é dele cai em cascata:
--        perfil, progresso, tentativas, desafios, evidências, XP, conquistas, mundo.
-- ---------------------------------------------------------------------
alter table public.profiles add column deletion_requested_at timestamptz;

create or replace function public.request_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set deletion_requested_at = now() where user_id = public.require_user();
end;
$$;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
begin
  if not exists (
    select 1 from public.profiles
    where user_id = v_user and deletion_requested_at > now() - interval '1 hour'
  ) then
    raise exception 'deletion_not_confirmed';
  end if;
  perform public.write_log(null, 'info', 'account.deleted', null, 'Conta excluída pelo próprio usuário.', '{}'::jsonb);
  delete from auth.users where id = v_user;
end;
$$;

-- Fotos: o jogador só apaga arquivos da própria pasta que NÃO são evidência de
-- nada (upload interrompido) — ou todos, depois de pedir a exclusão da conta.
create policy eco_evidence_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'eco-evidence'
    and (storage.foldername(objects.name))[1] = 'users'
    and (storage.foldername(objects.name))[2] = (select auth.uid())::text
    and (
      not exists (
        select 1 from public.challenge_evidence e
        where e.file_url = objects.name or e.thumbnail_url = objects.name
      )
      or exists (
        select 1 from public.profiles p
        where p.user_id = (select auth.uid()) and p.deletion_requested_at is not null
      )
    )
  );

-- ---------------------------------------------------------------------
-- 5. Administração (o papel é conferido em TODA função)
-- ---------------------------------------------------------------------
create or replace function public.require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return v_user;
end;
$$;

-- Métricas reais (nenhuma sem fonte de dados).
create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'users',                (select count(*) from public.profiles),
    'users_with_profile',   (select count(*) from public.profiles where display_name is not null),
    'active_users_30d',     (select count(distinct user_id) from public.gamification_events
                             where created_at > now() - interval '30 days'),
    'lessons_completed',    (select count(*) from public.user_lesson_progress where status = 'completed'),
    'quizzes_taken',        (select count(*) from public.quiz_attempts where status = 'completed'),
    'quizzes_passed',       (select count(*) from public.quiz_attempts where status = 'completed' and passed),
    'challenges_started',   (select count(*) from public.user_challenges),
    'challenges_completed', (select count(*) from public.user_challenges where status = 'completed'),
    'evidence_sent',        (select count(*) from public.challenge_evidence),
    'xp_distributed',       (select coalesce(sum(amount), 0) from public.xp_transactions),
    'world_items_unlocked', (select count(*) from public.user_world_items where source_type <> 'initial'),
    'errors_24h',           (select count(*) from public.app_logs
                             where level = 'error' and created_at > now() - interval '24 hours'),
    'content', jsonb_build_object(
      'categories',   (select jsonb_build_object('total', count(*), 'active', count(*) filter (where active)) from public.categories),
      'lessons',      (select jsonb_build_object('total', count(*), 'active', count(*) filter (where active)) from public.lessons),
      'quizzes',      (select jsonb_build_object('total', count(*), 'active', count(*) filter (where active)) from public.quizzes),
      'challenges',   (select jsonb_build_object('total', count(*), 'active', count(*) filter (where active)) from public.challenges),
      'achievements', (select jsonb_build_object('total', count(*), 'active', count(*) filter (where active)) from public.achievements),
      'world_items',  (select jsonb_build_object('total', count(*), 'active', count(*) filter (where active)) from public.world_items)
    )
  );
end;
$$;

-- Usuários: só o necessário (sem senha, sem evidências, sem dados privados extras).
create or replace function public.admin_list_users(p_search text default null, p_limit integer default 20, p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_limit  integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  perform public.require_admin();
  return (
    with base as (
      select p.user_id, p.display_name, p.username, p.role, p.level, p.total_xp, p.created_at, u.email,
             (select count(*) from public.user_challenges uc where uc.user_id = p.user_id and uc.status = 'completed') as challenges_completed,
             (select max(e.created_at) from public.gamification_events e where e.user_id = p.user_id) as last_activity
      from public.profiles p
      join auth.users u on u.id = p.user_id
      where v_search is null
         or p.display_name ilike '%' || v_search || '%'
         or p.username ilike '%' || v_search || '%'
         or u.email ilike '%' || v_search || '%'
    )
    select jsonb_build_object(
      'total', (select count(*) from base),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'user_id', b.user_id, 'display_name', b.display_name, 'username', b.username, 'email', b.email,
          'role', b.role, 'level', b.level, 'total_xp', b.total_xp,
          'challenges_completed', b.challenges_completed, 'created_at', b.created_at,
          'last_activity', b.last_activity,
          'status', case when b.last_activity > now() - interval '30 days' then 'active' else 'inactive' end
        ) order by b.created_at desc)
        from (select * from base order by created_at desc limit v_limit offset v_offset) b
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- Conteúdo para o painel (inclui os inativos) com o uso real de cada item.
create or replace function public.admin_list_content(p_kind text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return case p_kind
    when 'lesson' then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'title', l.title, 'active', l.active, 'group', c.name, 'xp_reward', l.xp_reward,
        'usage', (select count(*) from public.user_lesson_progress p where p.lesson_id = l.id and p.status = 'completed')
      ) order by c.order_index, l.order_index), '[]'::jsonb)
      from public.lessons l join public.categories c on c.id = l.category_id)
    when 'quiz' then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', q.id, 'title', q.title, 'active', q.active, 'group', l.title, 'xp_reward', q.xp_reward,
        'usage', (select count(*) from public.quiz_attempts a where a.quiz_id = q.id and a.status = 'completed')
      ) order by l.order_index), '[]'::jsonb)
      from public.quizzes q join public.lessons l on l.id = q.lesson_id)
    when 'challenge' then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', ch.id, 'title', ch.title, 'active', ch.active, 'group', c.name, 'xp_reward', ch.xp_reward,
        'usage', (select count(*) from public.user_challenges uc where uc.challenge_id = ch.id and uc.status = 'completed')
      ) order by c.order_index, ch.title), '[]'::jsonb)
      from public.challenges ch join public.categories c on c.id = ch.category_id)
    when 'achievement' then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'title', a.name, 'active', a.active, 'group', a.category, 'xp_reward', a.xp_reward,
        'usage', (select count(*) from public.user_achievements ua where ua.achievement_id = a.id)
      ) order by a.order_index), '[]'::jsonb)
      from public.achievements a)
    when 'world_item' then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', w.id, 'title', coalesce(w.icon || ' ', '') || w.name, 'active', w.active, 'group', w.area, 'xp_reward', null,
        'usage', (select count(*) from public.user_world_items u where u.world_item_id = w.id)
      ) order by w.sort_order), '[]'::jsonb)
      from public.world_items w)
    else null
  end;
end;
$$;

-- Ativar/desativar (nunca apaga: o histórico dos jogadores é preservado).
create or replace function public.admin_set_content_active(p_kind text, p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.require_admin();
  v_rows  integer;
begin
  if p_active is null then
    raise exception 'invalid_input';
  end if;
  case p_kind
    when 'lesson' then update public.lessons set active = p_active where id = p_id;
    when 'quiz' then update public.quizzes set active = p_active where id = p_id;
    when 'challenge' then update public.challenges set active = p_active where id = p_id;
    when 'achievement' then update public.achievements set active = p_active where id = p_id;
    when 'world_item' then update public.world_items set active = p_active where id = p_id;
    else raise exception 'invalid_input';
  end case;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'not_found';
  end if;
  perform public.write_log(v_admin, 'info', 'admin.set_active', p_kind,
    case when p_active then 'Conteúdo ativado' else 'Conteúdo desativado' end,
    jsonb_build_object('id', p_id));
end;
$$;

-- Papel de administrador: só outro admin muda, e nunca o próprio papel.
create or replace function public.admin_set_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.require_admin();
begin
  if p_user_id = v_admin then
    raise exception 'cannot_change_own_role';
  end if;
  update public.profiles set role = p_role where user_id = p_user_id;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.write_log(v_admin, 'info', 'admin.set_role', p_role::text, 'Papel alterado', jsonb_build_object('user_id', p_user_id));
end;
$$;

create or replace function public.admin_list_logs(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id, 'level', l.level, 'operation', l.operation, 'code', l.code,
      'message', l.message, 'created_at', l.created_at
    ) order by l.created_at desc)
    from (select * from public.app_logs order by created_at desc limit least(greatest(coalesce(p_limit, 50), 1), 200)) l
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------
-- 6. RLS e permissões
-- ---------------------------------------------------------------------
alter table public.app_logs enable row level security;
revoke all on public.app_logs from anon, authenticated;
grant select on public.app_logs to authenticated;
create policy app_logs_admin_read on public.app_logs
  for select to authenticated using ((select public.is_admin()));

revoke execute on function public.redact_sensitive(text),
                           public.write_log(uuid, text, text, text, text, jsonb),
                           public.require_admin(),
                           public.log_client_error(text, text, text, jsonb),
                           public.request_account_deletion(),
                           public.delete_my_account(),
                           public.admin_dashboard(),
                           public.admin_list_users(text, integer, integer),
                           public.admin_list_content(text),
                           public.admin_set_content_active(text, uuid, boolean),
                           public.admin_set_role(uuid, public.app_role),
                           public.admin_list_logs(integer)
  from public, anon, authenticated;

-- Funções chamáveis pelo app (as de admin conferem o papel por dentro).
revoke execute on function public.has_content_history(text, uuid) from public;
grant execute on function public.has_content_history(text, uuid) to anon, authenticated;
grant execute on function public.log_client_error(text, text, text, jsonb) to authenticated;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.admin_dashboard() to authenticated;
grant execute on function public.admin_list_users(text, integer, integer) to authenticated;
grant execute on function public.admin_list_content(text) to authenticated;
grant execute on function public.admin_set_content_active(text, uuid, boolean) to authenticated;
grant execute on function public.admin_set_role(uuid, public.app_role) to authenticated;
grant execute on function public.admin_list_logs(integer) to authenticated;

-- >>> 26_place_system.sql
-- =====================================================================
-- 26 · Módulo Meu Lugar (casa 3D) — persistência e desbloqueios
-- =====================================================================
-- Módulo ISOLADO: tabelas próprias, nenhuma tabela existente é alterada.
-- A casa só REPRESENTA o que já aconteceu no ECO QUEST. Não cria XP, não
-- cria missões nem outra lógica de recompensa: escuta os mesmos eventos
-- verificados da gamificação (gamification_events), como o Meu Mundo.
--
--   evento real (lição, desafio, conquista, nível, evidência…)
--     → trigger → sync_place(usuário)
--         → confere a regra de cada objeto (place_items.unlock_type)
--         → user_place_items (nunca duplica)
--         → guarda o desafio relacionado e o registro do jogador (diário)

-- ---------------------------------------------------------------------
-- 1. Catálogo (conteúdo gerado de content/place.json → migration 27)
-- ---------------------------------------------------------------------
create table public.place_stages (
  id              uuid primary key default gen_random_uuid(),
  stage_number    integer not null unique check (stage_number > 0),
  name            text not null,
  icon            text,
  description     text,
  min_items       integer not null default 0 check (min_items >= 0),
  min_categories  integer not null default 0 check (min_categories >= 0),
  created_at      timestamptz not null default now()
);

create table public.place_items (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique check (code ~ '^[a-z0-9_]+$'),
  name              text not null,
  icon              text,
  description       text,
  meaning           text,
  category          text not null check (category in (
    'casa', 'educacao', 'natureza', 'agua', 'reciclagem', 'energia', 'biodiversidade', 'comunidade'
  )),
  location          text not null,
  -- forma desenhada pelo app (modelo procedural leve)
  model             text not null,
  position_x        numeric not null,
  position_y        numeric not null,
  position_z        numeric not null,
  rotation          numeric not null default 0 check (rotation between -360 and 360),
  scale             numeric not null default 1 check (scale > 0 and scale <= 5),
  -- initial | lesson (slug) | challenge (slug) | achievement (código) | level (número)
  -- | evidence ('photo' = primeira foto enviada como evidência)
  unlock_type       text not null check (unlock_type in ('initial', 'lesson', 'challenge', 'achievement', 'level', 'evidence')),
  unlock_reference  text,
  sort_order        integer not null default 0,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint place_items_unlock_reference_check check ((unlock_type = 'initial') = (unlock_reference is null))
);

create trigger place_items_set_updated_at
  before update on public.place_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 2. A casa de cada jogador
-- ---------------------------------------------------------------------
create table public.user_place_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  place_item_id  uuid not null references public.place_items (id) on delete cascade,
  -- origem do desbloqueio
  source_type    text not null check (source_type in ('initial', 'lesson', 'challenge', 'achievement', 'level', 'evidence')),
  source_id      uuid,
  -- missão/desafio relacionado (quando houver) e o registro do jogador ("diário")
  challenge_id   uuid references public.challenges (id) on delete set null,
  evidence_id    uuid references public.challenge_evidence (id) on delete set null,
  origin_note    text check (char_length(origin_note) <= 500),
  -- posição própria do jogador (null = posição padrão do catálogo)
  position_x     numeric,
  position_y     numeric,
  position_z     numeric,
  state          text not null default 'visible' check (state in ('visible', 'hidden')),
  -- o jogador já viu o objeto aparecer
  revealed       boolean not null default false,
  unlocked_at    timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, place_item_id)
);

create index user_place_items_user_idx on public.user_place_items (user_id);
create index user_place_items_item_idx on public.user_place_items (place_item_id);
create index user_place_items_source_idx on public.user_place_items (source_type, source_id);
create index place_items_unlock_idx on public.place_items (unlock_type, unlock_reference);

create trigger user_place_items_set_updated_at
  before update on public.user_place_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. Desbloqueio (idempotente) — confere dados reais, nunca o cliente
-- ---------------------------------------------------------------------
create or replace function public.sync_place(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_level     integer;
  r           record;
  v_ok        boolean;
  v_src       uuid;
  v_challenge uuid;
  v_evidence  uuid;
  v_note      text;
  v_id        uuid;
  v_new       jsonb := '[]'::jsonb;
begin
  select level into v_level from public.profiles where user_id = p_user;
  if v_level is null then
    return v_new; -- sem perfil, sem casa
  end if;

  for r in
    select pi.* from public.place_items pi
    where pi.active
      and not exists (select 1 from public.user_place_items u
                      where u.user_id = p_user and u.place_item_id = pi.id)
    order by pi.sort_order
  loop
    v_ok := false;
    v_src := null;
    v_challenge := null;
    v_evidence := null;
    v_note := null;

    case r.unlock_type
      when 'initial' then
        v_ok := true;
      when 'lesson' then
        select l.id into v_src from public.lessons l
        join public.user_lesson_progress p on p.lesson_id = l.id and p.user_id = p_user and p.status = 'completed'
        where l.slug = r.unlock_reference;
        v_ok := v_src is not null;
      when 'challenge' then
        select c.id into v_src from public.challenges c
        where c.slug = r.unlock_reference
          and exists (select 1 from public.user_challenges uc
                      where uc.challenge_id = c.id and uc.user_id = p_user and uc.status = 'completed');
        v_ok := v_src is not null;
        if v_ok then
          v_challenge := v_src;
          -- diário: a primeira observação que o jogador escreveu nesse desafio
          select e.id, e.description into v_evidence, v_note
          from public.challenge_evidence e
          join public.user_challenges uc on uc.id = e.user_challenge_id
          where uc.user_id = p_user and uc.challenge_id = v_src and uc.status = 'completed'
            and nullif(btrim(e.description), '') is not null
          order by e.created_at
          limit 1;
          if v_note is null then
            select s.notes into v_note
            from public.user_challenge_steps s
            join public.user_challenges uc on uc.id = s.user_challenge_id
            where uc.user_id = p_user and uc.challenge_id = v_src and uc.status = 'completed'
              and nullif(btrim(s.notes), '') is not null
            order by s.completed_at
            limit 1;
          end if;
        end if;
      when 'achievement' then
        select a.id into v_src from public.achievements a
        join public.user_achievements ua on ua.achievement_id = a.id and ua.user_id = p_user
        where a.slug = r.unlock_reference;
        v_ok := v_src is not null;
      when 'level' then
        select l.id into v_src from public.levels l
        where l.level_number = r.unlock_reference::integer and l.level_number <= v_level;
        v_ok := v_src is not null;
      when 'evidence' then
        -- 'photo': a primeira foto enviada como evidência de uma ação real
        select e.id, uc.challenge_id, e.description into v_src, v_challenge, v_note
        from public.challenge_evidence e
        join public.user_challenges uc on uc.id = e.user_challenge_id
        where e.user_id = p_user and e.evidence_type = 'photo' and r.unlock_reference = 'photo'
        order by e.created_at
        limit 1;
        v_evidence := v_src;
        v_ok := v_src is not null;
      else
        v_ok := false;
    end case;

    continue when not v_ok;

    insert into public.user_place_items
      (user_id, place_item_id, source_type, source_id, challenge_id, evidence_id, origin_note, revealed)
    values (
      p_user, r.id, r.unlock_type, v_src, v_challenge, v_evidence,
      left(nullif(btrim(v_note), ''), 500),
      r.unlock_type = 'initial' -- a casa inicial já nasce vista
    )
    on conflict (user_id, place_item_id) do nothing
    returning id into v_id;

    if v_id is not null then
      v_new := v_new || jsonb_build_array(jsonb_build_object('id', r.id, 'code', r.code, 'name', r.name));
    end if;
  end loop;

  return v_new;
end;
$$;

-- Evolução da casa: estágio e progresso a partir dos objetos conquistados.
create or replace function public.place_progress(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_items   integer;
  v_total   integer;
  v_cats    integer;
  v_by      jsonb;
  v_stage   public.place_stages;
begin
  select count(*) into v_total from public.place_items where active and unlock_type <> 'initial';
  select count(*), count(distinct pi.category) into v_items, v_cats
  from public.user_place_items u join public.place_items pi on pi.id = u.place_item_id
  where u.user_id = p_user and pi.unlock_type <> 'initial';
  select coalesce(jsonb_object_agg(category, n), '{}'::jsonb) into v_by from (
    select pi.category, count(*) n
    from public.user_place_items u join public.place_items pi on pi.id = u.place_item_id
    where u.user_id = p_user and pi.unlock_type <> 'initial'
    group by pi.category
  ) x;
  select * into v_stage from public.place_stages
  where min_items <= v_items and min_categories <= v_cats
  order by stage_number desc limit 1;
  return jsonb_build_object(
    'stage', coalesce(v_stage.stage_number, 1),
    'stage_name', v_stage.name,
    'progress', case when v_total = 0 then 0 else round(100.0 * v_items / v_total) end,
    'items_unlocked', v_items,
    'items_total', v_total,
    'categories', v_cats,
    'by_category', v_by
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Integração com os sistemas existentes (sem alterá-los)
-- ---------------------------------------------------------------------
-- Todo evento real da gamificação também atualiza a casa.
create or replace function public.on_gamification_event_place()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_type <> 'world_stage_reached' then
    perform public.sync_place(new.user_id);
  end if;
  return new;
end;
$$;

create trigger gamification_events_place
  after insert on public.gamification_events
  for each row execute function public.on_gamification_event_place();

-- Todo perfil novo ganha a casa inicial.
create or replace function public.handle_new_profile_place()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_place(new.user_id);
  return new;
end;
$$;

create trigger on_profile_created_place
  after insert on public.profiles
  for each row execute function public.handle_new_profile_place();

-- ---------------------------------------------------------------------
-- 5. RPCs do app (somente os dados do próprio jogador)
-- ---------------------------------------------------------------------
create or replace function public.get_place_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
begin
  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id, 'place_item_id', u.place_item_id, 'source_type', u.source_type, 'source_id', u.source_id,
        'challenge_id', u.challenge_id, 'evidence_id', u.evidence_id, 'origin_note', u.origin_note,
        'position_x', u.position_x, 'position_y', u.position_y, 'position_z', u.position_z,
        'state', u.state, 'revealed', u.revealed, 'unlocked_at', u.unlocked_at
      ) order by u.unlocked_at)
      from public.user_place_items u where u.user_id = v_user
    ), '[]'::jsonb),
    'progress', public.place_progress(v_user)
  );
end;
$$;

-- O jogador viu os objetos novos (só marca como vistos; não cria nada).
create or replace function public.reveal_place_items()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  update public.user_place_items set revealed = true
  where user_id = public.require_user() and not revealed;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. RLS e permissões
-- ---------------------------------------------------------------------
alter table public.place_stages enable row level security;
alter table public.place_items enable row level security;
alter table public.user_place_items enable row level security;

revoke all on public.place_stages, public.place_items, public.user_place_items from anon, authenticated;
grant select on public.place_stages, public.place_items to anon, authenticated;
grant insert, update, delete on public.place_stages, public.place_items to authenticated;
grant select on public.user_place_items to authenticated;

create policy place_stages_read on public.place_stages for select to anon, authenticated using (true);
create policy place_items_read on public.place_items for select to anon, authenticated using (true);
create policy place_stages_admin on public.place_stages for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy place_items_admin on public.place_items for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy user_place_items_read_own on public.user_place_items
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

revoke execute on function public.sync_place(uuid),
                           public.place_progress(uuid),
                           public.on_gamification_event_place(),
                           public.handle_new_profile_place(),
                           public.get_place_state(),
                           public.reveal_place_items()
  from public, anon, authenticated;
grant execute on function public.get_place_state() to authenticated;
grant execute on function public.reveal_place_items() to authenticated;

-- >>> 27_place_content.sql
-- =====================================================================
-- 27 · Meu Lugar (casa 3D): estágios e objetos
-- =====================================================================
-- ARQUIVO GERADO por "npm run content:sql" a partir de content/place.json.
-- Não edite à mão. Idempotente. Objetos que saírem do JSON ficam inativos
-- (quem já tem, continua tendo).

insert into public.place_stages (id, stage_number, name, icon, description, min_items, min_categories) values
  ('82000000-0000-4000-8000-000000000001', 1, 'Pequena casa', '🏚️', 'Poucos objetos e o jardim ainda vazio.', 0, 0),
  ('82000000-0000-4000-8000-000000000002', 2, 'Casa em evolução', '🏠', 'Primeiras decorações e primeiras plantas.', 2, 1),
  ('82000000-0000-4000-8000-000000000003', 3, 'Casa ecológica', '🏡', 'Horta, árvores, flores, água e objetos sustentáveis.', 6, 3),
  ('82000000-0000-4000-8000-000000000004', 4, 'Casa-ecossistema', '🌳', 'Um lugar vivo: plantas, animais, água, estudo e comunidade.', 12, 5)
on conflict (id) do update set
  stage_number = excluded.stage_number, name = excluded.name, icon = excluded.icon,
  description = excluded.description, min_items = excluded.min_items, min_categories = excluded.min_categories;
delete from public.place_stages where id not in ('82000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000004');

insert into public.place_items (id, code, name, icon, description, meaning, category, location, model,
  position_x, position_y, position_z, rotation, scale, unlock_type, unlock_reference, sort_order, active) values
  ('80000000-0000-4000-8000-000000000001', 'desk', 'Mesa de estudos', '🪑', 'Uma mesa simples para começar.', 'O ponto de partida: é aqui que a sua jornada começa.', 'casa', 'estudos', 'table',
   2.5, 0, -5.9, 0, 1, 'initial', null, 1, true),
  ('80000000-0000-4000-8000-000000000002', 'chair', 'Cadeira', '🪑', 'Uma cadeira para estudar com calma.', 'Todo aprendizado começa com um momento para sentar e prestar atenção.', 'casa', 'estudos', 'chair',
   2.5, 0, -5.1, 180, 1, 'initial', null, 2, true),
  ('80000000-0000-4000-8000-000000000003', 'book', 'Livro', '📖', 'O primeiro livro da sua estante.', 'Sua primeira lição concluída no ECO QUEST.', 'educacao', 'estudos', 'book',
   2.3, 0.79, -5.9, 20, 1.3, 'achievement', 'primeiro-aprendizado', 3, true),
  ('80000000-0000-4000-8000-000000000004', 'bookshelf', 'Estante', '📚', 'Uma estante cheia de conhecimento.', 'Cinco lições concluídas: sua curiosidade encheu uma estante.', 'educacao', 'estudos', 'bookshelf',
   2.5, 0, -7.65, 0, 1, 'achievement', 'curioso', 4, true),
  ('80000000-0000-4000-8000-000000000005', 'picture', 'Quadro da primeira ação', '🖼️', 'Uma paisagem emoldurada na parede da sala.', 'A primeira foto que você enviou para comprovar uma ação real.', 'casa', 'sala', 'picture',
   -4.86, 1.6, -2, 90, 1, 'evidence', 'photo', 5, true),
  ('80000000-0000-4000-8000-000000000006', 'potted_plant', 'Planta', '🪴', 'Uma planta em vaso na sala.', 'O que você aprendeu sobre como uma planta cresce.', 'natureza', 'sala', 'plant',
   -4.3, 0, -0.6, 0, 1.2, 'lesson', 'como-uma-planta-cresce', 6, true),
  ('80000000-0000-4000-8000-000000000007', 'reuse_vase', 'Decoração sustentável', '♻️', 'Um vaso feito com uma garrafa reutilizada.', 'O que você aprendeu sobre reutilizar em vez de descartar.', 'reciclagem', 'cozinha', 'reuse_vase',
   0.5, 0, -0.5, 0, 1.4, 'lesson', 'o-que-significa-reutilizar', 7, true),
  ('80000000-0000-4000-8000-000000000008', 'recycling_bins', 'Lixeiras de coleta seletiva', '🗑️', 'Uma lixeira para cada tipo de resíduo.', 'A semana em que você separou os seus resíduos.', 'reciclagem', 'cozinha', 'recycling_bins',
   1.2, 0, -3.5, 0, 1, 'challenge', 'separe-seus-residuos-por-7-dias', 8, true),
  ('80000000-0000-4000-8000-000000000009', 'solar_lamp', 'Luminária solar', '💡', 'Luz que vem do sol.', 'Sua semana de consumo consciente de energia.', 'energia', 'quarto', 'solar_lamp',
   -4.55, 0, -4.5, 0, 1, 'challenge', 'semana-do-consumo-consciente', 9, true),
  ('80000000-0000-4000-8000-000000000010', 'flower', 'Flor', '🌷', 'Flores coloridas no canteiro.', 'A flor que você cultivou e acompanhou no mundo real.', 'natureza', 'jardim-flores', 'flower',
   -2.6, 0.12, 5.2, 0, 1.6, 'challenge', 'cultive-uma-flor', 10, true),
  ('80000000-0000-4000-8000-000000000011', 'my_tree', 'Minha Árvore', '🌳', 'A árvore do seu primeiro plantio.', 'O plantio que você fez e acompanhou por seis meses.', 'natureza', 'jardim-arvores', 'tree_small',
   -7, 0, 2.5, 0, 1.3, 'challenge', 'plante-uma-arvore', 11, true),
  ('80000000-0000-4000-8000-000000000012', 'big_tree', 'Árvore grande', '🌳', 'Uma árvore frondosa que dá sombra ao jardim.', 'Cinco ações pela natureza: você virou Guardião das Plantas.', 'natureza', 'jardim-arvores', 'tree_large',
   -9, 0, 5.5, 30, 1, 'achievement', 'guardiao-das-plantas', 12, true),
  ('80000000-0000-4000-8000-000000000013', 'vegetable_garden', 'Horta', '🥕', 'Um canteiro com hortaliças.', 'A horta que você montou e cuidou no mundo real.', 'natureza', 'horta', 'vegetable_garden',
   2.6, 0.12, 5.2, 0, 1, 'challenge', 'crie-uma-pequena-horta', 13, true),
  ('80000000-0000-4000-8000-000000000014', 'bee', 'Abelha', '🐝', 'Uma abelha visitando o jardim.', 'O espaço para polinizadores que você criou.', 'biodiversidade', 'jardim-flores', 'bee',
   -2.2, 1.2, 5.4, 0, 1.3, 'challenge', 'crie-um-espaco-para-polinizadores', 14, true),
  ('80000000-0000-4000-8000-000000000015', 'butterfly', 'Borboleta', '🦋', 'Uma borboleta de passagem.', 'Um jardim acolhedor para a vida.', 'biodiversidade', 'jardim-biodiversidade', 'butterfly',
   -1.5, 1.3, 9.5, 0, 1.6, 'challenge', 'crie-um-espaco-para-polinizadores', 15, true),
  ('80000000-0000-4000-8000-000000000016', 'bird', 'Pássaro', '🐦', 'Um pássaro que encontrou abrigo nas árvores.', 'Você explorou quatro temas ambientais.', 'biodiversidade', 'jardim-arvores', 'bird',
   -7.5, 3.4, 3.5, 0, 1.4, 'achievement', 'explorador-eco', 16, true),
  ('80000000-0000-4000-8000-000000000017', 'pond', 'Lago', '🪷', 'Um pequeno lago de água limpa.', 'O desperdício de água que você reduziu em casa.', 'agua', 'jardim-agua', 'pond',
   7.4, 0, 3.2, 0, 0.9, 'challenge', 'reduza-o-desperdicio-de-agua', 17, true),
  ('80000000-0000-4000-8000-000000000018', 'fountain', 'Fonte', '⛲', 'Uma fonte que reaproveita a água da chuva.', 'O que você aprendeu sobre o caminho da água da chuva.', 'agua', 'jardim-agua', 'fountain',
   9.3, 0, 5.8, 0, 0.8, 'lesson', 'o-que-acontece-com-a-agua-da-chuva', 18, true),
  ('80000000-0000-4000-8000-000000000019', 'community_bench', 'Banco comunitário', '🤝', 'Um banco para receber vizinhos e amigos.', 'A ação ambiental coletiva de que você participou.', 'comunidade', 'jardim-biodiversidade', 'bench',
   3, 0, 9.8, 0, 1, 'challenge', 'participe-de-uma-acao-ambiental', 19, true),
  ('80000000-0000-4000-8000-000000000020', 'wardrobe', 'Armário organizado', '👕', 'Um armário com roupas dobradas.', 'Você cuidou das suas roupas e ajudou a organizar a casa.', 'casa', 'quarto', 'wardrobe',
   -1, 0, -7.35, 0, 0.9, 'challenge', 'dobre-suas-roupas', 20, true),
  ('80000000-0000-4000-8000-000000000021', 'bed', 'Cama arrumada', '🛏️', 'Uma cama pronta para começar o dia.', 'Você começou o dia cuidando do seu espaço.', 'casa', 'quarto', 'bed',
   -3.7, 0, -6.5, 0, 0.85, 'challenge', 'arrume-sua-cama', 21, true),
  ('80000000-0000-4000-8000-000000000022', 'broom', 'Vassoura', '🧹', 'Uma vassoura guardada depois da limpeza.', 'Você ajudou a deixar um cômodo limpo.', 'casa', 'sala', 'broom',
   -0.35, 0, -3.55, 12, 0.8, 'challenge', 'varra-um-comodo-da-casa', 22, true),
  ('80000000-0000-4000-8000-000000000023', 'toy_box', 'Caixa de brinquedos', '🧸', 'Uma caixa para guardar os brinquedos.', 'Você cuidou das suas coisas e deixou o espaço pronto para brincar.', 'casa', 'sala', 'toy_box',
   -0.75, 0, -0.75, 0, 0.9, 'challenge', 'organize-seus-brinquedos', 23, true),
  ('80000000-0000-4000-8000-000000000024', 'sink', 'Pia organizada', '🍽️', 'Uma pia pronta para a próxima refeição.', 'Você ajudou a cuidar da cozinha e economizou água.', 'casa', 'cozinha', 'sink',
   4.55, 0, -1.3, 270, 0.9, 'challenge', 'ajude-a-lavar-a-louca', 24, true),
  ('80000000-0000-4000-8000-000000000025', 'reading_nook', 'Cantinho da leitura', '📖', 'Um cantinho para ler com calma.', 'Você reservou um tempo para aprender e imaginar.', 'educacao', 'estudos', 'reading_nook',
   0.2, 0, -6.7, 0, 0.9, 'challenge', 'leia-por-15-minutos', 25, true),
  ('80000000-0000-4000-8000-000000000026', 'magnifier', 'Lupa da observação', '🔍', 'Uma lupa para olhar o mundo com atenção.', 'Você observou uma paisagem e percebeu detalhes ao seu redor.', 'natureza', 'estudos', 'magnifier',
   1.2, 0.8, -5.9, 20, 0.8, 'challenge', 'analise-uma-paisagem', 26, true),
  ('80000000-0000-4000-8000-000000000027', 'journal', 'Diário de ideias', '✍️', 'Um caderno para registrar pensamentos e aprendizados.', 'Você parou para refletir e registrar uma ideia sua.', 'educacao', 'estudos', 'journal',
   3.1, 0.8, -5.9, 340, 1, 'challenge', 'escreva-no-diario', 27, true),
  ('80000000-0000-4000-8000-000000000028', 'meditation_cushion', 'Almofada da atenção', '🧘', 'Um lugar confortável para fazer uma pausa.', 'Você praticou atenção e percebeu melhor o momento presente.', 'casa', 'sala', 'meditation_cushion',
   -1.8, 0, -1.7, 0, 0.9, 'challenge', 'pratique-atencao-por-cinco-minutos', 28, true),
  ('80000000-0000-4000-8000-000000000029', 'cow', 'Vaca', '🐄', 'Uma vaca tranquila no espaço verde.', 'Você aprendeu de onde vem o leite e como respeitar os animais.', 'natureza', 'jardim-arvores', 'cow',
   5.5, 0, 5.5, 180, 0.9, 'challenge', 'conheca-a-vaca-e-os-derivados-do-leite', 29, true),
  ('80000000-0000-4000-8000-000000000030', 'sofa', 'Sofá da família', '🛋️', 'Um sofá para a família conversar e descansar junto.', 'Você fez uma ação pela comunidade: cuidar dos outros começa em casa.', 'casa', 'sala', 'sofa',
   -4, 0, -3.45, 0, 0.9, 'achievement', 'acao-em-comunidade', 30, true),
  ('80000000-0000-4000-8000-000000000031', 'coffee_table', 'Mesa de centro reaproveitada', '🪵', 'Uma mesinha feita com ripas de madeira reaproveitada.', 'Você aprendeu que um material pode ganhar uma nova vida.', 'reciclagem', 'sala', 'coffee_table',
   -4, 0, -2.35, 0, 0.9, 'lesson', 'o-que-significa-reutilizar', 31, true),
  ('80000000-0000-4000-8000-000000000032', 'living_rug', 'Tapete de retalhos', '🧶', 'Um tapete colorido feito de retalhos de tecido.', 'Você aprendeu sobre reciclagem: sobras também viram coisas úteis.', 'reciclagem', 'sala', 'rug',
   -4, 0, -2.4, 0, 0.9, 'lesson', 'o-que-e-reciclagem', 32, true),
  ('80000000-0000-4000-8000-000000000033', 'armchair', 'Poltrona de leitura', '💺', 'Uma poltrona confortável para pensar e estudar.', 'Cinco quizzes concluídos: você se dedicou a aprender.', 'casa', 'sala', 'armchair',
   -1.5, 0, -3.35, 0, 0.9, 'achievement', 'aprendiz-dedicado', 33, true),
  ('80000000-0000-4000-8000-000000000034', 'stove', 'Fogão', '🍳', 'Um fogão para preparar comida fresca da horta.', 'Você aprendeu de onde vêm os alimentos que cultivamos.', 'casa', 'cozinha', 'stove',
   4.55, 0, -2.55, 270, 1, 'lesson', 'o-que-e-uma-horta', 34, true),
  ('80000000-0000-4000-8000-000000000035', 'fridge', 'Geladeira econômica', '🧊', 'Uma geladeira com selo de eficiência, que gasta menos energia.', 'Você aprendeu por que economizar energia faz diferença.', 'energia', 'cozinha', 'fridge',
   4.5, 0, -3.55, 270, 1, 'lesson', 'por-que-economizar-energia', 35, true),
  ('80000000-0000-4000-8000-000000000036', 'dining_table', 'Mesa de jantar', '🍽️', 'Uma mesa com cadeiras e uma fruteira para as refeições em família.', 'Sua primeira ação ambiental: um passo que a família toda pode dar junto.', 'casa', 'cozinha', 'dining_table',
   2.2, 0, -1.8, 0, 0.85, 'achievement', 'primeiro-passo', 36, true),
  ('80000000-0000-4000-8000-000000000037', 'water_filter', 'Filtro de barro', '🏺', 'Um filtro de barro que deixa a água limpa e fresquinha.', 'Você aprendeu por que a água limpa é preciosa.', 'agua', 'cozinha', 'water_filter',
   3.4, 0, -3.7, 0, 1, 'lesson', 'por-que-precisamos-economizar-agua', 37, true),
  ('80000000-0000-4000-8000-000000000038', 'nightstand', 'Criado-mudo', '🕯️', 'Um criado-mudo com abajur e um livro para antes de dormir.', 'Você chegou ao nível 3 e seu quarto ficou mais aconchegante.', 'casa', 'quarto', 'nightstand',
   -2.3, 0, -7.5, 0, 1, 'level', '3', 38, true),
  ('80000000-0000-4000-8000-000000000039', 'bedroom_rug', 'Tapete do quarto', '🧶', 'Um tapete macio ao lado da cama.', 'Você chegou ao nível 6: sua jornada continua crescendo.', 'casa', 'quarto', 'rug',
   -2.2, 0, -5.4, 0, 0.7, 'level', '6', 39, true),
  ('80000000-0000-4000-8000-000000000040', 'laundry_basket', 'Cesto de roupas', '🧺', 'Um cesto para separar as roupas que vão para a lavagem.', 'Você dobrou suas roupas e ajudou a manter a casa em ordem.', 'casa', 'quarto', 'laundry_basket',
   -0.5, 0, -4.6, 0, 1, 'challenge', 'dobre-suas-roupas', 40, true),
  ('80000000-0000-4000-8000-000000000041', 'desk_lamp', 'Luminária de LED', '💡', 'Uma luminária de LED que ilumina bem e gasta pouca energia.', 'Você aprendeu sobre fontes de energia renováveis.', 'energia', 'estudos', 'desk_lamp',
   3.5, 0.79, -6.15, 0, 1.2, 'lesson', 'o-que-sao-fontes-renovaveis', 41, true),
  ('80000000-0000-4000-8000-000000000042', 'corkboard', 'Mural de recados', '📌', 'Um mural com recados e descobertas sobre a natureza.', 'Dez lições concluídas: você é um estudante da natureza.', 'educacao', 'estudos', 'corkboard',
   4.86, 1.5, -6, 270, 1, 'achievement', 'estudante-da-natureza', 42, true)
on conflict (id) do update set
  code = excluded.code, name = excluded.name, icon = excluded.icon, description = excluded.description,
  meaning = excluded.meaning, category = excluded.category, location = excluded.location, model = excluded.model,
  position_x = excluded.position_x, position_y = excluded.position_y, position_z = excluded.position_z,
  rotation = excluded.rotation, scale = excluded.scale, unlock_type = excluded.unlock_type,
  unlock_reference = excluded.unlock_reference, sort_order = excluded.sort_order, active = true;
update public.place_items set active = false where id not in ('80000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000002', '80000000-0000-4000-8000-000000000003', '80000000-0000-4000-8000-000000000004', '80000000-0000-4000-8000-000000000005', '80000000-0000-4000-8000-000000000006', '80000000-0000-4000-8000-000000000007', '80000000-0000-4000-8000-000000000008', '80000000-0000-4000-8000-000000000009', '80000000-0000-4000-8000-000000000010', '80000000-0000-4000-8000-000000000011', '80000000-0000-4000-8000-000000000012', '80000000-0000-4000-8000-000000000013', '80000000-0000-4000-8000-000000000014', '80000000-0000-4000-8000-000000000015', '80000000-0000-4000-8000-000000000016', '80000000-0000-4000-8000-000000000017', '80000000-0000-4000-8000-000000000018', '80000000-0000-4000-8000-000000000019', '80000000-0000-4000-8000-000000000020', '80000000-0000-4000-8000-000000000021', '80000000-0000-4000-8000-000000000022', '80000000-0000-4000-8000-000000000023', '80000000-0000-4000-8000-000000000024', '80000000-0000-4000-8000-000000000025', '80000000-0000-4000-8000-000000000026', '80000000-0000-4000-8000-000000000027', '80000000-0000-4000-8000-000000000028', '80000000-0000-4000-8000-000000000029', '80000000-0000-4000-8000-000000000030', '80000000-0000-4000-8000-000000000031', '80000000-0000-4000-8000-000000000032', '80000000-0000-4000-8000-000000000033', '80000000-0000-4000-8000-000000000034', '80000000-0000-4000-8000-000000000035', '80000000-0000-4000-8000-000000000036', '80000000-0000-4000-8000-000000000037', '80000000-0000-4000-8000-000000000038', '80000000-0000-4000-8000-000000000039', '80000000-0000-4000-8000-000000000040', '80000000-0000-4000-8000-000000000041', '80000000-0000-4000-8000-000000000042');

-- Aplica as regras a todos os jogadores (casa inicial + objetos já merecidos).
select public.sync_place(user_id) from public.profiles;
