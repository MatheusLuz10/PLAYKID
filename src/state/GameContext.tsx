import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { visibleCatalog } from '../logic/catalog';
import { diffProgress } from '../logic/gamification';
import type { Achievement, ContentCatalog, Level, LessonDetail, PlayerState, Question, QuizAttemptRecord, XpTransaction } from '../models';
import {
  backend,
  AppError,
  toAppError,
  type ActionResult,
  type ActiveQuizAttempt,
  type AnswerFeedback,
  type ChallengeCompletion,
  type EvidenceInput,
  type Page,
  type ProfileInput,
  type QuizAttemptResult,
  type QuizAttemptStart,
  type RevealResult,
  type StepResult,
} from '../services';

export interface Notice {
  id: string;
  icon: string;
  title: string;
  text?: string;
  tone: 'success' | 'error';
}

/** Subida de nível e/ou conquistas desbloqueadas na última ação (tela de celebração). */
export interface Celebration {
  id: number;
  /** Todos os níveis alcançados de uma vez (uma única tela, mesmo se forem vários). */
  levels: Level[];
  achievements: Achievement[];
}

export interface GameActions {
  refresh(): Promise<void>;
  /** Lança AppError para o formulário exibir a mensagem. */
  updateProfile(input: ProfileInput): Promise<void>;
  /** Seções da aula, com cache em memória (uma consulta por aula por sessão). */
  loadLessonDetail(lessonId: string): Promise<LessonDetail>;
  searchLessons(query: string): Promise<string[] | null>;
  /** Salva a parte atual da aula e atualiza o progresso local com a resposta do servidor. */
  trackLessonProgress(lessonId: string, sectionIndex: number): Promise<void>;
  completeLesson(lessonId: string): Promise<ActionResult | null>;
  toggleFavorite(lessonId: string): Promise<void>;
  /** Perguntas do quiz (sem gabarito), com cache em memória. Lança AppError. */
  loadQuizQuestions(quizId: string): Promise<Question[]>;
  getActiveQuizAttempt(quizId: string): Promise<ActiveQuizAttempt | null>;
  listQuizAttempts(quizId?: string): Promise<(QuizAttemptRecord & { quizId: string })[] | null>;
  startQuizAttempt(quizId: string): Promise<QuizAttemptStart | null>;
  answerQuestion(attemptId: string, questionId: string, optionId: string): Promise<AnswerFeedback | null>;
  finishQuizAttempt(attemptId: string): Promise<QuizAttemptResult | null>;
  acceptChallenge(challengeId: string): Promise<boolean>;
  /** Etapa do checklist (foto/observação quando exigido). Progresso vem do servidor. */
  completeChallengeStep(userChallengeId: string, challengeId: string, stepId: string, input: EvidenceInput): Promise<StepResult | null>;
  completeFollowup(followupId: string, challengeId: string, input: EvidenceInput): Promise<boolean>;
  /** Idempotente: cliques repetidos não duplicam a recompensa. */
  completeChallenge(userChallengeId: string, challengeId: string): Promise<boolean>;
  cancelChallenge(userChallengeId: string): Promise<boolean>;
  revealWorldItems(): Promise<RevealResult | null>;
  listXpHistory(page: number, pageSize: number): Promise<Page<XpTransaction> | null>;
  getEvidenceImageUrl(path: string): Promise<string | null>;
  resetDemo?(): Promise<void>;
  completeDemo?(): Promise<void>;
  dismissNotice(id: string): void;
  dismissCelebration(): void;
  /** Recarrega os conteúdos (ex.: depois de o admin ativar/desativar algo). */
  reloadContent(): Promise<void>;
  /** Exclui a conta e todos os dados do jogador. Lança AppError. */
  deleteAccount(): Promise<void>;
}

interface GameContextValue {
  mode: 'demo' | 'supabase';
  content: ContentCatalog;
  player: PlayerState;
  notices: Notice[];
  /** Resultado da última conclusão de desafio (exibido na tela de recompensa). */
  lastCompletion: (ChallengeCompletion & { challengeId: string }) | null;
  celebration: Celebration | null;
  actions: GameActions;
}

const GameContext = createContext<GameContextValue | null>(null);
const MAX_NOTICES = 2;
let noticeSeq = 0;

function notice(tone: Notice['tone'], icon: string, title: string, text?: string): Notice {
  noticeSeq += 1;
  return { id: `n${Date.now()}-${noticeSeq}`, tone, icon, title, text };
}

let celebrationSeq = 0;

interface SettleOptions {
  /** Mostra "+XP" com este texto (quando a tela da ação não mostra o XP). */
  xpLabel?: string;
  /** false: a tela de recompensa já mostra as conquistas; celebra só o nível. */
  celebrateAchievements?: boolean;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; content: ContentCatalog; player: PlayerState };

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  // Leitura síncrona do estado atual dentro das ações (os updaters do setState rodam depois).
  const stateRef = useRef(state);
  stateRef.current = state;
  const [notices, setNotices] = useState<Notice[]>([]);
  const [lastCompletion, setLastCompletion] = useState<GameContextValue['lastCompletion']>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const contentRef = useRef<ContentCatalog | null>(null);
  // Cache das aulas abertas (e das requisições em andamento, para não repetir consultas).
  const lessonCache = useRef(new Map<string, Promise<LessonDetail>>());
  const quizCache = useRef(new Map<string, Promise<Question[]>>());

  /** Altera o estado do jogador localmente (sem recarregar tudo do servidor). */
  const patchPlayer = useCallback((fn: (player: PlayerState) => PlayerState) => {
    setState((prev) => (prev.status === 'ready' ? { ...prev, player: fn(prev.player) } : prev));
  }, []);

  const push = useCallback((items: Notice[]) => {
    if (items.length) setNotices((prev) => [...prev, ...items].slice(-MAX_NOTICES));
  }, []);

  // Conteúdo: carregado uma única vez por sessão. Jogador: uma chamada (get_player_state).
  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const [content, player] = await Promise.all([
        contentRef.current ? Promise.resolve(contentRef.current) : backend.loadCatalog(),
        backend.loadPlayer(),
      ]);
      contentRef.current = content;
      setState({ status: 'ready', content, player });
    } catch (err) {
      const error = toAppError(err, 'load_progress');
      setState({ status: 'error', message: error.code === 'network' ? error.message : 'Não foi possível carregar seu progresso.' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    try {
      const player = await backend.loadPlayer();
      setState((prev) => (prev.status === 'ready' ? { ...prev, player } : prev));
    } catch (err) {
      push([notice('error', '⚠️', toAppError(err, 'load_progress').message)]);
    }
  }, [push]);

  const currentPlayer = () => (stateRef.current.status === 'ready' ? stateRef.current.player : null);

  /**
   * Depois de uma ação: recarrega o jogador e compara com o estado anterior
   * (XP, nível e conquistas decididos pelo servidor) para avisar o que mudou.
   */
  const settle = useCallback(
    async (before: PlayerState | null, opts: SettleOptions = {}) => {
      try {
        const player = await backend.loadPlayer();
        const current = stateRef.current;
        setState((prev) => (prev.status === 'ready' ? { ...prev, player } : prev));
        if (!before || current.status !== 'ready') return;
        const change = diffProgress(current.content, before, player);
        if (opts.xpLabel && change.actionXp > 0) push([notice('success', '⭐', `+${change.actionXp} XP`, opts.xpLabel)]);
        const achievements = opts.celebrateAchievements === false ? [] : change.achievements;
        if (change.levels.length || achievements.length) {
          celebrationSeq += 1;
          setCelebration((prev) => ({
            id: celebrationSeq,
            levels: [...(prev?.levels ?? []), ...change.levels],
            achievements: [...(prev?.achievements ?? []), ...achievements],
          }));
        }
      } catch (err) {
        push([notice('error', '⚠️', toAppError(err, 'load_progress').message)]);
      }
    },
    [push],
  );

  /** Executa uma ação do jogo com mensagem amigável em caso de erro. */
  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch (err) {
        push([notice('error', '⚠️', toAppError(err).message)]);
        return null;
      }
    },
    [push],
  );

  const actions = useMemo<GameActions>(
    () => ({
      refresh,
      async updateProfile(input) {
        try {
          await backend.updateProfile(input);
        } catch (err) {
          throw toAppError(err);
        }
        await refresh();
      },
      loadLessonDetail(lessonId) {
        const cached = lessonCache.current.get(lessonId);
        if (cached) return cached;
        const request = backend.loadLessonDetail(lessonId).catch((err) => {
          lessonCache.current.delete(lessonId); // permite "Tentar novamente"
          throw toAppError(err, 'load_lesson');
        });
        lessonCache.current.set(lessonId, request);
        return request;
      },
      searchLessons: (query) => run(() => backend.searchLessons(query)),
      async trackLessonProgress(lessonId, sectionIndex) {
        try {
          const progress = await backend.trackLessonProgress(lessonId, sectionIndex);
          patchPlayer((p) => ({ ...p, lessons: { ...p.lessons, [lessonId]: progress } }));
        } catch (err) {
          const error = toAppError(err);
          const message = error.code === 'unknown' ? new AppError('save_progress').message : error.message;
          push([notice('error', '⚠️', message)]);
        }
      },
      async completeLesson(lessonId) {
        const before = currentPlayer();
        const r = await run(() => backend.completeLesson(lessonId));
        if (!r) return null;
        // O XP aparece no resumo da aula; conquistas e nível, na celebração.
        await settle(before);
        return r;
      },
      async toggleFavorite(lessonId) {
        const current = stateRef.current;
        if (current.status !== 'ready') return;
        const favorite = !current.player.favorites.includes(lessonId);
        // Atualização otimista: a estrela muda na hora e volta se o servidor recusar.
        patchPlayer((p) => ({
          ...p,
          favorites: favorite ? [lessonId, ...p.favorites.filter((id) => id !== lessonId)] : p.favorites.filter((id) => id !== lessonId),
        }));
        try {
          await backend.setFavorite(lessonId, favorite);
        } catch (err) {
          patchPlayer((p) => ({
            ...p,
            favorites: favorite ? p.favorites.filter((id) => id !== lessonId) : [lessonId, ...p.favorites],
          }));
          push([notice('error', '⚠️', toAppError(err).message)]);
        }
      },
      loadQuizQuestions(quizId) {
        const cached = quizCache.current.get(quizId);
        if (cached) return cached;
        const request = backend.loadQuizQuestions(quizId).catch((err) => {
          quizCache.current.delete(quizId); // permite "Tentar novamente"
          throw toAppError(err, 'load_quiz');
        });
        quizCache.current.set(quizId, request);
        return request;
      },
      getActiveQuizAttempt: (quizId) => run(() => backend.getActiveQuizAttempt(quizId)),
      listQuizAttempts: (quizId) => run(() => backend.listQuizAttempts(quizId)),
      startQuizAttempt: (quizId) => run(() => backend.startQuizAttempt(quizId)),
      answerQuestion: (attemptId, questionId, optionId) =>
        run(() => backend.answerQuestion(attemptId, questionId, optionId)),
      async finishQuizAttempt(attemptId) {
        const before = currentPlayer();
        const r = await run(() => backend.finishQuizAttempt(attemptId));
        if (!r) return null;
        // XP e resultado aparecem na tela de resultado; conquistas e nível, na celebração.
        await settle(before);
        return r;
      },
      async acceptChallenge(challengeId) {
        const before = currentPlayer();
        const r = await run(() => backend.acceptChallenge(challengeId));
        if (r === null) return false;
        push([notice('success', '🎯', 'Seu desafio foi salvo.', 'Agora é com você!')]);
        await settle(before, { xpLabel: 'Desafio iniciado' });
        return true;
      },
      async completeChallengeStep(userChallengeId, challengeId, stepId, input) {
        const before = currentPlayer();
        const r = await run(() => backend.completeChallengeStep(userChallengeId, challengeId, stepId, input));
        if (!r) return null;
        const texts: Record<string, string> = {
          waiting_follow_up: 'Checklist concluído! Agora é hora de acompanhar.',
          in_progress: `Progresso: ${r.progressPercentage}%`,
        };
        push([notice('success', '✅', 'Etapa registrada', texts[r.status] ?? undefined)]);
        await settle(before, { xpLabel: 'Etapa concluída' });
        return r;
      },
      async completeFollowup(followupId, challengeId, input) {
        const before = currentPlayer();
        const r = await run(() => backend.completeFollowup(followupId, challengeId, input));
        if (!r) return false;
        await settle(before, { xpLabel: 'Acompanhamento registrado' });
        return true;
      },
      async completeChallenge(userChallengeId, challengeId) {
        const before = currentPlayer();
        const r = await run(() => backend.completeChallenge(userChallengeId));
        if (!r) return false;
        // XP, conquistas e item aparecem na própria tela de recompensa.
        // Clique repetido/atualização: mantém o resultado original (nada foi concedido de novo).
        if (!r.alreadyCompleted) setLastCompletion({ ...r, challengeId });
        await settle(before, { celebrateAchievements: false });
        return true;
      },
      async cancelChallenge(userChallengeId) {
        const r = await run(() => backend.cancelChallenge(userChallengeId));
        if (r === null) return false;
        push([notice('success', '🗂️', 'Desafio encerrado', 'Você pode aceitá-lo de novo quando quiser.')]);
        await refresh();
        return true;
      },
      async revealWorldItems() {
        const before = currentPlayer();
        const r = await run(() => backend.revealWorldItems());
        if (!r) return null;
        if (r.revealed.length) await settle(before);
        return r;
      },
      listXpHistory: (page, pageSize) => run(() => backend.listXpHistory(page, pageSize)),
      getEvidenceImageUrl: (path) => backend.getEvidenceImageUrl(path),
      resetDemo: backend.resetDemo
        ? async () => {
            await backend.resetDemo!();
            setLastCompletion(null);
            setCelebration(null);
            await load();
          }
        : undefined,
      completeDemo: backend.completeDemo
        ? async () => {
            await backend.completeDemo!();
            setLastCompletion(null);
            setCelebration(null);
            await load();
          }
        : undefined,
      dismissNotice: (id) => setNotices((prev) => prev.filter((n) => n.id !== id)),
      dismissCelebration: () => setCelebration(null),
      async reloadContent() {
        try {
          const content = await backend.loadCatalog();
          contentRef.current = content;
          setState((prev) => (prev.status === 'ready' ? { ...prev, content } : prev));
        } catch (err) {
          push([notice('error', '⚠️', toAppError(err, 'load_content').message)]);
        }
      },
      async deleteAccount() {
        try {
          await backend.deleteAccount();
        } catch (err) {
          throw toAppError(err, 'delete_account_failed');
        }
      },
    }),
    [refresh, run, push, load, patchPlayer, settle],
  );

  // Conteúdo desativado some, exceto o que o jogador já tem no histórico.
  const visible = useMemo(
    () => (state.status === 'ready' ? visibleCatalog(state.content, state.player) : null),
    [state],
  );

  if (state.status === 'loading') {
    return (
      <main className="screen-center">
        <span className="big-icon" aria-hidden>
          🌱
        </span>
        <h1 className="sr-only">ECO QUEST</h1>
        <p className="muted" role="status">
          Carregando seu mundo…
        </p>
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className="screen-center">
        <span className="big-icon" aria-hidden>
          🍂
        </span>
        <h1 className="sr-only">ECO QUEST</h1>
        <p role="alert">{state.message}</p>
        <button type="button" className="btn btn--primary" onClick={() => void load()}>
          Tentar novamente
        </button>
      </main>
    );
  }

  return (
    <GameContext.Provider
      value={{
        mode: backend.mode,
        content: visible!,
        player: state.player,
        notices,
        lastCompletion,
        celebration,
        actions,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame deve ser usado dentro de <GameProvider>');
  return ctx;
}
