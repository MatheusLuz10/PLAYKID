import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { WalkInput } from './scene/PlaceScene';

/** Quanto a bolinha anda a partir do centro (px). */
const TRAVEL = 42;
/** Perto do centro não faz nada (evita andar sem querer). */
const DEAD_ZONE = 0.12;

const KEYS: Record<string, WalkInput> = {
  ArrowUp: { forward: 1, turn: 0 },
  ArrowDown: { forward: -1, turn: 0 },
  ArrowLeft: { forward: 0, turn: -1 },
  ArrowRight: { forward: 0, turn: 1 },
};

/**
 * Controle analógico: arrastar a bolinha para cima anda para frente, para baixo anda
 * para trás e para os lados vira. Quanto mais longe do centro, mais rápido. Soltar para.
 * Com o foco nele, as setas do teclado fazem o mesmo.
 */
export function Joystick({ onChange }: { onChange: (input: WalkInput) => void }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const apply = (x: number, y: number) => {
    const len = Math.hypot(x, y);
    if (len > TRAVEL) {
      x = (x / len) * TRAVEL;
      y = (y / len) * TRAVEL;
    }
    setKnob({ x, y });
    const dz = (v: number) => (Math.abs(v) < DEAD_ZONE ? 0 : v);
    onChange({ forward: dz(-y / TRAVEL), turn: dz(x / TRAVEL) });
  };

  const fromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = baseRef.current!.getBoundingClientRect();
    apply(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
  };

  const stop = () => {
    setActive(false);
    setKnob({ x: 0, y: 0 });
    onChange({ forward: 0, turn: 0 });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const input = KEYS[e.key];
    if (!input) return;
    e.preventDefault();
    setActive(true);
    setKnob({ x: input.turn * TRAVEL, y: -input.forward * TRAVEL });
    onChange(input);
  };

  return (
    <div
      ref={baseRef}
      className={active ? 'joystick is-active' : 'joystick'}
      role="application"
      tabIndex={0}
      aria-label="Controle para andar pela casa: arraste a bolinha, ou use as setas do teclado com o controle em foco"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setActive(true);
        fromPointer(e);
      }}
      onPointerMove={(e) => active && fromPointer(e)}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={() => active && stop()}
      onKeyDown={onKeyDown}
      onKeyUp={(e) => KEYS[e.key] && stop()}
      onBlur={() => active && stop()}
    >
      <span className="joystick__ring" aria-hidden />
      <span className="joystick__knob" aria-hidden style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}
