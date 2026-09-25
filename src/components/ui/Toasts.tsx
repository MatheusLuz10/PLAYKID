import { useEffect } from 'react';
import { useGame, type Notice } from '../../state/GameContext';

const TOAST_DURATION_MS = 3200;
const ERROR_DURATION_MS = 6000;

function Toast({ notice, onDismiss }: { notice: Notice; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const ms = notice.tone === 'error' ? ERROR_DURATION_MS : TOAST_DURATION_MS;
    const timer = window.setTimeout(() => onDismiss(notice.id), ms);
    return () => window.clearTimeout(timer);
  }, [notice.id, notice.tone, onDismiss]);

  return (
    <div className={`toast${notice.tone === 'error' ? ' toast--error' : ''}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
      <span className="toast__icon" aria-hidden>
        {notice.icon}
      </span>
      <div>
        <strong>{notice.title}</strong>
        {notice.text && <span className="toast__text">{notice.text}</span>}
      </div>
    </div>
  );
}

export function Toasts() {
  const { notices, actions } = useGame();
  return (
    <div className="toasts" aria-live="polite">
      {notices.map((n) => (
        <Toast key={n.id} notice={n} onDismiss={actions.dismissNotice} />
      ))}
    </div>
  );
}
