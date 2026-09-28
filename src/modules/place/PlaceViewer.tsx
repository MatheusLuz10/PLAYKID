import { useEffect, useRef, useState } from 'react';
import { ImmersiveFrame } from '../../components/ui/ImmersiveFrame';
import { Joystick } from './Joystick';
import { PlaceScene, ROOMS, type FocusTarget, type Hotspot, type RoomCode, type SceneObject } from './scene/PlaceScene';
import { hasWebGL, prefersReducedMotion } from './scene/webgl';

interface PlaceViewerProps {
  objects: SceneObject[];
  onSelect: (code: string) => void;
  /** Abrir já andando dentro da casa (tocou na casa do mapa). */
  startWalking?: boolean;
  /** "Sair da casa" na tela cheia: volta para o mapa do mundo. */
  onLeave: (fullscreen: boolean) => void;
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

/**
 * Cena 3D + controles. Sem WebGL (ou se a cena falhar), mostra um aviso — a
 * lista de objetos da página continua funcionando como alternativa.
 */
export function PlaceViewer({ objects, onSelect, startWalking = false, onLeave }: PlaceViewerProps) {
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

  // "Sair da casa" na tela cheia: volta direto para o mapa do mundo (visão geral)
  const close = () => onLeave(true);

  return (
    <div className="place-viewer">
      <ImmersiveFrame
        active={inside}
        onEnter={() => setInside(true)}
        onExit={close}
        enterLabel="🏡 Entrar na casa"
        exitLabel="Sair da casa"
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
          {walking && <Joystick onChange={(input) => sceneRef.current?.setWalkInput(input)} />}
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
          ? 'Arraste a bolinha do controle para andar: para cima anda, para os lados vira (no teclado: setas ou W A S D). Arraste a cena para olhar em volta. Passe pelas portas para ir de um cômodo a outro e toque em um objeto para ver a origem.'
          : 'Toque em "Entrar na casa" para explorar em tela cheia. Lá dentro: arraste para girar · pinça ou roda do mouse para aproximar · toque em um objeto para ver a origem · "Andar pela casa" para passear pelos cômodos.'}
      </p>
    </div>
  );
}
