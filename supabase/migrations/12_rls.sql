-- =====================================================================
-- 12 · Segurança: Row Level Security, permissões e Storage
-- =====================================================================
-- Modelo:
--   • Conteúdo (categorias, aulas, quizzes, desafios, níveis, conquistas,
--     itens do mundo) → leitura pública; escrita somente para admin.
--   • Dados do jogador → cada usuário lê apenas os próprios registros.
--   • NENHUMA escrita direta em progresso, XP, conquistas ou mundo:
--     tudo passa pelas funções RPC (security definer), que validam a ordem
--     do jogo (aula → quiz aprovado → desafio → evidência → conclusão).
--   • Respostas corretas (is_correct) e explicações não são legíveis.

-- ---------------------------------------------------------------------
-- 1. Começa do zero: remove os privilégios padrão do Supabase
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Habilita RLS em todas as tabelas
-- ---------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.categories            enable row level security;
alter table public.lessons               enable row level security;
alter table public.lesson_sections       enable row level security;
alter table public.quizzes               enable row level security;
alter table public.quiz_questions        enable row level security;
alter table public.quiz_options          enable row level security;
alter table public.quiz_attempts         enable row level security;
alter table public.quiz_answers          enable row level security;
alter table public.challenges            enable row level security;
alter table public.challenge_steps       enable row level security;
alter table public.user_challenges       enable row level security;
alter table public.user_challenge_steps  enable row level security;
alter table public.challenge_followups   enable row level security;
alter table public.challenge_evidence    enable row level security;
alter table public.user_lesson_progress  enable row level security;
alter table public.levels                enable row level security;
alter table public.xp_transactions       enable row level security;
alter table public.achievements          enable row level security;
alter table public.user_achievements     enable row level security;
alter table public.worlds                enable row level security;
alter table public.world_items           enable row level security;
alter table public.user_world_items      enable row level security;

-- ---------------------------------------------------------------------
-- 3. Conteúdo público (somente leitura) + escrita para admin
-- ---------------------------------------------------------------------
grant select on public.categories, public.lessons, public.lesson_sections,
                public.quizzes, public.challenges, public.challenge_steps,
                public.levels, public.achievements, public.world_items
  to anon, authenticated;

-- Perguntas e alternativas: SEM explicação e SEM is_correct.
grant select (id, quiz_id, question, order_index, points, active, created_at)
  on public.quiz_questions to anon, authenticated;
grant select (id, question_id, option_text, order_index)
  on public.quiz_options to anon, authenticated;

-- Escrita de conteúdo: o grant existe, mas só passa pela política de admin.
grant insert, update, delete on public.categories, public.lessons, public.lesson_sections,
                                public.quizzes, public.quiz_questions, public.quiz_options,
                                public.challenges, public.challenge_steps, public.levels,
                                public.achievements, public.world_items
  to authenticated;

create policy categories_read on public.categories
  for select to anon, authenticated using (active or (select public.is_admin()));
create policy lessons_read on public.lessons
  for select to anon, authenticated using (active or (select public.is_admin()));
create policy lesson_sections_read on public.lesson_sections
  for select to anon, authenticated using (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.active)
    or (select public.is_admin())
  );
create policy quizzes_read on public.quizzes
  for select to anon, authenticated using (active or (select public.is_admin()));
create policy quiz_questions_read on public.quiz_questions
  for select to anon, authenticated using (active or (select public.is_admin()));
create policy quiz_options_read on public.quiz_options
  for select to anon, authenticated using (true);
create policy challenges_read on public.challenges
  for select to anon, authenticated using (active or (select public.is_admin()));
create policy challenge_steps_read on public.challenge_steps
  for select to anon, authenticated using (true);
create policy levels_read on public.levels
  for select to anon, authenticated using (true);
create policy achievements_read on public.achievements
  for select to anon, authenticated using (active or (select public.is_admin()));
create policy world_items_read on public.world_items
  for select to anon, authenticated using (true);

create policy categories_admin on public.categories
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy lessons_admin on public.lessons
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy lesson_sections_admin on public.lesson_sections
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy quizzes_admin on public.quizzes
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy quiz_questions_admin on public.quiz_questions
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy quiz_options_admin on public.quiz_options
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy challenges_admin on public.challenges
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy challenge_steps_admin on public.challenge_steps
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy levels_admin on public.levels
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy achievements_admin on public.achievements
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy world_items_admin on public.world_items
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Admin (futuro painel) lê o gabarito por uma função que confere o papel.
create or replace function public.admin_quiz_answer_key(p_quiz_id uuid)
returns table (question_id uuid, question text, explanation text, option_id uuid,
               option_text text, is_correct boolean, option_explanation text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select q.id, q.question, q.explanation, o.id, o.option_text, o.is_correct, o.explanation
    from public.quiz_questions q
    join public.quiz_options o on o.question_id = q.id
    where q.quiz_id = p_quiz_id
    order by q.order_index, o.order_index;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Perfil: lê o próprio; altera só campos de apresentação
-- ---------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (username, display_name, avatar_url, avatar_emoji) on public.profiles to authenticated;

create policy profiles_read_own on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 5. Dados do jogador: somente leitura dos próprios registros
--    (escritas acontecem exclusivamente pelas funções RPC)
-- ---------------------------------------------------------------------
grant select on public.quiz_attempts, public.quiz_answers, public.user_lesson_progress,
                public.user_challenges, public.user_challenge_steps, public.challenge_followups,
                public.challenge_evidence, public.xp_transactions, public.user_achievements,
                public.worlds, public.user_world_items
  to authenticated;

create policy quiz_attempts_read_own on public.quiz_attempts
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy quiz_answers_read_own on public.quiz_answers
  for select to authenticated using (
    exists (select 1 from public.quiz_attempts a where a.id = attempt_id and a.user_id = (select auth.uid()))
    or (select public.is_admin())
  );
create policy user_lesson_progress_read_own on public.user_lesson_progress
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy user_challenges_read_own on public.user_challenges
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy user_challenge_steps_read_own on public.user_challenge_steps
  for select to authenticated using (
    exists (select 1 from public.user_challenges uc
            where uc.id = user_challenge_id and uc.user_id = (select auth.uid()))
    or (select public.is_admin())
  );
create policy challenge_followups_read_own on public.challenge_followups
  for select to authenticated using (
    exists (select 1 from public.user_challenges uc
            where uc.id = user_challenge_id and uc.user_id = (select auth.uid()))
    or (select public.is_admin())
  );
create policy challenge_evidence_read_own on public.challenge_evidence
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy xp_transactions_read_own on public.xp_transactions
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy user_achievements_read_own on public.user_achievements
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy worlds_read_own on public.worlds
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy user_world_items_read_own on public.user_world_items
  for select to authenticated using (
    exists (select 1 from public.worlds w where w.id = world_id and w.user_id = (select auth.uid()))
    or (select public.is_admin())
  );

-- ---------------------------------------------------------------------
-- 6. Funções que o frontend pode chamar
--    (award_xp, check_achievements etc. continuam SEM permissão)
-- ---------------------------------------------------------------------
grant execute on function public.is_admin()                 to anon, authenticated;
grant execute on function public.require_user()             to authenticated;
grant execute on function public.get_player_state()         to authenticated;
grant execute on function public.track_lesson_progress(uuid, integer) to authenticated;
grant execute on function public.complete_lesson(uuid)      to authenticated;
grant execute on function public.start_quiz_attempt(uuid)   to authenticated;
grant execute on function public.answer_quiz_question(uuid, uuid, uuid) to authenticated;
grant execute on function public.finish_quiz_attempt(uuid)  to authenticated;
grant execute on function public.accept_challenge(uuid)     to authenticated;
grant execute on function public.submit_challenge_evidence(uuid, text, text, text, date) to authenticated;
grant execute on function public.complete_followup(uuid, text, text, text) to authenticated;
grant execute on function public.complete_challenge(uuid)   to authenticated;
grant execute on function public.reveal_world_items()       to authenticated;
grant execute on function public.admin_quiz_answer_key(uuid) to authenticated;
grant execute on function public.admin_recalculate_xp(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Storage (bucket privado eco-evidence)
--    Caminho obrigatório: users/{auth.uid()}/challenges/{challenge_id}/{arquivo}
--    Upload só para desafios aceitos pelo próprio usuário. Sem update/delete.
-- ---------------------------------------------------------------------
create policy eco_evidence_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'eco-evidence'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and (storage.foldername(name))[3] = 'challenges'
    and exists (
      select 1 from public.user_challenges uc
      where uc.user_id = (select auth.uid())
        and uc.challenge_id::text = (storage.foldername(name))[4]
        and uc.status in ('accepted', 'in_progress', 'waiting_follow_up')
    )
  );

create policy eco_evidence_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'eco-evidence'
    and (
      (storage.foldername(name))[2] = (select auth.uid())::text
      or (select public.is_admin())
    )
  );
