/**
 * Desafios do MODO DEMONSTRAÇÃO, lidos da mesma fonte que gera o SQL
 * (content/challenges.json → supabase/migrations/20_challenge_content.sql).
 */
import content from '../../../content/challenges.json';
import lessonsContent from '../../../content/lessons.json';
import type { Challenge, ChallengeStep, Difficulty, StepType } from '../../models';

interface SourceStep {
  id?: string;
  title: string;
  description: string;
  type: string;
  evidence_kind?: string;
  required?: boolean;
  xp_reward?: number;
  day_offset?: number;
  early_window_days?: number;
  deadline_offset_days?: number;
}
interface SourceChallenge {
  id?: string;
  slug: string;
  lesson: string;
  category: string;
  icon: string;
  title: string;
  description: string;
  why_it_matters: string;
  materials: string[];
  evidence_instructions: string;
  safety_notes: string[];
  difficulty: string;
  deadline_days: number;
  duration_label: string;
  xp_reward: number;
  start_xp_reward?: number;
  requires_evidence: boolean;
  requires_follow_up: boolean;
  steps: SourceStep[];
}

// Mesmas regras de ID de scripts/build-content-sql.mjs.
const pad = (n: number, size: number) => String(n).padStart(size, '0');
const challengeId = (n: number) => `40000000-0000-4000-8000-${pad(n, 12)}`;
const stepId = (n: number, s: number) => `41000000-0000-4000-8000-${pad(n, 3)}000000${pad(s, 3)}`;

export const CATEGORY_IDS: Record<string, string> = {
  natureza: '10000000-0000-4000-8000-000000000001',
  agua: '10000000-0000-4000-8000-000000000002',
  residuos: '10000000-0000-4000-8000-000000000003',
  energia: '10000000-0000-4000-8000-000000000004',
  biodiversidade: '10000000-0000-4000-8000-000000000005',
  comunidade: '10000000-0000-4000-8000-000000000006',
};
const lessonIds = new Map(
  (lessonsContent as { lessons: { id: string; slug: string }[] }).lessons.map((l) => [l.slug, l.id]),
);

export const demoChallenges: Challenge[] = [];

(content as { challenges: SourceChallenge[] }).challenges.forEach((c, ci) => {
  const n = ci + 1;
  const steps: ChallengeStep[] = c.steps.map((s, si) => ({
    id: s.id ?? stepId(n, si + 1),
    type: s.type as StepType,
    title: s.title,
    description: s.description,
    orderIndex: si + 1,
    required: s.required !== false,
    xpReward: s.xp_reward ?? 0,
    dayOffset: s.type === 'follow_up' ? (s.day_offset ?? 0) : null,
    earlyWindowDays: s.early_window_days ?? 2,
    evidenceKind: (s.evidence_kind ?? 'none') as ChallengeStep['evidenceKind'],
    deadlineOffsetDays: s.deadline_offset_days ?? null,
  }));
  demoChallenges.push({
    id: c.id ?? challengeId(n),
    slug: c.slug,
    categoryId: CATEGORY_IDS[c.category],
    lessonId: lessonIds.get(c.lesson)!,
    icon: c.icon,
    title: c.title,
    mission: c.description,
    whyItMatters: c.why_it_matters,
    materials: c.materials,
    evidenceInstructions: c.evidence_instructions,
    durationLabel: c.duration_label,
    instructions: steps.filter((s) => s.type !== 'follow_up').map((s) => s.description ?? ''),
    cares: c.safety_notes,
    difficulty: c.difficulty as Difficulty,
    deadlineDays: c.deadline_days,
    xpReward: c.xp_reward,
    startXpReward: c.start_xp_reward ?? 0,
    requiresEvidence: c.requires_evidence,
    requiresFollowUp: c.requires_follow_up,
    steps,
  });
});
