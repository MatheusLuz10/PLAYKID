import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { StateMessage } from '../ui/StateMessage';
import { useMission } from '../../hooks/useMission';
import { isStepUnlocked, missionPath, type MissionStep } from '../../logic/mission';
import { MissionStepper } from './MissionStepper';

interface MissionRouteProps {
  step: MissionStep;
  children: ReactNode;
}

/**
 * Garante a ordem da missão: uma etapa ainda não liberada mostra uma tela de bloqueio
 * (mesmo acessando pela URL). O servidor aplica a mesma regra em cada ação.
 */
export function MissionRoute({ step, children }: MissionRouteProps) {
  const mission = useMission();
  if (!mission) return <Navigate to="/desafios" replace />;

  const { challenge, currentStep } = mission;
  const locked = step !== 'desafio' && !isStepUnlocked(step, currentStep);

  // Mesmo digitando a URL, a etapa bloqueada não abre (o servidor também recusa).
  let lockedView = null;
  if (locked && step === 'quiz') {
    lockedView = (
      <StateMessage icon="🔒" title="Quiz bloqueado" text="Conclua o conteúdo para testar seus conhecimentos." role="alert">
        <Link to={missionPath(challenge.slug, 'aprender')} className="btn btn--primary">
          Ir para o conteúdo
        </Link>
      </StateMessage>
    );
  } else if (locked && (currentStep === 'aprender' || currentStep === 'quiz')) {
    lockedView = (
      <StateMessage
        icon="🎯"
        title="Aceite o desafio primeiro"
        text="Todas as missões estão abertas: aceite o desafio para começar a executá-lo."
        role="alert"
      >
        <Link to={missionPath(challenge.slug, 'desafio')} className="btn btn--primary">
          Ver o desafio
        </Link>
      </StateMessage>
    );
  } else if (locked) {
    lockedView = (
      <StateMessage icon="🔒" title="Etapa ainda não liberada" text="Complete a etapa atual da missão para continuar." role="alert">
        <Link to={missionPath(challenge.slug, currentStep)} className="btn btn--primary">
          Ir para a etapa atual
        </Link>
      </StateMessage>
    );
  }

  return (
    <div className="mission">
      <div className="mission__top">
        <Link to="/desafios" className="back-link">
          ← Desafios
        </Link>
        <span className="mission__name">
          <span aria-hidden>{challenge.icon}</span> {challenge.title}
        </span>
      </div>
      <MissionStepper challengeSlug={challenge.slug} currentStep={currentStep} activeStep={step} />
      {lockedView ?? children}
    </div>
  );
}
