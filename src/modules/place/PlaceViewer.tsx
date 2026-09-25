import { useEffect, useRef, useState } from 'react';
import { PlaceScene, type FocusTarget, type Hotspot, type SceneObject } from './scene/PlaceScene';
import { hasWebGL, prefersReducedMotion } from './scene/webgl';

interface PlaceViewerProps {
  objects: SceneObject[];
  onSelect: (code: string) => void;
}

const FOCUS: { id: FocusTarget; label: string }[] = [
  { id: 'geral', label: '🏡 Visão geral' },
  { id: 'jardim', label: '🌳 Jardim' },
  { id: 'sala', label: '🛋️ Sala' },
  { id: 'quarto', label: '🛏️ Quarto' },
  { id: 'cozinha', label: '🍳 Cozinha' },
  { id: 'estudos', label: '📚 Estudos' },
];

/**
 * Cena 3D + controles. Sem WebGL (ou se a cena falhar), mostra um aviso — a
 * lista de objetos da página continua funcionando como alternativa.
 */
export function PlaceViewer({ objects, onSelect }: PlaceViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PlaceScene | null>(null);
  const [supported] = useState(hasWebGL);
  const [failed, setFailed] = useState(false);
  const [interior, setInterior] = useState(false);
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
      });
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
  const focus = (f: FocusTarget) => {
    sceneRef.current?.focus(f);
    if (f !== 'geral' && f !== 'jardim') setInterior(true);
  };

  return (
    <div className="place-viewer">
      <div className="place-toolbar" role="toolbar" aria-label="Navegar pela casa">
        {FOCUS.map((f) => (
          <button key={f.id} type="button" className="filter-chip" onClick={() => focus(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="place-stage">
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
        <div className="place-controls">
          <button type="button" className="place-control" onClick={toggleInterior} aria-pressed={interior}>
            {interior ? '🏠 Ver telhado' : '🔍 Ver por dentro'}
          </button>
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
        </div>
      </div>
      <p className="small muted place-help">
        Arraste para girar · pinça ou roda do mouse para aproximar · dois dedos ou botão direito para mover · toque em um
        objeto para ver a origem.
      </p>
    </div>
  );
}
