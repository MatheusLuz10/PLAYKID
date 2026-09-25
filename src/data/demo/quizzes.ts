/**
 * Quizzes do MODO DEMONSTRAÇÃO, lidos da mesma fonte que gera o SQL
 * (content/quizzes.json → supabase/migrations/17_quiz_content.sql).
 * O gabarito (demoAnswerKey) é usado apenas pelo backend local — nunca pelas telas.
 */
import content from '../../../content/quizzes.json';
import lessonsContent from '../../../content/lessons.json';
import type { Question, Quiz } from '../../models';

interface SourceOption {
  id?: string;
  text: string;
  correct: boolean;
  feedback: string;
}
interface SourceQuestion {
  id?: string;
  topic: string;
  question: string;
  explanation: string;
  points?: number;
  options: SourceOption[];
}
interface SourceQuiz {
  lesson: string;
  id?: string;
  title: string;
  description: string;
  passing_score: number;
  xp_reward: number;
  improvement_xp_reward?: number;
  attempts_allowed: number | null;
  questions: SourceQuestion[];
}

// Mesmas regras de ID de scripts/build-content-sql.mjs.
const pad = (n: number, size: number) => String(n).padStart(size, '0');
const quizId = (ln: number) => `30000000-0000-4000-8000-${pad(ln, 12)}`;
const questionId = (ln: number, qn: number) => `31000000-0000-4000-8000-${pad(ln, 3)}000000${pad(qn, 3)}`;
const optionId = (ln: number, qn: number, on: number) => `32000000-0000-4000-8000-${pad(ln, 3)}000${pad(qn, 3)}${pad(on, 3)}`;

const lessons = (lessonsContent as { lessons: { id: string; slug: string }[] }).lessons;
const lessonIndex = new Map(lessons.map((l, i) => [l.slug, { id: l.id, number: i + 1 }]));

export const demoQuizzes: Quiz[] = [];
export const demoQuizQuestions: Record<string, Question[]> = {};
export const demoAnswerKey: Record<string, { correctOptionId: string; explanation: string; feedback: Record<string, string> }> = {};

for (const quiz of (content as { quizzes: SourceQuiz[] }).quizzes) {
  const lesson = lessonIndex.get(quiz.lesson);
  if (!lesson) continue;
  const id = quiz.id ?? quizId(lesson.number);
  const questions: Question[] = quiz.questions.map((q, qi) => {
    const qid = q.id ?? questionId(lesson.number, qi + 1);
    const options = q.options.map((o, oi) => ({ ...o, id: o.id ?? optionId(lesson.number, qi + 1, oi + 1) }));
    demoAnswerKey[qid] = {
      correctOptionId: options.find((o) => o.correct)!.id,
      explanation: q.explanation,
      feedback: Object.fromEntries(options.map((o) => [o.id, o.feedback])),
    };
    return {
      id: qid,
      prompt: q.question,
      topic: q.topic,
      type: 'single_choice',
      points: q.points ?? 1,
      options: options.map((o) => ({ id: o.id, text: o.text })),
    };
  });
  demoQuizQuestions[id] = questions;
  demoQuizzes.push({
    id,
    lessonId: lesson.id,
    title: quiz.title,
    description: quiz.description,
    passingScore: quiz.passing_score,
    xpReward: quiz.xp_reward,
    improvementXpReward: quiz.improvement_xp_reward ?? 0,
    attemptsAllowed: quiz.attempts_allowed,
    questionCount: questions.length,
  });
}
