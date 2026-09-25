-- =====================================================================
-- 08 · Progresso nos conteúdos (conhecimentos adquiridos)
-- =====================================================================

create type public.lesson_progress_status as enum ('not_started', 'in_progress', 'completed');

create table public.user_lesson_progress (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  lesson_id            uuid not null references public.lessons (id) on delete cascade,
  status               public.lesson_progress_status not null default 'not_started',
  progress_percentage  integer not null default 0 check (progress_percentage between 0 and 100),
  completed_at         timestamptz,
  last_accessed_at     timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create trigger user_lesson_progress_set_updated_at
  before update on public.user_lesson_progress
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- RPC: registrar o avanço na aula (nunca conclui; máximo 99%)
-- ---------------------------------------------------------------------
create or replace function public.track_lesson_progress(p_lesson_id uuid, p_percentage integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
begin
  if not exists (select 1 from public.lessons where id = p_lesson_id and active) then
    raise exception 'not_found';
  end if;

  insert into public.user_lesson_progress as ulp
    (user_id, lesson_id, status, progress_percentage, last_accessed_at)
  values
    (v_user, p_lesson_id, 'in_progress', least(greatest(coalesce(p_percentage, 0), 0), 99), now())
  on conflict (user_id, lesson_id) do update
  set last_accessed_at = now(),
      progress_percentage = case
        when ulp.status = 'completed' then ulp.progress_percentage
        else greatest(ulp.progress_percentage, excluded.progress_percentage)
      end,
      status = case
        when ulp.status = 'completed' then ulp.status
        else 'in_progress'::public.lesson_progress_status
      end;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: concluir a aula → XP de conhecimento (uma única vez) e conquistas
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
  v_xp      integer;
begin
  select * into v_lesson from public.lessons where id = p_lesson_id and active;
  if not found then
    raise exception 'not_found';
  end if;

  insert into public.user_lesson_progress as ulp
    (user_id, lesson_id, status, progress_percentage, completed_at, last_accessed_at)
  values
    (v_user, p_lesson_id, 'completed', 100, now(), now())
  on conflict (user_id, lesson_id) do update
  set status = 'completed',
      progress_percentage = 100,
      completed_at = coalesce(ulp.completed_at, now()),
      last_accessed_at = now();

  v_xp := public.award_xp(v_user, v_lesson.xp_reward, 'knowledge', 'lesson', v_lesson.id,
                          'Conteúdo concluído: ' || v_lesson.title);

  return jsonb_build_object(
    'xp_awarded',   v_xp,
    'achievements', public.check_achievements(v_user)
  );
end;
$$;
