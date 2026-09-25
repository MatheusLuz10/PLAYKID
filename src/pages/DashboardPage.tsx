import { Link } from 'react-router-dom';
import { ReminderBanner } from '../components/challenge/ReminderBanner';
import { FirstMission, Onboarding } from '../components/onboarding/FirstMission';
import { LevelProgress } from '../components/player/LevelProgress';
import { ProgressBar } from '../components/ui/ProgressBar';
import { findCategory, findQuizForLesson } from '../logic/catalog';
import { latestAchievement } from '../logic/gamification';
import { challengeStatusLabels, daysUntil, getChallengeState, nextAction, serverNow } from '../logic/challenges';
import { MISSION_STEPS, getCurrentStep, isStepDone, missionPath, type MissionStep } from '../logic/mission';
import { worldStatusLabels } from '../logic/world';
import { calculateUserLevel } from '../logic/xp';
import { safeImageSrc } from '../logic/safeUrl';
import { useGame } from '../state/GameContext';

const nextStepCopy: Record<MissionStep, { title: string; cta: string }> = {
  aprender: { title: 'Comece pela aula sobre árvores', cta: 'Começar aula' },
  quiz: { title: 'Teste o que você aprendeu no quiz', cta: 'Fazer quiz' },
  desafio: { title: 'Sua missão foi liberada!', cta: 'Ver missão' },
  comprovar: { title: 'Continue o checklist do desafio', cta: 'Continuar' },
  acompanhar: { title: 'Acompanhe sua árvore nas datas previstas', cta: 'Acompanhar' },
  recompensa: { title: 'Ciclo concluído! Visite seu mundo', cta: 'Ver meu mundo' },
};

export function DashboardPage() {
  const { content, player, mode } = useGame();
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

  const activeChallenges = content.challenges.filter((c) => {
    const uc = player.challenges[c.id];
    return uc && uc.status !== 'completed';
  });
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
          {mode === 'demo' && (
            <Link to="/jogadores" className="player-header__switch">
              Não é você? 👥 Trocar de conta
            </Link>
          )}
        </div>
      </header>

      <ReminderBanner />

      <Onboarding userId={profile.userId} show={firstVisit} />

      {mainChallenge && step !== 'recompensa' ? (
        <FirstMission
          lesson={content.lessons.find((l) => l.id === mainChallenge.lessonId)}
          challenge={mainChallenge}
          step={step}
          href={nextHref}
          cta={next.cta}
        />
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
            <p className="empty">Nenhum desafio ativo. Aprenda algo novo para liberar um desafio.</p>
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
