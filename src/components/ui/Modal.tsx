import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  title: ReactNode;
  titleId: string;
  onClose: () => void;
  closeLabel?: string;
  children: ReactNode;
}

/** Janela simples e acessível: foco no botão de fechar, Esc fecha, o foco não escapa. */
export function Modal({ title, titleId, onClose, closeLabel = 'Fechar', children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, textarea, select');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      if (!dialogRef.current?.contains(e.target as Node)) closeRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="celebration-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className="celebration card modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className="modal__title">
          {title}
        </h2>
        {children}
        <button ref={closeRef} type="button" className="btn btn--primary btn--block" onClick={onClose}>
          {closeLabel}
        </button>
      </div>
    </div>
  );
}
