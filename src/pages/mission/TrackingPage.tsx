import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReminderBanner } from '../../components/challenge/ReminderBanner';
import { EvidenceForm } from '../../components/mission/EvidenceForm';
import { EvidencePhoto } from '../../components/mission/EvidencePhoto';
import { TrackingTimeline } from '../../components/mission/TrackingTimeline';
import { useMission } from '../../hooks/useMission';
import { readyToComplete } from '../../logic/challenges';
import { formatDate } from '../../logic/dates';
import { buildCheckpoints, missionPath, type Checkpoint } from '../../logic/mission';

/** Linha do tempo dos acompanhamentos; o registro só abre perto da data (relógio do servidor). */
export function TrackingPage() {
  const mission = useMission()!;
  const { challenge, userChallenge: uc, mode, player, actions } = mission;
  const navigate = useNavigate();
  const [openFollowupId, setOpenFollowupId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!uc) return null;

  const checkpoints = buildCheckpoints(challenge, uc, player);
  const openCheckpoint = checkpoints.find((c) => c.followup?.id === openFollowupId);
  const ready = readyToComplete(challenge, uc);

  const conclude = async () => {
    setBusy(true);
    const ok = await actions.completeChallenge(uc.id, challenge.id);
    if (ok) navigate(missionPath(challenge.slug, 'recompensa'));
    else setBusy(false);
  };

  const renderAction = (c: Checkpoint) => {
    if (!c.followup) return null;
    if (c.state === 'done') {
      const ev = uc.evidence.find((e) => e.followupId === c.followup!.id);
      return ev ? (
        <div className="checklist-step__evidence">
          <EvidencePhoto evidence={ev} />
          {ev.description && <p className="small">“{ev.description}”</p>}
        </div>
      ) : null;
    }
    if (c.state === 'available' || c.state === 'late') {
      if (openFollowupId === c.followup.id) return null;
      return (
        <button type="button" className="btn btn--primary btn--sm" onClick={() => setOpenFollowupId(c.followup!.id)}>
          {c.followup.evidenceRequired ? '📷 Registrar acompanhamento' : '📝 Registrar observação'}
        </button>
      );
    }
    return c.opensAt ? <span className="followup-lock">🔒 Disponível a partir de {formatDate(c.opensAt.toISOString())}</span> : null;
  };

  return (
    <div className="stack">
      <header>
        <p className="eyebrow">📅 Acompanhamento</p>
        <h1 className="page-title">Linha do tempo: {challenge.title}</h1>
        <p className="page-subtitle">Cada acompanhamento mostra como a sua ação continua dando resultado.</p>
      </header>

      <ReminderBanner challengeId={challenge.id} />

      <section className="card">
        <TrackingTimeline checkpoints={checkpoints} renderAction={renderAction} />
        <p className="muted small demo-note">
          📅 Cada acompanhamento é liberado perto da data prevista (contada a partir do dia em que o checklist foi
          concluído). Não dá para adiantar: a data é conferida pelo servidor.
        </p>
      </section>

      {openCheckpoint?.followup && (
        <EvidenceForm
          title={openCheckpoint.title}
          mode={mode}
          kind={openCheckpoint.followup.evidenceRequired ? 'photo' : 'text'}
          askDate={false}
          photoHint={openCheckpoint.description}
          notePlaceholder={openCheckpoint.description}
          submitLabel="Registrar acompanhamento"
          onCancel={() => setOpenFollowupId(null)}
          onSubmit={async (input) => {
            const ok = await actions.completeFollowup(openCheckpoint.followup!.id, challenge.id, input);
            if (ok) setOpenFollowupId(null);
            return ok;
          }}
        />
      )}

      {ready ? (
        <section className="card center stack stack--sm">
          <p>🎉 Todos os acompanhamentos foram registrados!</p>
          <button type="button" className="btn btn--primary btn--lg" onClick={conclude} disabled={busy}>
            🏆 Concluir desafio
          </button>
        </section>
      ) : (
        <section className="card card--muted">
          <p className="muted small">
            A conclusão definitiva — com XP, conquista e item no seu Mundo — acontece depois do último acompanhamento.
          </p>
        </section>
      )}
    </div>
  );
}
