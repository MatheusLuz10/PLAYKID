import { startTransition, useEffect, useRef, useState } from 'react';
import { ImmersiveFrame } from '../../components/ui/ImmersiveFrame';
import { Joystick } from './Joystick';
import { PlaceScene, ROOMS, type Hotspot, type RoomCode, type SceneObject } from './scene/PlaceScene';
import { hasWebGL, prefersReducedMotion } from './scene/webgl';
import './place.css';

interface PlaceViewerProps {
  objects: SceneObject[];
  onSelect: (code: string) => void;
  /** "Sair da casa": volta para o mapa do mundo. */
  onLeave: (fullscreen: boolean) => void;
}

const ROOM_BUTTONS: { id: RoomCode; label: string }[] = [
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
 * A casa por dentro, em tela cheia: a pessoa entra pela porta da sala e anda pelos
 * cômodos (joystick, teclado ou arrastando para olhar). Não há vista de fora: a casa
 * e o quintal, por fora, estão no Meu Mundo. "Sair da casa" volta para ele.
 */
export function PlaceViewer({ objects, onSelect, onLeave }: PlaceViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PlaceScene | null>(null);
  const [supported] = useState(hasWebGL);
  const [failed, setFailed] = useState(false);
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
        // baixa prioridade: os botões sobre os objetos mudam a cada quadro e não podem atrasar a troca de página
        onHotspots: (s) => startTransition(() => setSpots(s)),
        onRoom: setRoom,
      });
      sceneRef.current.setWalk(true);
    } catch (err) {
      console.warn('[ECO QUEST] cena 3D indisponível', err);
      setFailed(true);
    }
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [supported]);

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
          <strong>Seu aparelho não conseguiu abrir a casa em 3D.</strong>
        </p>
        <button type="button" className="btn btn--primary" onClick={() => onLeave(false)}>
          🚪 Voltar para o mundo
        </button>
      </div>
    );
  }

  return (
    <div className="place-viewer">
      <ImmersiveFrame
        active
        onEnter={() => {}}
        onExit={() => onLeave(true)}
        enterLabel="🏡 Entrar na casa"
        exitLabel="Sair da casa"
        className="place-frame"
      >
        <div className="place-toolbar" role="toolbar" aria-label="Navegar pela casa">
          {ROOM_BUTTONS.map((r) => (
            <button key={r.id} type="button" className="filter-chip" aria-pressed={room === r.id} onClick={() => sceneRef.current?.walkTo(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="place-stage is-walking" data-walking="on">
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
          {room && (
            <p className="place-room" role="status" aria-live="polite">
              📍 Você está {ROOM_PLACE[room]}
            </p>
          )}
          <Joystick onChange={(input) => sceneRef.current?.setWalkInput(input)} />
        </div>
      </ImmersiveFrame>
      <p className="small muted place-help">
        Arraste a bolinha do controle para andar: para cima anda, para os lados vira (no teclado: setas ou W A S D).
        Arraste a cena para olhar em volta, passe pelas portas para ir de um cômodo a outro e toque em um objeto para
        ver a origem.
      </p>
    </div>
  );
}
