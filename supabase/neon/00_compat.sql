-- =====================================================================
-- NEON · camada de compatibilidade (roda ANTES das migrations 01…27)
-- As migrations foram escritas para o Supabase. No Neon:
--   - auth.uid() já existe (extensão pg_session_jwt da Data API) e devolve uuid;
--   - o papel sem login da Data API chama "anonymous" (no Supabase, "anon");
--   - o esquema "auth" é do Neon (não aceita tabelas): a tabela de usuários fica
--     em app_auth.users, e o instalador troca "auth.users" por "app_auth.users";
--   - não há Storage do Supabase: storage.objects é só o registro dos arquivos
--     enviados ao Neon Object Storage (quem grava é o Worker, após conferir o upload).
-- Idempotente: pode rodar de novo.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $$;
-- quem chega sem login pela Data API tem exatamente o que "anon" tem no Supabase
grant anon to anonymous;

create schema if not exists extensions;

-- ---------- usuários (espelho mínimo das contas do Neon Auth) ----------
create schema if not exists app_auth;
create table if not exists app_auth.users (
  id uuid primary key,
  email text,
  created_at timestamptz not null default now()
);
revoke all on schema app_auth from public;
revoke all on app_auth.users from public, anon, authenticated, anonymous;

-- auth.uid() do Neon só pode ser chamado por quem tem acesso ao esquema auth (que não
-- pode ser concedido aos papéis da Data API). Esta função roda como o dono do banco e
-- devolve o mesmo id do login; o instalador troca auth.uid() por ela nas migrations.
create or replace function app_auth.uid()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select auth.uid() $$;
grant usage on schema app_auth to anon, authenticated;
revoke all on function app_auth.uid() from public;
grant execute on function app_auth.uid() to anon, authenticated;

-- ---------- registro de arquivos (fotos das evidências) ----------
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text,
  public boolean,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid,
  created_at timestamptz not null default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[]
language sql immutable as
$$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to anon, authenticated;

-- ---------- permissões padrão como no Supabase ----------
-- (as migrations revogam o que não deve ser público e protegem tudo com RLS)
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
