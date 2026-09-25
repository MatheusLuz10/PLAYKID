-- =====================================================================
-- 25 · Integração final: segurança, administração, conta e logs (Etapa 8)
-- =====================================================================
-- Não apaga nem recria nada existente. Só acrescenta:
--   1. índices para as consultas/políticas mais usadas;
--   2. histórico preservado quando um conteúdo é desativado;
--   3. registro de erros (monitoramento) sem dados sensíveis;
--   4. exclusão da própria conta (com confirmação em duas etapas);
--   5. funções de administração (sempre conferindo o papel no servidor).

-- ---------------------------------------------------------------------
-- 1. Índices (chaves usadas pelo RLS e pela validação de eventos)
-- ---------------------------------------------------------------------
create index if not exists challenge_evidence_user_idx on public.challenge_evidence (user_id);
create index if not exists user_challenge_steps_step_idx on public.user_challenge_steps (challenge_step_id);
create index if not exists challenge_followups_step_idx on public.challenge_followups (challenge_step_id);
create index if not exists user_achievements_achievement_idx on public.user_achievements (achievement_id);
create index if not exists gamification_events_created_idx on public.gamification_events (created_at);

-- ---------------------------------------------------------------------
-- 2. Conteúdo desativado (active = false) some para quem não o usou,
--    mas continua visível para quem já tem histórico com ele.
-- ---------------------------------------------------------------------
-- O jogador tem histórico com este conteúdo? (anônimo: nunca)
create or replace function public.has_content_history(p_kind text, p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then false
    when p_kind = 'lesson' then exists (select 1 from public.user_lesson_progress where lesson_id = p_id and user_id = auth.uid())
    when p_kind = 'quiz' then exists (select 1 from public.quiz_attempts where quiz_id = p_id and user_id = auth.uid())
    when p_kind = 'challenge' then exists (select 1 from public.user_challenges where challenge_id = p_id and user_id = auth.uid())
    when p_kind = 'achievement' then exists (select 1 from public.user_achievements where achievement_id = p_id and user_id = auth.uid())
    else false
  end;
$$;

drop policy lessons_read on public.lessons;
create policy lessons_read on public.lessons
  for select to anon, authenticated
  using (active or (select public.is_admin()) or public.has_content_history('lesson', id));

drop policy quizzes_read on public.quizzes;
create policy quizzes_read on public.quizzes
  for select to anon, authenticated
  using (active or (select public.is_admin()) or public.has_content_history('quiz', id));

drop policy challenges_read on public.challenges;
create policy challenges_read on public.challenges
  for select to anon, authenticated
  using (active or (select public.is_admin()) or public.has_content_history('challenge', id));

drop policy achievements_read on public.achievements;
create policy achievements_read on public.achievements
  for select to anon, authenticated
  using (active or (select public.is_admin()) or public.has_content_history('achievement', id));

-- ---------------------------------------------------------------------
-- 3. Registro de erros (preparado para monitoramento)
--    Nunca guarda senha, token ou chave: o texto é limpo antes de salvar.
-- ---------------------------------------------------------------------
create table public.app_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete set null,
  level       text not null default 'error' check (level in ('error', 'warn', 'info')),
  operation   text not null check (char_length(operation) between 1 and 80),
  code        text check (char_length(code) <= 80),
  message     text check (char_length(message) <= 500),
  context     jsonb not null default '{}'::jsonb check (pg_column_size(context) <= 4000),
  created_at  timestamptz not null default now()
);
create index app_logs_created_idx on public.app_logs (created_at desc);
create index app_logs_user_created_idx on public.app_logs (user_id, created_at desc);

comment on table public.app_logs is 'Erros e ações administrativas. Leitura só por admin. Sem dados sensíveis.';

-- Remove tokens JWT, chaves do Supabase e e-mails de um texto.
create or replace function public.redact_sensitive(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(coalesce(p_text, ''), 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*', '[token]', 'g'),
             'sb_(secret|publishable)_[A-Za-z0-9_-]+', '[chave]', 'g'),
           '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[email]', 'g');
$$;

create or replace function public.write_log(
  p_user uuid, p_level text, p_operation text, p_code text, p_message text, p_context jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.app_logs (user_id, level, operation, code, message, context)
  values (
    p_user, p_level,
    left(public.redact_sensitive(p_operation), 80),
    left(public.redact_sensitive(p_code), 80),
    left(public.redact_sensitive(p_message), 500),
    -- contexto grande demais é descartado (cortar o texto quebraria o JSON)
    case when char_length(coalesce(p_context, '{}'::jsonb)::text) > 3500 then '{}'::jsonb
         else public.redact_sensitive(coalesce(p_context, '{}'::jsonb)::text)::jsonb end
  );
$$;

-- RPC: o app registra um erro do jogador (limite de 20 por minuto por usuário).
create or replace function public.log_client_error(
  p_operation text, p_code text, p_message text, p_context jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
begin
  if (select count(*) from public.app_logs
      where user_id = v_user and created_at > now() - interval '1 minute') >= 20 then
    return; -- evita inundar o registro
  end if;
  if jsonb_typeof(coalesce(p_context, '{}'::jsonb)) <> 'object' then
    p_context := '{}'::jsonb;
  end if;
  perform public.write_log(v_user, 'error', coalesce(nullif(btrim(p_operation), ''), 'unknown'), p_code, p_message, p_context);
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Excluir minha conta
--    (1) request_account_deletion: marca o pedido (o app mostra a confirmação antes);
--    (2) o app remove as fotos pelo Storage (a política abaixo passa a permitir);
--    (3) delete_my_account: apaga o usuário. Tudo o que é dele cai em cascata:
--        perfil, progresso, tentativas, desafios, evidências, XP, conquistas, mundo.
-- ---------------------------------------------------------------------
alter table public.profiles add column deletion_requested_at timestamptz;

create or replace function public.request_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set deletion_requested_at = now() where user_id = public.require_user();
end;
$$;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
begin
  if not exists (
    select 1 from public.profiles
    where user_id = v_user and deletion_requested_at > now() - interval '1 hour'
  ) then
    raise exception 'deletion_not_confirmed';
  end if;
  perform public.write_log(null, 'info', 'account.deleted', null, 'Conta excluída pelo próprio usuário.', '{}'::jsonb);
  delete from auth.users where id = v_user;
end;
$$;

-- Fotos: o jogador só apaga arquivos da própria pasta que NÃO são evidência de
-- nada (upload interrompido) — ou todos, depois de pedir a exclusão da conta.
create policy eco_evidence_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'eco-evidence'
    and (storage.foldername(objects.name))[1] = 'users'
    and (storage.foldername(objects.name))[2] = (select auth.uid())::text
    and (
      not exists (
        select 1 from public.challenge_evidence e
        where e.file_url = objects.name or e.thumbnail_url = objects.name
      )
      or exists (
        select 1 from public.profiles p
        where p.user_id = (select auth.uid()) and p.deletion_requested_at is not null
      )
    )
  );

-- ---------------------------------------------------------------------
-- 5. Administração (o papel é conferido em TODA função)
-- ---------------------------------------------------------------------
create or replace function public.require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return v_user;
end;
$$;

-- Métricas reais (nenhuma sem fonte de dados).
create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'users',                (select count(*) from public.profiles),
    'users_with_profile',   (select count(*) from public.profiles where display_name is not null),
    'active_users_30d',     (select count(distinct user_id) from public.gamification_events
                             where created_at > now() - interval '30 days'),
    'lessons_completed',    (select count(*) from public.user_lesson_progress where status = 'completed'),
    'quizzes_taken',        (select count(*) from public.quiz_attempts where status = 'completed'),
    'quizzes_passed',       (select count(*) from public.quiz_attempts where status = 'completed' and passed),
    'challenges_started',   (select count(*) from public.user_challenges),
    'challenges_completed', (select count(*) from public.user_challenges where status = 'completed'),
    'evidence_sent',        (select count(*) from public.challenge_evidence),
    'xp_distributed',       (select coalesce(sum(amount), 0) from public.xp_transactions),
    'world_items_unlocked', (select count(*) from public.user_world_items where source_type <> 'initial'),
    'errors_24h',           (select count(*) from public.app_logs
                             where level = 'error' and created_at > now() - interval '24 hours'),
    'content', jsonb_build_object(
      'categories',   (select jsonb_build_object('total', count(*), 'active', count(*) filter (where active)) from public.categories),
      'lessons',      (select jsonb_build_object('total', count(*), 'active', count(*) filter (where active)) from public.lessons),
      'quizzes',      (select jsonb_build_object('total', count(*), 'active', count(*) filter (where active)) from public.quizzes),
      'challenges',   (select jsonb_build_object('total', count(*), 'active', count(*) filter (where active)) from public.challenges),
      'achievements', (select jsonb_build_object('total', count(*), 'active', count(*) filter (where active)) from public.achievements),
      'world_items',  (select jsonb_build_object('total', count(*), 'active', count(*) filter (where active)) from public.world_items)
    )
  );
end;
$$;

-- Usuários: só o necessário (sem senha, sem evidências, sem dados privados extras).
create or replace function public.admin_list_users(p_search text default null, p_limit integer default 20, p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_limit  integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  perform public.require_admin();
  return (
    with base as (
      select p.user_id, p.display_name, p.username, p.role, p.level, p.total_xp, p.created_at, u.email,
             (select count(*) from public.user_challenges uc where uc.user_id = p.user_id and uc.status = 'completed') as challenges_completed,
             (select max(e.created_at) from public.gamification_events e where e.user_id = p.user_id) as last_activity
      from public.profiles p
      join auth.users u on u.id = p.user_id
      where v_search is null
         or p.display_name ilike '%' || v_search || '%'
         or p.username ilike '%' || v_search || '%'
         or u.email ilike '%' || v_search || '%'
    )
    select jsonb_build_object(
      'total', (select count(*) from base),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'user_id', b.user_id, 'display_name', b.display_name, 'username', b.username, 'email', b.email,
          'role', b.role, 'level', b.level, 'total_xp', b.total_xp,
          'challenges_completed', b.challenges_completed, 'created_at', b.created_at,
          'last_activity', b.last_activity,
          'status', case when b.last_activity > now() - interval '30 days' then 'active' else 'inactive' end
        ) order by b.created_at desc)
        from (select * from base order by created_at desc limit v_limit offset v_offset) b
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- Conteúdo para o painel (inclui os inativos) com o uso real de cada item.
create or replace function public.admin_list_content(p_kind text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return case p_kind
    when 'lesson' then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'title', l.title, 'active', l.active, 'group', c.name, 'xp_reward', l.xp_reward,
        'usage', (select count(*) from public.user_lesson_progress p where p.lesson_id = l.id and p.status = 'completed')
      ) order by c.order_index, l.order_index), '[]'::jsonb)
      from public.lessons l join public.categories c on c.id = l.category_id)
    when 'quiz' then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', q.id, 'title', q.title, 'active', q.active, 'group', l.title, 'xp_reward', q.xp_reward,
        'usage', (select count(*) from public.quiz_attempts a where a.quiz_id = q.id and a.status = 'completed')
      ) order by l.order_index), '[]'::jsonb)
      from public.quizzes q join public.lessons l on l.id = q.lesson_id)
    when 'challenge' then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', ch.id, 'title', ch.title, 'active', ch.active, 'group', c.name, 'xp_reward', ch.xp_reward,
        'usage', (select count(*) from public.user_challenges uc where uc.challenge_id = ch.id and uc.status = 'completed')
      ) order by c.order_index, ch.title), '[]'::jsonb)
      from public.challenges ch join public.categories c on c.id = ch.category_id)
    when 'achievement' then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'title', a.name, 'active', a.active, 'group', a.category, 'xp_reward', a.xp_reward,
        'usage', (select count(*) from public.user_achievements ua where ua.achievement_id = a.id)
      ) order by a.order_index), '[]'::jsonb)
      from public.achievements a)
    when 'world_item' then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', w.id, 'title', coalesce(w.icon || ' ', '') || w.name, 'active', w.active, 'group', w.area, 'xp_reward', null,
        'usage', (select count(*) from public.user_world_items u where u.world_item_id = w.id)
      ) order by w.sort_order), '[]'::jsonb)
      from public.world_items w)
    else null
  end;
end;
$$;

-- Ativar/desativar (nunca apaga: o histórico dos jogadores é preservado).
create or replace function public.admin_set_content_active(p_kind text, p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.require_admin();
  v_rows  integer;
begin
  if p_active is null then
    raise exception 'invalid_input';
  end if;
  case p_kind
    when 'lesson' then update public.lessons set active = p_active where id = p_id;
    when 'quiz' then update public.quizzes set active = p_active where id = p_id;
    when 'challenge' then update public.challenges set active = p_active where id = p_id;
    when 'achievement' then update public.achievements set active = p_active where id = p_id;
    when 'world_item' then update public.world_items set active = p_active where id = p_id;
    else raise exception 'invalid_input';
  end case;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'not_found';
  end if;
  perform public.write_log(v_admin, 'info', 'admin.set_active', p_kind,
    case when p_active then 'Conteúdo ativado' else 'Conteúdo desativado' end,
    jsonb_build_object('id', p_id));
end;
$$;

-- Papel de administrador: só outro admin muda, e nunca o próprio papel.
create or replace function public.admin_set_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.require_admin();
begin
  if p_user_id = v_admin then
    raise exception 'cannot_change_own_role';
  end if;
  update public.profiles set role = p_role where user_id = p_user_id;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.write_log(v_admin, 'info', 'admin.set_role', p_role::text, 'Papel alterado', jsonb_build_object('user_id', p_user_id));
end;
$$;

create or replace function public.admin_list_logs(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id, 'level', l.level, 'operation', l.operation, 'code', l.code,
      'message', l.message, 'created_at', l.created_at
    ) order by l.created_at desc)
    from (select * from public.app_logs order by created_at desc limit least(greatest(coalesce(p_limit, 50), 1), 200)) l
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------
-- 6. RLS e permissões
-- ---------------------------------------------------------------------
alter table public.app_logs enable row level security;
revoke all on public.app_logs from anon, authenticated;
grant select on public.app_logs to authenticated;
create policy app_logs_admin_read on public.app_logs
  for select to authenticated using ((select public.is_admin()));

revoke execute on function public.redact_sensitive(text),
                           public.write_log(uuid, text, text, text, text, jsonb),
                           public.require_admin(),
                           public.log_client_error(text, text, text, jsonb),
                           public.request_account_deletion(),
                           public.delete_my_account(),
                           public.admin_dashboard(),
                           public.admin_list_users(text, integer, integer),
                           public.admin_list_content(text),
                           public.admin_set_content_active(text, uuid, boolean),
                           public.admin_set_role(uuid, public.app_role),
                           public.admin_list_logs(integer)
  from public, anon, authenticated;

-- Funções chamáveis pelo app (as de admin conferem o papel por dentro).
revoke execute on function public.has_content_history(text, uuid) from public;
grant execute on function public.has_content_history(text, uuid) to anon, authenticated;
grant execute on function public.log_client_error(text, text, text, jsonb) to authenticated;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.admin_dashboard() to authenticated;
grant execute on function public.admin_list_users(text, integer, integer) to authenticated;
grant execute on function public.admin_list_content(text) to authenticated;
grant execute on function public.admin_set_content_active(text, uuid, boolean) to authenticated;
grant execute on function public.admin_set_role(uuid, public.app_role) to authenticated;
grant execute on function public.admin_list_logs(integer) to authenticated;
