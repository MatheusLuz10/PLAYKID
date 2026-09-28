import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { LoadingMessage, StateMessage } from '../../components/ui/StateMessage';
import { formatDate } from '../../logic/dates';
import { backend, toAppError, type PlaceStateDTO } from '../../services';
import { useGame } from '../../state/GameContext';
import { PLACE_CATEGORY_LABELS, PLACE_ITEMS, PLACE_LOCATION_LABELS, PLACE_STAGES, type PlaceCategory } from './catalog';
import { PlaceItemDialog } from './PlaceItemDialog';
import { PlaceViewer } from './PlaceViewer';
import { activityCounts, toSceneObject, unlockSourceText, type OwnedPlaceItem } from './placeLogic';
import './place.css';

/** Casa do jogador, carregada do servidor (fonte oficial) só quando a página abre. */
function usePlace() {
  const [state, setState] = useState<PlaceStateDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setState(await backend.loadPlace());
    } catch (err) {
      setError(toAppError(err, 'load_progress').message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { state, error, retry: load };
}

const PANEL_CATEGORIES: PlaceCategory[] = ['natureza', 'agua', 'reciclagem', 'biodiversidade', 'educacao', 'energia', 'comunidade'];

interface PlacePageProps {
  /** Abrir já andando lá dentro (tocou na casa do mapa). */
  walkIn?: boolean;
  /** "Sair da casa": volta para o mapa do mundo (fullscreen = estava em tela cheia). */
  onLeave: (fullscreen: boolean) => void;
}

/** Cabeçalho da casa dentro do Meu Mundo, com o caminho de volta para o mapa. */
function HouseHeader({ onLeave }: { onLeave: () => void }) {
  return (
    <div className="place-header">
      <PageHeader title="🏡 Minha casa" subtitle="Minha casa é construída pelas coisas que eu aprendo e faço." />
      <button type="button" className="btn btn--ghost" onClick={onLeave}>
        🚪 Sair da casa
      </button>
    </div>
  );
}

/** 🏡 A casa e o jardim em 3D (dentro do Meu Mundo), construídos pelo que o jogador aprende e faz. */
export function PlacePage({ walkIn = false, onLeave }: PlacePageProps) {
  const { content, player } = useGame();
  const { state, error, retry } = usePlace();
  const [selected, setSelected] = useState<string | null>(null);
  const closeDialog = useCallback(() => setSelected(null), []);

  // Objetos que o jogador ainda não tinha visto: crescem agora e depois ficam "vistos".
  const [newIds, setNewIds] = useState<string[] | null>(null);
  const revealed = useRef(false);
  useEffect(() => {
    if (!state || newIds) return;
    const fresh = state.items.filter((i) => !i.revealed).map((i) => i.itemId);
    setNewIds(fresh);
    if (fresh.length && !revealed.current) {
      revealed.current = true;
      void backend.revealPlaceItems().catch(() => {});
    }
  }, [state, newIds]);

  const owned: OwnedPlaceItem[] = useMemo(() => (state?.items ?? []).filter((i) => i.state === 'visible'), [state]);
  const ownedById = useMemo(() => new Map(owned.map((o) => [o.itemId, o])), [owned]);
  const sceneObjects = useMemo(
    () => PLACE_ITEMS.filter((d) => ownedById.has(d.id)).map((d) => toSceneObject(d, newIds?.includes(d.id) ?? false)),
    [ownedById, newIds],
  );
  const counts = activityCounts(content, player);
  const selectedDef = PLACE_ITEMS.find((d) => d.code === selected) ?? null;

  if (error && !state) {
    return (
      <div className="stack">
        <HouseHeader onLeave={() => onLeave(false)} />
        <StateMessage icon="⚠️" title="Não foi possível carregar a sua casa" text={error} role="alert">
          <button type="button" className="btn btn--primary" onClick={() => void retry()}>
            Tentar novamente
          </button>
        </StateMessage>
      </div>
    );
  }
  if (!state) {
    return (
      <div className="stack">
        <HouseHeader onLeave={() => onLeave(false)} />
        <LoadingMessage text="Carregando a sua casa…" />
      </div>
    );
  }

  const p = state.progress;
  const stage = PLACE_STAGES.find((s) => s.number === p.stage) ?? PLACE_STAGES[0];
  const next = PLACE_STAGES.find((s) => s.number === p.stage + 1) ?? null;
  const newDefs = PLACE_ITEMS.filter((d) => newIds?.includes(d.id));
  const history = PLACE_ITEMS.filter((d) => ownedById.has(d.id)).sort((a, b) =>
    ownedById.get(b.id)!.unlockedAt.localeCompare(ownedById.get(a.id)!.unlockedAt),
  );

  return (
    <div className="stack">
      <HouseHeader onLeave={() => onLeave(false)} />

      {newDefs.length > 0 && (
        <div className="banner banner--success" role="status">
          <span className="banner__icon" aria-hidden>
            {newDefs[0].icon}
          </span>
          <div>
            <strong>Sua casa ganhou {newDefs.length === 1 ? 'um objeto novo' : `${newDefs.length} objetos novos`}!</strong>
            <p>{newDefs.map((d) => d.name).join(', ')} — resultado do que você aprendeu e fez.</p>
          </div>
        </div>
      )}

      <PlaceViewer objects={sceneObjects} onSelect={setSelected} startWalking={walkIn} onLeave={onLeave} />

      <section className="card place-panel" aria-labelledby="place-evolution-title">
        <h2 className="section-title" id="place-evolution-title">
          Evolução da casa
        </h2>
        <p className="place-panel__stage">
          <span className="place-panel__stage-icon" aria-hidden>
            {stage.icon}
          </span>
          <span>
            <span className="eyebrow">
              Estágio {stage.number} de {PLACE_STAGES.length}
            </span>
            <strong className="block">{stage.name}</strong>
            <span className="small muted">{stage.description}</span>
          </span>
        </p>
        <ProgressBar value={p.progress} label="Evolução da casa" valueText={`${p.progress}% de evolução`} />
        <p className="small">
          <strong>{p.progress}%</strong> de evolução
          {next && (
            <span className="muted">
              {' '}
              · próximo: {next.icon} {next.name} ({next.minItems} objetos em {next.minCategories} categorias)
            </span>
          )}
        </p>
        <dl className="stats stats--6">
          <div>
            <dt>Objetos desbloqueados</dt>
            <dd>
              {p.itemsUnlocked}/{p.itemsTotal}
            </dd>
          </div>
          <div>
            <dt>Missões realizadas</dt>
            <dd>{counts.missions}</dd>
          </div>
          <div>
            <dt>Desafios realizados</dt>
            <dd>{counts.challenges}</dd>
          </div>
        </dl>
        <p className="small muted">Missões = aulas concluídas ({counts.lessons}) + quizzes aprovados ({counts.quizzes}).</p>
        <ul className="place-categories">
          {PANEL_CATEGORIES.map((c) => (
            <li key={c}>
              <span aria-hidden>{PLACE_CATEGORY_LABELS[c].icon}</span> {PLACE_CATEGORY_LABELS[c].label}:{' '}
              <strong>{p.byCategory[c] ?? 0}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="place-history-title">
        <h2 className="section-title" id="place-history-title">
          📜 Histórico da casa
        </h2>
        <ol className="place-history">
          {history.map((d) => {
            const o = ownedById.get(d.id)!;
            return (
              <li key={d.id} className="place-history__item">
                <span className="place-history__icon" aria-hidden>
                  {d.icon}
                </span>
                <span>
                  <strong className="block">{d.name}</strong>
                  <span className="small block">{unlockSourceText(d, content, o)}</span>
                  {o.originNote && <span className="small block place-history__note">📝 “{o.originNote}”</span>}
                  <span className="small muted block">
                    {formatDate(o.unlockedAt)} · {d.meaning}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="card" aria-labelledby="place-list-title">
        <h2 className="section-title" id="place-list-title">
          Objetos da casa ({owned.length}/{PLACE_ITEMS.length})
        </h2>
        <p className="small muted">Lista completa — alternativa à cena 3D. 🔒 mostra o que ainda pode aparecer e como.</p>
        <ul className="list">
          {PLACE_ITEMS.map((d) => {
            const mine = ownedById.has(d.id);
            return (
              <li key={d.id} className="list__row">
                <span aria-hidden>{mine ? d.icon : '🔒'}</span>
                <span>
                  <strong>{d.name}</strong>
                  <span className="muted small block">
                    {mine ? 'Na sua casa' : 'Ainda não'} · {PLACE_LOCATION_LABELS[d.location] ?? d.location}
                  </span>
                </span>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelected(d.code)} aria-label={`Detalhes: ${d.name}`}>
                  Detalhes
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="small muted center">
        A casa só mostra o que você já fez no ECO QUEST — nenhum objeto dá XP.{' '}
        <Link to="/mundo" className="text-link">
          Ver o Meu Mundo →
        </Link>
      </p>

      {selectedDef && (
        <PlaceItemDialog def={selectedDef} owned={ownedById.get(selectedDef.id) ?? null} content={content} onClose={closeDialog} />
      )}
    </div>
  );
}
