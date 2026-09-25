import { LessonPlayer } from '../../components/learning/LessonPlayer';
import { useMission } from '../../hooks/useMission';
import { missionPath } from '../../logic/mission';

/** Etapa "Aprender" da missão: a mesma aula da área Aprender, seguida do quiz da missão. */
export function LessonPage() {
  const { lesson, challenge } = useMission()!;
  return <LessonPlayer key={lesson.id} lesson={lesson} quizHref={missionPath(challenge.slug, 'quiz')} />;
}
