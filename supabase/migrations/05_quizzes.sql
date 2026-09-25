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
