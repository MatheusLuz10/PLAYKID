import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { LessonCard } from '../../components/learning/LessonCard';
import { SearchBox } from '../../components/learning/SearchBox';
import { LoadingMessage, StateMessage } from '../../components/ui/StateMessage';
import { getLessonState, lessonLevelLabels, normalizeSearch } from '../../logic/learning';
import type { LessonLevel } from '../../models';
import { useGame } from '../../state/GameContext';

type StatusFilter = 'all' | 'not_started' | 'in_progress' | 'completed';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'not_started', label: 'Não iniciados' },
  { id: 'in_progress', label: 'Em andamento' },
  { id: 'completed', label: 'Concluídos' },
];
const LEVELS: LessonLevel[] = ['beginner', 'intermediate', 'advanced'];
const SEARCH_DEBOUNCE_MS = 300;

export function LibraryPage() {
  const { content, player, actions } = useGame();
  const [params, setParams] = useSearchParams();
  const category = params.get('categoria') ?? '';
  const status = (params.get('situacao') ?? 'all') as StatusFilter;
  const level = (params.get('nivel') ?? '') as LessonLevel | '';
  const onlyFavorites = params.get('favoritos') === '1';
  const urlQuery = params.get('q') ?? '';

  const [query, setQuery] = useState(urlQuery);
  const [search, setSearch] = useState<{ status: 'idle' | 'loading' | 'error'; ids: string[] | null }>({
    status: 'idle',
    ids: null,
  });
  const [retry, setRetry] = useState(0);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  // Busca no servidor com atraso curto (evita uma consulta por tecla).
  const { searchLessons } = actions;
  useEffect(() => {
    const term = normalizeSearch(query);
    if (term.length < 2) {
      setSearch({ status: 'idle', ids: null });
      return;
    }
    setSearch((s) => ({ ...s, status: 'loading' }));
    let active = true;
    const timer = window.setTimeout(async () => {
      const ids = await searchLessons(query);
      if (!active) return;
      setSearch(ids ? { status: 'idle', ids } : { status: 'error', ids: null });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, searchLessons, retry]);

  // Mantém a URL em dia com a busca (permite compartilhar/voltar).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if ((params.get('q') ?? '') === query.trim()) return;
      const next = new URLSearchParams(params);
      if (query.trim()) next.set('q', query.trim());
      else next.delete('q');
      setParams(next, { replace: true });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, params, setParams]);

  const categoryOrder = useMemo(
    () => new Map(content.categories.map((c, i) => [c.id, i])),
    [content.categories],
  );

  const results = content.lessons
    .filter((l) => {
      if (search.ids && !search.ids.includes(l.id)) return false;
      if (category && content.categories.find((c) => c.id === l.categoryId)?.slug !== category) return false;
      if (level && l.difficulty !== level) return false;
      if (onlyFavorites && !player.favorites.includes(l.id)) return false;
      const state = getLessonState(l, player);
      if (status === 'not_started' && state !== 'not_started' && state !== 'locked') return false;
      if (status === 'in_progress' && state !== 'in_progress') return false;
      if (status === 'completed' && state !== 'completed') return false;
      return true;
    })
    .sort(
      (a, b) =>
        (categoryOrder.get(a.categoryId) ?? 0) - (categoryOrder.get(b.categoryId) ?? 0) || a.orderIndex - b.orderIndex,
    );

  const hasFilters = Boolean(category || level || onlyFavorites || status !== 'all' || query.trim());
  const clearAll = () => {
    setQuery('');
    setParams(new URLSearchParams(), { replace: true });
  };

  return (
    <div className="stack">
      <PageHeader backTo="/aprender" backLabel="Aprender" title="Biblioteca" subtitle="Todos os conteúdos do ECO QUEST." />

      <SearchBox value={query} onChange={setQuery} />

      <div className="filters">
        <div className="filter-group" role="group" aria-label="Filtrar por categoria">
          <button
            type="button"
            className={`filter-chip ${!category ? 'is-active' : ''}`}
            aria-pressed={!category}
            onClick={() => setParam('categoria', '')}
          >
            Todas
          </button>
          {content.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`filter-chip ${category === c.slug ? 'is-active' : ''}`}
              aria-pressed={category === c.slug}
              onClick={() => setParam('categoria', category === c.slug ? '' : c.slug)}
            >
              <span aria-hidden>{c.icon}</span> {c.name}
            </button>
          ))}
        </div>

        <div className="filter-group" role="group" aria-label="Filtrar por situação">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`filter-chip ${status === f.id ? 'is-active' : ''}`}
              aria-pressed={status === f.id}
              onClick={() => setParam('situacao', f.id === 'all' ? '' : f.id)}
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            className={`filter-chip ${onlyFavorites ? 'is-active' : ''}`}
            aria-pressed={onlyFavorites}
            onClick={() => setParam('favoritos', onlyFavorites ? '' : '1')}
          >
            ★ Favoritos
          </button>
        </div>

        <div className="filter-group" role="group" aria-label="Filtrar por nível">
          <button
            type="button"
            className={`filter-chip ${!level ? 'is-active' : ''}`}
            aria-pressed={!level}
            onClick={() => setParam('nivel', '')}
          >
            Todos os níveis
          </button>
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              className={`filter-chip ${level === l ? 'is-active' : ''}`}
              aria-pressed={level === l}
              onClick={() => setParam('nivel', level === l ? '' : l)}
            >
              {lessonLevelLabels[l]}
            </button>
          ))}
        </div>
      </div>

      <div className="section-head" aria-live="polite">
        <span className="muted small">
          {search.status === 'loading'
            ? 'Pesquisando…'
            : `${results.length} ${results.length === 1 ? 'conteúdo' : 'conteúdos'}`}
        </span>
        {hasFilters && (
          <button type="button" className="text-link link-button" onClick={clearAll}>
            Limpar filtros
          </button>
        )}
      </div>

      {search.status === 'loading' && !search.ids ? (
        <LoadingMessage text="Pesquisando conteúdos…" />
      ) : search.status === 'error' ? (
        <StateMessage icon="🍂" title="Não conseguimos pesquisar agora." text="Verifique sua conexão e tente de novo." role="alert">
          <button type="button" className="btn btn--primary" onClick={() => setRetry((n) => n + 1)}>
            Tentar novamente
          </button>
        </StateMessage>
      ) : results.length === 0 ? (
        <StateMessage icon="🔍" title="Nenhum conteúdo encontrado" text="Tente outra palavra ou remova alguns filtros.">
          {hasFilters && (
            <button type="button" className="btn btn--ghost" onClick={clearAll}>
              Limpar filtros
            </button>
          )}
        </StateMessage>
      ) : (
        <div className="lesson-grid">
          {results.map((l) => (
            <LessonCard key={l.id} lesson={l} />
          ))}
        </div>
      )}
    </div>
  );
}
