-- =====================================================================
-- 02 · Perfis de usuário e papéis (user / admin)
-- =====================================================================

create type public.app_role as enum ('user', 'admin');

create table public.profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users (id) on delete cascade,
  username      text unique,
  display_name  text,
  avatar_url    text,
  -- Avatar em emoji usado pela interface atual (avatar_url fica para fotos futuras).
  avatar_emoji  text not null default '🦊',
  role          public.app_role not null default 'user',
  level         integer not null default 1 check (level >= 1),
  total_xp      integer not null default 0 check (total_xp >= 0),
  knowledge_xp  integer not null default 0 check (knowledge_xp >= 0),
  action_xp     integer not null default 0 check (action_xp >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint profiles_username_format
    check (username is null or username ~ '^[a-z0-9_]{3,24}$'),
  constraint profiles_display_name_length
    check (display_name is null or char_length(btrim(display_name)) between 1 and 40),
  constraint profiles_avatar_emoji_length
    check (char_length(avatar_emoji) <= 16)
);

comment on table public.profiles is 'Perfil público do jogador. XP e nível são mantidos pelo servidor (xp_transactions).';
comment on column public.profiles.role is 'user ou admin. Não pode ser alterado pelo próprio usuário.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria o perfil automaticamente quando alguém se cadastra no Supabase Auth.
-- display_name nulo = perfil ainda não criado pelo jogador (tela "Criar perfil").
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usado pelas políticas RLS e pelo futuro painel administrativo.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  );
$$;
