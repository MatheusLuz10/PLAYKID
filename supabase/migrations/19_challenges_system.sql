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
