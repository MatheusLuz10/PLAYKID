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
