import type { ReactNode } from 'react';
import type { Checkpoint } from '../../logic/mission';

interface TrackingTimelineProps {
  checkpoints: Checkpoint[];
  /** Ação ou detalhe de cada marco (registrar, data de liberação, evidência enviada). */
  renderAction?: (checkpoint: Checkpoint) => ReactNode;
}

const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

// Estado sempre em texto (não só em cor).
const stateLabels: Record<Checkpoint['state'], { text: string; className: string }> = {
  done: { text: '✓ Concluído', className: 'tag--done' },
  available: { text: '○ Disponível', className: 'tag--new' },
  late: { text: '⚠ Atrasado', className: 'tag--status-in_progress' },
  soon: { text: '🔒 Aguardando data', className: 'tag--muted' },
  locked: { text: '🔒 Aguardando data', className: 'tag--muted' },
  next: { text: '○ Em andamento', className: 'tag--new' },
  pending: { text: 'Depois do checklist', className: 'tag--muted' },
};

export function TrackingTimeline({ checkpoints, renderAction }: TrackingTimelineProps) {
  return (
    <ol className="timeline">
      {checkpoints.map((checkpoint) => {
        const label = stateLabels[checkpoint.state];
        const itemState = checkpoint.state === 'done' ? 'done' : ['available', 'late', 'next'].includes(checkpoint.state) ? 'next' : 'pending';
        return (
          <li key={checkpoint.key} className={`timeline__item is-${itemState}`}>
            <span className="timeline__marker" aria-hidden>
              {checkpoint.icon}
            </span>
            <div className="timeline__body">
              <div className="timeline__head">
                <span className="timeline__day">Dia {checkpoint.day}</span>
                <span className={`tag ${label.className}`}>{label.text}</span>
              </div>
              <strong className="timeline__title">{checkpoint.title}</strong>
              <p className="timeline__text">{checkpoint.description}</p>
              <div className="timeline__meta">
                {checkpoint.dueDate && <span>📅 {dateFormat.format(checkpoint.dueDate)}</span>}
                {checkpoint.xp > 0 && <span>⭐ +{checkpoint.xp} XP</span>}
              </div>
              {renderAction?.(checkpoint)}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
