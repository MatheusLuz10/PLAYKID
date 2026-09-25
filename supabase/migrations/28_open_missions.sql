-- =====================================================================
-- 28 · Missões abertas para todos os jogadores
-- - Todo desafio pode ser aceito sem concluir a aula nem ser aprovado no quiz.
-- - As aulas não têm mais pré-requisito (conteúdo em content/lessons.json → 15).
-- A aula e o quiz continuam existindo e dando XP. O quiz segue depois da sua aula.
-- =====================================================================

create or replace function public.accept_challenge(p_challenge_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user       uuid := public.require_user();
  v_challenge  public.challenges;
  v_existing   public.user_challenges;
  v_id         uuid;
begin
  select * into v_challenge from public.challenges where id = p_challenge_id and active;
  if not found then
    raise exception 'not_found';
  end if;

  -- Missões abertas: o desafio pode ser aceito sem concluir a aula nem passar no quiz
  -- (a aula e o quiz continuam disponíveis e dando XP, mas não são obrigatórios).

  select * into v_existing from public.user_challenges
  where user_id = v_user and challenge_id = p_challenge_id and status not in ('expired', 'cancelled')
  for update;

  if found then
    if public.challenge_is_overdue(v_existing.id) then
      -- Prazo vencido: o registro antigo expira e um novo começa.
      update public.user_challenges set status = 'expired' where id = v_existing.id;
    else
      return v_existing.id; -- já existe um ativo/concluído: não duplica
    end if;
  end if;

  insert into public.user_challenges (user_id, challenge_id, status, accepted_at, deadline_at)
  values (v_user, p_challenge_id, 'accepted', now(), now() + make_interval(days => v_challenge.deadline_days))
  returning id into v_id;

  insert into public.user_challenge_steps (user_challenge_id, challenge_step_id)
  select v_id, cs.id from public.challenge_steps cs where cs.challenge_id = p_challenge_id and cs.active;

  perform public.refresh_user_challenge_progress(v_id);
  -- XP de início: uma vez por desafio (recomeçar ou encerrar não repete).
  perform public.process_gamification_event(v_user, 'challenge_started', p_challenge_id);
  perform public.check_achievements(v_user);
  return v_id;
end;
$$;
