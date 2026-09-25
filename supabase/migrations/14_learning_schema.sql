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
