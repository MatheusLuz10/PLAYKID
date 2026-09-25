import { Link } from 'react-router-dom';
import { getReminders, reminderText } from '../../logic/challenges';
import { missionPath } from '../../logic/mission';
import { useGame } from '../../state/GameContext';

/** 🔔 Lembretes de acompanhamento dentro do app (sem notificação push nesta etapa). */
export function ReminderBanner({ challengeId, limit = 3 }: { challengeId?: string; limit?: number }) {
  const { content, player } = useGame();
  const reminders = getReminders(content, player)
    .filter((r) => !challengeId || r.challenge.id === challengeId)
    .slice(0, limit);
  if (reminders.length === 0) return null;
  return (
    <section className="reminders" aria-label="Lembretes">
      {reminders.map((r) => (
        <div key={r.followup.id} className={`reminder reminder--${r.kind}`} role="status">
          <span className="reminder__icon" aria-hidden>
            {r.kind === 'late' ? '⚠️' : '🔔'}
          </span>
          <p className="reminder__text">{reminderText(r)}</p>
          {r.kind !== 'soon' && !challengeId && (
            <Link to={missionPath(r.challenge.slug, 'acompanhar')} className="btn btn--primary btn--sm">
              Registrar
            </Link>
          )}
        </div>
      ))}
    </section>
  );
}
