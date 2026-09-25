import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EvidenceForm } from '../../components/mission/EvidenceForm';
import { EvidencePhoto } from '../../components/mission/EvidencePhoto';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useMission } from '../../hooks/useMission';
import {
  challengeStatusLabels,
  daysUntil,
  followupSteps,
  isStepDone,
  mainSteps,
  nextMainStep,
  readyToComplete,
  serverNow,
} from '../../logic/challenges';
import { dateInputFromIso, formatDate } from '../../logic/dates';
import { missionPath } from '../../logic/mission';

/** Execução do desafio: checklist em ordem, com foto/observação quando a etapa exige. */
export function ChecklistPage() {
  const mission = useMission()!;
  const { challenge, userChallenge: uc, status, mode, player, actions } = mission;
  const navigate = useNavigate();
  const [openStepId, setOpenStepId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!uc) return null;

  const now = serverNow(player);
  const next = nextMainStep(challenge, uc);
  const follow = followupSteps(challenge);
  const expired = status === 'expired';
  const canComplete = readyToComplete(challenge, uc) && follow.length === 0;
  const daysLeft = uc.deadlineAt ? daysUntil(uc.deadlineAt, now) : null;

  const markDone = async (stepId: string) => {
    setBusy(true);
    await actions.completeChallengeStep(uc.id, challenge.id, stepId, { file: null, description: '', capturedAt: null });
    setBusy(false);
  };

  const conclude = async () => {
    setBusy(true);
    const ok = await actions.completeChallenge(uc.id, challenge.id);
    if (ok) navigate(missionPath(challenge.slug, 'recompensa'));
    else setBusy(false);
  };

  const restart = async () => {
    setBusy(true);
    await actions.acceptChallenge(challenge.id); // o servidor expira o antigo e cria um novo
    setBusy(false);
  };

  const cancel = async () => {
    if (!window.confirm('Encerrar este desafio? O progresso dele será descartado e você poderá aceitá-lo de novo depois.')) return;
    setBusy(true);
    const ok = await actions.cancelChallenge(uc.id);
    if (ok) navigate('/desafios');
    else setBusy(false);
  };

  return (
    <div className="stack">
      <section className="card status-card">
        <div className="status-card__head">
          <span className="big-icon big-icon--sm" aria-hidden>
            {challenge.icon}
          </span>
          <div>
            <span className={`tag tag--status-${status}`}>{challengeStatusLabels[status]}</span>
            <h1 className="card__title">{challenge.title}</h1>
          </div>
        </div>
        <div className="challenge-progress">
          <span>
            <strong>{uc.progressPercentage}%</strong> concluído
          </span>
          <ProgressBar value={uc.progressPercentage} label="Progresso do desafio" valueText={`${uc.progressPercentage}% concluído`} />
        </div>
        <dl className="facts facts--2">
          <div>
            <dt>Aceito em</dt>
            <dd>{uc.acceptedAt ? formatDate(uc.acceptedAt) : '—'}</dd>
          </div>
          <div>
            <dt>Prazo do checklist</dt>
            <dd>
              {uc.deadlineAt ? formatDate(uc.deadlineAt) : '—'}
              {daysLeft !== null && !expired && status !== 'waiting_follow_up' && (
                <span className="block small muted">
                  {daysLeft <= 0 ? 'Termina hoje' : `Faltam ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}`}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {expired && (
        <section className="card lock-card" role="alert">
          <h2 className="card__title">⌛ O prazo terminou</h2>
          <p>O checklist não foi concluído dentro do prazo. Você pode recomeçar (com um novo prazo) ou encerrar o desafio.</p>
          <div className="actions">
            <button type="button" className="btn btn--primary" onClick={restart} disabled={busy}>
              Recomeçar desafio
            </button>
            <button type="button" className="btn btn--ghost" onClick={cancel} disabled={busy}>
              Encerrar
            </button>
          </div>
        </section>
      )}

      <section className="card" aria-labelledby="checklist-title">
        <h2 id="checklist-title" className="section-title">
          ✅ Checklist
        </h2>
        <ol className="checklist-steps">
          {mainSteps(challenge).map((step) => {
            const done = isStepDone(uc, step);
            const isNext = !expired && next?.id === step.id;
            const evidence = uc.evidence.find((e) => e.stepId === step.id && !e.followupId);
            const note = uc.steps[step.id]?.notes;
            return (
              <li key={step.id} className={`checklist-step ${done ? 'is-done' : isNext ? 'is-next' : 'is-pending'}`}>
                <div className="checklist-step__head">
                  <span className="checklist-step__box" aria-hidden>
                    {done ? '☑' : '☐'}
                  </span>
                  <div>
                    <strong>{step.title}</strong>
                    <span className="sr-only">{done ? ' — concluída' : isNext ? ' — próxima etapa' : ' — pendente'}</span>
                    {step.description && <p className="muted small">{step.description}</p>}
                    {!done && step.evidenceKind !== 'none' && (
                      <p className="small step-need">{step.evidenceKind === 'photo' ? '📷 Precisa de foto' : '📝 Precisa de uma observação'}</p>
                    )}
                    {done && uc.steps[step.id]?.completedAt && (
                      <p className="small muted">✓ Concluída em {formatDate(uc.steps[step.id].completedAt!)}</p>
                    )}
                  </div>
                </div>

                {done && evidence && (
                  <div className="checklist-step__evidence">
                    <EvidencePhoto evidence={evidence} />
                    {evidence.description && <p className="small">“{evidence.description}”</p>}
                  </div>
                )}
                {done && !evidence && note && <p className="small checklist-step__evidence">“{note}”</p>}

                {isNext && openStepId !== step.id && (
                  <div className="checklist-step__action">
                    {step.evidenceKind === 'none' ? (
                      <button type="button" className="btn btn--primary" onClick={() => void markDone(step.id)} disabled={busy}>
                        ✓ Marcar como feito
                      </button>
                    ) : (
                      <button type="button" className="btn btn--primary" onClick={() => setOpenStepId(step.id)}>
                        {step.evidenceKind === 'photo' ? '📷 Registrar foto' : '📝 Escrever observação'}
                      </button>
                    )}
                  </div>
                )}
                {!done && !isNext && !expired && <p className="small muted checklist-step__lock">🔒 Conclua a etapa anterior</p>}

                {isNext && openStepId === step.id && (
                  <EvidenceForm
                    title={step.title}
                    mode={mode}
                    kind={step.evidenceKind === 'text' ? 'text' : 'photo'}
                    minDate={uc.acceptedAt ? dateInputFromIso(uc.acceptedAt) : undefined}
                    photoHint={step.description ?? undefined}
                    notePlaceholder={step.evidenceKind === 'text' ? step.description ?? undefined : 'Ex.: Plantei no quintal porque recebe sol pela manhã.'}
                    onCancel={() => setOpenStepId(null)}
                    onSubmit={async (input) => {
                      const r = await actions.completeChallengeStep(uc.id, challenge.id, step.id, input);
                      if (r) setOpenStepId(null);
                      return Boolean(r);
                    }}
                  />
                )}
              </li>
            );
          })}
        </ol>
        {follow.length > 0 && (
          <p className="muted small demo-note">
            📅 Depois do checklist: {follow.length} {follow.length === 1 ? 'acompanhamento' : 'acompanhamentos'} (
            {follow.map((s) => `dia ${s.dayOffset}`).join(', ')}).
          </p>
        )}
      </section>

      {status === 'waiting_follow_up' && (
        <Link to={missionPath(challenge.slug, 'acompanhar')} className="btn btn--primary btn--lg btn--block">
          📅 Ver acompanhamentos
        </Link>
      )}

      {canComplete && (
        <section className="card center stack stack--sm">
          <p>Checklist concluído! Agora é só confirmar para receber a recompensa.</p>
          <button type="button" className="btn btn--primary btn--lg" onClick={conclude} disabled={busy}>
            🏆 Concluir desafio
          </button>
        </section>
      )}

      {!expired && status !== 'completed' && (
        <button type="button" className="text-link link-button danger-link" onClick={cancel} disabled={busy}>
          Encerrar este desafio
        </button>
      )}
    </div>
  );
}
