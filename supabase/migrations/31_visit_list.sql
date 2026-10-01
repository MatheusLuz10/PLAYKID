-- =====================================================================
-- 31 · LISTA DE JOGADORES PARA VISITAR (pedido do jogo, 01/10/2026)
-- Quem está conectado vê os jogadores cadastrados para visitar o mundo e a casa.
-- Mostra só o que a própria visita já mostra: nome, @usuário, avatar em emoji e
-- nível. Nada de e-mail, foto de perfil, fotos, diário ou XP.
-- - só perfis com @usuário; contas em exclusão ficam de fora;
-- - quem pede não aparece na própria lista;
-- - busca opcional por nome ou @usuário; no máximo 50 por vez.
-- =====================================================================

create or replace function public.list_visitable_players(p_search text default null, p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer uuid := public.require_user();
  v_term   text := nullif(lower(btrim(ltrim(coalesce(p_search, ''), '@'))), '');
  v_limit  integer := least(greatest(coalesce(p_limit, 50), 1), 50);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'username', x.username,
             'display_name', x.display_name,
             'avatar', x.avatar_emoji,
             'level', x.level) order by x.display_name nulls last, x.username)
    from (
      select p.username, p.display_name, p.avatar_emoji, p.level
      from public.profiles p
      where p.username is not null
        and p.deletion_requested_at is null
        and p.user_id <> v_viewer
        and (v_term is null
             or p.username like '%' || v_term || '%'
             or lower(coalesce(p.display_name, '')) like '%' || v_term || '%')
      order by p.display_name nulls last, p.username
      limit v_limit
    ) x
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_visitable_players(text, integer) from public, anon;
grant execute on function public.list_visitable_players(text, integer) to authenticated;
