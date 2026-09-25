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
