-- =====================================================================
-- 01 · Extensões, tipos e utilitários compartilhados
-- =====================================================================
-- gen_random_uuid() é nativo do PostgreSQL 13+, então nenhuma extensão
-- adicional é obrigatória. O pgcrypto já vem habilitado no Supabase.
create extension if not exists pgcrypto with schema extensions;

-- Dificuldade usada por aulas e desafios.
create type public.difficulty_level as enum ('facil', 'medio', 'dificil');

-- Mantém updated_at sempre correto.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Garante que existe um usuário autenticado e devolve o seu id.
-- As mensagens de erro são códigos curtos, traduzidos no frontend.
create or replace function public.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  return v_user;
end;
$$;
