import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingMessage, StateMessage } from '../components/ui/StateMessage';
import type { PlayerState } from '../models';
import { PLACE_ITEMS } from '../modules/place/catalog';
import { toSceneObject } from '../modules/place/placeLogic';
import { hasWebGL } from '../modules/place/scene/webgl';
import { backend, toAppError, type VisitDTO } from '../services';
import { useGame } from '../state/GameContext';

// Mundo e casa em 3D: carregados sob demanda (o three.js fica fora do app principal).
const World3DView = lazy(() => import('../modules/world3d/World3DView'));
const PlaceViewer = lazy(() => import('../modules/place/PlaceViewer').then((m) => ({ default: m.PlaceViewer })));

/**
 * 👀 Visita ao mundo e à casa de outro jogador, pelo @usuário.
 * Só leitura: nada muda no mundo de ninguém. Mostra apenas o que é seguro
 * (nome, avatar, nível, itens do mundo e objetos da casa).
 */
export function VisitPage() {
  const { username = '' } = useParams();
  const { content, player } = useGame();
  const [visit, setVisit] = useState<VisitDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inHouse, setInHouse] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [use3d, setUse3d] = useState(hasWebGL);
  const fallback = useCallback(() => setUse3d(false), []);

  useEffect(() => {
    let alive = true;
    setVisit(null);
    setError(null);
    setInHouse(false);
    backend
      .visitPlayer(username)
      .then((v) => alive && setVisit(v))
      .catch((e) => alive && setError(toAppError(e).message));
    return () => {
      alive = false;
    };
  }, [username]);

  // O mundo 3D lê os itens de um PlayerState: o do visitado é montado só com o que a visita trouxe.
  const visited = useMemo<PlayerState | null>(() => {
    if (!visit) return null;
    return {
      ...player,
      world: {
        ...player.world,
        name: visit.world.name,
        stage: visit.world.stage,
        progress: visit.world.progress,
        items: visit.world.itemIds.map((id) => ({
          id,
          worldItemId: id,
          quantity: 1,
          x: null,
          y: null,
          rotation: 0,
          revealed: true,
          unlockedAt: '',
          sourceType: 'initial' as const,
          sourceId: null,
        })),
        stageHistory: [],
      },
    };
  }, [visit, player]);
  const objects = useMemo(
    () => (visit ? PLACE_ITEMS.filter((d) => visit.place.itemIds.includes(d.id)).map((d) => toSceneObject(d)) : []),
    [visit],
  );

  const back = (
    <Link to="/mundo" className="btn btn--ghost">
      ← Voltar para o meu mundo
    </Link>
  );

  if (error) {
    return (
      <div className="stack">
        <PageHeader title="👀 Visitar um amigo" />
        <StateMessage icon="🔎" title="Visita não encontrada" text={error} role="alert">
          {back}
        </StateMessage>
      </div>
    );
  }
  if (!visit || !visited) {
    return (
      <div className="stack">
        <PageHeader title="👀 Visitar um amigo" />
        <LoadingMessage text={`Procurando @${username.replace(/^@/, '')}…`} />
      </div>
    );
  }

  const who = visit.player.displayName ?? `@${visit.player.username}`;
  const pickedName = (id: string) => {
    const w = content.worldItems.find((x) => x.id === id);
    if (w) return `${visited.world.items.some((i) => i.worldItemId === id) ? w.icon : '🔒'} ${w.name}`;
    const d = PLACE_ITEMS.find((x) => x.code === id);
    return d ? `${d.icon} ${d.name}` : null;
  };

  return (
    <div className="stack visit">
      <div className="visit__head">
        <span className="avatar avatar--lg" aria-hidden>
          {visit.player.avatar}
        </span>
        <div>
          <p className="eyebrow">{visit.player.isMe ? 'Este é o seu próprio mundo' : 'Você está visitando'}</p>
          <h1 className="page-title">
            {inHouse ? `🏡 Casa de ${who}` : `🌎 Mundo de ${who}`}
          </h1>
          <p className="small muted">
            @{visit.player.username} · Nível {visit.player.level} · {visit.world.name} · {visit.world.progress}% de evolução
          </p>
        </div>
      </div>
      <div className="visit__actions">
        {back}
        {inHouse ? (
          <button type="button" className="btn btn--ghost" onClick={() => setInHouse(false)}>
            🌎 Ver o mundo de {who}
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => setInHouse(true)}>
            🏡 Entrar na casa de {who}
          </button>
        )}
      </div>
      <p className="small muted" role="note">
        👀 Visita só para olhar: nada muda no mundo nem na casa de {who}.
      </p>
      {picked && pickedName(picked) && (
        <p className="visit__picked" role="status">
          {pickedName(picked)}
        </p>
      )}

      <Suspense fallback={<LoadingMessage text="Abrindo…" />}>
        {inHouse ? (
          <PlaceViewer key="casa" objects={objects} onSelect={setPicked} startWalking onLeave={() => setInHouse(false)} />
        ) : use3d ? (
          <World3DView
            key="mundo"
            content={content}
            player={visited}
            onSelect={(item) => setPicked(item.id)}
            onEnterHome={() => setInHouse(true)}
            homeLabel={`Casa de ${who}`}
            onFail={fallback}
          />
        ) : (
          <ul className="list">
            {content.worldItems
              .filter((w) => visit.world.itemIds.includes(w.id))
              .map((w) => (
                <li key={w.id} className="list__row">
                  <span aria-hidden>{w.icon}</span>
                  <span>{w.name}</span>
                </li>
              ))}
          </ul>
        )}
      </Suspense>
    </div>
  );
}
