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
