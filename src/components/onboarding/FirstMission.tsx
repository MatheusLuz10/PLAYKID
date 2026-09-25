import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { MISSION_STEPS, isStepDone, type MissionStep } from '../../logic/mission';
import type { Challenge, Lesson } from '../../models';
import { Modal } from '../ui/Modal';

/** O que cada passo significa na primeira missão (o conceito central do jogo). */
const STEP_TEXT: Record<MissionStep, string> = {
  aprender: 'Leia a aula',
  quiz: 'Responda o quiz para comprovar o que aprendeu',
  desafio: 'Aceite o desafio',
  comprovar: 'Faça a ação no mundo real e registre com foto',
  acompanhar: 'Acompanhe a ação nas datas previstas',
  recompensa: 'Receba XP e conquistas',
};

interface FirstMissionProps {
  lesson: Lesson | undefined;
  challenge: Challenge;
  step: MissionStep;
  href: string;
  cta: string;
}

/** 🌱 Sua primeira missão: mostra o caminho inteiro e onde o jogador está. */
export function FirstMission({ lesson, challenge, step, href, cta }: FirstMissionProps) {
  const done = MISSION_STEPS.filter((s) => isStepDone(s.id, step)).length;
  return (
    <section className="card card--accent first-mission" aria-labelledby="first-mission-title">
      <p className="eyebrow">Próximo passo</p>
      <h2 className="card__title" id="first-mission-title">
        🌱 Sua primeira missão
      </h2>
      <p className="small">
        Aprender “{lesson?.title ?? 'Por que as árvores são importantes?'}” → quiz → “{challenge.title}”.
      </p>
      <ol className="mission-path">
        {MISSION_STEPS.map((s, i) => {
          const state = isStepDone(s.id, step) ? 'is-done' : s.id === step ? 'is-current' : '';
          return (
            <li key={s.id} className={`mission-path__step ${state}`} aria-current={s.id === step ? 'step' : undefined}>
              <span className="mission-path__icon" aria-hidden>
                {state === 'is-done' ? '✓' : s.icon}
              </span>
              <span>
                <strong>
                  {i + 1}. {s.label}
                </strong>
                <span className="block small muted">{STEP_TEXT[s.id]}</span>
              </span>
              {state === 'is-done' && <span className="sr-only">(concluído)</span>}
              {state === 'is-current' && <span className="sr-only">(você está aqui)</span>}
            </li>
          );
        })}
        <li className="mission-path__step mission-path__step--world">
          <span className="mission-path__icon" aria-hidden>
            🌎
          </span>
          <span>
            <strong>Seu mundo evolui</strong>
            <span className="block small muted">A árvore aparece no seu mundo virtual</span>
          </span>
        </li>
      </ol>
      <p className="small muted">
        {done} de {MISSION_STEPS.length} passos concluídos
      </p>
      <Link to={href} className="btn btn--primary">
        {cta}
      </Link>
    </section>
  );
}

const ONBOARDING_KEY = 'eco-quest:onboarding-visto';

function seen(userId: string): boolean {
  try {
    return localStorage.getItem(`${ONBOARDING_KEY}:${userId}`) === '1';
  } catch {
    return false;
  }
}

/** Boas-vindas do primeiro acesso (curta). Preferência guardada só neste aparelho. */
export function Onboarding({ userId, show }: { userId: string; show: boolean }) {
  const [open, setOpen] = useState(() => show && !seen(userId));
  const close = useCallback(() => {
    try {
      localStorage.setItem(`${ONBOARDING_KEY}:${userId}`, '1');
    } catch {
      // modo privado: tudo bem, só aparece de novo
    }
    setOpen(false);
  }, [userId]);
  if (!open) return null;
  return (
    <Modal titleId="onboarding-title" title="Bem-vindo ao ECO QUEST" onClose={close} closeLabel="Começar">
      <div className="onboarding stack stack--sm">
        <span className="onboarding__icon" aria-hidden>
          🌱
        </span>
        <p>
          Aqui você aprende sobre o planeta, transforma conhecimento em ações reais e vê seu mundo crescer.
        </p>
        <p className="onboarding__motto">
          <strong>Aprenda.</strong> <strong>Faça.</strong> <strong>Transforme.</strong>
        </p>
      </div>
    </Modal>
  );
}
