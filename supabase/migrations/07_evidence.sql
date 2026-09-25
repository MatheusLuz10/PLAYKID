-- =====================================================================
-- 07 · Evidências, acompanhamentos (follow-ups) e Storage
-- =====================================================================

create type public.evidence_type as enum ('photo', 'video', 'text');
create type public.evidence_status as enum ('submitted', 'approved', 'rejected');
create type public.followup_status as enum ('scheduled', 'completed', 'missed');

create table public.challenge_followups (
  id                 uuid primary key default gen_random_uuid(),
  user_challenge_id  uuid not null references public.user_challenges (id) on delete cascade,
  -- Etapa (follow_up) do desafio que originou este acompanhamento.
  challenge_step_id  uuid references public.challenge_steps (id) on delete set null,
  title              text not null,
  description        text,
  scheduled_for      timestamptz not null,
  completed_at       timestamptz,
  status             public.followup_status not null default 'scheduled',
  evidence_required  boolean not null default true,
  created_at         timestamptz not null default now(),
  unique (user_challenge_id, challenge_step_id)
);

create index challenge_followups_uc_idx on public.challenge_followups (user_challenge_id, scheduled_for);
-- Preparado para lembretes futuros (ex.: acompanhamentos vencendo).
create index challenge_followups_due_idx on public.challenge_followups (status, scheduled_for);

create table public.challenge_evidence (
  id                 uuid primary key default gen_random_uuid(),
  user_challenge_id  uuid not null references public.user_challenges (id) on delete cascade,
  user_id            uuid not null references auth.users (id) on delete cascade,
  -- null = evidência da realização (Dia 0); preenchido = evidência de um acompanhamento.
  followup_id        uuid references public.challenge_followups (id) on delete cascade,
  evidence_type      public.evidence_type not null default 'photo',
  -- Caminho do arquivo no bucket privado eco-evidence (não é uma URL pública).
  file_url           text,
  thumbnail_url      text,
  description        text check (description is null or char_length(description) <= 500),
  captured_at        timestamptz not null default now(),
  status             public.evidence_status not null default 'submitted',
  created_at         timestamptz not null default now(),
  constraint challenge_evidence_photo_file check (evidence_type <> 'photo' or file_url is not null)
);

create index challenge_evidence_uc_idx on public.challenge_evidence (user_challenge_id);
create unique index challenge_evidence_main_uniq
  on public.challenge_evidence (user_challenge_id) where followup_id is null;
create unique index challenge_evidence_followup_uniq
  on public.challenge_evidence (followup_id) where followup_id is not null;

-- ---------------------------------------------------------------------
-- Storage: bucket privado para as fotos
-- Caminho: users/{user_id}/challenges/{challenge_id}/{arquivo}
-- (políticas de acesso em 12_rls.sql)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('eco-evidence', 'eco-evidence', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Confere se o arquivo pertence ao usuário/desafio e se realmente foi enviado.
create or replace function public.assert_evidence_path(p_user uuid, p_challenge uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_path is null then
    return;
  end if;
  if p_path !~ ('^users/' || p_user::text || '/challenges/' || p_challenge::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'invalid_evidence_path';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'eco-evidence' and name = p_path) then
    raise exception 'evidence_file_missing';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: enviar a evidência da realização (Dia 0)
-- Cria os acompanhamentos agendados a partir das etapas follow_up.
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
  -- Aceita um dia de folga por causa de fuso horário.
  if p_captured_at is null or p_captured_at > current_date + 1 then
    raise exception 'invalid_date';
  end if;

  perform public.assert_evidence_path(v_user, v_challenge.id, p_file_path);
  perform public.assert_evidence_path(v_user, v_challenge.id, p_thumbnail_path);

  insert into public.challenge_evidence (
    user_challenge_id, user_id, evidence_type, file_url, thumbnail_url, description, captured_at
  )
  values (
    v_uc.id,
    v_user,
    case when p_file_path is null then 'text' else 'photo' end::public.evidence_type,
    p_file_path,
    p_thumbnail_path,
    nullif(btrim(p_description), ''),
    (p_captured_at + time '12:00') at time zone 'UTC'
  )
  returning id into v_id;

  perform public.complete_challenge_steps(
    v_uc.id, array['instruction', 'action', 'evidence']::public.challenge_step_type[]
  );

  update public.user_challenges
  set status = 'in_progress', started_at = coalesce(started_at, now())
  where id = v_uc.id;

  insert into public.challenge_followups (
    user_challenge_id, challenge_step_id, title, description, scheduled_for, evidence_required
  )
  select v_uc.id, cs.id, cs.title, cs.description,
         ((p_captured_at + cs.day_offset) + time '12:00') at time zone 'UTC',
         true
  from public.challenge_steps cs
  where cs.challenge_id = v_challenge.id and cs.step_type = 'follow_up'
  on conflict (user_challenge_id, challenge_step_id) do nothing;

  perform public.refresh_user_challenge_progress(v_uc.id);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: registrar um acompanhamento (somente a partir da data prevista)
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
  v_step_xp   integer;
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
  if v_followup.scheduled_for > now() then
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

    select xp_reward into v_step_xp from public.challenge_steps where id = v_followup.challenge_step_id;
    v_xp := public.award_xp(v_user, coalesce(v_step_xp, 0), 'follow_up', 'follow_up', p_followup_id,
                            'Acompanhamento: ' || v_followup.title);
  end if;

  -- Último acompanhamento de um desafio já concluído encerra o ciclo do desafio.
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
