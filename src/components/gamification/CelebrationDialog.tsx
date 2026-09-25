import { useEffect, useRef } from 'react';
import { formatXp } from '../../logic/xp';
import { useGame } from '../../state/GameContext';

/**
 * Subiu de nível e/ou desbloqueou conquistas: UMA tela curta, mesmo quando
 * vários níveis são alcançados de uma vez. Os dados vêm do servidor.
 */
export function CelebrationDialog() {
  const { celebration, actions } = useGame();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { dismissCelebration } = actions;

  useEffect(() => {
    if (!celebration) return;
    const previous = document.activeElement as HTMLElement | null;
    buttonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissCelebration();
      if (e.key === 'Tab') {
        // Só existe um botão: o foco fica dentro da janela.
        e.preventDefault();
        buttonRef.current?.focus();
      }
    };
    // A tela de baixo pode mover o foco ao terminar de carregar: ele volta para a janela.
    const onFocusIn = (e: FocusEvent) => {
      if (e.target !== buttonRef.current) buttonRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
      previous?.focus?.();
    };
  }, [celebration, dismissCelebration]);

  if (!celebration) return null;
  const { levels, achievements } = celebration;
  const top = levels[levels.length - 1];
  const title = top ? 'Você subiu de nível!' : achievements.length > 1 ? 'Conquistas desbloqueadas' : 'Conquista desbloqueada';

  return (
    <div className="celebration-backdrop" role="presentation">
      <div className="celebration card" role="dialog" aria-modal="true" aria-labelledby="celebration-title" key={celebration.id}>
        <span className="celebration__burst" aria-hidden>
          {top ? '🎉' : '🏆'}
        </span>
        <h2 id="celebration-title" className="celebration__title">
          {title}
        </h2>

        {top && (
          <div className="celebration__level">
            <span className="celebration__level-icon" aria-hidden>
              {top.icon}
            </span>
            <span className="eyebrow">Nível {top.number}</span>
            <strong className="celebration__level-name">{top.name}</strong>
            {levels.length > 1 && (
              <p className="small muted">
                Níveis alcançados: {levels.map((l) => l.number).join(', ')}
              </p>
            )}
            <p className="muted">{top.description ?? 'Você está evoluindo sua jornada ecológica.'}</p>
            <span className="tag tag--done">
              + {levels.length > 1 ? `${levels.length} novos níveis desbloqueados` : 'novo nível desbloqueado'}
            </span>
          </div>
        )}

        {achievements.length > 0 && (
          <ul className="celebration__achievements" aria-label="Conquistas desbloqueadas">
            {achievements.map((a) => (
              <li key={a.id} className="celebration__achievement">
                <span className="celebration__achievement-icon" aria-hidden>
                  {a.icon}
                </span>
                <span>
                  <span className="eyebrow">🏆 Conquista desbloqueada</span>
                  <strong className="block">{a.title}</strong>
                  <span className="small muted block">{a.description}</span>
                </span>
                {a.xpReward > 0 && <span className="tag tag--xp">+{formatXp(a.xpReward)} XP</span>}
              </li>
            ))}
          </ul>
        )}

        <button ref={buttonRef} type="button" className="btn btn--primary btn--block" onClick={dismissCelebration}>
          Continuar
        </button>
      </div>
    </div>
  );
}
