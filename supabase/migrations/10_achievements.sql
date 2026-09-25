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
