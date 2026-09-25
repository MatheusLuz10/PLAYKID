-- =====================================================================
-- NEON · contas (roda DEPOIS das migrations 01…27). Idempotente.
-- No Supabase o perfil nasce do trigger em auth.users. No Neon a conta é criada
-- pelo Neon Auth (neon_auth."user"); na primeira entrada o app chama
-- ensure_account(), que registra a conta em app_auth.users e dispara o mesmo
-- trigger que cria o perfil e o mundo inicial.
-- =====================================================================

create or replace function public.ensure_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := app_auth.uid();
  v_email text;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from app_auth.users where id = v_user) then
    return;
  end if;
  -- só contas que existem de verdade no Neon Auth
  select u.email into v_email from neon_auth."user" u where u.id = v_user;
  if not found then
    raise exception 'not_authenticated';
  end if;
  insert into app_auth.users (id, email) values (v_user, v_email) on conflict (id) do nothing;
end;
$$;

revoke all on function public.ensure_account() from public, anon;
grant execute on function public.ensure_account() to authenticated;

-- Excluir a conta (delete_my_account apaga app_auth.users) também apaga o login no Neon Auth.
create or replace function app_auth.delete_neon_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from neon_auth."user" where id = old.id;
  return old;
exception when others then
  -- se o Neon Auth recusar, os dados do jogo já foram apagados; o login fica órfão
  return old;
end;
$$;

drop trigger if exists on_app_user_deleted on app_auth.users;
create trigger on_app_user_deleted
  after delete on app_auth.users
  for each row execute function app_auth.delete_neon_auth_user();

-- ---------------------------------------------------------------------
-- Fotos (Neon Object Storage). Quem envia/lê/apaga é o Worker, depois de
-- conferir o login; estas funções são as MESMAS regras das políticas de
-- storage.objects (12_rls e 25_final_hardening), com o usuário já verificado.
-- Só o dono do banco (o Worker) as executa.
-- ---------------------------------------------------------------------
create or replace function app_auth.storage_can_insert(p_user uuid, p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (storage.foldername(p_name))[1] = 'users'
     and (storage.foldername(p_name))[2] = p_user::text
     and (storage.foldername(p_name))[3] = 'challenges'
     and exists (
       select 1 from public.user_challenges uc
       where uc.user_id = p_user
         and uc.challenge_id::text = (storage.foldername(p_name))[4]
         and uc.status in ('accepted', 'in_progress', 'waiting_follow_up')
     );
$$;

create or replace function app_auth.storage_can_read(p_user uuid, p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (storage.foldername(p_name))[2] = p_user::text
      or exists (select 1 from public.profiles p where p.user_id = p_user and p.role = 'admin');
$$;

create or replace function app_auth.storage_can_delete(p_user uuid, p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (storage.foldername(p_name))[1] = 'users'
     and (storage.foldername(p_name))[2] = p_user::text
     and (
       not exists (
         select 1 from public.challenge_evidence e
         where e.file_url = p_name or e.thumbnail_url = p_name
       )
       or exists (
         select 1 from public.profiles p
         where p.user_id = p_user and p.deletion_requested_at is not null
       )
     );
$$;

revoke all on function app_auth.storage_can_insert(uuid, text) from public, anon, authenticated, anonymous;
revoke all on function app_auth.storage_can_read(uuid, text) from public, anon, authenticated, anonymous;
revoke all on function app_auth.storage_can_delete(uuid, text) from public, anon, authenticated, anonymous;

-- ---------------------------------------------------------------------
-- Bancos instalados antes de app_auth.uid(): recria (create or replace, sem mexer em
-- dados) as funções de public cujo código ainda chama auth.uid() direto.
-- ---------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prokind = 'f'
      and p.prosrc like '%auth.uid()%'
      and p.prosrc not like '%app_auth.uid()%'
  loop
    execute replace(pg_get_functiondef(f.oid), 'auth.uid()', 'app_auth.uid()');
  end loop;
end $$;
