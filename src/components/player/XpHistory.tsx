import { useCallback, useEffect, useState } from 'react';
import { xpCategory, xpSourceLabel } from '../../logic/gamification';
import { formatDate } from '../../logic/dates';
import { formatXp } from '../../logic/xp';
import type { XpTransaction } from '../../models';
import { useGame } from '../../state/GameContext';

const PAGE_SIZE = 10;

/** Histórico de XP (auditável): mais recente primeiro, carregado sob demanda. */
export function XpHistory() {
  const { actions, player } = useGame();
  const [items, setItems] = useState<XpTransaction[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const { listXpHistory } = actions;
  const loadPage = useCallback(
    async (p: number) => {
      setLoading(true);
      const result = await listXpHistory(p, PAGE_SIZE);
      setLoading(false);
      if (!result) return;
      setItems((prev) => (p === 0 ? result.items : [...prev, ...result.items]));
      setHasMore(result.hasMore);
      setPage(p);
    },
    [listXpHistory],
  );

  // Recarrega quando o total muda (nova transação).
  useEffect(() => {
    void loadPage(0);
  }, [loadPage, player.profile.totalXp]);

  return (
    <section className="card" aria-labelledby="xp-history-title">
      <h2 className="section-title" id="xp-history-title">
        Histórico de XP
      </h2>
      {items.length === 0 && !loading ? (
        <p className="empty">Seu XP aparecerá aqui conforme você aprende e age.</p>
      ) : (
        <ul className="xp-history">
          {items.map((t) => {
            const cat = xpCategory[t.type];
            return (
              <li key={t.id} className="xp-history__row">
                <span className="xp-history__amount">+{formatXp(t.amount)} XP</span>
                <span className="xp-history__text">
                  <strong>{xpSourceLabel(t)}</strong>
                  {t.description && <span className="block">{t.description}</span>}
                  <span className="muted small block">
                    <span aria-hidden>{cat.icon}</span> {cat.label} · {formatDate(t.createdAt)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {hasMore && (
        <button type="button" className="btn btn--ghost btn--sm load-more" onClick={() => loadPage(page + 1)} disabled={loading}>
          {loading ? 'Carregando…' : 'Ver mais'}
        </button>
      )}
    </section>
  );
}
