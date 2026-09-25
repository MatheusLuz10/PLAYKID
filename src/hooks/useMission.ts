import { useParams } from 'react-router-dom';
import { findChallengeBySlug, findLesson, findQuizForLesson } from '../logic/catalog';
import { getChallengeState } from '../logic/challenges';
import { getCurrentStep } from '../logic/mission';
import { useGame } from '../state/GameContext';

/** Reúne tudo o que uma tela da missão precisa a partir do :challengeSlug da rota. */
export function useMission() {
  const { challengeSlug = '' } = useParams();
  const game = useGame();
  const challenge = findChallengeBySlug(game.content, challengeSlug);
  if (!challenge) return null;
  const lesson = findLesson(game.content, challenge.lessonId);
  if (!lesson) return null;
  const quiz = findQuizForLesson(game.content, lesson.id);

  const { player } = game;
  return {
    ...game,
    challenge,
    lesson,
    quiz,
    userChallenge: player.challenges[challenge.id],
    quizSummary: quiz ? player.quizzes[quiz.id] : undefined,
    currentStep: getCurrentStep(challenge, quiz, player),
    status: getChallengeState(game.content, challenge, player),
  };
}

export type MissionContext = NonNullable<ReturnType<typeof useMission>>;
