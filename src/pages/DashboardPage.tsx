import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ReminderBanner } from '../components/challenge/ReminderBanner';
import { WaitingList } from '../components/challenge/WaitingList';
import { FirstMission, Onboarding } from '../components/onboarding/FirstMission';
import { LevelProgress } from '../components/player/LevelProgress';
import { ProgressBar } from '../components/ui/ProgressBar';
import { findCategory, findQuizForLesson } from '../logic/catalog';
import { latestAchievement } from '../logic/gamification';
import { challengeStatusLabels, daysUntil, getChallengeState, isWaitingQuietly, nextAction, serverNow } from '../logic/challenges';
import { MISSION_STEPS, getCurrentStep, isStepDone, missionPath, stepIndex, type MissionStep } from '../logic/mission';
import { orderQueue, readSkipped, skipToEnd } from '../logic/skipQueue';
import { worldStatusLabels } from '../logic/world';
import { calculateUserLevel } from '../logic/xp';
import { safeImageSrc } from '../logic/safeUrl';
import { useAuth } from '../state/AuthContext';
import { useGame } from '../state/GameContext';

const nextStepCopy: Record<MissionStep, { title: string; cta: string }> = {
  aprender: { title: 'Comece pela aula sobre árvores', cta: 'Começar aula' },
  quiz: { title: 'Teste o que você aprendeu no quiz', cta: 'Fazer quiz' },
  desafio: { title: 'Sua missão foi liberada!', cta: 'Ver missão' },
  comprovar: { title: 'Continue o checklist do desafio', cta: 'Continuar' },
  acompanhar: { title: 'Acompanhe sua árvore nas datas previstas', cta: 'Acompanhar' },
  recompensa: { title: 'Ciclo concluído! Visite seu mundo', cta: 'Ver meu mundo' },
};

/** Botão da próxima atividade, conforme a etapa em que a missão está. */
const nextActivityCta: Record<MissionStep, string> = {
  aprender: 'Começar aula',
  quiz: 'Fazer quiz',
  desafio: 'Ver missão',
  comprovar: 'Continuar',
  acompanhar: 'Registrar acompanhamento',
  recompensa: 'Ver recompensa',
};

export function DashboardPage() {
  const { content, player, mode } = useGame();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  // Online: trocar de conta = sair desta e ir para a tela de entrar (lá também dá para criar outra conta).
  const switchAccount = async () => {
    try {
      await signOut();
    } finally {
      navigate('/entrar');
    }
  };
  const { profile } = player;
  const level = calculateUserLevel(profile.totalXp, content.levels);
  const lastAchievement = latestAchievement(content, player);

  // Nesta etapa existe uma única missão completa: "Plante uma árvore".
  const mainChallenge = content.challenges[0];
  const mainQuiz = mainChallenge ? findQuizForLesson(content, mainChallenge.lessonId) : undefined;
  const step = mainChallenge ? getCurrentStep(mainChallenge, mainQuiz, player) : 'aprender';
  const stepsDone = MISSION_STEPS.filter((s) => isStepDone(s.id, step)).length;
  const next = nextStepCopy[step];
  const nextHref = !mainChallenge ? '/aprender' : step === 'recompensa' ? '/mundo' : missionPath(mainChallenge.slug, step);

  const openChallenges = content.challenges.filter((c) => {
    const uc = player.challenges[c.id];
    return uc && uc.status !== 'completed';
  });
  // Feitos, só esperando a data do acompanhamento: ficam numa lista compacta.
  const waitingChallenges = openChallenges.filter((c) => isWaitingQuietly(c, player.challenges[c.id], player));
  const activeChallenges = openChallenges.filter((c) => !waitingChallenges.includes(c));

  // Depois que a primeira missão chega ao acompanhamento, o destaque passa para a próxima atividade:
  // um desafio com algo a fazer agora ou, senão, a próxima missão ainda não aceita.
  // "Pular por agora": a missão sugerida vai para o fim da fila e o painel mostra a próxima.
  const [skipped, setSkipped] = useState(() => readSkipped(profile.userId));
  const queue = orderQueue([...activeChallenges, ...content.challenges.filter((c) => !player.challenges[c.id])], skipped);
  const skip = (id: string) => setSkipped((s) => skipToEnd(profile.userId, s, id));
  const firstMissionOpen = mainChallenge && stepIndex(step) < stepIndex('acompanhar') && !skipped.includes(mainChallenge.id);
  const nextChallenge = queue[0];
  const canSkip = queue.length > 1;
  const nextChallengeStep = nextChallenge
    ? getCurrentStep(nextChallenge, findQuizForLesson(content, nextChallenge.lessonId), player)
    : null;
  const now = serverNow(player);
  const learnedLessons = content.lessons.filter((l) => player.lessons[l.id]?.status === 'completed');
  const world = player.world;
  const worldStage = content.worldStages.find((s) => s.number === world.stage);
  const recentItems = [...world.items]
    .sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt))
    .map((i) => content.worldItems.find((w) => w.id === i.worldItemId))
    .filter((w) => w !== undefined)
    .slice(0, 8);

  // Primeiro acesso: nenhuma aula aberta ainda.
  const firstVisit = profile.totalXp === 0 && Object.keys(player.lessons).length === 0;

  return (
    <div className="stack">
      <header className="player-header">
        <span className="avatar avatar--lg" aria-hidden>
          {safeImageSrc(profile.avatarUrl) ? (
            <img className="avatar__image" src={safeImageSrc(profile.avatarUrl)} alt="" />
          ) : (
            profile.avatar
          )}
        </span>
        <div>
          <p className="eyebrow">{firstVisit ? 'Bem-vindo(a)' : 'Bem-vindo(a) de volta'}</p>
          <h1 className="page-title">Olá, {profile.displayName}!</h1>
          <p className="player-header__level">
            {level.current.icon} Nível {level.current.number} · {level.current.name}
          </p>
          {mode === 'demo' ? (
            <Link to="/jogadores" className="player-header__switch">
              Não é você? 👥 Trocar de conta
            </Link>
          ) : (
            <button type="button" className="player-header__switch link-button" onClick={() => void switchAccount()}>
              Não é você? 👥 Trocar de conta
            </button>
          )}
        </div>
      </header>

      <ReminderBanner />

      <Onboarding userId={profile.userId} show={firstVisit} />

      {firstMissionOpen ? (
        <FirstMission
          lesson={content.lessons.find((l) => l.id === mainChallenge.lessonId)}
          challenge={mainChallenge}
          step={step}
          href={nextHref}
          cta={next.cta}
          onSkip={canSkip ? () => skip(mainChallenge.id) : undefined}
        />
      ) : nextChallenge && nextChallengeStep ? (
        <section className="card card--accent next-step">
          <p className="eyebrow">Próxima atividade</p>
          <h2 className="card__title">
            <span aria-hidden>{nextChallenge.icon}</span> {nextChallenge.title}
          </h2>
          <p className="small">
            {player.challenges[nextChallenge.id]
              ? nextAction(nextChallenge, player.challenges[nextChallenge.id], player)?.text ?? 'Continue de onde parou.'
              : 'Uma nova missão para você: aprenda, faça e veja seu mundo crescer.'}
          </p>
          <div className="next-step__actions">
            <Link to={missionPath(nextChallenge.slug, nextChallengeStep)} className="btn btn--primary">
              {nextActivityCta[nextChallengeStep]}
            </Link>
            {canSkip && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => skip(nextChallenge.id)}
                aria-label={`Pular “${nextChallenge.title}” por agora (vai para o fim da fila)`}
              >
                ⏭️ Pular por agora
              </button>
            )}
          </div>
        </section>
      ) : mainChallenge && (
        <section className="card card--accent next-step">
          <p className="eyebrow">Próximo passo</p>
          <h2 className="card__title">{next.title}</h2>
          <div className="next-step__progress">
            <ProgressBar value={stepsDone} max={MISSION_STEPS.length} label="Progresso da missão" tone="sun" size="sm" />
            <span>
              {mainChallenge.icon} {mainChallenge.title} · {stepsDone}/{MISSION_STEPS.length} etapas
            </span>
          </div>
          <Link to={nextHref} className="btn btn--primary">
            {next.cta}
          </Link>
        </section>
      )}

      <section className="card evolution-card" aria-labelledby="evolution-title">
        <div className="world-preview__head">
          <h2 className="section-title" id="evolution-title">
            📈 Sua evolução
          </h2>
          <Link to="/perfil/evolucao" className="text-link">
            Ver detalhes →
          </Link>
        </div>
        <LevelProgress profile={profile} levels={content.levels} />
        <p className="small last-achievement">
          <span aria-hidden>🏆</span>{' '}
          {lastAchievement ? (
            <>
              Última conquista: <strong>{lastAchievement.title}</strong>
            </>
          ) : (
            'Conclua sua primeira lição para ganhar a primeira conquista.'
          )}
        </p>
      </section>

      <div className="grid-2">
        <section className="card">
          <h2 className="section-title">🎯 Meus desafios</h2>
          {activeChallenges.length === 0 ? (
            <p className="empty">
              Nenhum desafio com algo a fazer agora. <Link to="/desafios">Escolha um novo desafio →</Link>
            </p>
          ) : (
            <ul className="my-challenges">
              {activeChallenges.map((c) => {
                const uc = player.challenges[c.id]!;
                const state = getChallengeState(content, c, player);
                const action = nextAction(c, uc, player);
                const nextFollow = uc.followups.find((f) => f.status !== 'completed');
                const due =
                  state === 'waiting_follow_up' && nextFollow
                    ? { label: 'Próximo acompanhamento', iso: nextFollow.scheduledFor }
                    : uc.deadlineAt
                      ? { label: 'Prazo', iso: uc.deadlineAt }
                      : null;
                const days = due ? daysUntil(due.iso, now) : null;
                return (
                  <li key={c.id} className="my-challenge">
                    <div className="my-challenge__head">
                      <strong>
                        <span aria-hidden>{c.icon}</span> {c.title}
                      </strong>
                      <span className={`tag tag--status-${state}`}>{challengeStatusLabels[state]}</span>
                    </div>
                    <ProgressBar value={uc.progressPercentage} label={`Progresso de ${c.title}`} size="sm" />
                    <p className="small">
                      <strong>Progresso:</strong> {uc.progressPercentage}%
                    </p>
                    {action && (
                      <p className="small">
                        <strong>Próxima ação:</strong> {action.icon} {action.text}
                      </p>
                    )}
                    {due && days !== null && state !== 'expired' && (
                      <p className="small muted">
                        {due.label}: {days <= 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`}
                      </p>
                    )}
                    <Link
                      to={missionPath(c.slug, getCurrentStep(c, findQuizForLesson(content, c.lessonId), player))}
                      className="btn btn--primary btn--sm"
                    >
                      Continuar
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {waitingChallenges.length > 0 && (
            <div className="stack stack--sm">
              <h3 className="small muted">🌱 Aguardando acompanhamento ({waitingChallenges.length})</h3>
              <WaitingList challenges={waitingChallenges} />
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="section-title">📚 Conhecimentos adquiridos</h2>
          {learnedLessons.length === 0 ? (
            <p className="empty">Você ainda não concluiu nenhuma aula.</p>
          ) : (
            <ul className="list">
              {learnedLessons.map((l) => (
                <li key={l.id} className="list__row">
                  <span aria-hidden>{findCategory(content, l.categoryId)?.icon}</span>
                  <span>{l.title}</span>
                  <span className="tag tag--done">✓</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card world-summary" aria-labelledby="world-summary-title">
        <div className="world-preview__head">
          <h2 className="section-title" id="world-summary-title">
            🌎 Meu Mundo
          </h2>
          <Link to="/mundo" className="text-link">
            Visitar →
          </Link>
        </div>
        <p>
          <strong>{world.name}</strong>
          <span className="block small muted">
            Estágio {world.stage}
            {worldStage ? ` · ${worldStage.name}` : ''} · {worldStatusLabels[world.status]}
          </span>
        </p>
        <ProgressBar value={world.progress} label="Evolução do mundo" valueText={`${world.progress}% de evolução`} size="sm" />
        <p className="small">
          <strong>{world.progress}%</strong> de evolução · {world.items.length}{' '}
          {world.items.length === 1 ? 'elemento' : 'elementos'} no mundo
        </p>
        <Link to="/mundo" className="world-summary__items" aria-label="Abrir Meu Mundo">
          {recentItems.map((w) => (
            <span key={w!.id} aria-hidden>
              {w!.icon}
            </span>
          ))}
        </Link>
        <Link to="/meu-lugar" className="text-link">
          🏡 Visitar Meu Lugar (sua casa em 3D) →
        </Link>
      </section>
    </div>
  );
}
