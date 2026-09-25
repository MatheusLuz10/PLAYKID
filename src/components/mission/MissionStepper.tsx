import { Link } from 'react-router-dom';
import { MISSION_STEPS, isStepDone, isStepUnlocked, missionPath, type MissionStep } from '../../logic/mission';

interface MissionStepperProps {
  challengeSlug: string;
  currentStep: MissionStep;
  activeStep: MissionStep;
}

export function MissionStepper({ challengeSlug, currentStep, activeStep }: MissionStepperProps) {
  return (
    <ol className="stepper" aria-label="Etapas da missão">
      {MISSION_STEPS.map((step) => {
        const done = isStepDone(step.id, currentStep);
        const unlocked = isStepUnlocked(step.id, currentStep);
        const active = step.id === activeStep;
        const state = active ? 'active' : done ? 'done' : unlocked ? 'open' : 'locked';
        const content = (
          <>
            <span className="stepper__dot" aria-hidden>
              {done && !active ? '✓' : step.icon}
            </span>
            <span className="stepper__label">{step.label}</span>
            {state === 'done' && <span className="sr-only"> (concluída)</span>}
            {state === 'locked' && <span className="sr-only"> (bloqueada)</span>}
          </>
        );
        return (
          <li key={step.id} className={`stepper__item is-${state}`} aria-current={active ? 'step' : undefined}>
            {unlocked && !active ? (
              <Link to={missionPath(challengeSlug, step.id)} className="stepper__link">
                {content}
              </Link>
            ) : (
              <span className="stepper__link">{content}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
