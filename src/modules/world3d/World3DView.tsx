import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImmersiveFrame } from '../../components/ui/ImmersiveFrame';
import { buildAreas } from '../../logic/world';
import type { ContentCatalog, PlayerState, WorldItem } from '../../models';
import { prefersReducedMotion } from '../place/scene/webgl';
import { AREA_CODES, type AreaCode } from './scene/layout';
import { WorldScene3D, type FocusTarget, type ScreenPin, type WorldItemSpec } from './scene/WorldScene3D';
import './world3d.css';

interface World3DViewProps {
  content: ContentCatalog;
  player: PlayerState;
  /** Itens que acabaram de surgir (crescem na cena). */
  highlightIds?: string[];
  onSelect: (item: WorldItem) => void;
  /** Tocou na casa (ou no botão "Minha casa"): entrar nela. */
  onEnterHome: () => void;
  /** Abrir já em tela cheia (voltando da casa pelo "Sair da casa"). */
  startInside?: boolean;
  /** O 3D não abriu: a página mostra o mapa 2D no lugar. */
  onFail: () => void;
}

const itemLabel = (item: WorldItem, owned: boolean) =>
  owned
    ? `${item.name}${item.milestone ? ' (marco especial)' : ''}. Ver detalhes`
    : `Espaço bloqueado: ${item.name}. Ver como desbloquear`;

/** 🌎 Mundo em 3D: as 5 áreas numa paisagem, com navegação por área e lista acessível. */
export default function World3DView({ content, player, highlightIds = [], onSelect, onEnterHome, startInside = false, onFail }: World3DViewProps) {
  const areas = useMemo(() => buildAreas(content, player), [content, player]);
  const holder = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<WorldScene3D | null>(null);
  const [focus, setFocus] = useState<FocusTarget>('overview');
  const [pins, setPins] = useState<{ items: ScreenPin[]; areas: ScreenPin[]; home: ScreenPin | null }>({ items: [], areas: [], home: null });
  const [reducedMotion] = useState(prefersReducedMotion);
  // Fora do mundo a cena é só prévia: a página rola. "Entrar no mundo" abre em tela cheia.
  const [inside, setInside] = useState(startInside);

  const allItems = useMemo(() => areas.flatMap((a) => a.items), [areas]);
  const specs = useMemo<WorldItemSpec[]>(
    () =>
      areas.flatMap(({ items, owned }) =>
        items.map((item) => ({
          id: item.id,
          code: item.code,
          itemType: item.itemType,
          area: item.area,
          label: item.name,
          owned: owned.has(item.id),
          isNew: highlightIds.includes(item.id),
          slot: item.slot ?? { x: 50, y: 80 },
        })),
      ),
    [areas, highlightIds],
  );

  const selectById = useCallback(
    (id: string) => {
      const item = allItems.find((i) => i.id === id);
      if (item) onSelect(item);
    },
    [allItems, onSelect],
  );
  const selectRef = useRef(selectById);
  selectRef.current = selectById;
  const homeRef = useRef(onEnterHome);
  homeRef.current = onEnterHome;

  useEffect(() => {
    if (!holder.current) return;
    let scene: WorldScene3D;
    try {
      scene = new WorldScene3D(holder.current, {
        reducedMotion,
        lowPower: window.innerWidth < 700,
        onSelect: (id) => selectRef.current(id),
        onPins: (items, areaPins, home) => setPins({ items, areas: areaPins, home }),
        onHome: () => homeRef.current(),
      });
    } catch {
      onFail();
      return;
    }
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [reducedMotion, onFail]);

  useEffect(() => {
    sceneRef.current?.setItems(specs);
  }, [specs]);

  // Novidade: a câmera vai até a área do item que acabou de surgir.
  const firstNewArea = allItems.find((i) => highlightIds.includes(i.id))?.area as AreaCode | undefined;
  const userChose = useRef(false);
  useEffect(() => {
    if (!firstNewArea) return;
    const t = window.setTimeout(() => {
      if (userChose.current) return; // a pessoa já escolheu uma área: não muda a câmera por ela
      sceneRef.current?.focusOn(firstNewArea);
      setFocus(firstNewArea);
    }, 400);
    return () => window.clearTimeout(t);
  }, [firstNewArea]);

  const go = (target: FocusTarget) => {
    userChose.current = true;
    sceneRef.current?.focusOn(target);
    setFocus(target);
  };

  const areaName = (code: string) => content.worldAreas.find((a) => a.code === code);
  const itemPins = focus === 'overview' ? [] : pins.items.filter((p) => p.visible && allItems.find((i) => i.id === p.id)?.area === focus);

  return (
    <div className="world3d">
      <ImmersiveFrame
        active={inside}
        onEnter={() => setInside(true)}
        onExit={() => setInside(false)}
        enterLabel="🌍 Entrar no mundo"
        exitLabel="Sair do mundo"
        className="world3d-frame"
      >
        <div className="world3d-toolbar" role="toolbar" aria-label="Navegar pelo mundo">
          <button type="button" aria-pressed={focus === 'overview'} onClick={() => go('overview')}>
            🌍 Visão geral
          </button>
          {AREA_CODES.map((code) => {
            const area = areaName(code);
            if (!area) return null;
            return (
              <button key={code} type="button" aria-pressed={focus === code} onClick={() => go(code)}>
                <span aria-hidden>{area.icon}</span> {area.name}
              </button>
            );
          })}
          <button type="button" className="world3d-toolbar__home" onClick={onEnterHome}>
            🏡 Entrar na minha casa
          </button>
        </div>

        <div
          className="world3d-stage"
          data-motion={reducedMotion ? 'off' : 'on'}
          data-focus={focus}
          data-new-items={highlightIds.length}
        >
          <div ref={holder} className="world3d-holder" />
          {/* Atalhos visuais sobre a cena (a lista abaixo tem os mesmos itens para teclado e leitores de tela) */}
          <div className="world3d-pins" aria-hidden="true">
            {focus === 'overview' &&
              pins.areas
                .filter((p) => p.visible)
                .map((p) => {
                  const area = areaName(p.id);
                  const done = areas.find((a) => a.area.code === p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      tabIndex={-1}
                      className="world3d-area-pin"
                      style={{ left: p.x, top: p.y }}
                      onClick={() => go(p.id as AreaCode)}
                    >
                      {area?.icon} {area?.name}
                      <small>
                        {done?.unlocked}/{done?.items.length}
                      </small>
                    </button>
                  );
                })}
            {pins.home?.visible && (
              <button
                type="button"
                tabIndex={-1}
                className="world3d-area-pin world3d-home-pin"
                style={{ left: pins.home.x, top: pins.home.y }}
                onClick={onEnterHome}
              >
                🏡 Minha casa
                <small>entrar</small>
              </button>
            )}
            {itemPins.map((p) => {
              const item = allItems.find((i) => i.id === p.id)!;
              const owned = player.world.items.some((w) => w.worldItemId === p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  tabIndex={-1}
                  className={owned ? 'world3d-hotspot' : 'world3d-hotspot is-locked'}
                  style={{ left: p.x, top: p.y }}
                  onClick={() => onSelect(item)}
                  title={item.name}
                >
                  {owned ? item.icon : '🔒'}
                </button>
              );
            })}
          </div>
          <div className="world3d-controls" role="group" aria-label="Câmera">
            <button type="button" onClick={() => sceneRef.current?.rotate(0.35)} aria-label="Girar para a esquerda">
              ⟲
            </button>
            <button type="button" onClick={() => sceneRef.current?.rotate(-0.35)} aria-label="Girar para a direita">
              ⟳
            </button>
            <button type="button" onClick={() => sceneRef.current?.zoom(0.8)} aria-label="Aproximar">
              ＋
            </button>
            <button type="button" onClick={() => sceneRef.current?.zoom(1.25)} aria-label="Afastar">
              －
            </button>
          </div>
        </div>
      </ImmersiveFrame>
      <p className="muted small world3d-hint">
        Toque em "Entrar no mundo" para explorar em tela cheia (e em "Sair do mundo" para voltar). Escolha uma área acima ou toque no nome dela. Arraste para girar, use a roda ou dois dedos para aproximar, e toque num
        elemento para saber de onde ele veio. 🔒 mostra o que ainda pode surgir. Toque na 🏡 casa para entrar e andar pelos
        cômodos.
      </p>

      <div className="world3d-areas">
        {areas.map(({ area, items, owned, unlocked }) => (
          <section key={area.code} className="world3d-area" aria-labelledby={`world3d-area-${area.code}`}>
            <h3 id={`world3d-area-${area.code}`} className="world3d-area__title">
              <span aria-hidden>{area.icon}</span> {area.name}
            </h3>
            <span className="world3d-area__count">
              {unlocked}/{items.length} <span className="sr-only">itens conquistados</span>
            </span>
            <ul className="world3d-list">
              {items.map((item) => {
                const mine = owned.has(item.id);
                const isNew = highlightIds.includes(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={['world3d-item', mine ? '' : 'is-locked', isNew ? 'is-new' : ''].filter(Boolean).join(' ')}
                      onClick={() => onSelect(item)}
                      onFocus={() => focus !== item.area && go(item.area as AreaCode)}
                      aria-label={itemLabel(item, mine)}
                    >
                      <span aria-hidden>{mine ? item.icon : '🔒'}</span> {item.name}
                      {isNew && <span className="tag tag--new">Novo!</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
