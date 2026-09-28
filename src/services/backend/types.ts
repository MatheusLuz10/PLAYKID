import type {
  ContentCatalog,
  LessonDetail,
  LessonProgress,
  PlayerState,
  Question,
  QuizAttemptRecord,
  XpTransaction,
} from '../../models';

export interface AchievementUnlock {
  id: string;
  slug: string;
  name: string;
  icon: string;
}

export interface ActionResult {
  xpAwarded: number;
  achievements: AchievementUnlock[];
}

/** Correção de uma pergunta — só existe depois que o jogador respondeu. */
export interface AnswerFeedback {
  questionId: string;
  isCorrect: boolean;
  selectedOptionId: string;
  correctOptionId: string;
  /** Explicação geral da pergunta. */
  explanation: string | null;
  /** Feedback específico da alternativa escolhida. */
  optionFeedback: string | null;
}

export interface QuizAttemptStart {
  attemptId: string;
  attemptNumber: number;
}

/** Tentativa em andamento (para retomar) com as respostas já dadas. */
export interface ActiveQuizAttempt extends QuizAttemptStart {
  answers: AnswerFeedback[];
}

/** Resultado calculado pelo servidor. */
export interface QuizAttemptResult extends ActionResult {
  attemptId: string;
  attemptNumber: number;
  score: number;
  correctAnswers: number;
  incorrectAnswers: number;
  totalQuestions: number;
  pointsEarned: number;
  pointsTotal: number;
  passed: boolean;
  passingScore: number;
  firstPass: boolean;
  review: AnswerFeedback[];
  challengeUnlocked: { id: string; slug: string; title: string; icon: string } | null;
}

export interface ChallengeCompletion extends ActionResult {
  /** true = o desafio já estava concluído (clique repetido/atualização): nada foi concedido de novo. */
  alreadyCompleted: boolean;
  worldItems: { id: string; code: string; name: string; icon: string }[];
}

/** Resultado de uma etapa do checklist — status e progresso calculados pelo servidor. */
export interface StepResult {
  status: string;
  progressPercentage: number;
  xpAwarded: number;
}

export interface FollowupResult extends ActionResult {
  pendingFollowups: number;
}

export interface RevealResult {
  revealed: string[];
  achievements: AchievementUnlock[];
}

export interface EvidenceInput {
  file: File | null;
  /** Observação do usuário (até 500 caracteres; sanitizada no servidor). */
  description: string;
  /** Data informada pelo usuário (YYYY-MM-DD). A data do registro é a do servidor. */
  capturedAt: string | null;
}

export interface ProfileInput {
  displayName: string;
  username: string;
  avatar: string;
  avatarUrl: string | null;
}

export interface Page<T> {
  items: T[];
  hasMore: boolean;
}

// ---------- Administração ----------

export type AdminContentKind = 'lesson' | 'quiz' | 'challenge' | 'achievement' | 'world_item';

export interface AdminDashboard {
  users: number;
  usersWithProfile: number;
  activeUsers30d: number;
  lessonsCompleted: number;
  quizzesTaken: number;
  quizzesPassed: number;
  challengesStarted: number;
  challengesCompleted: number;
  evidenceSent: number;
  xpDistributed: number;
  worldItemsUnlocked: number;
  errors24h: number;
  content: Record<'categories' | 'lessons' | 'quizzes' | 'challenges' | 'achievements' | 'world_items', { total: number; active: number }>;
}

export interface AdminUser {
  userId: string;
  displayName: string | null;
  username: string | null;
  email: string | null;
  role: 'user' | 'admin';
  level: number;
  totalXp: number;
  challengesCompleted: number;
  createdAt: string;
  lastActivity: string | null;
  status: 'active' | 'inactive';
}

export interface AdminContentRow {
  id: string;
  title: string;
  active: boolean;
  group: string | null;
  xpReward: number | null;
  /** Uso real (conclusões, tentativas, desbloqueios). */
  usage: number;
}

export interface AdminLog {
  id: string;
  level: 'error' | 'warn' | 'info';
  operation: string;
  code: string | null;
  message: string | null;
  createdAt: string;
}

/** Erro enviado ao registro do servidor (já sem dados sensíveis). */
export interface ClientLogEntry {
  operation: string;
  code: string | null;
  message: string;
  context: Record<string, unknown>;
}

// ---------- Meu Lugar (casa 3D) ----------

/** Objeto conquistado na casa (user_place_items). */
export interface PlaceOwnedDTO {
  itemId: string;
  unlockedAt: string;
  sourceType: string;
  sourceId: string | null;
  /** Desafio relacionado (quando houver). */
  challengeId: string | null;
  evidenceId: string | null;
  /** Registro do jogador ligado à origem (observação da evidência) — o "diário". */
  originNote: string | null;
  revealed: boolean;
  state: 'visible' | 'hidden';
}

export interface PlaceStateDTO {
  items: PlaceOwnedDTO[];
  progress: {
    stage: number;
    progress: number;
    itemsUnlocked: number;
    itemsTotal: number;
    categories: number;
    byCategory: Record<string, number>;
  };
}

/**
 * Visita ao mundo e à casa de outro jogador (pelo @usuário). Só o que é seguro mostrar:
 * nada de fotos, diário, e-mail, foto de perfil ou XP.
 */
export interface VisitDTO {
  player: { username: string; displayName: string | null; avatar: string; level: number; isMe: boolean };
  world: { name: string; stage: number; progress: number; itemIds: string[] };
  place: { itemIds: string[] };
}

/**
 * Contrato único entre as telas e a fonte de dados.
 * - SupabaseBackend: dados reais (Postgres + Auth + Storage).
 * - LocalBackend: modo demonstração no navegador, com as mesmas regras.
 */
export interface GameBackend {
  readonly mode: 'demo' | 'supabase';

  loadCatalog(): Promise<ContentCatalog>;
  loadPlayer(): Promise<PlayerState>;
  updateProfile(input: ProfileInput): Promise<void>;

  /** Seções, resumo e relacionados de uma aula — buscados só quando a aula é aberta. */
  loadLessonDetail(lessonId: string): Promise<LessonDetail>;
  /** Ids das aulas que combinam com o texto (busca no servidor, sem acentos). */
  searchLessons(query: string): Promise<string[]>;
  /** Registra a parte em que o jogador está; o percentual é calculado pelo servidor. */
  trackLessonProgress(lessonId: string, sectionIndex: number): Promise<LessonProgress>;
  completeLesson(lessonId: string): Promise<ActionResult>;
  setFavorite(lessonId: string, favorite: boolean): Promise<void>;

  /** Perguntas e alternativas (sem gabarito), carregadas sob demanda. */
  loadQuizQuestions(quizId: string): Promise<Question[]>;
  getActiveQuizAttempt(quizId: string): Promise<ActiveQuizAttempt | null>;
  listQuizAttempts(quizId?: string): Promise<(QuizAttemptRecord & { quizId: string })[]>;
  startQuizAttempt(quizId: string): Promise<QuizAttemptStart>;
  answerQuestion(attemptId: string, questionId: string, optionId: string): Promise<AnswerFeedback>;
  finishQuizAttempt(attemptId: string): Promise<QuizAttemptResult>;

  acceptChallenge(challengeId: string): Promise<void>;
  /** Conclui uma etapa do checklist (com foto/observação quando a etapa exige). */
  completeChallengeStep(userChallengeId: string, challengeId: string, stepId: string, input: EvidenceInput): Promise<StepResult>;
  completeFollowup(followupId: string, challengeId: string, input: EvidenceInput): Promise<FollowupResult>;
  /** Idempotente: repetir não concede recompensa de novo. */
  completeChallenge(userChallengeId: string): Promise<ChallengeCompletion>;
  cancelChallenge(userChallengeId: string): Promise<void>;
  revealWorldItems(): Promise<RevealResult>;

  listXpHistory(page: number, pageSize: number): Promise<Page<XpTransaction>>;
  /** URL temporária (assinada) para exibir uma foto privada. */
  getEvidenceImageUrl(path: string): Promise<string | null>;

  /** Casa 3D do jogador (carregada só na página Meu Lugar). */
  loadPlace(): Promise<PlaceStateDTO>;
  /** Marca como vistos os objetos novos da casa. */
  revealPlaceItems(): Promise<void>;
  /** Visita o mundo e a casa de outro jogador pelo @usuário (só leitura). */
  visitPlayer(username: string): Promise<VisitDTO>;

  /** Exclui a conta do jogador e tudo o que é dele (fotos, progresso, XP, mundo). */
  deleteAccount(): Promise<void>;
  /** Registro de erros (monitoramento). Nunca lança erro. */
  logError(entry: ClientLogEntry): Promise<void>;

  // Administração: o servidor confere o papel em todas as chamadas.
  adminDashboard(): Promise<AdminDashboard>;
  adminListUsers(search: string, page: number, pageSize: number): Promise<{ total: number; items: AdminUser[] }>;
  adminListContent(kind: AdminContentKind): Promise<AdminContentRow[]>;
  adminSetContentActive(kind: AdminContentKind, id: string, active: boolean): Promise<void>;
  adminSetRole(userId: string, role: 'user' | 'admin'): Promise<void>;
  adminListLogs(limit: number): Promise<AdminLog[]>;

  /** Somente no modo demonstração. */
  resetDemo?(): Promise<void>;
  /** Completa todo o conteúdo apenas para inspeção do modo demonstração. */
  completeDemo?(): Promise<void>;
}
