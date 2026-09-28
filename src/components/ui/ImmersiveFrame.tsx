import { useEffect, useRef, type ReactNode } from 'react';

interface ImmersiveFrameProps {
  active: boolean;
  onEnter: () => void;
  onExit: () => void;
  /** "Entrar no mundo", "Entrar na casa"… */
  enterLabel: string;
  /** "Sair do mundo", "Sair da casa"… */
  exitLabel: string;
  className?: string;
  children: ReactNode;
}

/**
 * Cena 3D que não prende a página: fora dela, a cena é só uma prévia (a página rola
 * normalmente, com o dedo ou a roda do mouse). "Entrar" abre a cena em tela cheia,
 * com o botão de sair sempre à vista (Esc também sai).
 */
export function ImmersiveFrame({ active, onEnter, onExit, enterLabel, exitLabel, className = '', children }: ImmersiveFrameProps) {
  const exitRef = useRef<HTMLButtonElement>(null);
  const enterRef = useRef<HTMLButtonElement>(null);
  const wasActive = useRef(active);
  const exitCb = useRef(onExit);
  exitCb.current = onExit;

  useEffect(() => {
    if (!active) {
      if (wasActive.current) enterRef.current?.focus(); // de volta ao botão que abriu
      wasActive.current = false;
      return;
    }
    wasActive.current = true;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // a página por trás não rola
    document.body.classList.add('has-immersive');
    exitRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Esc fecha primeiro as janelas de detalhes; sem janela aberta, sai da tela cheia
      if (e.key === 'Escape' && !document.querySelector('.celebration-backdrop')) exitCb.current();
    };
    // na fase de captura: confere se há janela aberta ANTES de a janela tratar o Esc e sumir
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = previous;
      document.body.classList.remove('has-immersive');
      document.removeEventListener('keydown', onKey, true);
    };
  }, [active]);

  return (
    <div className={`immersive ${active ? 'is-active' : 'is-preview'} ${className}`.trim()} data-immersive={active ? 'on' : 'off'}>
      {children}
      {active ? (
        <button ref={exitRef} type="button" className="immersive__exit" onClick={onExit}>
          ✕ {exitLabel}
        </button>
      ) : (
        <button ref={enterRef} type="button" className="immersive__enter" onClick={onEnter}>
          {enterLabel}
        </button>
      )}
    </div>
  );
}
