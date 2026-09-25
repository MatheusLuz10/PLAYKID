import type { Challenge, Followup, PlayerState, Quiz, UserChallenge } from '../models';
import { followupState, mainSteps, serverNow, type FollowupState } from './challenges';

/**
 * Regra principal do jogo: nenhum desafio aparece sem contexto.
 * APRENDER → QUIZ → DESAFIO → COMPROVAR → ACOMPANHAR → RECOMPENSA
 * (o servidor valida a mesma ordem; aqui ela orienta a navegação).
 */
export type MissionStep = 'aprender' | 'quiz' | 'desafio' | 'comprovar' | 'acompanhar' | 'recompensa';

export const MISSION_STEPS: { id: MissionStep; label: string; icon: string }[] = [
  { id: 'aprender', label: 'Aprender', icon: '📚' },
  { id: 'quiz', label: 'Quiz', icon: '🧠' },
  { id: 'desafio', label: 'Desafio', icon: '🎯' },
  { id: 'comprovar', label: 'Executar', icon: '✅' },
  { id: 'acompanhar', label: 'Acompanhar', icon: '📅' },
  { id: 'recompensa', label: 'Recompensa', icon: '🎉' },
];

export function stepIndex(step: MissionStep): number {
  return MISSION_STEPS.findIndex((s) => s.id === step);
}

export function getMainEvidence(uc: UserChallenge | undefined) {
  return uc?.evidence.find((e) => !e.followupId);
}

/** Etapa em que o jogador está atualmente nesta missão (segue o status do servidor). */
export function getCurrentStep(challenge: Challenge, quiz: Quiz | undefined, player: PlayerState): MissionStep {
  if (player.lessons[challenge.lessonId]?.status !== 'completed') return 'aprender';
  if (quiz && !player.quizzes[quiz.id]?.passed) return 'quiz';
  const uc = player.challenges[challenge.id];
  if (!uc) return 'desafio';
  if (uc.status === 'completed') return 'recompensa';
  if (uc.status === 'waiting_follow_up') return 'acompanhar';
  return 'comprovar';
}

export function isStepUnlocked(step: MissionStep, current: MissionStep): boolean {
  return stepIndex(step) <= stepIndex(current);
}

export function isStepDone(step: MissionStep, current: MissionStep): boolean {
  if (current === 'recompensa') return true;
  return stepIndex(step) < stepIndex(current);
}

export function missionPath(challengeSlug: string, step: MissionStep): string {
  return `/missao/${challengeSlug}/${step}`;
}

export function isExpired(uc: UserChallenge | undefined): boolean {
  return Boolean(uc && uc.status === 'accepted' && uc.deadlineAt && new Date(uc.deadlineAt) < new Date());
}

// ---------- Linha do tempo (Dia 0 + acompanhamentos) ----------

const TIMELINE_ICONS = ['🌱', '🌿', '🌳', '🏞️'];

export interface Checkpoint {
  key: string;
  day: number;
  icon: string;
  title: string;
  description: string;
  xp: number;
  state: FollowupState | 'next' | 'pending';
  dueDate: Date | null;
  /** A partir de quando o registro é liberado (data prevista − janela de antecedência). */
  opensAt: Date | null;
  followup: Followup | null;
}

/**
 * Dia 0 = dia em que o checklist principal terminou (o servidor agenda os
 * acompanhamentos a partir dele). Serve para qualquer desafio com acompanhamento.
 */
export function buildCheckpoints(challenge: Challenge, uc: UserChallenge | undefined, player: PlayerState): Checkpoint[] {
  const now = serverNow(player);
  const follow = challenge.steps
    .filter((s) => s.type === 'follow_up')
    .sort((a, b) => (a.dayOffset ?? 0) - (b.dayOffset ?? 0));
  const mainDone = Boolean(uc) && mainSteps(challenge).filter((s) => s.required).every((s) => uc!.steps[s.id]?.status === 'completed');
  const first = uc?.followups[0];
  const firstStep = first ? follow.find((s) => s.id === first.stepId) : undefined;
  const base = first
    ? new Date(new Date(first.scheduledFor).getTime() - (firstStep?.dayOffset ?? 0) * 86_400_000)
    : null;
  const daily = follow.length > 3; // registros diários: ícone de caderno

  const list: Checkpoint[] = [
    {
      key: 'main',
      day: 0,
      icon: TIMELINE_ICONS[0],
      title: 'Checklist concluído',
      description: 'Etapas principais do desafio registradas.',
      xp: 0,
      state: mainDone ? 'done' : 'next',
      dueDate: base,
      opensAt: null,
      followup: null,
    },
  ];
  follow.forEach((step, i) => {
    const followup = uc?.followups.find((f) => f.stepId === step.id) ?? null;
    const due = followup ? new Date(followup.scheduledFor) : null;
    list.push({
      key: step.id,
      day: step.dayOffset ?? 0,
      icon: daily ? '📝' : TIMELINE_ICONS[Math.min(i + 1, TIMELINE_ICONS.length - 1)],
      title: step.title,
      description: step.description ?? '',
      xp: step.xpReward,
      state: followup ? followupState(followup, step, now) : 'pending',
      dueDate: due,
      opensAt: due ? new Date(due.getTime() - step.earlyWindowDays * 86_400_000) : null,
      followup,
    });
  });
  return list;
}
