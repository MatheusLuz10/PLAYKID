import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMission } from '../../hooks/useMission';
import { challengeRewards, difficultyLabels, findCategory } from '../../logic/catalog';
import { challengeStatusLabels, followupSteps, mainSteps, requirementText } from '../../logic/challenges';
import { lessonPath, quizPathForLesson } from '../../logic/learning';
import { missionPath } from '../../logic/mission';

const kindBadge = { none: null, photo: '📷 Foto', text: '📝 Observação' } as const;

/** Detalhe do desafio: objetivo, importância, materiais, etapas, comprovação, acompanhamento e recompensa. */
export function ChallengePage() {
  const mission = useMission()!;
  const { challenge, lesson, quiz, userChallenge, status, currentStep, content, player, actions } = mission;
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const category = findCategory(content, challenge.categoryId);
  const follow = followupSteps(challenge);
  const followXp = follow.reduce((sum, s) => sum + s.xpReward, 0);
  const rewards = challengeRewards(content, challenge);
  const lessonDone = player.lessons[lesson.id]?.status === 'completed';
  const quizPassed = !quiz || Boolean(player.quizzes[quiz.id]?.passed);

  const accept = async () => {
    setBusy(true);
    const ok = await actions.acceptChallenge(challenge.id);
    if (ok) navigate(missionPath(challenge.slug, 'comprovar'));
    else setBusy(false);
  };

  return (
    <div className="stack">
      <section className="card mission-hero">
        <p className="eyebrow">
          {challenge.icon} {category?.name ?? 'Desafio'}
        </p>
        <h1 className="mission-hero__title">{challenge.title}</h1>
        <span className={`tag tag--status-${status}`}>{challengeStatusLabels[status]}</span>
        <dl className="facts">
          <div>
            <dt>Dificuldade</dt>
            <dd>{difficultyLabels[challenge.difficulty]}</dd>
          </div>
          <div>
            <dt>Duração</dt>
            <dd>{challenge.durationLabel ?? `${challenge.deadlineDays} dias`}</dd>
          </div>
          <div>
            <dt>Recompensa</dt>
            <dd>+{challenge.xpReward} XP</dd>
          </div>
        </dl>
        <p className="muted small">Prazo para concluir o checklist: {challenge.deadlineDays} dias após aceitar.</p>
      </section>

      {status === 'locked' && (
        <section className="card lock-card" role="alert" aria-labelledby="lock-title">
          <h2 id="lock-title" className="card__title">
            🔒 Desafio bloqueado
          </h2>
          <p>{requirementText(content, challenge)}</p>
          <ul className="requirement-list">
            <li className={lessonDone ? 'is-done' : ''}>
              <span>{lessonDone ? '☑' : '☐'} Concluir a aula “{lesson.title}”</span>
              {!lessonDone && (
                <Link to={lessonPath(lesson)} className="btn btn--primary btn--sm">
                  Ir para a aula
                </Link>
              )}
            </li>
            {quiz && (
              <li className={quizPassed ? 'is-done' : ''}>
                <span>{quizPassed ? '☑' : '☐'} Ser aprovado no quiz ({quiz.passingScore}%)</span>
                {lessonDone && !quizPassed && (
                  <Link to={quizPathForLesson(content, lesson)} className="btn btn--primary btn--sm">
                    Fazer quiz
                  </Link>
                )}
              </li>
            )}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="section-title">🎯 Objetivo</h2>
        <p>{challenge.mission}</p>
      </section>

      {challenge.whyItMatters && (
        <section className="card card--accent">
          <h2 className="section-title">💡 Por que isso importa?</h2>
          <p>{challenge.whyItMatters}</p>
        </section>
      )}

      {challenge.materials.length > 0 && (
        <section className="card">
          <h2 className="section-title">🧰 O que você vai precisar</h2>
          <ul className="checklist">
            {challenge.materials.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="section-title">📋 Como realizar</h2>
        <ol className="steps-list">
          {mainSteps(challenge).map((s) => (
            <li key={s.id}>
              <strong>{s.title}</strong>
              {kindBadge[s.evidenceKind] && <span className="tag tag--new step-kind">{kindBadge[s.evidenceKind]}</span>}
              {s.description && <span className="block muted small">{s.description}</span>}
            </li>
          ))}
        </ol>
      </section>

      {challenge.evidenceInstructions && (
        <section className="card">
          <h2 className="section-title">📷 Como comprovar</h2>
          <p>{challenge.evidenceInstructions}</p>
          <p className="muted small">As fotos ficam privadas: só você (e, no futuro, a moderação) pode vê-las.</p>
        </section>
      )}

      <section className="card">
        <h2 className="section-title">📅 Acompanhamento</h2>
        {follow.length === 0 ? (
          <p>Este desafio não tem acompanhamento: ele termina quando o checklist for concluído.</p>
        ) : (
          <>
            <p className="muted small">Depois do checklist, os acompanhamentos são liberados perto de cada data (contada pelo servidor).</p>
            <ul className="list">
              {follow.map((s) => (
                <li key={s.id} className="list__row">
                  <span aria-hidden>{s.evidenceKind === 'photo' ? '📷' : '📝'}</span>
                  <span>
                    <strong>Dia {s.dayOffset}</strong> — {s.title}
                  </span>
                  {s.xpReward > 0 && <span className="tag tag--done">+{s.xpReward} XP</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {challenge.cares.length > 0 && (
        <section className="card card--warm">
          <h2 className="section-title">⚠️ Cuidados</h2>
          <ul className="checklist checklist--warn">
            {challenge.cares.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="section-title">🏆 Recompensa</h2>
        <ul className="list">
          <li className="list__row">
            <span aria-hidden>⭐</span>
            <span>+{challenge.xpReward} XP ao concluir o desafio</span>
          </li>
          {followXp > 0 && (
            <li className="list__row">
              <span aria-hidden>📅</span>
              <span>+{followXp} XP nos acompanhamentos</span>
            </li>
          )}
          {rewards.achievements.map((a) => (
            <li key={a.id} className="list__row">
              <span aria-hidden>🏆</span>
              <span>
                Conquista “{a.title}” {a.icon}
              </span>
            </li>
          ))}
          {rewards.worldItems.map((w) => (
            <li key={w.id} className="list__row">
              <span aria-hidden>{w.icon}</span>
              <span>“{w.name}” no seu Mundo</span>
            </li>
          ))}
        </ul>
      </section>

      {status === 'available' && (
        <button type="button" className="btn btn--primary btn--lg btn--block" onClick={accept} disabled={busy}>
          {busy ? 'Salvando…' : 'Aceitar desafio'}
        </button>
      )}
      {['accepted', 'in_progress', 'waiting_follow_up', 'expired'].includes(status) && userChallenge && (
        <Link to={missionPath(challenge.slug, currentStep)} className="btn btn--primary btn--lg btn--block">
          {status === 'expired' ? 'Ver opções' : 'Continuar desafio →'}
        </Link>
      )}
      {status === 'completed' && (
        <Link to={missionPath(challenge.slug, 'recompensa')} className="btn btn--ghost btn--lg btn--block">
          🏆 Ver recompensa
        </Link>
      )}
    </div>
  );
}
