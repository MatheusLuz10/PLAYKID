/**
 * Modelos de domínio do ECO QUEST usados pela interface.
 * Espelham as tabelas do Supabase (supabase/migrations), já convertidos
 * para camelCase pelos mappers em services/backend/mappers.ts.
 *
 * Segurança: nenhum modelo de conteúdo carrega a resposta correta do quiz.
 * A correção sempre vem do servidor, depois da resposta do jogador.
 */

export type Difficulty = 'facil' | 'medio' | 'dificil';

// ---------- Conteúdo (somente leitura para o jogador) ----------

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  imageUrl: string | null;
  topics: string[];
}

/** Nível do conteúdo (lessons.difficulty). */
export type LessonLevel = 'beginner' | 'intermediate' | 'advanced';

/** Blocos interativos de uma seção (lesson_sections.blocks). */
export type LessonBlock =
  | { type: 'fun_fact'; title: string; text: string }
  | { type: 'observe'; prompt: string; imageUrl: string | null; imageAlt: string; answer: string }
  | { type: 'think'; prompt: string }
  | { type: 'tip'; text: string }
  | {
      type: 'choice';
      prompt: string;
      options: { id: string; icon: string | null; label: string; isBest: boolean; feedback: string }[];
    };

export interface LessonSection {
  id: string;
  icon: string;
  title: string;
  paragraphs: string[];
  highlights: string[];
  imageUrl: string | null;
  imageAlt: string | null;
  videoUrl: string | null;
  blocks: LessonBlock[];
}

/**
 * Resumo da aula — carregado com o catálogo (cards, busca, filtros).
 * As seções ficam em LessonDetail e só são buscadas quando a aula é aberta.
 */
export interface Lesson {
  /** false = desativado pelo administrador (continua visível para quem já tem histórico). */
  active?: boolean;
  id: string;
  slug: string;
  categoryId: string;
  topic: string | null;
  title: string;
  summary: string;
  difficulty: LessonLevel;
  durationMinutes: number;
  xpReward: number;
  orderIndex: number;
  sectionCount: number;
  /** Aula que precisa ser concluída antes desta. */
  prerequisiteId: string | null;
}

export interface LessonDetail {
  lessonId: string;
  sections: LessonSection[];
  /** Tela "Você aprendeu". */
  summaryPoints: { icon: string; text: string }[];
  relatedIds: string[];
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  prompt: string;
  /** Conceito avaliado (ex.: "💧 Água e solo"). */
  topic: string | null;
  /** Nesta etapa só existe 'single_choice'; preparado para outros formatos. */
  type: 'single_choice';
  points: number;
  options: QuestionOption[];
}

/**
 * Resumo do quiz (vem com o catálogo). As perguntas são carregadas só quando
 * o jogador abre o quiz — e nunca trazem o gabarito.
 */
export interface Quiz {
  /** false = desativado pelo administrador (continua visível para quem já tem histórico). */
  active?: boolean;
  id: string;
  lessonId: string;
  title: string;
  description: string | null;
  /** Percentual mínimo (0–100) para aprovação — definido no banco. */
  passingScore: number;
  /** XP da primeira aprovação. */
  xpReward: number;
  /** XP extra ao superar a própria melhor nota (0 = desligado). */
  improvementXpReward: number;
  /** null = ilimitado */
  attemptsAllowed: number | null;
  questionCount: number;
}

/** Tentativa registrada (histórico do jogador). */
export interface QuizAttemptRecord {
  id: string;
  number: number;
  status: 'started' | 'completed' | 'abandoned';
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  passed: boolean;
  startedAt: string;
  completedAt: string | null;
}

export type StepType = 'instruction' | 'action' | 'evidence' | 'follow_up' | 'completion';

export interface ChallengeStep {
  id: string;
  type: StepType;
  title: string;
  description: string | null;
  orderIndex: number;
  required: boolean;
  xpReward: number;
  /** follow_up: dias após a realização (Dia 0). */
  dayOffset: number | null;
  /** follow_up: quantos dias antes da data o registro já é liberado. */
  earlyWindowDays: number;
  /** O que a etapa exige: nada (só marcar), foto ou observação escrita. */
  evidenceKind: 'none' | 'photo' | 'text';
  /** Prazo sugerido da etapa, em dias após o aceite (informativo). */
  deadlineOffsetDays: number | null;
}

export interface Challenge {
  /** false = desativado pelo administrador (continua visível para quem já tem histórico). */
  active?: boolean;
  id: string;
  slug: string;
  categoryId: string;
  lessonId: string;
  icon: string;
  title: string;
  /** Objetivo do desafio. */
  mission: string;
  whyItMatters: string | null;
  materials: string[];
  evidenceInstructions: string | null;
  /** Ex.: "1 dia + acompanhamentos (30, 90 e 180 dias)". */
  durationLabel: string | null;
  instructions: string[];
  cares: string[];
  difficulty: Difficulty;
  deadlineDays: number;
  xpReward: number;
  /** XP por iniciar o desafio (uma única vez). */
  startXpReward: number;
  requiresEvidence: boolean;
  requiresFollowUp: boolean;
  steps: ChallengeStep[];
}

export type AchievementRequirement =
  | 'lessons_completed'
  | 'quizzes_passed'
  | 'challenges_completed'
  | 'challenge_completed'
  | 'category_challenges_completed'
  | 'category_actions_completed'
  | 'categories_explored'
  | 'level_reached'
  | 'cycles_completed';

export type AchievementCategory =
  | 'knowledge'
  | 'first_actions'
  | 'nature'
  | 'water'
  | 'waste'
  | 'energy'
  | 'biodiversity'
  | 'community'
  | 'special';

export interface Achievement {
  /** false = desativado pelo administrador (continua visível para quem já tem histórico). */
  active?: boolean;
  id: string;
  /** Código estável (ex.: "primeira-arvore"). */
  slug: string;
  icon: string;
  title: string;
  description: string;
  category: AchievementCategory;
  xpReward: number;
  requirementType: AchievementRequirement;
  /** Slug do desafio ou slugs de categoria (separados por vírgula), conforme o tipo. */
  requirementValue: string;
  /** Quantidade exigida (lições, desafios, nível…). */
  requirementCount: number;
  order: number;
}

export interface Level {
  number: number;
  name: string;
  icon: string;
  xpRequired: number;
  description: string | null;
}

/** Formas da ilustração da tela de boas-vindas (WorldScene). */
export type WorldItemKind = 'grass' | 'sprout' | 'bush' | 'tree' | 'flower' | 'garden' | 'pollinator';

/** Como um item do mundo é liberado (sempre verificado pelo servidor). */
export type WorldUnlockType = 'initial' | 'lesson' | 'challenge' | 'achievement' | 'level';
export type WorldStatus = 'empty' | 'evolving' | 'developed' | 'rich' | 'ecosystem';

export interface WorldArea {
  code: string;
  name: string;
  icon: string;
  description: string | null;
}

export interface WorldStage {
  number: number;
  name: string;
  icon: string;
  description: string | null;
  status: WorldStatus;
  minItems: number;
  minChallenges: number;
  minCategories: number;
}

export interface WorldItem {
  /** false = desativado pelo administrador (continua visível para quem já tem histórico). */
  active?: boolean;
  id: string;
  /** Código único e estável (ex.: "tree_basic"). */
  code: string;
  name: string;
  icon: string;
  description: string | null;
  /** O que o item representa na jornada do jogador. */
  meaning: string | null;
  area: string;
  categoryId: string | null;
  itemType: string;
  rarity: string;
  /** Item especial de um marco (ex.: "Árvore do Primeiro Passo"). */
  milestone: boolean;
  unlockType: WorldUnlockType;
  /** Slug do desafio/lição, código da conquista ou número do nível. */
  unlockReference: string | null;
  minLevel: number | null;
  order: number;
  /** Posição padrão dentro da área, em % (y = base do item). */
  slot: { x: number; y: number } | null;
  unlockTitle: string | null;
  unlockMessage: string | null;
}

export interface ContentCatalog {
  categories: Category[];
  lessons: Lesson[];
  quizzes: Quiz[];
  challenges: Challenge[];
  achievements: Achievement[];
  levels: Level[];
  worldItems: WorldItem[];
  worldAreas: WorldArea[];
  worldStages: WorldStage[];
}

// ---------- Jogador ----------

export type Role = 'user' | 'admin';

export interface Profile {
  id: string;
  userId: string;
  username: string | null;
  /** null = o jogador ainda não criou o perfil. */
  displayName: string | null;
  avatar: string;
  avatarUrl: string | null;
  role: Role;
  level: number;
  totalXp: number;
  knowledgeXp: number;
  actionXp: number;
  achievementXp: number;
  bonusXp: number;
  createdAt: string;
}

export type LessonStatus = 'not_started' | 'in_progress' | 'completed';

export interface LessonProgress {
  lessonId: string;
  status: LessonStatus;
  progressPercentage: number;
  /** Parte em que o jogador parou (retomada da aula). */
  lastSectionIndex: number;
  lastAccessedAt: string | null;
  completedAt: string | null;
}

/** Melhor tentativa concluída de um quiz. */
export interface QuizSummary {
  quizId: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  passed: boolean;
  attempts: number;
  completedAt: string | null;
}

export interface Evidence {
  id: string;
  /** Etapa do checklist a que a evidência pertence. */
  stepId: string | null;
  /** Preenchido quando é a evidência de um acompanhamento. */
  followupId: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  /** Data e hora do registro no servidor (a data informada pelo usuário é capturedAt). */
  uploadedAt: string | null;
  type: 'photo' | 'video' | 'text';
  /** Caminho no bucket privado (não é URL pública). */
  filePath: string | null;
  thumbnailPath: string | null;
  description: string | null;
  capturedAt: string;
  status: 'submitted' | 'approved' | 'rejected';
  createdAt: string;
}

export interface Followup {
  id: string;
  stepId: string | null;
  title: string;
  description: string | null;
  scheduledFor: string;
  completedAt: string | null;
  status: 'scheduled' | 'completed' | 'missed';
  evidenceRequired: boolean;
}

export type UserChallengeStatus =
  | 'locked'
  | 'available'
  | 'accepted'
  | 'in_progress'
  | 'waiting_follow_up'
  | 'completed'
  | 'expired'
  | 'cancelled';

export interface UserChallenge {
  id: string;
  challengeId: string;
  status: UserChallengeStatus;
  acceptedAt: string | null;
  deadlineAt: string | null;
  startedAt: string | null;
  /** Preenchido quando o desafio foi concluído (recompensa entregue). */
  completedAt: string | null;
  progressPercentage: number;
  steps: Record<string, UserChallengeStep>;
  followups: Followup[];
  evidence: Evidence[];
}

export interface UserChallengeStep {
  status: 'pending' | 'completed' | 'skipped';
  completedAt: string | null;
  notes: string | null;
}

export interface UnlockedAchievement {
  achievementId: string;
  unlockedAt: string;
}

export interface PlayerWorldItem {
  id: string;
  worldItemId: string;
  quantity: number;
  /** Posição em % dentro da área (null = posição padrão do item). */
  x: number | null;
  y: number | null;
  rotation: number;
  /** O jogador já viu o item surgir no mundo. */
  revealed: boolean;
  unlockedAt: string;
  /** Origem do desbloqueio (desafio, conquista, lição, nível ou mundo inicial). */
  sourceType: WorldUnlockType;
  sourceId: string | null;
}

export interface PlayerWorld {
  id: string;
  name: string;
  description: string | null;
  /** Estágio, estado e progresso calculados pelo servidor. */
  stage: number;
  status: WorldStatus;
  progress: number;
  items: PlayerWorldItem[];
  /** Cada estágio alcançado (história do mundo). */
  stageHistory: { stage: number; reachedAt: string }[];
}

export interface PlayerState {
  /** Diferença entre o relógio do servidor e o do aparelho (ms). Datas do jogo usam o servidor. */
  clockOffsetMs: number;
  profile: Profile;
  lessons: Record<string, LessonProgress>;
  /** Ids das aulas favoritas (mais recentes primeiro). */
  favorites: string[];
  quizzes: Record<string, QuizSummary>;
  /** Indexado pelo id do desafio (apenas o registro ativo/concluído). */
  challenges: Record<string, UserChallenge>;
  achievements: UnlockedAchievement[];
  world: PlayerWorld;
}

export interface XpTransaction {
  id: string;
  amount: number;
  type: 'knowledge' | 'action' | 'achievement' | 'follow_up' | 'bonus';
  sourceType: string;
  description: string | null;
  createdAt: string;
}

/** Status simplificado de um desafio para a interface. */
/** Estado do desafio para a interface (catálogo + desafio do usuário). */
export type ChallengeStatus =
  | 'locked'
  | 'available'
  | 'accepted'
  | 'in_progress'
  | 'waiting_follow_up'
  | 'completed'
  | 'expired';
