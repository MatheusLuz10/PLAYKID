/**
 * Regras de apresentação dos desafios (Etapa 5), centralizadas.
 * Quem decide de verdade é o servidor; aqui só traduzimos o estado dele
 * para a interface, usando a HORA DO SERVIDOR (player.clockOffsetMs).
 */
import type { Challenge, ChallengeStatus, ChallengeStep, ContentCatalog, Followup, PlayerState, UserChallenge } from '../models';
import { findLesson } from './catalog';

const DAY_MS = 86_400_000;
/** Depois de quantos dias da data prevista um acompanhamento é considerado atrasado. */
export const FOLLOWUP_LATE_AFTER_DAYS = 7;
/** Com quantos dias de antecedência avisamos que um acompanhamento está chegando. */
export const FOLLOWUP_SOON_DAYS = 7;

/** "Agora" segundo o servidor. */
export function serverNow(player: PlayerState): number {
  return Date.now() + (player.clockOffsetMs ?? 0);
}

export const challengeStatusLabels: Record<ChallengeStatus, string> = {
  locked: '🔒 Bloqueado',
  available: '🔓 Disponível',
  accepted: '🎯 Aceito',
  in_progress: '⏳ Em andamento',
  waiting_follow_up: '🌱 Aguardando acompanhamento',
  completed: '🏆 Concluído',
  expired: '⌛ Prazo encerrado',
};

export const mainSteps = (c: Challenge) => c.steps.filter((s) => s.type !== 'follow_up');
export const followupSteps = (c: Challenge) => c.steps.filter((s) => s.type === 'follow_up');

export function isStepDone(uc: UserChallenge | undefined, step: ChallengeStep) {
  return uc?.steps[step.id]?.status === 'completed';
}

export function mainStepsDone(c: Challenge, uc: UserChallenge | undefined) {
  return Boolean(uc) && mainSteps(c).filter((s) => s.required).every((s) => isStepDone(uc, s));
}

/** Próxima etapa do checklist (em ordem). */
export function nextMainStep(c: Challenge, uc: UserChallenge | undefined): ChallengeStep | undefined {
  return mainSteps(c).find((s) => !isStepDone(uc, s));
}

export function isOverdue(c: Challenge, uc: UserChallenge | undefined, now: number) {
  return Boolean(
    uc &&
      ['accepted', 'in_progress'].includes(uc.status) &&
      uc.deadlineAt &&
      new Date(uc.deadlineAt).getTime() < now &&
      !mainStepsDone(c, uc),
  );
}

/**
 * Missões abertas (migration 28): todo desafio pode ser aceito sem a aula e o quiz,
 * que continuam recomendados e dando XP. Assinatura mantida para quem já a usa.
 */
export function isUnlocked(_content: ContentCatalog, _c: Challenge, _player: PlayerState) {
  return true;
}

export function getChallengeState(content: ContentCatalog, c: Challenge, player: PlayerState): ChallengeStatus {
  const uc = player.challenges[c.id];
  if (uc) {
    if (uc.status === 'completed') return 'completed';
    if (isOverdue(c, uc, serverNow(player))) return 'expired';
    if (uc.status === 'waiting_follow_up') return 'waiting_follow_up';
    if (uc.status === 'in_progress') return 'in_progress';
    return 'accepted';
  }
  return isUnlocked(content, c, player) ? 'available' : 'locked';
}

/** Mensagem clara do requisito de um desafio bloqueado. */
export function requirementText(content: ContentCatalog, c: Challenge) {
  const lesson = findLesson(content, c.lessonId);
  const topic = lesson?.topic ? lesson.topic.toLowerCase() : 'o tema';
  return `Aprenda sobre ${topic} e conclua o quiz para desbloquear este desafio.`;
}

// ---------- Acompanhamentos ----------

export type FollowupState = 'done' | 'available' | 'late' | 'soon' | 'locked';

export function followupOpensAt(f: Followup, step: ChallengeStep | undefined) {
  return new Date(f.scheduledFor).getTime() - (step?.earlyWindowDays ?? 0) * DAY_MS;
}

export function followupState(f: Followup, step: ChallengeStep | undefined, now: number): FollowupState {
  if (f.status === 'completed') return 'done';
  const opens = followupOpensAt(f, step);
  if (opens <= now) return now > new Date(f.scheduledFor).getTime() + FOLLOWUP_LATE_AFTER_DAYS * DAY_MS ? 'late' : 'available';
  return opens - now <= FOLLOWUP_SOON_DAYS * DAY_MS ? 'soon' : 'locked';
}

export function allFollowupsDone(c: Challenge, uc: UserChallenge | undefined) {
  return followupSteps(c)
    .filter((s) => s.required)
    .every((s) => isStepDone(uc, s));
}

/** O servidor aceitará a conclusão? (checklist + acompanhamentos obrigatórios). */
export function readyToComplete(c: Challenge, uc: UserChallenge | undefined) {
  return Boolean(uc) && uc!.status !== 'completed' && mainStepsDone(c, uc) && allFollowupsDone(c, uc);
}

export interface NextAction {
  icon: string;
  text: string;
}

/** Texto curto da próxima ação do jogador (cards e painel "Meus desafios"). */
export function nextAction(c: Challenge, uc: UserChallenge | undefined, player: PlayerState): NextAction | null {
  if (!uc || uc.status === 'completed') return null;
  const now = serverNow(player);
  if (isOverdue(c, uc, now)) return { icon: '⌛', text: 'Prazo encerrado — recomece ou encerre o desafio' };
  if (readyToComplete(c, uc)) return { icon: '🏆', text: 'Concluir desafio e receber a recompensa' };
  const step = nextMainStep(c, uc);
  if (step) {
    const verb = step.evidenceKind === 'photo' ? '📷 Enviar foto' : step.evidenceKind === 'text' ? '📝 Registrar' : '✅';
    return { icon: '', text: `${verb}: ${step.title}` };
  }
  const pending = uc.followups.filter((f) => f.status !== 'completed');
  const stepOf = (f: Followup) => c.steps.find((s) => s.id === f.stepId);
  const open = pending.find((f) => ['available', 'late'].includes(followupState(f, stepOf(f), now)));
  if (open) return { icon: '📅', text: `Registrar: ${open.title}` };
  if (pending[0]) {
    const opens = new Date(followupOpensAt(pending[0], stepOf(pending[0])));
    return { icon: '⏳', text: `${pending[0].title} a partir de ${opens.toLocaleDateString('pt-BR')}` };
  }
  return null;
}

/**
 * Desafio feito que só espera a data do próximo acompanhamento (nada a fazer agora).
 * Esses ficam numa lista compacta para as outras atividades aparecerem; quando um
 * acompanhamento libera (ou atrasa), o desafio volta ao destaque.
 */
export function isWaitingQuietly(c: Challenge, uc: UserChallenge | undefined, player: PlayerState): boolean {
  if (!uc || uc.status !== 'waiting_follow_up' || readyToComplete(c, uc)) return false;
  const now = serverNow(player);
  return !uc.followups.some(
    (f) => f.status !== 'completed' && ['available', 'late'].includes(followupState(f, c.steps.find((s) => s.id === f.stepId), now)),
  );
}

// ---------- Lembretes (dentro do app; sem push nesta etapa) ----------

export interface Reminder {
  challenge: Challenge;
  followup: Followup;
  kind: 'available' | 'late' | 'soon';
  opensAt: Date;
}

export function getReminders(content: ContentCatalog, player: PlayerState): Reminder[] {
  const now = serverNow(player);
  const list: Reminder[] = [];
  for (const uc of Object.values(player.challenges)) {
    if (uc.status !== 'waiting_follow_up') continue;
    const c = content.challenges.find((x) => x.id === uc.challengeId);
    if (!c) continue;
    // Só o próximo acompanhamento pendente de cada desafio.
    const next = uc.followups.find((f) => f.status !== 'completed');
    if (!next) continue;
    const step = c.steps.find((s) => s.id === next.stepId);
    const state = followupState(next, step, now);
    if (state === 'available' || state === 'late' || state === 'soon') {
      list.push({ challenge: c, followup: next, kind: state, opensAt: new Date(followupOpensAt(next, step)) });
    }
  }
  const order = { late: 0, available: 1, soon: 2 };
  return list.sort((a, b) => order[a.kind] - order[b.kind]);
}

export function reminderText(r: Reminder) {
  const name = `${r.challenge.icon} ${r.challenge.title}`;
  if (r.kind === 'late') return `Seu acompanhamento de “${r.challenge.title}” está atrasado. Registre assim que puder.`;
  if (r.kind === 'available') return `Seu acompanhamento de “${r.challenge.title}” está disponível.`;
  return `${name}: o próximo acompanhamento abre em ${r.opensAt.toLocaleDateString('pt-BR')}.`;
}

export function daysUntil(iso: string, now: number) {
  return Math.ceil((new Date(iso).getTime() - now) / DAY_MS);
}
