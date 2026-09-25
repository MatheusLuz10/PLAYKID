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
