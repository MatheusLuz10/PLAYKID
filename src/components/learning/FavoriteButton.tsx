import { useGame } from '../../state/GameContext';

export function FavoriteButton({ lessonId, title }: { lessonId: string; title: string }) {
  const { player, actions } = useGame();
  const active = player.favorites.includes(lessonId);
  return (
    <button
      type="button"
      className={`favorite-btn ${active ? 'is-active' : ''}`}
      aria-pressed={active}
      aria-label={active ? `Remover “${title}” dos favoritos` : `Favoritar “${title}”`}
      title={active ? 'Remover dos favoritos' : 'Favoritar'}
      onClick={() => void actions.toggleFavorite(lessonId)}
    >
      <span aria-hidden>{active ? '★' : '☆'}</span>
    </button>
  );
}
