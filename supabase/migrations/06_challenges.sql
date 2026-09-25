-- =====================================================================
-- 06 · Desafios, etapas e desafios aceitos pelos usuários
-- =====================================================================
-- Relacionamento pedagógico: LESSON → QUIZ → CHALLENGE.
-- Um desafio só pode ser aceito depois da aula concluída e do quiz aprovado.

create type public.challenge_status as enum (
  'locked', 'available', 'accepted', 'in_progress',
  'waiting_follow_up', 'completed', 'expired', 'cancelled'
);

create type public.challenge_step_type as enum (
  'instruction', 'action', 'evidence', 'follow_up', 'completion'
);

create table public.challenges (
  id                  uuid primary key default gen_random_uuid(),
  category_id         uuid not null references public.categories (id) on delete restrict,
  lesson_id           uuid not null references public.lessons (id) on delete restrict,
  icon                text,
  title               text not null,
  slug                text not null unique,
  description         text not null,
  -- Uma instrução por linha.
  instructions        text,
  -- Cuidados/segurança, uma recomendação por linha.
  safety_notes        text,
  difficulty          public.difficulty_level not null default 'medio',
  deadline_days       integer not null default 15 check (deadline_days > 0),
  xp_reward           integer not null default 500 check (xp_reward >= 0),
  active              boolean not null default true,
  requires_evidence   boolean not null default true,
  requires_follow_up  boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index challenges_lesson_idx on public.challenges (lesson_id);
create index challenges_category_idx on public.challenges (category_id);

create trigger challenges_set_updated_at
  before update on public.challenges
  for each row execute function public.set_updated_at();

create table public.challenge_steps (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references public.challenges (id) on delete cascade,
  title         text not null,
  description   text,
  step_type     public.challenge_step_type not null,
  order_index   integer not null default 0,
  required      boolean not null default true,
  xp_reward     integer not null default 0 check (xp_reward >= 0),
  -- Para follow_up: quantos dias após a realização (Dia 0) o acompanhamento acontece.
  day_offset    integer check (day_offset is null or day_offset >= 0),
  created_at    timestamptz not null default now(),
  unique (challenge_id, order_index),
  constraint challenge_steps_follow_up_day check (step_type <> 'follow_up' or day_offset is not null)
);

create table public.user_challenges (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  challenge_id         uuid not null references public.challenges (id) on delete cascade,
  status               public.challenge_status not null default 'accepted',
  started_at           timestamptz,
  accepted_at          timestamptz,
  deadline_at          timestamptz,
  completed_at         timestamptz,
  progress_percentage  integer not null default 0 check (progress_percentage between 0 and 100),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Um único registro "vivo" por usuário e desafio (expirados/cancelados podem ser refeitos).
create unique index user_challenges_active_uniq
  on public.user_challenges (user_id, challenge_id)
  where status not in ('expired', 'cancelled');
create index user_challenges_user_status_idx on public.user_challenges (user_id, status);

create trigger user_challenges_set_updated_at
  before update on public.user_challenges
  for each row execute function public.set_updated_at();

create table public.user_challenge_steps (
  id                 uuid primary key default gen_random_uuid(),
  user_challenge_id  uuid not null references public.user_challenges (id) on delete cascade,
  challenge_step_id  uuid not null references public.challenge_steps (id) on delete cascade,
  status             text not null default 'pending' check (status in ('pending', 'completed', 'skipped')),
  completed_at       timestamptz,
  notes              text,
  created_at         timestamptz not null default now(),
  unique (user_challenge_id, challenge_step_id)
);

-- ---------------------------------------------------------------------
-- Utilitários internos (sem permissão de execução para usuários)
-- ---------------------------------------------------------------------
create or replace function public.complete_challenge_steps(
  p_user_challenge_id uuid,
  p_types public.challenge_step_type[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.user_challenge_steps ucs
  set status = 'completed', completed_at = now()
  from public.challenge_steps cs
  where cs.id = ucs.challenge_step_id
    and ucs.user_challenge_id = p_user_challenge_id
    and cs.step_type = any (p_types)
    and ucs.status <> 'completed';
end;
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
    where ucs.user_challenge_id = p_user_challenge_id and cs.required
  ), 0)
  where uc.id = p_user_challenge_id;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: aceitar desafio (exige aula concluída e quiz aprovado)
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
    -- Prazo vencido sem realização: o registro antigo expira e um novo começa.
    if v_existing.status = 'accepted' and v_existing.deadline_at < now() then
      update public.user_challenges set status = 'expired' where id = v_existing.id;
    else
      return v_existing.id;
    end if;
  end if;

  insert into public.user_challenges (user_id, challenge_id, status, accepted_at, deadline_at)
  values (v_user, p_challenge_id, 'accepted', now(), now() + make_interval(days => v_challenge.deadline_days))
  returning id into v_id;

  insert into public.user_challenge_steps (user_challenge_id, challenge_step_id)
  select v_id, cs.id from public.challenge_steps cs where cs.challenge_id = p_challenge_id;

  perform public.refresh_user_challenge_progress(v_id);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: concluir desafio → XP, conquistas e item no mundo
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
  v_pending    integer;
  v_xp         integer;
  v_items      jsonb;
begin
  select * into v_uc from public.user_challenges
  where id = p_user_challenge_id and user_id = v_user
  for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_uc.completed_at is not null then
    raise exception 'challenge_already_completed';
  end if;
  if v_uc.status not in ('accepted', 'in_progress') then
    raise exception 'challenge_not_active';
  end if;

  select * into v_challenge from public.challenges where id = v_uc.challenge_id;

  if v_challenge.requires_evidence and not exists (
    select 1 from public.challenge_evidence
    where user_challenge_id = v_uc.id and followup_id is null
  ) then
    raise exception 'evidence_required';
  end if;

  perform public.complete_challenge_steps(
    v_uc.id, array['instruction', 'action', 'completion']::public.challenge_step_type[]
  );

  select count(*) into v_pending from public.challenge_followups
  where user_challenge_id = v_uc.id and status = 'scheduled';

  update public.user_challenges
  set status = case when v_pending > 0 then 'waiting_follow_up' else 'completed' end::public.challenge_status,
      completed_at = now(),
      started_at = coalesce(started_at, now())
  where id = v_uc.id;

  perform public.refresh_user_challenge_progress(v_uc.id);

  v_xp := public.award_xp(v_user, v_challenge.xp_reward, 'action', 'challenge', v_uc.id,
                          'Desafio concluído: ' || v_challenge.title);
  v_items := public.unlock_world_items_for_challenge(v_user, v_challenge.slug);

  return jsonb_build_object(
    'xp_awarded',   v_xp,
    'world_items',  v_items,
    'achievements', public.check_achievements(v_user)
  );
end;
$$;
