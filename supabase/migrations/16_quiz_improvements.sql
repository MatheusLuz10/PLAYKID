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
