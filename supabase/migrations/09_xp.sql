-- =====================================================================
-- 09 · XP (histórico auditável) e níveis
-- =====================================================================
-- Toda variação de XP vira uma linha em xp_transactions. Os totais do
-- perfil são apenas um cache mantido por trigger e podem ser recalculados
-- a qualquer momento a partir do histórico (admin_recalculate_xp).

create type public.xp_type as enum ('knowledge', 'action', 'achievement', 'follow_up', 'bonus');

create table public.levels (
  id            uuid primary key default gen_random_uuid(),
  level_number  integer not null unique check (level_number > 0),
  name          text not null,
  xp_required   integer not null unique check (xp_required >= 0),
  description   text,
  reward        text,
  icon          text,
  created_at    timestamptz not null default now()
);

create table public.xp_transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  amount       integer not null check (amount <> 0),
  xp_type      public.xp_type not null,
  -- Origem: lesson, quiz, challenge, follow_up, achievement, bonus...
  source_type  text not null,
  source_id    uuid,
  description  text,
  created_at   timestamptz not null default now()
);

create index xp_transactions_user_created_idx on public.xp_transactions (user_id, created_at desc);
-- Impede XP duplicado pela mesma origem (idempotência).
create unique index xp_transactions_source_uniq
  on public.xp_transactions (user_id, source_type, source_id)
  where source_id is not null;

create or replace function public.level_for_xp(p_xp integer)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(max(level_number), 1) from public.levels where xp_required <= p_xp;
$$;

-- Atualiza o cache de XP/nível do perfil a cada nova transação.
create or replace function public.apply_xp_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles p
  set total_xp     = greatest(p.total_xp + new.amount, 0),
      knowledge_xp = greatest(p.knowledge_xp + case when new.xp_type = 'knowledge' then new.amount else 0 end, 0),
      action_xp    = greatest(p.action_xp + case when new.xp_type in ('action', 'follow_up') then new.amount else 0 end, 0)
  where p.user_id = new.user_id;

  update public.profiles p
  set level = public.level_for_xp(p.total_xp)
  where p.user_id = new.user_id;

  return new;
end;
$$;

create trigger xp_transactions_apply
  after insert on public.xp_transactions
  for each row execute function public.apply_xp_transaction();

-- Função interna: concede XP uma única vez por origem. Retorna o XP concedido (0 se repetido).
create or replace function public.award_xp(
  p_user_id      uuid,
  p_amount       integer,
  p_type         public.xp_type,
  p_source_type  text,
  p_source_id    uuid,
  p_description  text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if coalesce(p_amount, 0) <= 0 then
    return 0;
  end if;

  insert into public.xp_transactions (user_id, amount, xp_type, source_type, source_id, description)
  values (p_user_id, p_amount, p_type, p_source_type, p_source_id, p_description)
  on conflict (user_id, source_type, source_id) where source_id is not null do nothing
  returning id into v_id;

  return case when v_id is null then 0 else p_amount end;
end;
$$;

-- Auditoria (admin): recalcula o cache do perfil a partir do histórico.
create or replace function public.admin_recalculate_xp(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.profiles p
  set total_xp     = greatest(coalesce(t.total, 0), 0),
      knowledge_xp = greatest(coalesce(t.knowledge, 0), 0),
      action_xp    = greatest(coalesce(t.action, 0), 0),
      level        = public.level_for_xp(greatest(coalesce(t.total, 0), 0))
  from (
    select sum(amount)::integer as total,
           (sum(amount) filter (where xp_type = 'knowledge'))::integer as knowledge,
           (sum(amount) filter (where xp_type in ('action', 'follow_up')))::integer as action
    from public.xp_transactions
    where user_id = p_user_id
  ) t
  where p.user_id = p_user_id;
end;
$$;
