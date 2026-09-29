import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { LoadingMessage, StateMessage } from '../../components/ui/StateMessage';
import { backend, toAppError, type PlaceStateDTO } from '../../services';
import { useGame } from '../../state/GameContext';
import { isOutdoorItem, PLACE_ITEMS } from './catalog';
import { PlaceItemDialog } from './PlaceItemDialog';
import { PlaceViewer } from './PlaceViewer';
import { toSceneObject, type OwnedPlaceItem } from './placeLogic';
import './place.css';

/** Casa do jogador, carregada do servidor (fonte oficial) quando ele entra nela. */
export function usePlace() {
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

interface PlacePageProps {
  /** "Sair da casa": volta para o mapa do mundo (fullscreen = estava em tela cheia). */
  onLeave: (fullscreen: boolean) => void;
}

/** Enquanto a casa carrega (ou se falhar): título e o caminho de volta para o mapa. */
function HouseHeader({ onLeave }: { onLeave: () => void }) {
  return (
    <div className="place-header">
      <PageHeader title="🏡 Casa" subtitle="Construída pelas coisas que você aprende e faz." />
      <button type="button" className="btn btn--ghost" onClick={onLeave}>
        🚪 Sair da casa
      </button>
    </div>
  );
}

/**
 * 🏡 A casa por dentro, dentro do Meu Mundo: abre em tela cheia, já andando pelos
 * cômodos. Não existe um "lugar" separado: o quintal (árvores, bichos, horta, água)
 * fica no próprio mundo, e "Sair da casa" volta para ele.
 */
export function PlacePage({ onLeave }: PlacePageProps) {
  const { content } = useGame();
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
    // dentro da casa só os objetos da casa; o quintal aparece no Meu Mundo
    () => PLACE_ITEMS.filter((d) => ownedById.has(d.id) && !isOutdoorItem(d)).map((d) => toSceneObject(d, newIds?.includes(d.id) ?? false)),
    [ownedById, newIds],
  );
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
        <LoadingMessage text="Abrindo a sua casa…" />
      </div>
    );
  }

  return (
    <div className="stack">
      <HouseHeader onLeave={() => onLeave(false)} />
      <PlaceViewer objects={sceneObjects} onSelect={setSelected} onLeave={onLeave} />
      {selectedDef && (
        <PlaceItemDialog def={selectedDef} owned={ownedById.get(selectedDef.id) ?? null} content={content} onClose={closeDialog} />
      )}
    </div>
  );
}
