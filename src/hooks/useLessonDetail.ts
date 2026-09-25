import { useCallback, useEffect, useState } from 'react';
import type { LessonDetail } from '../models';
import type { AppError } from '../services';
import { useGame } from '../state/GameContext';

type LessonDetailState =
  | { status: 'loading' }
  | { status: 'error'; error: AppError }
  | { status: 'ready'; detail: LessonDetail };

/** Carrega as seções de uma aula sob demanda (com cache no GameContext). */
export function useLessonDetail(lessonId: string) {
  const { actions } = useGame();
  const { loadLessonDetail } = actions;
  const [state, setState] = useState<LessonDetailState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    loadLessonDetail(lessonId)
      .then((detail) => active && setState({ status: 'ready', detail }))
      .catch((error: AppError) => active && setState({ status: 'error', error }));
    return () => {
      active = false;
    };
  }, [lessonId, loadLessonDetail, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
