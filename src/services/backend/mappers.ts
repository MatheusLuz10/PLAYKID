/**
 * Conversão das linhas do banco (snake_case) para os modelos da interface.
 * Tipos "Row" descrevem apenas as colunas que o frontend realmente seleciona.
 */
import type {
  Achievement,
  AchievementCategory,
  AchievementRequirement,
  Category,
  Challenge,
  ChallengeStep,
  ContentCatalog,
  Difficulty,
  Evidence,
  Followup,
  Lesson,
  LessonBlock,
  LessonDetail,
  LessonLevel,
  LessonProgress,
  LessonSection,
  Level,
  PlayerState,
  Profile,
  Question,
  Quiz,
  QuizAttemptRecord,
  QuizSummary,
  StepType,
  UserChallenge,
  UserChallengeStatus,
  WorldArea,
  WorldItem,
  WorldStage,
  WorldStatus,
  WorldUnlockType,
  XpTransaction,
} from '../../models';
import { DEFAULT_AVATAR } from '../../data/avatars';
import type { AchievementUnlock, AnswerFeedback, QuizAttemptResult } from './types';

type Json = any;

const byOrder = <T extends { order_index: number }>(a: T, b: T) => a.order_index - b.order_index;

/** Uma linha por item (instruções e cuidados). */
export function splitLines(text: string | null): string[] {
  return (text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Texto da seção: cada linha é um parágrafo; linhas "- " viram destaques. */
export function parseSectionContent(content: string): { paragraphs: string[]; highlights: string[] } {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  return {
    paragraphs: lines.filter((l) => !l.startsWith('- ')),
    highlights: lines.filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim()),
  };
}

// ---------- Conteúdo ----------

export interface CategoryRow {
  id: string; name: string; slug: string; description: string | null; icon: string | null;
  image_url: string | null; color: string | null; topics: string[] | null; order_index: number;
}
export interface LessonRow {
  id: string; active?: boolean; category_id: string; topic: string | null; title: string; slug: string;
  description: string | null; difficulty: LessonLevel; estimated_minutes: number; xp_reward: number; order_index: number;
  prerequisite_lesson_id: string | null;
  /** Contagem embutida do PostgREST: lesson_sections(count) */
  lesson_sections: { count: number }[];
}
export interface LessonSectionRow {
  id: string; section_type: 'content' | 'fun_fact'; icon: string | null; title: string; content: string;
  image_url: string | null; image_alt: string | null; video_url: string | null; blocks: unknown; order_index: number;
}
export interface QuizRow {
  id: string; active?: boolean; lesson_id: string; title: string; description: string | null; passing_score: number;
  xp_reward: number; improvement_xp_reward: number; attempts_allowed: number | null;
  /** Contagem embutida do PostgREST: quiz_questions(count) — só perguntas ativas (RLS). */
  quiz_questions: { count: number }[];
}
export interface QuestionRow {
  id: string; question: string; topic: string | null; question_type: 'single_choice'; order_index: number; points: number;
  quiz_options: { id: string; option_text: string; order_index: number }[];
}
export interface ChallengeRow {
  id: string; active?: boolean; category_id: string; lesson_id: string; icon: string | null; title: string; slug: string;
  description: string; instructions: string | null; safety_notes: string | null; difficulty: Difficulty;
  deadline_days: number; xp_reward: number; start_xp_reward: number | null; requires_evidence: boolean; requires_follow_up: boolean;
  why_it_matters: string | null; materials: string | null; evidence_instructions: string | null; duration_label: string | null;
  challenge_steps: {
    id: string; title: string; description: string | null; step_type: StepType; order_index: number;
    required: boolean; xp_reward: number; day_offset: number | null; early_window_days: number | null;
    evidence_kind: 'none' | 'photo' | 'text' | null; deadline_offset_days: number | null; active: boolean | null;
  }[];
}
export interface AchievementRow {
  id: string; active?: boolean; name: string; slug: string; description: string | null; icon: string | null; xp_reward: number;
  requirement_type: AchievementRequirement; requirement_value: string; requirement_count: number | null;
  category: AchievementCategory | null; order_index: number | null;
}
export interface LevelRow {
  level_number: number; name: string; xp_required: number; description: string | null; icon: string | null;
}
export interface WorldItemRow {
  id: string; active?: boolean; code: string; name: string; icon: string | null; description: string | null; meaning: string | null;
  area: string | null; category_id: string | null; item_type: string; rarity: string; milestone: boolean;
  unlock_type: WorldUnlockType; unlock_reference: string | null; min_level: number | null; sort_order: number;
  metadata: { slot?: { x: number; y: number } } | null; unlock_title: string | null; unlock_message: string | null;
}
export interface WorldAreaRow {
  code: string; name: string; icon: string | null; description: string | null; sort_order: number;
}
export interface WorldStageRow {
  stage_number: number; name: string; icon: string | null; description: string | null; status: WorldStatus;
  min_items: number; min_challenges: number; min_categories: number;
}

export function mapCategory(r: CategoryRow): Category {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    icon: r.icon ?? '🌿',
    color: r.color ?? 'var(--primary)',
    description: r.description ?? '',
    imageUrl: r.image_url,
    topics: r.topics ?? [],
  };
}

export function mapLesson(r: LessonRow): Lesson {
  return {
    id: r.id,
    active: r.active ?? true,
    slug: r.slug,
    categoryId: r.category_id,
    topic: r.topic,
    title: r.title,
    summary: r.description ?? '',
    difficulty: r.difficulty,
    durationMinutes: r.estimated_minutes,
    xpReward: r.xp_reward,
    orderIndex: r.order_index,
    sectionCount: r.lesson_sections?.[0]?.count ?? 0,
    prerequisiteId: r.prerequisite_lesson_id,
  };
}

/** Converte um bloco do banco, descartando formatos desconhecidos. */
function mapBlock(b: Json): LessonBlock | null {
  switch (b?.type) {
    case 'fun_fact':
      return { type: 'fun_fact', title: b.title ?? 'Você sabia?', text: String(b.text ?? '') };
    case 'observe':
      return {
        type: 'observe',
        prompt: String(b.prompt ?? ''),
        imageUrl: b.image_url ?? null,
        imageAlt: String(b.image_alt ?? ''),
        answer: String(b.answer ?? ''),
      };
    case 'think':
      return { type: 'think', prompt: String(b.prompt ?? '') };
    case 'tip':
      return { type: 'tip', text: String(b.text ?? '') };
    case 'choice':
      return {
        type: 'choice',
        prompt: String(b.prompt ?? ''),
        options: (b.options ?? []).map((o: Json, i: number) => ({
          id: String(o.id ?? i),
          icon: o.icon ?? null,
          label: String(o.label ?? ''),
          isBest: Boolean(o.is_best),
          feedback: String(o.feedback ?? ''),
        })),
      };
    default:
      return null;
  }
}

export function mapLessonDetail(
  lessonId: string,
  sectionRows: LessonSectionRow[],
  summaryPoints: unknown,
  relatedIds: string[],
): LessonDetail {
  const sections: LessonSection[] = [];
  for (const row of [...sectionRows].sort(byOrder)) {
    const blocks = (Array.isArray(row.blocks) ? row.blocks : []).map(mapBlock).filter((b): b is LessonBlock => b !== null);
    // Formato antigo (Etapa 2): "Você sabia?" como seção própria vira bloco da seção anterior.
    if (row.section_type === 'fun_fact' && sections.length) {
      sections[sections.length - 1].blocks.push({
        type: 'fun_fact',
        title: row.title,
        text: parseSectionContent(row.content).paragraphs.join(' '),
      });
      continue;
    }
    sections.push({
      id: row.id,
      icon: row.icon ?? '📘',
      title: row.title,
      ...parseSectionContent(row.content),
      imageUrl: row.image_url,
      imageAlt: row.image_alt,
      videoUrl: row.video_url,
      blocks,
    });
  }
  return {
    lessonId,
    sections,
    summaryPoints: Array.isArray(summaryPoints)
      ? summaryPoints.map((p: Json) => ({ icon: String(p.icon ?? '✅'), text: String(p.text ?? '') }))
      : [],
    relatedIds,
  };
}

export function mapQuiz(r: QuizRow): Quiz {
  return {
    id: r.id,
    active: r.active ?? true,
    lessonId: r.lesson_id,
    title: r.title,
    description: r.description,
    passingScore: r.passing_score,
    xpReward: r.xp_reward,
    improvementXpReward: r.improvement_xp_reward ?? 0,
    attemptsAllowed: r.attempts_allowed,
    questionCount: r.quiz_questions?.[0]?.count ?? 0,
  };
}

export function mapQuestions(rows: QuestionRow[]): Question[] {
  return [...rows].sort(byOrder).map((q) => ({
    id: q.id,
    prompt: q.question,
    topic: q.topic,
    type: q.question_type ?? 'single_choice',
    points: q.points,
    options: [...q.quiz_options].sort(byOrder).map((o) => ({ id: o.id, text: o.option_text })),
  }));
}

export function mapAnswerFeedback(r: Json, fallback: { questionId?: string; optionId?: string } = {}): AnswerFeedback {
  return {
    questionId: r.question_id ?? fallback.questionId,
    isCorrect: Boolean(r.is_correct),
    selectedOptionId: r.selected_option_id ?? fallback.optionId,
    correctOptionId: r.correct_option_id,
    explanation: r.explanation ?? null,
    optionFeedback: r.option_explanation ?? null,
  };
}

export function mapQuizResult(r: Json): QuizAttemptResult {
  return {
    attemptId: r.attempt_id,
    attemptNumber: r.attempt_number,
    score: r.score,
    correctAnswers: r.correct_answers,
    incorrectAnswers: r.incorrect_answers,
    totalQuestions: r.total_questions,
    pointsEarned: r.points_earned,
    pointsTotal: r.points_total,
    passed: r.passed,
    passingScore: r.passing_score,
    firstPass: Boolean(r.first_pass),
    xpAwarded: r.xp_awarded,
    review: (r.review ?? []).map((x: Json) => mapAnswerFeedback(x)),
    challengeUnlocked: r.challenge_unlocked ?? null,
    achievements: mapAchievementUnlocks(r.achievements),
  };
}

export function mapAttemptRecord(r: Json): QuizAttemptRecord & { quizId: string } {
  return {
    id: r.id,
    quizId: r.quiz_id,
    number: r.attempt_number,
    status: r.status,
    score: r.score,
    correctAnswers: r.correct_answers,
    totalQuestions: r.total_questions,
    passed: r.passed,
    startedAt: r.started_at,
    completedAt: r.completed_at,
  };
}

export function mapChallenge(r: ChallengeRow): Challenge {
  const steps: ChallengeStep[] = [...(r.challenge_steps ?? [])].filter((s) => s.active !== false).sort(byOrder).map((s) => ({
    id: s.id,
    type: s.step_type,
    title: s.title,
    description: s.description,
    orderIndex: s.order_index,
    required: s.required,
    xpReward: s.xp_reward,
    dayOffset: s.day_offset,
    earlyWindowDays: s.early_window_days ?? 0,
    evidenceKind: s.evidence_kind ?? 'none',
    deadlineOffsetDays: s.deadline_offset_days ?? null,
  }));
  return {
    id: r.id,
    active: r.active ?? true,
    slug: r.slug,
    categoryId: r.category_id,
    lessonId: r.lesson_id,
    icon: r.icon ?? '🎯',
    title: r.title,
    mission: r.description,
    whyItMatters: r.why_it_matters ?? null,
    materials: splitLines(r.materials ?? null),
    evidenceInstructions: r.evidence_instructions ?? null,
    durationLabel: r.duration_label ?? null,
    instructions: splitLines(r.instructions),
    cares: splitLines(r.safety_notes),
    difficulty: r.difficulty,
    deadlineDays: r.deadline_days,
    xpReward: r.xp_reward,
    startXpReward: r.start_xp_reward ?? 0,
    requiresEvidence: r.requires_evidence,
    requiresFollowUp: r.requires_follow_up,
    steps,
  };
}

export function mapAchievement(r: AchievementRow): Achievement {
  return {
    id: r.id,
    active: r.active ?? true,
    slug: r.slug,
    icon: r.icon ?? '🏆',
    title: r.name,
    description: r.description ?? '',
    xpReward: r.xp_reward,
    category: r.category ?? 'special',
    requirementType: r.requirement_type,
    requirementValue: r.requirement_value ?? '',
    requirementCount: r.requirement_count ?? 1,
    order: r.order_index ?? 0,
  };
}

export function mapLevel(r: LevelRow): Level {
  return {
    number: r.level_number,
    name: r.name,
    icon: r.icon ?? '🌱',
    xpRequired: r.xp_required,
    description: r.description,
  };
}

export function mapWorldItem(r: WorldItemRow): WorldItem {
  return {
    id: r.id,
    active: r.active ?? true,
    code: r.code,
    name: r.name,
    icon: r.icon ?? '🌿',
    description: r.description,
    meaning: r.meaning,
    area: r.area ?? 'natural',
    categoryId: r.category_id,
    itemType: r.item_type,
    rarity: r.rarity,
    milestone: r.milestone,
    unlockType: r.unlock_type,
    unlockReference: r.unlock_reference,
    minLevel: r.min_level,
    order: r.sort_order,
    slot: r.metadata?.slot ?? null,
    unlockTitle: r.unlock_title,
    unlockMessage: r.unlock_message,
  };
}

export const mapWorldArea = (r: WorldAreaRow): WorldArea => ({
  code: r.code,
  name: r.name,
  icon: r.icon ?? '🌿',
  description: r.description,
});

export const mapWorldStage = (r: WorldStageRow): WorldStage => ({
  number: r.stage_number,
  name: r.name,
  icon: r.icon ?? '🌱',
  description: r.description,
  status: r.status,
  minItems: r.min_items,
  minChallenges: r.min_challenges,
  minCategories: r.min_categories,
});

export function buildCatalog(parts: {
  categories: CategoryRow[];
  lessons: LessonRow[];
  quizzes: QuizRow[];
  challenges: ChallengeRow[];
  achievements: AchievementRow[];
  levels: LevelRow[];
  worldItems: WorldItemRow[];
  worldAreas: WorldAreaRow[];
  worldStages: WorldStageRow[];
}): ContentCatalog {
  return {
    categories: [...parts.categories].sort(byOrder).map(mapCategory),
    lessons: [...parts.lessons].sort(byOrder).map(mapLesson),
    quizzes: parts.quizzes.map(mapQuiz),
    challenges: parts.challenges.map(mapChallenge),
    achievements: parts.achievements.map(mapAchievement).sort((a, b) => a.order - b.order),
    levels: parts.levels.map(mapLevel).sort((a, b) => a.number - b.number),
    worldItems: parts.worldItems.map(mapWorldItem).sort((a, b) => a.order - b.order),
    worldAreas: [...parts.worldAreas].sort((a, b) => a.sort_order - b.sort_order).map(mapWorldArea),
    worldStages: parts.worldStages.map(mapWorldStage).sort((a, b) => a.number - b.number),
  };
}

// ---------- Jogador (resultado de get_player_state) ----------


export function mapProfile(p: Json): Profile {
  return {
    id: p.id,
    userId: p.user_id,
    username: p.username,
    displayName: p.display_name,
    avatar: p.avatar_emoji ?? DEFAULT_AVATAR,
    avatarUrl: p.avatar_url ?? null,
    role: p.role,
    level: p.level,
    totalXp: p.total_xp,
    knowledgeXp: p.knowledge_xp,
    actionXp: p.action_xp,
    achievementXp: p.achievement_xp ?? 0,
    bonusXp: p.bonus_xp ?? 0,
    createdAt: p.created_at,
  };
}

function mapEvidence(e: Json): Evidence {
  return {
    id: e.id,
    stepId: e.challenge_step_id ?? null,
    followupId: e.followup_id,
    fileName: e.file_name ?? null,
    mimeType: e.mime_type ?? null,
    fileSize: e.file_size === null || e.file_size === undefined ? null : Number(e.file_size),
    uploadedAt: e.uploaded_at ?? null,
    type: e.evidence_type,
    filePath: e.file_url,
    thumbnailPath: e.thumbnail_url,
    description: e.description,
    capturedAt: e.captured_at,
    status: e.status,
    createdAt: e.created_at,
  };
}

function mapFollowup(f: Json): Followup {
  return {
    id: f.id,
    stepId: f.challenge_step_id,
    title: f.title,
    description: f.description,
    scheduledFor: f.scheduled_for,
    completedAt: f.completed_at,
    status: f.status,
    evidenceRequired: f.evidence_required,
  };
}

function mapUserChallenge(c: Json): UserChallenge {
  return {
    id: c.id,
    challengeId: c.challenge_id,
    status: c.status as UserChallengeStatus,
    acceptedAt: c.accepted_at,
    deadlineAt: c.deadline_at,
    startedAt: c.started_at,
    completedAt: c.completed_at,
    progressPercentage: c.progress_percentage,
    steps: Object.fromEntries(
      (c.steps ?? []).map((s: Json) => [
        s.challenge_step_id,
        { status: s.status, completedAt: s.completed_at ?? null, notes: s.notes ?? null },
      ]),
    ),
    followups: (c.followups ?? []).map(mapFollowup),
    evidence: (c.evidence ?? []).map(mapEvidence),
  };
}

export function mapPlayerState(s: Json): PlayerState {
  const lessons: Record<string, LessonProgress> = {};
  for (const l of s.lessons ?? []) {
    lessons[l.lesson_id] = mapLessonProgress(l);
  }
  const quizzes: Record<string, QuizSummary> = {};
  for (const q of s.quizzes ?? []) {
    quizzes[q.quiz_id] = {
      quizId: q.quiz_id,
      score: q.score,
      correctAnswers: q.correct_answers,
      totalQuestions: q.total_questions,
      passed: q.passed,
      attempts: q.attempts,
      completedAt: q.completed_at,
    };
  }
  const challenges: Record<string, UserChallenge> = {};
  for (const c of s.challenges ?? []) challenges[c.challenge_id] = mapUserChallenge(c);

  return {
    clockOffsetMs: s.server_time ? new Date(s.server_time).getTime() - Date.now() : 0,
    profile: mapProfile(s.profile),
    lessons,
    favorites: (s.favorites ?? []) as string[],
    quizzes,
    challenges,
    achievements: (s.achievements ?? []).map((a: Json) => ({
      achievementId: a.achievement_id,
      unlockedAt: a.unlocked_at,
    })),
    world: {
      id: s.world?.id ?? '',
      name: s.world?.name ?? 'Meu Primeiro Ecossistema',
      description: s.world?.description ?? null,
      stage: s.world?.stage ?? 1,
      status: s.world?.status ?? 'empty',
      progress: s.world?.progress ?? 0,
      items: (s.world?.items ?? []).map((i: Json) => ({
        id: i.id,
        worldItemId: i.world_item_id,
        quantity: i.quantity,
        x: i.position_x === null ? null : Number(i.position_x),
        y: i.position_y === null ? null : Number(i.position_y),
        rotation: Number(i.rotation ?? 0),
        revealed: Boolean(i.metadata?.revealed),
        unlockedAt: i.unlocked_at,
        sourceType: i.source_type ?? 'challenge',
        sourceId: i.source_id ?? null,
      })),
      stageHistory: (s.world?.stage_history ?? []).map((h: Json) => ({ stage: h.stage, reachedAt: h.reached_at })),
    },
  };
}

export function mapLessonProgress(l: Json): LessonProgress {
  return {
    lessonId: l.lesson_id,
    status: l.status,
    progressPercentage: l.progress_percentage,
    lastSectionIndex: l.last_section_index ?? 0,
    lastAccessedAt: l.last_accessed_at ?? null,
    completedAt: l.completed_at,
  };
}

export function mapAchievementUnlocks(list: Json): AchievementUnlock[] {
  return (list ?? []).map((a: Json) => ({ id: a.id, slug: a.slug, name: a.name, icon: a.icon }));
}

export function mapXpTransaction(t: Json): XpTransaction {
  return {
    id: t.id,
    amount: t.amount,
    type: t.xp_type,
    sourceType: t.source_type,
    description: t.description,
    createdAt: t.created_at,
  };
}
