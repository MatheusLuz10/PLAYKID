/**
 * MODO DEMONSTRAÇÃO — usado quando o Supabase não está configurado.
 * Reproduz no navegador as mesmas regras das funções do banco
 * (ordem aula → quiz → desafio, XP idempotente, conquistas, mundo),
 * guardando o estado no localStorage deste dispositivo.
 * Nenhuma foto é enviada: apenas o nome do arquivo é registrado.
 */
import { DEFAULT_AVATAR } from '../../data/avatars';
import { demoCatalog } from '../../data/demo/catalog';
import { demoLessonDetail, demoSearchText } from '../../data/demo/lessons';
import { demoAnswerKey, demoQuizQuestions } from '../../data/demo/quizzes';
import { demoWorldInfo } from '../../data/demo/world';
import { achievementProgress, computeStats } from '../../logic/gamification';
import { normalizeSearch } from '../../logic/learning';
import { calculateWorldStage } from '../../logic/world';
import { PLACE_ITEMS } from '../../modules/place/catalog';
import { calculatePlaceStage } from '../../modules/place/placeLogic';
import { calculateUserLevel } from '../../logic/xp';
import type {
  LessonProgress,
  PlayerState,
  QuizAttemptRecord,
  UnlockedAchievement,
  UserChallenge,
  WorldUnlockType,
  XpTransaction,
} from '../../models';
import {
  currentDemoPlayerId,
  demoDataKey,
  demoLoginUsername,
  LEGACY_PLAYER_ID,
  listDemoPlayers,
  removeDemoPlayer,
  renameDemoLogin,
  usernamesOfOtherDemoPlayers,
} from '../demoPlayers';
import { AppError } from '../errors';
import { validateEvidenceFile } from '../imageService';
import type {
  AchievementUnlock,
  AdminContentKind,
  AdminContentRow,
  AdminDashboard,
  AdminLog,
  ClientLogEntry,
  AnswerFeedback,
  EvidenceInput,
  GameBackend,
  PlaceOwnedDTO,
  PlaceStateDTO,
  ProfileInput,
  QuizAttemptResult,
} from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

interface DemoAttempt {
  id: string;
  quizId: string;
  status: 'started' | 'completed' | 'abandoned';
  number: number;
  startedAt: string;
  pointsEarned: number;
  pointsTotal: number;
  answers: Record<string, { optionId: string; isCorrect: boolean }>;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  passed: boolean;
  completedAt: string | null;
}

/** Um evento de gamificação por acontecimento real (como public.gamification_events). */
interface DemoEvent {
  type: GamificationEventType | 'level_reached' | 'world_stage_reached';
  referenceId: string;
  createdAt: string;
}

type GamificationEventType =
  | 'lesson_completed'
  | 'quiz_passed'
  | 'quiz_improved'
  | 'challenge_started'
  | 'challenge_step_completed'
  | 'followup_completed'
  | 'challenge_completed'
  | 'achievement_unlocked';

interface DemoDb {
  player: Omit<PlayerState, 'quizzes'>;
  attempts: DemoAttempt[];
  xp: (XpTransaction & { sourceId: string })[];
  events: DemoEvent[];
  /** Conteúdo desativado pelo administrador (por tipo). */
  inactive?: Partial<Record<AdminContentKind, string[]>>;
  /** Registro de erros e ações administrativas (espelha public.app_logs). */
  logs?: AdminLog[];
  /** Casa 3D (espelha public.user_place_items). */
  place?: PlaceOwnedDTO[];
}

/** Origens de XP salvas antes da Etapa 6 → nomes de evento. */
const LEGACY_SOURCES: Record<string, GamificationEventType> = {
  lesson: 'lesson_completed',
  quiz: 'quiz_passed',
  quiz_improvement: 'quiz_improved',
  challenge_step: 'challenge_step_completed',
  follow_up: 'followup_completed',
  challenge: 'challenge_completed',
  achievement: 'achievement_unlocked',
};

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
/** "Hoje" no calendário do jogo (horário de Brasília), como `game_today()` no servidor. */
const gameToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

function createDb(userId: string): DemoDb {
  return {
    player: {
      clockOffsetMs: 0,
      profile: {
        id: uid(),
        userId,
        username: null,
        displayName: null,
        avatar: DEFAULT_AVATAR,
        avatarUrl: null,
        role: 'user',
        level: 1,
        totalXp: 0,
        knowledgeXp: 0,
        actionXp: 0,
        achievementXp: 0,
        bonusXp: 0,
        createdAt: now(),
      },
      lessons: {},
      favorites: [],
      challenges: {},
      achievements: [],
      world: {
        id: uid(),
        name: demoWorldInfo.name,
        description: demoWorldInfo.description,
        stage: 1,
        status: 'empty',
        progress: 0,
        items: [],
        stageHistory: [],
      },
    },
    attempts: [],
    xp: [],
    events: [],
  };
}

/** Marca usada só pelos testes de ponta a ponta para começar como usuário novo. */
function autoCompleteDisabled(): boolean {
  try {
    return localStorage.getItem('eco-quest:teste:sem-conclusao-automatica') === '1';
  } catch {
    return false;
  }
}

export class LocalBackend implements GameBackend {
  readonly mode = 'demo' as const;
  /** Jogador atual deste aparelho: cada jogador tem os próprios dados (ver services/demoPlayers). */
  private readonly playerId = currentDemoPlayerId();
  private readonly storageKey = demoDataKey(this.playerId);
  private db: DemoDb = this.read();
  /** Depois de excluir o jogador nada mais é gravado (a página é recarregada em seguida). */
  private deleted = false;

  constructor() {
    // A demonstração abre pronta para que a casa completa possa ser explorada — só no
    // jogador de demonstração original; jogadores cadastrados depois começam do zero.
    // Os testes de ponta a ponta (usuário novo) desligam isso com a marca abaixo.
    if (this.playerId === LEGACY_PLAYER_ID && !autoCompleteDisabled()) {
      void this.completeDemo();
      return;
    }
    this.syncWorld();
    this.syncPlace();
    this.save();
  }

  private read(): DemoDb {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const db = JSON.parse(raw) as DemoDb;
        // Dados salvos antes da Etapa 3: completa os campos novos.
        db.player.favorites ??= [];
        db.player.clockOffsetMs = 0;
        // Dados salvos antes da Etapa 5: etapas viram objetos e evidências ganham metadados.
        for (const uc of Object.values(db.player.challenges)) {
          for (const [k, v] of Object.entries(uc.steps as Record<string, unknown>)) {
            if (typeof v === 'string') uc.steps[k] = { status: v as 'pending', completedAt: null, notes: null };
          }
          for (const e of uc.evidence) {
            e.stepId ??= null;
            e.fileName ??= null;
            e.mimeType ??= null;
            e.fileSize ??= null;
            e.uploadedAt ??= e.createdAt;
          }
        }
        // Dados salvos antes da Etapa 4: status e número das tentativas.
        const counters = new Map<string, number>();
        for (const a of db.attempts) {
          a.status ??= a.completedAt ? 'completed' : 'abandoned';
          const n = (counters.get(a.quizId) ?? 0) + 1;
          counters.set(a.quizId, n);
          a.number ??= n;
          a.startedAt ??= a.completedAt ?? now();
          a.pointsEarned ??= a.correctAnswers;
          a.pointsTotal ??= a.totalQuestions;
        }
        for (const p of Object.values(db.player.lessons)) {
          p.lastSectionIndex ??= 0;
          p.lastAccessedAt ??= null;
        }
        // Dados salvos antes da Etapa 7: mundo com estágio, origem dos itens e posições em %.
        const world = db.player.world as typeof db.player.world & { level?: number; environmentScore?: number };
        if (world.stage === undefined) {
          delete world.level;
          delete world.environmentScore;
          if (world.name === 'Meu Mundo') world.name = demoWorldInfo.name;
          world.description ??= demoWorldInfo.description;
          world.stage = 1;
          world.status = 'empty';
          world.progress = 0;
          world.stageHistory = [];
          for (const item of world.items) {
            const def = demoCatalog.worldItems.find((w) => w.id === item.worldItemId);
            item.x = null;
            item.y = null;
            item.rotation = 0;
            item.sourceType = def?.unlockType ?? 'challenge';
            item.sourceId = demoCatalog.challenges.find((c) => c.slug === def?.unlockReference)?.id ?? null;
          }
        }
        // Dados salvos antes da Etapa 6: origens viram eventos, XP por categoria.
        if (!db.events) {
          const ucs = Object.values(db.player.challenges);
          for (const t of db.xp) {
            const type = LEGACY_SOURCES[t.sourceType];
            if (!type) continue;
            if (type === 'challenge_step_completed') t.sourceId = t.sourceId.split(':')[1] ?? t.sourceId;
            if (type === 'challenge_completed') t.sourceId = ucs.find((uc) => uc.id === t.sourceId)?.challengeId ?? t.sourceId;
            if (type === 'followup_completed') {
              const f = ucs.flatMap((uc) => uc.followups).find((x) => x.id === t.sourceId);
              t.sourceId = f?.stepId ?? t.sourceId;
            }
            t.sourceType = type;
          }
          db.events = db.xp.map((t) => ({ type: t.sourceType as GamificationEventType, referenceId: t.sourceId, createdAt: t.createdAt }));
          const profile = db.player.profile;
          profile.achievementXp = db.xp.filter((t) => t.type === 'achievement').reduce((s, t) => s + t.amount, 0);
          profile.bonusXp = db.xp.filter((t) => t.type === 'bonus').reduce((s, t) => s + t.amount, 0);
          profile.level = calculateUserLevel(profile.totalXp, demoCatalog.levels).current.number;
        }
        return db;
      }
    } catch {
      // armazenamento indisponível: segue em memória
    }
    // conta nova: o perfil já vem com o nome de usuário escolhido no login
    const db = createDb(this.playerId);
    db.player.profile.username = demoLoginUsername(this.playerId);
    return db;
  }

  private save() {
    if (this.deleted) return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.db));
    } catch {
      // modo privado / cota cheia: o jogo segue em memória
    }
  }

  // ---------- Regras internas (espelham as funções SQL) ----------

  /** Registra o XP (award_xp) e atualiza o perfil (trigger apply_xp_transaction). */
  private awardXp(amount: number, type: XpTransaction['type'], sourceType: string, sourceId: string, description: string) {
    if (!(amount > 0)) return 0;
    if (this.db.xp.some((t) => t.sourceType === sourceType && t.sourceId === sourceId)) return 0;
    this.db.xp.unshift({ id: uid(), amount, type, sourceType, sourceId, description, createdAt: now() });
    const p = this.db.player.profile;
    const before = p.level;
    p.totalXp += amount;
    if (type === 'knowledge') p.knowledgeXp += amount;
    if (type === 'action' || type === 'follow_up') p.actionXp += amount;
    if (type === 'achievement') p.achievementXp += amount;
    if (type === 'bonus') p.bonusXp += amount;
    p.level = calculateUserLevel(p.totalXp, demoCatalog.levels).current.number;
    // Cada nível ultrapassado vira um evento (vários de uma vez, se for o caso).
    for (let n = before + 1; n <= p.level; n++) {
      if (!this.hasEvent('level_reached', `level-${n}`)) this.db.events.push({ type: 'level_reached', referenceId: `level-${n}`, createdAt: now() });
    }
    return amount;
  }

  private hasEvent(type: DemoEvent['type'], referenceId: string) {
    return this.db.events.some((e) => e.type === type && e.referenceId === referenceId);
  }

  /**
   * Mesmas regras de public.process_gamification_event: confere se o fato
   * aconteceu, ignora eventos repetidos e busca o XP configurado no conteúdo.
   */
  private processEvent(type: GamificationEventType, ref: string): number {
    const player = this.view();
    let found: { amount: number; xpType: XpTransaction['type']; description: string } | null = null;
    switch (type) {
      case 'lesson_completed': {
        const l = demoCatalog.lessons.find((x) => x.id === ref);
        if (l && player.lessons[ref]?.status === 'completed') found = { amount: l.xpReward, xpType: 'knowledge', description: l.title };
        break;
      }
      case 'quiz_passed':
      case 'quiz_improved': {
        const q = demoCatalog.quizzes.find((x) => x.id === ref);
        const passes = this.db.attempts.filter((a) => a.quizId === ref && a.status === 'completed' && a.passed).length;
        if (q && passes >= (type === 'quiz_passed' ? 1 : 2))
          found = { amount: type === 'quiz_passed' ? q.xpReward : q.improvementXpReward, xpType: 'knowledge', description: q.title };
        break;
      }
      case 'challenge_started':
      case 'challenge_completed': {
        const c = demoCatalog.challenges.find((x) => x.id === ref);
        const uc = player.challenges[ref];
        if (c && uc && (type === 'challenge_started' || uc.status === 'completed'))
          found = { amount: type === 'challenge_started' ? c.startXpReward : c.xpReward, xpType: 'action', description: c.title };
        break;
      }
      case 'challenge_step_completed':
      case 'followup_completed': {
        const c = demoCatalog.challenges.find((x) => x.steps.some((s) => s.id === ref));
        const step = c?.steps.find((s) => s.id === ref);
        const uc = c ? player.challenges[c.id] : undefined;
        const isFollow = type === 'followup_completed';
        const done = isFollow
          ? uc?.followups.some((f) => f.stepId === ref && f.status === 'completed')
          : uc?.steps[ref]?.status === 'completed';
        if (c && step && (step.type === 'follow_up') === isFollow && done)
          found = { amount: step.xpReward, xpType: isFollow ? 'follow_up' : 'action', description: `${step.title} · ${c.title}` };
        break;
      }
      case 'achievement_unlocked': {
        const a = demoCatalog.achievements.find((x) => x.id === ref);
        if (a && player.achievements.some((u) => u.achievementId === ref)) found = { amount: a.xpReward, xpType: 'achievement', description: a.title };
        break;
      }
    }
    if (!found) throw new AppError('event_not_verified');
    if (this.hasEvent(type, ref)) return 0; // repetido: atualização, clique duplo…
    this.db.events.push({ type, referenceId: ref, createdAt: now() });
    return this.awardXp(found.amount, found.xpType, type, ref, found.description);
  }

  /**
   * Mesmas regras de public.sync_world: libera os itens cujas condições reais
   * foram cumpridas (sem duplicar) e recalcula o estágio do mundo.
   */
  private syncWorld(): string[] {
    const player = this.view();
    const world = this.db.player.world;
    const level = this.db.player.profile.level;
    const added: string[] = [];
    for (const item of demoCatalog.worldItems) {
      if (world.items.some((i) => i.worldItemId === item.id)) continue;
      if (this.isInactive('world_item', item.id)) continue;
      if (item.minLevel && level < item.minLevel) continue;
      const ref = item.unlockReference ?? '';
      let sourceId: string | null = null;
      let ok = false;
      switch (item.unlockType) {
        case 'initial':
          ok = true;
          break;
        case 'lesson':
          sourceId = demoCatalog.lessons.find((l) => l.slug === ref && player.lessons[l.id]?.status === 'completed')?.id ?? null;
          ok = sourceId !== null;
          break;
        case 'challenge':
          sourceId = demoCatalog.challenges.find((c) => c.slug === ref && player.challenges[c.id]?.status === 'completed')?.id ?? null;
          ok = sourceId !== null;
          break;
        case 'achievement': {
          const a = demoCatalog.achievements.find((x) => x.slug === ref);
          sourceId = a && player.achievements.some((u) => u.achievementId === a.id) ? a.id : null;
          ok = sourceId !== null;
          break;
        }
        case 'level':
          ok = Number(ref) <= level;
          sourceId = ok ? `level-${ref}` : null;
          break;
      }
      if (!ok) continue;
      world.items.push({
        id: uid(),
        worldItemId: item.id,
        quantity: 1,
        x: item.slot?.x ?? null,
        y: item.slot?.y ?? null,
        rotation: 0,
        revealed: item.unlockType === 'initial',
        unlockedAt: now(),
        sourceType: item.unlockType as WorldUnlockType,
        sourceId,
      });
      if (item.unlockType !== 'initial') added.push(item.id);
    }
    // Estágio, estado e progresso (espelha refresh_world).
    const info = calculateWorldStage(demoCatalog, this.view());
    const before = world.stage;
    world.stage = info.stage.number;
    world.status = info.stage.status;
    world.progress = info.progress;
    for (let n = before + 1; n <= world.stage; n++) {
      if (this.hasEvent('world_stage_reached', `stage-${n}`)) continue;
      this.db.events.push({ type: 'world_stage_reached', referenceId: `stage-${n}`, createdAt: now() });
      world.stageHistory.push({ stage: n, reachedAt: now() });
    }
    return added;
  }

  /**
   * Mesmas regras de public.sync_place: a casa só representa o que já
   * aconteceu (lições, desafios, conquistas, nível, primeira foto). Não dá XP.
   */
  private syncPlace() {
    const player = this.view();
    const owned = (this.db.place ??= []);
    const ucs = Object.values(player.challenges);
    for (const def of PLACE_ITEMS) {
      if (owned.some((o) => o.itemId === def.id)) continue;
      const ref = def.unlockReference ?? '';
      let ok = false;
      let sourceId: string | null = null;
      let challengeId: string | null = null;
      let evidenceId: string | null = null;
      let note: string | null = null;
      switch (def.unlockType) {
        case 'initial':
          ok = true;
          break;
        case 'lesson':
          sourceId = demoCatalog.lessons.find((l) => l.slug === ref && player.lessons[l.id]?.status === 'completed')?.id ?? null;
          ok = sourceId !== null;
          break;
        case 'challenge': {
          const c = demoCatalog.challenges.find((x) => x.slug === ref && player.challenges[x.id]?.status === 'completed');
          if (c) {
            ok = true;
            sourceId = challengeId = c.id;
            const uc = player.challenges[c.id]!;
            const ev = [...uc.evidence].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).find((e) => e.description?.trim());
            evidenceId = ev?.id ?? null;
            note = ev?.description ?? Object.values(uc.steps).find((st) => st.notes?.trim())?.notes ?? null;
          }
          break;
        }
        case 'achievement': {
          const a = demoCatalog.achievements.find((x) => x.slug === ref);
          sourceId = a && player.achievements.some((u) => u.achievementId === a.id) ? a.id : null;
          ok = sourceId !== null;
          break;
        }
        case 'level':
          ok = Number(ref) <= player.profile.level;
          sourceId = ok ? `level-${ref}` : null;
          break;
        case 'evidence': {
          const photos = ucs
            .flatMap((uc) => uc.evidence.filter((e) => e.type === 'photo').map((e) => ({ e, challengeId: uc.challengeId })))
            .sort((a, b) => a.e.createdAt.localeCompare(b.e.createdAt));
          const first = ref === 'photo' ? photos[0] : undefined;
          if (first) {
            ok = true;
            sourceId = evidenceId = first.e.id;
            challengeId = first.challengeId;
            note = first.e.description;
          }
          break;
        }
      }
      if (!ok) continue;
      owned.push({
        itemId: def.id,
        unlockedAt: now(),
        sourceType: def.unlockType,
        sourceId,
        challengeId,
        evidenceId,
        originNote: note?.trim().slice(0, 500) || null,
        revealed: def.unlockType === 'initial',
        state: 'visible',
      });
    }
  }

  async loadPlace(): Promise<PlaceStateDTO> {
    this.syncPlace();
    this.save();
    const items = structuredClone(this.db.place ?? []);
    const info = calculatePlaceStage(
      items.map((i) => ({ itemId: i.itemId, unlockedAt: i.unlockedAt, sourceType: i.sourceType, sourceId: i.sourceId, originNote: i.originNote, revealed: i.revealed })),
    );
    return {
      items,
      progress: {
        stage: info.stage.number,
        progress: info.progress,
        itemsUnlocked: info.itemsUnlocked,
        itemsTotal: info.itemsTotal,
        categories: info.categories,
        byCategory: info.byCategory,
      },
    };
  }

  async revealPlaceItems() {
    for (const item of this.db.place ?? []) item.revealed = true;
    this.save();
  }

  /** Mesmas regras de public.check_achievements: repete enquanto houver desbloqueios. */
  private checkAchievements(): AchievementUnlock[] {
    const unlocked: AchievementUnlock[] = [];
    for (let round = true; round; ) {
      round = false;
      const player = this.view();
      const stats = computeStats(demoCatalog, player);
      for (const a of demoCatalog.achievements) {
        if (this.db.player.achievements.some((u) => u.achievementId === a.id)) continue;
        if (this.isInactive('achievement', a.id)) continue;
        if (!achievementProgress(a, demoCatalog, player, stats).done) continue;
        const entry: UnlockedAchievement = { achievementId: a.id, unlockedAt: now() };
        this.db.player.achievements.push(entry);
        this.processEvent('achievement_unlocked', a.id);
        unlocked.push({ id: a.id, slug: a.slug, name: a.title, icon: a.icon });
        round = true;
        break; // recalcula com o novo estado (nível, XP)
      }
    }
    // Todo evento real atualiza o mundo (como o trigger em gamification_events).
    this.unlockedNow.push(...this.syncWorld());
    this.syncPlace();
    return unlocked;
  }

  /** Itens liberados na ação atual (qualquer regra). */
  private unlockedNow: string[] = [];

  private lessonCompleted(lessonId: string) {
    return this.db.player.lessons[lessonId]?.status === 'completed';
  }

  private assertLessonUnlocked(lessonId: string) {
    const lesson = demoCatalog.lessons.find((l) => l.id === lessonId);
    if (!lesson || this.isInactive('lesson', lessonId)) throw new AppError('not_found');
    if (lesson.prerequisiteId && !this.lessonCompleted(lesson.prerequisiteId)) throw new AppError('lesson_locked');
    return lesson;
  }

  private findUserChallenge(userChallengeId: string): UserChallenge {
    const uc = Object.values(this.db.player.challenges).find((c) => c.id === userChallengeId);
    if (!uc) throw new AppError('not_found');
    return uc;
  }

  private challengeOf(uc: UserChallenge) {
    return demoCatalog.challenges.find((c) => c.id === uc.challengeId)!;
  }

  /** Mesmo cálculo do servidor: etapas obrigatórias concluídas / total. */
  private refreshProgress(uc: UserChallenge) {
    const required = this.challengeOf(uc).steps.filter((s) => s.required);
    const done = required.filter((s) => uc.steps[s.id]?.status === 'completed').length;
    uc.progressPercentage = required.length ? Math.round((done / required.length) * 100) : 0;
  }

  private mainStepsDone(uc: UserChallenge) {
    return this.challengeOf(uc)
      .steps.filter((s) => s.required && s.type !== 'follow_up')
      .every((s) => uc.steps[s.id]?.status === 'completed');
  }

  private isOverdue(uc: UserChallenge) {
    return (
      ['accepted', 'in_progress'].includes(uc.status) &&
      uc.deadlineAt !== null &&
      new Date(uc.deadlineAt).getTime() < Date.now() &&
      !this.mainStepsDone(uc)
    );
  }

  private note(text: string) {
    const clean = text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 500);
    return clean || null;
  }

  private assertEvidence(kind: string, input: EvidenceInput) {
    if (kind === 'photo' && !input.file) throw new AppError('photo_required');
    if (kind === 'text' && (this.note(input.description)?.length ?? 0) < 3) throw new AppError('observation_required');
    if (input.file) validateEvidenceFile(input.file);
  }

  private pushEvidence(uc: UserChallenge, stepId: string | null, followupId: string | null, input: EvidenceInput) {
    const captured = new Date(`${input.capturedAt ?? gameToday()}T12:00:00Z`);
    uc.evidence.push({
      id: uid(),
      stepId,
      followupId,
      type: input.file ? 'photo' : 'text',
      filePath: input.file ? `demo/${input.file.name}` : null,
      thumbnailPath: null,
      fileName: input.file?.name ?? null,
      mimeType: input.file?.type ?? null,
      fileSize: input.file?.size ?? null,
      description: this.note(input.description),
      capturedAt: captured.toISOString(),
      uploadedAt: now(),
      status: 'submitted',
      createdAt: now(),
    });
  }

  // ---------- GameBackend ----------

  private isInactive(kind: AdminContentKind, id: string) {
    return this.db.inactive?.[kind]?.includes(id) ?? false;
  }

  async loadCatalog() {
    const flag = <T extends { id: string }>(kind: AdminContentKind, list: T[]) =>
      list.map((x) => ({ ...x, active: !this.isInactive(kind, x.id) }));
    return {
      ...demoCatalog,
      lessons: flag('lesson', demoCatalog.lessons),
      quizzes: flag('quiz', demoCatalog.quizzes),
      challenges: flag('challenge', demoCatalog.challenges),
      achievements: flag('achievement', demoCatalog.achievements),
      worldItems: flag('world_item', demoCatalog.worldItems),
    };
  }

  async loadPlayer(): Promise<PlayerState> {
    // Cópia profunda: a interface nunca altera o "banco" local diretamente.
    return structuredClone(this.view());
  }

  /** Estado do jogador (sem cópia), com o resumo dos quizzes calculado das tentativas. */
  private view(): PlayerState {
    const quizzes: PlayerState['quizzes'] = {};
    for (const quiz of demoCatalog.quizzes) {
      const done = this.db.attempts.filter((a) => a.quizId === quiz.id && a.status === 'completed');
      if (!done.length) continue;
      const best = [...done].sort((a, b) => Number(b.passed) - Number(a.passed) || b.score - a.score)[0];
      quizzes[quiz.id] = {
        quizId: quiz.id,
        score: best.score,
        correctAnswers: best.correctAnswers,
        totalQuestions: best.totalQuestions,
        passed: best.passed,
        attempts: done.length,
        completedAt: best.completedAt,
      };
    }
    return { ...this.db.player, quizzes };
  }

  async updateProfile(input: ProfileInput) {
    const username = input.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(username)) throw new AppError('username_invalid');
    const displayName = input.displayName.trim();
    if (!displayName || displayName.length > 40) throw new AppError('display_name_invalid');
    // Vários jogadores no mesmo aparelho: o nome de usuário não pode repetir.
    if (usernamesOfOtherDemoPlayers(this.playerId).includes(username)) throw new AppError('username_taken');
    Object.assign(this.db.player.profile, { username, displayName, avatar: input.avatar, avatarUrl: input.avatarUrl });
    renameDemoLogin(this.playerId, username); // o login acompanha o nome de usuário
    this.save();
  }

  async loadLessonDetail(lessonId: string) {
    const detail = demoLessonDetail(lessonId);
    if (!detail) throw new AppError('lesson_not_found');
    return detail;
  }

  async searchLessons(query: string) {
    const term = normalizeSearch(query);
    if (term.length < 2) return [];
    return demoCatalog.lessons
      .filter((l) => normalizeSearch(demoSearchText(l.id)).includes(term))
      .map((l) => l.id);
  }

  async setFavorite(lessonId: string, favorite: boolean) {
    const list = this.db.player.favorites.filter((id) => id !== lessonId);
    this.db.player.favorites = favorite ? [lessonId, ...list] : list;
    this.save();
  }

  /** Mesmo cálculo de track_lesson_progress: percentual pela parte atual, máx. 99%. */
  async trackLessonProgress(lessonId: string, sectionIndex: number): Promise<LessonProgress> {
    const lesson = this.assertLessonUnlocked(lessonId);
    const total = Math.max(lesson.sectionCount, 1);
    const index = Math.min(Math.max(Math.round(sectionIndex), 0), total - 1);
    const pct = Math.min(99, Math.round(((index + 1) * 100) / total));
    const current = this.db.player.lessons[lessonId];
    const next: LessonProgress =
      current?.status === 'completed'
        ? { ...current, lastSectionIndex: index, lastAccessedAt: now() }
        : {
            lessonId,
            status: 'in_progress',
            progressPercentage: Math.max(current?.progressPercentage ?? 0, pct),
            lastSectionIndex: index,
            lastAccessedAt: now(),
            completedAt: null,
          };
    this.db.player.lessons[lessonId] = next;
    this.save();
    return { ...next };
  }

  async completeLesson(lessonId: string) {
    const lesson = this.assertLessonUnlocked(lessonId);
    const current = this.db.player.lessons[lessonId];
    const finished = current?.status === 'completed' || (current?.lastSectionIndex ?? -1) >= lesson.sectionCount - 1;
    if (!finished) throw new AppError('lesson_not_finished');
    this.db.player.lessons[lessonId] = {
      lessonId,
      status: 'completed',
      progressPercentage: 100,
      lastSectionIndex: current?.lastSectionIndex ?? 0,
      lastAccessedAt: now(),
      completedAt: current?.completedAt ?? now(),
    };
    const xpAwarded = this.processEvent('lesson_completed', lesson.id);
    const achievements = this.checkAchievements();
    this.save();
    return { xpAwarded, achievements };
  }

  private feedbackFor(questionId: string, optionId: string, isCorrect: boolean): AnswerFeedback {
    const key = demoAnswerKey[questionId];
    return {
      questionId,
      isCorrect,
      selectedOptionId: optionId,
      correctOptionId: key.correctOptionId,
      explanation: key.explanation,
      optionFeedback: key.feedback[optionId] ?? null,
    };
  }

  private review(attempt: DemoAttempt): AnswerFeedback[] {
    const questions = demoQuizQuestions[attempt.quizId] ?? [];
    return questions
      .filter((q) => attempt.answers[q.id])
      .map((q) => this.feedbackFor(q.id, attempt.answers[q.id].optionId, attempt.answers[q.id].isCorrect));
  }

  private ownedAttempt(attemptId: string) {
    const attempt = this.db.attempts.find((a) => a.id === attemptId);
    if (!attempt) throw new AppError('not_found');
    return attempt;
  }

  async loadQuizQuestions(quizId: string) {
    const questions = demoQuizQuestions[quizId];
    if (!questions) throw new AppError('load_quiz');
    return structuredClone(questions);
  }

  async getActiveQuizAttempt(quizId: string) {
    const attempt = this.db.attempts.find((a) => a.quizId === quizId && a.status === 'started');
    if (!attempt) return null;
    return { attemptId: attempt.id, attemptNumber: attempt.number, answers: this.review(attempt) };
  }

  async listQuizAttempts(quizId?: string): Promise<(QuizAttemptRecord & { quizId: string })[]> {
    return this.db.attempts
      .filter((a) => !quizId || a.quizId === quizId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .map((a) => ({
        id: a.id,
        quizId: a.quizId,
        number: a.number,
        status: a.status,
        score: a.score,
        correctAnswers: a.correctAnswers,
        totalQuestions: a.totalQuestions,
        passed: a.passed,
        startedAt: a.startedAt,
        completedAt: a.completedAt,
      }));
  }

  async startQuizAttempt(quizId: string) {
    const quiz = demoCatalog.quizzes.find((q) => q.id === quizId);
    if (!quiz || this.isInactive('quiz', quizId)) throw new AppError('not_found');
    if (!this.lessonCompleted(quiz.lessonId)) throw new AppError('lesson_not_completed');
    const mine = this.db.attempts.filter((a) => a.quizId === quizId);
    const used = mine.filter((a) => a.status === 'completed').length;
    if (quiz.attemptsAllowed !== null && used >= quiz.attemptsAllowed) throw new AppError('attempts_exhausted');
    for (const a of mine) if (a.status === 'started') a.status = 'abandoned';
    const questions = demoQuizQuestions[quizId] ?? [];
    const attempt: DemoAttempt = {
      id: uid(),
      quizId,
      status: 'started',
      number: mine.length + 1,
      startedAt: now(),
      answers: {},
      score: 0,
      correctAnswers: 0,
      totalQuestions: questions.length,
      passed: false,
      completedAt: null,
      pointsEarned: 0,
      pointsTotal: questions.reduce((sum, q) => sum + q.points, 0),
    };
    this.db.attempts.push(attempt);
    this.save();
    return { attemptId: attempt.id, attemptNumber: attempt.number };
  }

  async answerQuestion(attemptId: string, questionId: string, optionId: string) {
    const attempt = this.ownedAttempt(attemptId);
    if (attempt.status !== 'started') throw new AppError('attempt_closed');
    if (attempt.answers[questionId]) throw new AppError('already_answered');
    const key = demoAnswerKey[questionId];
    if (!key || !(optionId in key.feedback)) throw new AppError('not_found');
    const isCorrect = key.correctOptionId === optionId;
    attempt.answers[questionId] = { optionId, isCorrect };
    this.save();
    return this.feedbackFor(questionId, optionId, isCorrect);
  }

  /** Mesmas regras de finish_quiz_attempt (16_quiz_improvements.sql). */
  async finishQuizAttempt(attemptId: string): Promise<QuizAttemptResult> {
    const attempt = this.ownedAttempt(attemptId);
    if (attempt.status !== 'started') throw new AppError('attempt_closed');
    const quiz = demoCatalog.quizzes.find((q) => q.id === attempt.quizId)!;
    const questions = demoQuizQuestions[quiz.id] ?? [];
    if (questions.some((q) => !attempt.answers[q.id])) throw new AppError('quiz_incomplete');

    const previous = this.db.attempts.filter((a) => a.quizId === quiz.id && a.status === 'completed');
    const previousBest = previous.length ? Math.max(...previous.map((a) => a.score)) : null;
    const alreadyPassed = previous.some((a) => a.passed);

    attempt.pointsTotal = questions.reduce((sum, q) => sum + q.points, 0);
    attempt.pointsEarned = questions.reduce((sum, q) => sum + (attempt.answers[q.id].isCorrect ? q.points : 0), 0);
    attempt.correctAnswers = questions.filter((q) => attempt.answers[q.id].isCorrect).length;
    attempt.totalQuestions = questions.length;
    attempt.score = attempt.pointsTotal ? Math.round((attempt.pointsEarned * 100) / attempt.pointsTotal) : 0;
    attempt.passed = attempt.score >= quiz.passingScore;
    attempt.status = 'completed';
    attempt.completedAt = now();

    let xpAwarded = 0;
    let challengeUnlocked: QuizAttemptResult['challengeUnlocked'] = null;
    const firstPass = attempt.passed && !alreadyPassed;
    if (attempt.passed) {
      xpAwarded += this.processEvent('quiz_passed', quiz.id);
      // Bônus por superar a própria melhor nota: uma única vez por quiz.
      if (!firstPass && quiz.improvementXpReward > 0 && attempt.score > (previousBest ?? 0)) {
        xpAwarded += this.processEvent('quiz_improved', quiz.id);
      }
      const challenge = demoCatalog.challenges.find((c) => c.lessonId === quiz.lessonId);
      if (challenge) challengeUnlocked = { id: challenge.id, slug: challenge.slug, title: challenge.title, icon: challenge.icon };
    }
    const achievements = this.checkAchievements();
    this.save();
    return {
      attemptId: attempt.id,
      attemptNumber: attempt.number,
      score: attempt.score,
      correctAnswers: attempt.correctAnswers,
      incorrectAnswers: attempt.totalQuestions - attempt.correctAnswers,
      totalQuestions: attempt.totalQuestions,
      pointsEarned: attempt.pointsEarned,
      pointsTotal: attempt.pointsTotal,
      passed: attempt.passed,
      passingScore: quiz.passingScore,
      firstPass,
      review: this.review(attempt),
      challengeUnlocked,
      xpAwarded,
      achievements,
    };
  }

  async acceptChallenge(challengeId: string) {
    const challenge = demoCatalog.challenges.find((c) => c.id === challengeId);
    if (!challenge || this.isInactive('challenge', challengeId)) throw new AppError('not_found');
    // Missões abertas (como a migration 28): aceitar não exige a aula nem o quiz.

    const existing = this.db.player.challenges[challengeId];
    if (existing && !this.isOverdue(existing)) return; // não duplica
    // (prazo vencido: o registro antigo é substituído por um novo)

    const uc: UserChallenge = {
      id: uid(),
      challengeId,
      status: 'accepted',
      acceptedAt: now(),
      deadlineAt: new Date(Date.now() + challenge.deadlineDays * DAY_MS).toISOString(),
      startedAt: null,
      completedAt: null,
      progressPercentage: 0,
      steps: Object.fromEntries(
        challenge.steps.map((s) => [s.id, { status: 'pending' as const, completedAt: null, notes: null }]),
      ),
      followups: [],
      evidence: [],
    };
    this.db.player.challenges[challengeId] = uc;
    // XP de início: uma vez por desafio (recomeçar ou encerrar não repete).
    this.processEvent('challenge_started', challengeId);
    this.checkAchievements();
    this.save();
  }

  /** Mesmas regras de complete_challenge_step (19_challenges_system.sql). */
  async completeChallengeStep(userChallengeId: string, _challengeId: string, stepId: string, input: EvidenceInput) {
    const uc = this.findUserChallenge(userChallengeId);
    const challenge = this.challengeOf(uc);
    if (!['accepted', 'in_progress'].includes(uc.status)) throw new AppError('challenge_not_active');
    if (this.isOverdue(uc)) throw new AppError('challenge_expired');
    const step = challenge.steps.find((s) => s.id === stepId);
    if (!step || step.type === 'follow_up') throw new AppError('invalid_step');
    if (uc.steps[step.id]?.status === 'completed') throw new AppError('step_already_completed');
    const pendingBefore = challenge.steps.some(
      (s) => s.required && s.type !== 'follow_up' && s.orderIndex < step.orderIndex && uc.steps[s.id]?.status !== 'completed',
    );
    if (pendingBefore) throw new AppError('previous_steps_pending');
    if (input.capturedAt) {
      const captured = new Date(`${input.capturedAt}T12:00:00Z`).getTime();
      const accepted = uc.acceptedAt ? new Date(uc.acceptedAt).getTime() - 2 * DAY_MS : 0;
      if (Number.isNaN(captured) || captured > Date.now() + DAY_MS || captured < accepted) throw new AppError('invalid_date');
    }
    this.assertEvidence(step.evidenceKind, input);
    if (step.evidenceKind !== 'none') this.pushEvidence(uc, step.id, null, input);

    uc.steps[step.id] = { status: 'completed', completedAt: now(), notes: this.note(input.description) };
    if (uc.status === 'accepted') uc.status = 'in_progress';
    uc.startedAt ??= now();
    const xpAwarded = this.processEvent('challenge_step_completed', step.id);

    // Parte principal terminou: agenda os acompanhamentos a partir de HOJE.
    const follow = challenge.steps.filter((s) => s.type === 'follow_up');
    if (this.mainStepsDone(uc) && follow.length) {
      const today = new Date(`${gameToday()}T12:00:00Z`);
      uc.followups = follow.map((s) => ({
        id: uid(),
        stepId: s.id,
        title: s.title,
        description: s.description,
        scheduledFor: new Date(today.getTime() + (s.dayOffset ?? 0) * DAY_MS).toISOString(),
        completedAt: null,
        status: 'scheduled' as const,
        evidenceRequired: s.evidenceKind === 'photo',
      }));
      uc.status = 'waiting_follow_up';
    }
    this.refreshProgress(uc);
    this.checkAchievements();
    this.save();
    return { status: uc.status, progressPercentage: uc.progressPercentage, xpAwarded };
  }

  /** Mesma regra do servidor: só a partir de (data prevista − janela), com a evidência exigida. */
  async completeFollowup(followupId: string, _challengeId: string, input: EvidenceInput) {
    const uc = Object.values(this.db.player.challenges).find((c) => c.followups.some((f) => f.id === followupId));
    const followup = uc?.followups.find((f) => f.id === followupId);
    if (!uc || !followup) throw new AppError('not_found');
    if (followup.status !== 'scheduled') throw new AppError('followup_already_done');
    if (uc.status !== 'waiting_follow_up') throw new AppError('challenge_not_active');
    const step = this.challengeOf(uc).steps.find((s) => s.id === followup.stepId);
    const opensAt = new Date(followup.scheduledFor).getTime() - (step?.earlyWindowDays ?? 0) * DAY_MS;
    if (opensAt > Date.now()) throw new AppError('followup_not_due');
    this.assertEvidence(step?.evidenceKind ?? (followup.evidenceRequired ? 'photo' : 'text'), input);
    if (input.file || this.note(input.description)) this.pushEvidence(uc, followup.stepId, followupId, { ...input, capturedAt: null });

    followup.status = 'completed';
    followup.completedAt = now();
    let xpAwarded = 0;
    if (followup.stepId) {
      uc.steps[followup.stepId] = { status: 'completed', completedAt: now(), notes: this.note(input.description) };
      xpAwarded = this.processEvent('followup_completed', followup.stepId);
    }
    this.refreshProgress(uc);
    const achievements = this.checkAchievements();
    this.save();
    return { xpAwarded, achievements, pendingFollowups: uc.followups.filter((f) => f.status === 'scheduled').length };
  }

  /** Idempotente: um segundo clique não concede nada de novo. */
  async completeChallenge(userChallengeId: string) {
    const uc = this.findUserChallenge(userChallengeId);
    const challenge = this.challengeOf(uc);
    if (uc.status === 'completed') return { alreadyCompleted: true, xpAwarded: 0, achievements: [], worldItems: [] };
    if (!['accepted', 'in_progress', 'waiting_follow_up'].includes(uc.status)) throw new AppError('challenge_not_active');
    if (this.isOverdue(uc)) throw new AppError('challenge_expired');
    if (!this.mainStepsDone(uc)) throw new AppError('steps_pending');
    const requiredFollow = challenge.steps.filter((s) => s.type === 'follow_up' && s.required);
    if (requiredFollow.some((s) => uc.steps[s.id]?.status !== 'completed')) throw new AppError('followups_pending');

    uc.status = 'completed';
    uc.completedAt ??= now();
    uc.startedAt ??= now();
    this.refreshProgress(uc);

    const xpAwarded = this.processEvent('challenge_completed', challenge.id);
    this.unlockedNow = [];
    const achievements = this.checkAchievements();
    this.save();
    return {
      alreadyCompleted: false,
      xpAwarded,
      achievements,
      worldItems: demoCatalog.worldItems
        .filter((w) => this.unlockedNow.includes(w.id))
        .map((w) => ({ id: w.id, code: w.code, name: w.name, icon: w.icon })),
    };
  }

  async cancelChallenge(userChallengeId: string) {
    const uc = this.findUserChallenge(userChallengeId);
    if (!['accepted', 'in_progress', 'waiting_follow_up'].includes(uc.status)) throw new AppError('challenge_not_active');
    delete this.db.player.challenges[uc.challengeId]; // cancelados saem da lista, como no servidor
    this.save();
  }

  async revealWorldItems() {
    const revealed: string[] = [];
    for (const item of this.db.player.world.items) {
      if (!item.revealed) {
        item.revealed = true;
        revealed.push(item.worldItemId);
      }
    }
    const achievements = this.checkAchievements();
    this.save();
    return { revealed, achievements };
  }

  async listXpHistory(page: number, pageSize: number) {
    const from = page * pageSize;
    const items = this.db.xp.slice(from, from + pageSize).map(({ sourceId: _sourceId, ...t }) => t);
    return { items, hasMore: this.db.xp.length > from + pageSize };
  }

  async deleteAccount() {
    // Na demonstração tudo fica neste navegador: apagar a conta = apagar os dados deste
    // jogador (os outros jogadores do aparelho continuam como estão).
    removeDemoPlayer(this.playerId);
    this.deleted = true;
    this.db = createDb(this.playerId);
  }

  async logError(entry: ClientLogEntry) {
    this.pushLog({ level: 'error', operation: entry.operation, code: entry.code, message: entry.message });
    this.save();
  }

  private pushLog(entry: Omit<AdminLog, 'id' | 'createdAt'>) {
    this.db.logs = [{ id: uid(), createdAt: now(), ...entry }, ...(this.db.logs ?? [])].slice(0, 100);
  }

  private requireAdmin() {
    if (this.db.player.profile.role !== 'admin') throw new AppError('forbidden');
  }

  async adminDashboard(): Promise<AdminDashboard> {
    this.requireAdmin();
    const player = this.view();
    const ucs = Object.values(player.challenges);
    const count = <T extends { id: string }>(kind: AdminContentKind, list: T[]) => ({
      total: list.length,
      active: list.filter((x) => !this.isInactive(kind, x.id)).length,
    });
    const recentEvent = this.db.events.some((e) => Date.now() - new Date(e.createdAt).getTime() < 30 * DAY_MS);
    return {
      // a conta de demonstração só conta depois de ser usada
      users: listDemoPlayers().filter((p) => !p.showcase || p.displayName).length,
      usersWithProfile: listDemoPlayers().filter((p) => p.displayName).length,
      activeUsers30d: recentEvent ? 1 : 0,
      lessonsCompleted: Object.values(player.lessons).filter((l) => l.status === 'completed').length,
      quizzesTaken: this.db.attempts.filter((a) => a.status === 'completed').length,
      quizzesPassed: this.db.attempts.filter((a) => a.status === 'completed' && a.passed).length,
      challengesStarted: ucs.length,
      challengesCompleted: ucs.filter((c) => c.status === 'completed').length,
      evidenceSent: ucs.reduce((n, c) => n + c.evidence.length, 0),
      xpDistributed: player.profile.totalXp,
      worldItemsUnlocked: player.world.items.filter((i) => i.sourceType !== 'initial').length,
      errors24h: (this.db.logs ?? []).filter((l) => l.level === 'error' && Date.now() - new Date(l.createdAt).getTime() < DAY_MS).length,
      content: {
        categories: { total: demoCatalog.categories.length, active: demoCatalog.categories.length },
        lessons: count('lesson', demoCatalog.lessons),
        quizzes: count('quiz', demoCatalog.quizzes),
        challenges: count('challenge', demoCatalog.challenges),
        achievements: count('achievement', demoCatalog.achievements),
        world_items: count('world_item', demoCatalog.worldItems),
      },
    };
  }

  async adminListUsers(search: string) {
    this.requireAdmin();
    const p = this.db.player.profile;
    const term = search.trim().toLowerCase();
    const matches = !term || [p.displayName, p.username].some((v) => v?.toLowerCase().includes(term));
    const last = this.db.events.map((e) => e.createdAt).sort().pop() ?? null;
    const items = matches
      ? [
          {
            userId: p.userId,
            displayName: p.displayName,
            username: p.username,
            email: null,
            role: p.role,
            level: p.level,
            totalXp: p.totalXp,
            challengesCompleted: Object.values(this.db.player.challenges).filter((c) => c.status === 'completed').length,
            createdAt: p.createdAt,
            lastActivity: last,
            status: (last && Date.now() - new Date(last).getTime() < 30 * DAY_MS ? 'active' : 'inactive') as 'active' | 'inactive',
          },
        ]
      : [];
    return { total: items.length, items };
  }

  async adminListContent(kind: AdminContentKind): Promise<AdminContentRow[]> {
    this.requireAdmin();
    const player = this.view();
    const cat = (id: string | null) => demoCatalog.categories.find((c) => c.id === id)?.name ?? null;
    const row = (id: string, title: string, group: string | null, xpReward: number | null, usage: number) => ({
      id,
      title,
      active: !this.isInactive(kind, id),
      group,
      xpReward,
      usage,
    });
    switch (kind) {
      case 'lesson':
        return demoCatalog.lessons.map((l) => row(l.id, l.title, cat(l.categoryId), l.xpReward, player.lessons[l.id]?.status === 'completed' ? 1 : 0));
      case 'quiz':
        return demoCatalog.quizzes.map((q) =>
          row(q.id, q.title, demoCatalog.lessons.find((l) => l.id === q.lessonId)?.title ?? null, q.xpReward,
            this.db.attempts.filter((a) => a.quizId === q.id && a.status === 'completed').length));
      case 'challenge':
        return demoCatalog.challenges.map((c) => row(c.id, c.title, cat(c.categoryId), c.xpReward, player.challenges[c.id]?.status === 'completed' ? 1 : 0));
      case 'achievement':
        return demoCatalog.achievements.map((a) => row(a.id, a.title, a.category, a.xpReward, player.achievements.some((u) => u.achievementId === a.id) ? 1 : 0));
      case 'world_item':
        return demoCatalog.worldItems.map((w) => row(w.id, `${w.icon} ${w.name}`, w.area, null, player.world.items.some((i) => i.worldItemId === w.id) ? 1 : 0));
    }
  }

  async adminSetContentActive(kind: AdminContentKind, id: string, active: boolean) {
    this.requireAdmin();
    const lists: Record<AdminContentKind, { id: string }[]> = {
      lesson: demoCatalog.lessons,
      quiz: demoCatalog.quizzes,
      challenge: demoCatalog.challenges,
      achievement: demoCatalog.achievements,
      world_item: demoCatalog.worldItems,
    };
    if (!lists[kind]) throw new AppError('invalid_input');
    if (!lists[kind].some((x) => x.id === id)) throw new AppError('not_found');
    const inactive = { ...(this.db.inactive ?? {}) };
    const set = new Set(inactive[kind] ?? []);
    if (active) set.delete(id);
    else set.add(id);
    inactive[kind] = [...set];
    this.db.inactive = inactive;
    this.pushLog({ level: 'info', operation: 'admin.set_active', code: kind, message: active ? 'Conteúdo ativado' : 'Conteúdo desativado' });
    this.save();
  }

  async adminSetRole(userId: string) {
    this.requireAdmin();
    if (userId === this.db.player.profile.userId) throw new AppError('cannot_change_own_role');
    throw new AppError('not_found');
  }

  async adminListLogs(limit: number) {
    this.requireAdmin();
    return (this.db.logs ?? []).slice(0, limit);
  }

  async getEvidenceImageUrl() {
    return null; // na demonstração a foto não é armazenada
  }

  async completeDemo() {
    const completedAt = now();
    this.db.player.profile.displayName ??= 'Explorador ECO';
    this.db.player.profile.username ??= 'explorador_eco';
    for (const lesson of demoCatalog.lessons) {
      this.db.player.lessons[lesson.id] = {
        lessonId: lesson.id,
        status: 'completed',
        progressPercentage: 100,
        lastSectionIndex: Math.max(0, lesson.sectionCount - 1),
        lastAccessedAt: completedAt,
        completedAt,
      };
      if (!this.hasEvent('lesson_completed', lesson.id)) this.processEvent('lesson_completed', lesson.id);
    }

    for (const quiz of demoCatalog.quizzes) {
      const questions = demoQuizQuestions[quiz.id] ?? [];
      // já aprovado antes (demonstração aberta de novo): não repete a tentativa
      if (this.db.attempts.some((a) => a.quizId === quiz.id && a.passed)) {
        if (!this.hasEvent('quiz_passed', quiz.id)) this.processEvent('quiz_passed', quiz.id);
        continue;
      }
      const answers = Object.fromEntries(
        questions.map((question) => [question.id, { optionId: demoAnswerKey[question.id].correctOptionId, isCorrect: true }]),
      );
      this.db.attempts.push({
        id: uid(),
        quizId: quiz.id,
        status: 'completed',
        number: 1,
        startedAt: completedAt,
        pointsEarned: questions.reduce((sum, question) => sum + question.points, 0),
        pointsTotal: questions.reduce((sum, question) => sum + question.points, 0),
        answers,
        score: 100,
        correctAnswers: questions.length,
        totalQuestions: questions.length,
        passed: true,
        completedAt,
      });
      if (!this.hasEvent('quiz_passed', quiz.id)) this.processEvent('quiz_passed', quiz.id);
    }

    for (const challenge of demoCatalog.challenges) {
      const steps = Object.fromEntries(
        challenge.steps.map((step) => [step.id, { status: 'completed' as const, completedAt, notes: 'Concluído na demonstração.' }]),
      );
      const userChallenge: UserChallenge = {
        id: uid(),
        challengeId: challenge.id,
        status: 'completed',
        acceptedAt: completedAt,
        deadlineAt: completedAt,
        startedAt: completedAt,
        completedAt,
        progressPercentage: 100,
        steps,
        followups: [],
        evidence: [],
      };
      this.db.player.challenges[challenge.id] = userChallenge;
      if (!this.hasEvent('challenge_started', challenge.id)) this.processEvent('challenge_started', challenge.id);
      for (const step of challenge.steps.filter((item) => item.type !== 'follow_up')) {
        if (!this.hasEvent('challenge_step_completed', step.id)) this.processEvent('challenge_step_completed', step.id);
      }
      if (!this.hasEvent('challenge_completed', challenge.id)) this.processEvent('challenge_completed', challenge.id);
    }

    this.checkAchievements();
    this.unlockEverything(completedAt);
    this.syncWorld();
    this.syncPlace();
    for (const item of this.db.place ?? []) item.revealed = true;
    this.save();
  }

  /**
   * DEMONSTRAÇÃO — tudo desbloqueado: o que ainda faltava depois de concluir
   * todo o conteúdo (nível máximo, a primeira foto, conquistas que o conteúdo
   * atual não permite e itens do mundo e da casa). Só existe no modo demonstração;
   * no Supabase cada item continua exigindo a ação real.
   */
  private unlockEverything(at: string) {
    // 1) um registro com foto (libera o quadro da casa pela mesma regra da primeira foto real)
    const ucs = Object.values(this.db.player.challenges).filter((uc) => uc.status === 'completed');
    if (ucs.length && !ucs.some((uc) => uc.evidence.some((e) => e.type === 'photo'))) {
      ucs[0].evidence.push({
        id: uid(),
        stepId: null,
        followupId: null,
        fileName: 'demonstracao.jpg',
        mimeType: 'image/jpeg',
        fileSize: null,
        uploadedAt: at,
        type: 'photo',
        filePath: null,
        thumbnailPath: null,
        description: 'Registro da demonstração.',
        capturedAt: at,
        status: 'approved',
        createdAt: at,
      });
    }
    // 2) XP de bônus até o último nível (libera os itens que pedem nível)
    const top = demoCatalog.levels.reduce((a, b) => (b.xpRequired > a.xpRequired ? b : a));
    this.awardXp(top.xpRequired - this.db.player.profile.totalXp, 'bonus', 'demo_unlock_all', 'demo', 'Demonstração: tudo desbloqueado');
    // 3) conquistas: primeiro pelas regras normais; as que o conteúdo atual não permite, direto
    this.checkAchievements();
    for (const a of demoCatalog.achievements) {
      if (this.isInactive('achievement', a.id)) continue;
      if (this.db.player.achievements.some((u) => u.achievementId === a.id)) continue;
      this.db.player.achievements.push({ achievementId: a.id, unlockedAt: at });
      this.processEvent('achievement_unlocked', a.id);
    }
    // 4) itens do mundo e da casa que ainda faltarem
    this.syncWorld();
    this.syncPlace();
    for (const item of demoCatalog.worldItems) {
      if (this.isInactive('world_item', item.id)) continue;
      if (this.db.player.world.items.some((i) => i.worldItemId === item.id)) continue;
      this.db.player.world.items.push({
        id: uid(),
        worldItemId: item.id,
        quantity: 1,
        x: item.slot?.x ?? null,
        y: item.slot?.y ?? null,
        rotation: 0,
        revealed: true,
        unlockedAt: at,
        sourceType: item.unlockType as WorldUnlockType,
        sourceId: 'demo',
      });
    }
    const owned = (this.db.place ??= []);
    for (const def of PLACE_ITEMS) {
      if (owned.some((o) => o.itemId === def.id)) continue;
      owned.push({
        itemId: def.id,
        unlockedAt: at,
        sourceType: def.unlockType,
        sourceId: 'demo',
        challengeId: null,
        evidenceId: null,
        originNote: null,
        revealed: true,
        state: 'visible',
      });
    }
    this.syncWorld(); // recalcula estágio e progresso do mundo
  }

  async resetDemo() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // ignorado
    }
    this.db = createDb(this.playerId);
    this.syncWorld();
    this.syncPlace();
    this.save();
  }
}
