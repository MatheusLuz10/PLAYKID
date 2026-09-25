import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '../../services/logger';

interface State {
  failed: boolean;
}

/**
 * Última proteção contra tela branca: se uma tela quebrar, mostra uma
 * mensagem com "Tentar novamente" e registra o erro (sem dados sensíveis).
 * O progresso do jogador não é afetado: ele está no servidor.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('render', error, { component: (info.componentStack ?? '').split('\n').filter(Boolean)[0]?.trim() ?? null });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="screen-center" role="alert">
        <span className="big-icon" aria-hidden>
          🍂
        </span>
        <h1 className="section-title">Algo não saiu como esperado</h1>
        <p className="muted">Não foi possível mostrar esta tela. Seu progresso está salvo.</p>
        <div className="state-message__actions">
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
            Tentar novamente
          </button>
          <a className="btn btn--ghost" href="/inicio">
            Ir para o início
          </a>
        </div>
      </div>
    );
  }
}
