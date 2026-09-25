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
