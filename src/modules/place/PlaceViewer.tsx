import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ImmersiveFrame } from '../../components/ui/ImmersiveFrame';
import { PlaceScene, ROOMS, type FocusTarget, type Hotspot, type RoomCode, type SceneObject, type WalkInput } from './scene/PlaceScene';
import { hasWebGL, prefersReducedMotion } from './scene/webgl';

interface PlaceViewerProps {
  objects: SceneObject[];
  onSelect: (code: string) => void;
  /** Abrir já andando dentro da casa (vindo do "Meu Mundo"). */
  startWalking?: boolean;
}

const FOCUS: { id: FocusTarget; label: string }[] = [
  { id: 'geral', label: '🏡 Visão geral' },
  { id: 'jardim', label: '🌳 Jardim' },
  { id: 'sala', label: '🛋️ Sala' },
  { id: 'quarto', label: '🛏️ Quarto' },
  { id: 'cozinha', label: '🍳 Cozinha' },
  { id: 'estudos', label: '📚 Estudos' },
];

/** Nome do cômodo com o artigo certo ("na Sala", "no Quarto"). */
const ROOM_PLACE: Record<RoomCode, string> = {
  sala: 'na 🛋️ Sala',
  cozinha: 'na 🍳 Cozinha',
  quarto: 'no 🛏️ Quarto',
  estudos: `na 📚 ${ROOMS.estudos.name}`,
};

/** Botões de andar: segurar anda sem parar; um clique (ou Enter) dá um passo. */
const PAD: { label: string; icon: string; input: WalkInput; area: string }[] = [
  { label: 'Andar para frente', icon: '▲', input: { forward: 1, turn: 0 }, area: 'up' },
  { label: 'Virar para a esquerda', icon: '◀', input: { forward: 0, turn: -1 }, area: 'left' },
  { label: 'Virar para a direita', icon: '▶', input: { forward: 0, turn: 1 }, area: 'right' },
  { label: 'Andar para trás', icon: '▼', input: { forward: -1, turn: 0 }, area: 'down' },
];

/**
 * Cena 3D + controles. Sem WebGL (ou se a cena falhar), mostra um aviso — a
 * lista de objetos da página continua funcionando como alternativa.
 */
export function PlaceViewer({ objects, onSelect, startWalking = false }: PlaceViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PlaceScene | null>(null);
  const [supported] = useState(hasWebGL);
  const [failed, setFailed] = useState(false);
  const [interior, setInterior] = useState(false);
  const [walking, setWalking] = useState(false);
  // Fora da casa a cena é só prévia (a página rola); vindo do mundo, já abre em tela cheia.
  const [inside, setInside] = useState(startWalking);
  const [room, setRoom] = useState<RoomCode | null>(null);
  const [spots, setSpots] = useState<Hotspot[]>([]);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const held = useRef(false);

  useEffect(() => {
    if (!supported || !containerRef.current) return;
    try {
      sceneRef.current = new PlaceScene(containerRef.current, {
        reducedMotion: prefersReducedMotion(),
        onSelect: (code) => selectRef.current(code),
        onHotspots: setSpots,
        onRoom: setRoom,
      });
      if (startWalking) {
        sceneRef.current.setWalk(true);
        setWalking(true);
      }
    } catch (err) {
      console.warn('[ECO QUEST] cena 3D indisponível', err);
      setFailed(true);
    }
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [supported, startWalking]);

  useEffect(() => {
    sceneRef.current?.setObjects(objects);
  }, [objects]);

  if (!supported || failed) {
    return (
      <div className="place-fallback" role="status">
        <span className="place-fallback__icon" aria-hidden>
          🏡
        </span>
        <p>
          <strong>Seu aparelho não conseguiu abrir a visualização em 3D.</strong>
        </p>
        <p className="small muted">Tudo o que existe na sua casa está na lista logo abaixo.</p>
      </div>
    );
  }

  const toggleInterior = () => {
    const next = !interior;
    setInterior(next);
    sceneRef.current?.setInterior(next);
  };
  const toggleWalk = () => {
    const next = !walking;
    setWalking(next);
    if (next) setInterior(false);
    sceneRef.current?.setWalk(next);
    if (!next) setRoom(null);
  };
  const focus = (f: FocusTarget) => {
    sceneRef.current?.focus(f);
    if (walking && (f === 'geral' || f === 'jardim')) {
      setWalking(false);
      setRoom(null);
    }
    if (!walking && f !== 'geral' && f !== 'jardim') setInterior(true);
  };

  const press = (input: WalkInput) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    held.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    sceneRef.current?.setWalkInput(input);
  };
  const release = () => sceneRef.current?.setWalkInput({ forward: 0, turn: 0 });
  // clique sem segurar (ou Enter/Espaço no teclado): um passo
  const tap = (input: WalkInput) => {
    if (held.current) {
      held.current = false;
      return;
    }
    sceneRef.current?.nudge(input.forward, input.turn);
  };

  const close = () => {
    setInside(false);
    if (walking) {
      setWalking(false);
      setRoom(null);
      sceneRef.current?.setWalk(false);
    }
  };

  return (
    <div className="place-viewer">
      <ImmersiveFrame
        active={inside}
        onEnter={() => setInside(true)}
        onExit={close}
        enterLabel="🏡 Entrar na casa"
        exitLabel="Fechar a casa"
        className="place-frame"
      >
        <div className="place-toolbar" role="toolbar" aria-label="Navegar pela casa">
          {FOCUS.map((f) => (
            <button key={f.id} type="button" className="filter-chip" onClick={() => focus(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className={walking ? 'place-stage is-walking' : 'place-stage'} data-walking={walking ? 'on' : 'off'}>
          <div ref={containerRef} className="place-stage__canvas" />
          {/* Botões invisíveis sobre cada objeto: toque fácil e navegação por teclado */}
          <div className="place-hotspots">
            {spots.map((s) =>
              s.visible ? (
                <button
                  key={s.code}
                  type="button"
                  className="place-hotspot"
                  style={{ transform: `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px)` }}
                  aria-label={`${s.label}: ver detalhes`}
                  title={s.label}
                  onClick={() => onSelect(s.code)}
                />
              ) : null,
            )}
          </div>
          {walking && room && (
            <p className="place-room" role="status" aria-live="polite">
              📍 Você está {ROOM_PLACE[room]}
            </p>
          )}
          {walking && (
            <div className="place-pad" role="group" aria-label="Andar pela casa">
              {PAD.map((b) => (
                <button
                  key={b.area}
                  type="button"
                  className={`place-pad__btn place-pad__btn--${b.area}`}
                  aria-label={b.label}
                  onPointerDown={press(b.input)}
                  onPointerUp={release}
                  onPointerCancel={release}
                  onLostPointerCapture={release}
                  onClick={() => tap(b.input)}
                >
                  {b.icon}
                </button>
              ))}
            </div>
          )}
          <div className="place-controls">
            <button type="button" className="place-control place-control--walk" onClick={toggleWalk} aria-pressed={walking}>
              {walking ? '🔭 Ver de fora' : '🚶 Andar pela casa'}
            </button>
            {!walking && (
              <button type="button" className="place-control" onClick={toggleInterior} aria-pressed={interior}>
                {interior ? '🏠 Ver telhado' : '🔍 Ver por dentro'}
              </button>
            )}
            {!walking && (
              <span className="place-controls__group">
                <button type="button" className="place-control place-control--icon" onClick={() => sceneRef.current?.rotate(-1)} aria-label="Girar para a esquerda">
                  ⟲
                </button>
                <button type="button" className="place-control place-control--icon" onClick={() => sceneRef.current?.rotate(1)} aria-label="Girar para a direita">
                  ⟳
                </button>
                <button type="button" className="place-control place-control--icon" onClick={() => sceneRef.current?.zoom(1)} aria-label="Aproximar">
                  ＋
                </button>
                <button type="button" className="place-control place-control--icon" onClick={() => sceneRef.current?.zoom(-1)} aria-label="Afastar">
                  －
                </button>
              </span>
            )}
          </div>
        </div>
      </ImmersiveFrame>
      <p className="small muted place-help">
        {walking
          ? 'Use as setas (ou W A S D) ou os botões ▲ ◀ ▶ ▼ para andar. Arraste para olhar em volta. Passe pelas portas para ir de um cômodo a outro e toque em um objeto para ver a origem.'
          : 'Toque em "Entrar na casa" para explorar em tela cheia. Lá dentro: arraste para girar · pinça ou roda do mouse para aproximar · toque em um objeto para ver a origem · "Andar pela casa" para passear pelos cômodos.'}
      </p>
    </div>
  );
}
