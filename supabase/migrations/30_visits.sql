-- =====================================================================
-- 30 · VISITAS (pedido do jogo, 28/09/2026)
-- Um jogador conectado visita o mundo e a casa de outro pelo @usuário.
-- Privacidade (jogo para crianças):
-- - não existe lista pública de jogadores: só quem sabe o @usuário visita;
-- - a visita devolve apenas nome, @usuário, avatar em emoji, nível e os itens
--   do mundo e da casa. Nada de fotos, diário, e-mail, foto de perfil ou XP;
-- - contas em exclusão não podem ser visitadas;
-- - é só leitura: visitar não muda nada no mundo nem na casa de ninguém.
-- =====================================================================

create or replace function public.visit_player(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viewer  uuid := public.require_user();
  v_name    text := lower(btrim(coalesce(p_username, '')));
  v_profile record;
  v_world   record;
begin
  v_name := ltrim(v_name, '@');
  select p.user_id, p.username, p.display_name, p.avatar_emoji, p.level
    into v_profile
  from public.profiles p
  where p.username = v_name
    and p.deletion_requested_at is null;
  if not found then
    raise exception 'player_not_found';
  end if;

  select w.id, w.name, w.stage, w.progress into v_world
  from public.worlds w where w.user_id = v_profile.user_id;

  return jsonb_build_object(
    'player', jsonb_build_object(
      'username', v_profile.username,
      'display_name', v_profile.display_name,
      'avatar', v_profile.avatar_emoji,
      'level', v_profile.level,
      'is_me', v_profile.user_id = v_viewer
    ),
    'world', jsonb_build_object(
      'name', v_world.name,
      'stage', v_world.stage,
      'progress', v_world.progress,
      'item_ids', coalesce((select jsonb_agg(u.world_item_id order by u.unlocked_at)
                            from public.user_world_items u where u.world_id = v_world.id), '[]'::jsonb)
    ),
    'place', jsonb_build_object(
      'item_ids', coalesce((select jsonb_agg(u.place_item_id order by u.unlocked_at)
                            from public.user_place_items u
                            where u.user_id = v_profile.user_id and u.state = 'visible'), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.visit_player(text) from public, anon;
grant execute on function public.visit_player(text) to authenticated;
