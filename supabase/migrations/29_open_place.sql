-- =====================================================================
-- 29 · CASA COMPLETA (pedido do jogo, 28/09/2026)
-- Todos os objetos da casa e do quintal ficam liberados para todos os jogadores.
-- - Objeto cuja atividade ainda não aconteceu entra como parte da casa
--   (source_type 'initial').
-- - Quando a atividade acontece (lição, desafio, conquista, nível, foto), o objeto
--   passa a guardar a origem real e o registro do diário, como antes.
-- - A casa de todos os jogadores já existentes é completada no fim desta migration.
-- Idempotente: pode rodar de novo.
-- =====================================================================

create or replace function public.sync_place(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_level     integer;
  r           record;
  v_ok        boolean;
  v_src       uuid;
  v_challenge uuid;
  v_evidence  uuid;
  v_note      text;
  v_id        uuid;
  v_new       jsonb := '[]'::jsonb;
begin
  select level into v_level from public.profiles where user_id = p_user;
  if v_level is null then
    return v_new; -- sem perfil, sem casa
  end if;

  for r in
    select pi.*, u.id as owned_id from public.place_items pi
    left join public.user_place_items u on u.user_id = p_user and u.place_item_id = pi.id
    where pi.active
      and (u.id is null or (u.source_type = 'initial' and pi.unlock_type <> 'initial'))
    order by pi.sort_order
  loop
    v_ok := false;
    v_src := null;
    v_challenge := null;
    v_evidence := null;
    v_note := null;

    case r.unlock_type
      when 'initial' then
        v_ok := true;
      when 'lesson' then
        select l.id into v_src from public.lessons l
        join public.user_lesson_progress p on p.lesson_id = l.id and p.user_id = p_user and p.status = 'completed'
        where l.slug = r.unlock_reference;
        v_ok := v_src is not null;
      when 'challenge' then
        select c.id into v_src from public.challenges c
        where c.slug = r.unlock_reference
          and exists (select 1 from public.user_challenges uc
                      where uc.challenge_id = c.id and uc.user_id = p_user and uc.status = 'completed');
        v_ok := v_src is not null;
        if v_ok then
          v_challenge := v_src;
          -- diário: a primeira observação que o jogador escreveu nesse desafio
          select e.id, e.description into v_evidence, v_note
          from public.challenge_evidence e
          join public.user_challenges uc on uc.id = e.user_challenge_id
          where uc.user_id = p_user and uc.challenge_id = v_src and uc.status = 'completed'
            and nullif(btrim(e.description), '') is not null
          order by e.created_at
          limit 1;
          if v_note is null then
            select s.notes into v_note
            from public.user_challenge_steps s
            join public.user_challenges uc on uc.id = s.user_challenge_id
            where uc.user_id = p_user and uc.challenge_id = v_src and uc.status = 'completed'
              and nullif(btrim(s.notes), '') is not null
            order by s.completed_at
            limit 1;
          end if;
        end if;
      when 'achievement' then
        select a.id into v_src from public.achievements a
        join public.user_achievements ua on ua.achievement_id = a.id and ua.user_id = p_user
        where a.slug = r.unlock_reference;
        v_ok := v_src is not null;
      when 'level' then
        select l.id into v_src from public.levels l
        where l.level_number = r.unlock_reference::integer and l.level_number <= v_level;
        v_ok := v_src is not null;
      when 'evidence' then
        -- 'photo': a primeira foto enviada como evidência de uma ação real
        select e.id, uc.challenge_id, e.description into v_src, v_challenge, v_note
        from public.challenge_evidence e
        join public.user_challenges uc on uc.id = e.user_challenge_id
        where e.user_id = p_user and e.evidence_type = 'photo' and r.unlock_reference = 'photo'
        order by e.created_at
        limit 1;
        v_evidence := v_src;
        v_ok := v_src is not null;
      else
        v_ok := false;
    end case;

    -- Já veio com a casa completa: quando a atividade acontece, passa a guardar a origem real.
    if r.owned_id is not null then
      if v_ok then
        update public.user_place_items
        set source_type = r.unlock_type, source_id = v_src, challenge_id = v_challenge,
            evidence_id = v_evidence, origin_note = left(nullif(btrim(v_note), ''), 500)
        where id = r.owned_id;
      end if;
      continue;
    end if;

    -- Casa completa: todo objeto é entregue. Sem a atividade ainda, entra como parte da casa.
    insert into public.user_place_items
      (user_id, place_item_id, source_type, source_id, challenge_id, evidence_id, origin_note, revealed)
    values (
      p_user, r.id,
      case when v_ok then r.unlock_type else 'initial' end,
      case when v_ok then v_src end,
      case when v_ok then v_challenge end,
      case when v_ok then v_evidence end,
      case when v_ok then left(nullif(btrim(v_note), ''), 500) end,
      r.unlock_type = 'initial' or not v_ok -- o que já faz parte da casa nasce visto
    )
    on conflict (user_id, place_item_id) do nothing
    returning id into v_id;

    if v_id is not null then
      v_new := v_new || jsonb_build_array(jsonb_build_object('id', r.id, 'code', r.code, 'name', r.name));
    end if;
  end loop;

  return v_new;
end;
$$;

-- (as permissões de sync_place continuam as da migration 26: só o servidor executa)
revoke execute on function public.sync_place(uuid) from public, anon, authenticated;

-- Completa a casa de quem já joga.
select public.sync_place(user_id) from public.profiles;
