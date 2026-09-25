import { QuizPlayer } from '../../components/quiz/QuizPlayer';
import { StateMessage } from '../../components/ui/StateMessage';
import { useMission } from '../../hooks/useMission';
import { missionPath } from '../../logic/mission';

/** Etapa "Quiz" da missão: o mesmo quiz da área Aprender. */
export function QuizPage() {
  const { lesson, quiz, challenge } = useMission()!;
  if (!quiz) {
    return <StateMessage icon="🧠" title="Quiz em preparação" text="As perguntas desta aula ainda estão sendo preparadas." />;
  }
  return <QuizPlayer lesson={lesson} quiz={quiz} reviewHref={missionPath(challenge.slug, 'aprender')} />;
}
