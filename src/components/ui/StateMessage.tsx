import type { ReactNode } from 'react';

interface StateMessageProps {
  icon: string;
  title: string;
  text?: ReactNode;
  /** Botões/links de ação (ex.: "Tentar novamente"). */
  children?: ReactNode;
  role?: 'status' | 'alert';
}

/** Estado vazio, de erro ou de carregamento — nunca deixar a tela em branco. */
export function StateMessage({ icon, title, text, children, role = 'status' }: StateMessageProps) {
  return (
    <div className="card center stack stack--sm state-message" role={role}>
      <span className="big-icon" aria-hidden>
        {icon}
      </span>
      <h2 className="card__title">{title}</h2>
      {text && <p className="muted">{text}</p>}
      {children && <div className="state-message__actions">{children}</div>}
    </div>
  );
}

export function LoadingMessage({ text = 'Carregando…' }: { text?: string }) {
  return (
    <div className="loading-message" role="status" aria-live="polite">
      <span className="loading-message__dot" aria-hidden />
      <span>{text}</span>
    </div>
  );
}
