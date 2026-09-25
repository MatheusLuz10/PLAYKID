import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { lessonLevelLabels } from '../../logic/learning';
import type { Lesson, Question, Quiz, QuizAttemptRecord } from '../../models';
import type { ActiveQuizAttempt, AnswerFeedback, QuizAttemptResult, QuizAttemptStart } from '../../services';
import { useGame } from '../../state/GameContext';
import { ProgressBar } from '../ui/ProgressBar';
import { LoadingMessage, StateMessage } from '../ui/StateMessage';
import { AttemptHistory } from './AttemptHistory';
import { QuestionCard } from './QuestionCard';
import { QuizResult } from './QuizResult';

interface QuizPlayerProps {
  lesson: Lesson;
  quiz: Quiz;
  /** Para onde "Revisar conteúdo" leva (aula na área Aprender ou na missão). */
  reviewHref: string;
}

/**
 * Quiz completo: bloqueio → apresentação → perguntas → feedback → resultado.
 * O navegador nunca recebe o gabarito: cada correção e o resultado vêm do servidor.
 */
export function QuizPlayer({ lesson, quiz, reviewHref }: QuizPlayerProps) {
  const { player } = useGame();
  if (player.lessons[lesson.id]?.status !== 'completed') {
    return (
      <StateMessage icon="🔒" title="Quiz bloqueado" text="Conclua o conteúdo para testar seus conhecimentos." role="alert">
        <Link to={reviewHref} className="btn btn--primary">
          Ir para o conteúdo
        </Link>
      </StateMessage>
    );
  }
  return <QuizSession key={quiz.id} lesson={lesson} quiz={quiz} reviewHref={reviewHref} />;
}

type Phase = 'loading' | 'error' | 'intro' | 'question' | 'finishing' | 'result';

function QuizSession({ lesson, quiz, reviewHref }: QuizPlayerProps) {
  const { player, actions } = useGame();
  const { loadQuizQuestions, getActiveQuizAttempt, listQuizAttempts } = actions;

  const [phase, setPhase] = useState<Phase>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [active, setActive] = useState<ActiveQuizAttempt | null>(null);
  const [history, setHistory] = useState<QuizAttemptRecord[]>([]);

  const [attempt, setAttempt] = useState<QuizAttemptStart | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerFeedback>>({});
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<QuizAttemptResult | null>(null);

  const focusRef = useRef<HTMLDivElement>(null);
  const navigated = useRef(false);

  // Carrega só o necessário: perguntas (sem gabarito), tentativa em andamento e histórico.
  useEffect(() => {
    let alive = true;
    setPhase('loading');
    Promise.all([loadQuizQuestions(quiz.id), getActiveQuizAttempt(quiz.id), listQuizAttempts(quiz.id)])
      .then(([qs, act, list]) => {
        if (!alive) return;
        setQuestions(qs);
        setActive(act);
        setHistory(list ?? []);
        setPhase('intro');
      })
      .catch((err: Error) => {
        if (!alive) return;
        setLoadError(err.message);
        setPhase('error');
      });
    return () => {
      alive = false;
    };
  }, [quiz.id, reload, loadQuizQuestions, getActiveQuizAttempt, listQuizAttempts]);

  // Acessibilidade: ao trocar de pergunta/fase, o foco acompanha o conteúdo.
  useEffect(() => {
    if (!navigated.current) return;
    window.scrollTo({ top: 0 });
    if (phase === 'result') document.getElementById('quiz-result-title')?.focus();
    else focusRef.current?.focus();
  }, [index, phase]);

  const summary = player.quizzes[quiz.id];
  const completedAttempts = history.filter((h) => h.status === 'completed').length;
  const canStart = quiz.attemptsAllowed === null || completedAttempts < quiz.attemptsAllowed;
  const total = questions.length;
  const activeAnswered = active?.answers.length ?? 0;

  const begin = async (resume: boolean) => {
    navigated.current = true;
    setResult(null);
    if (resume && active) {
      const map = Object.fromEntries(active.answers.map((a) => [a.questionId, a]));
      const firstOpen = questions.findIndex((q) => !map[q.id]);
      setAttempt({ attemptId: active.attemptId, attemptNumber: active.attemptNumber });
      setAnswers(map);
      setIndex(firstOpen === -1 ? total - 1 : firstOpen);
      setSelected(null);
      setPhase('question');
      return;
    }
    setSaving(true);
    const started = await actions.startQuizAttempt(quiz.id);
    setSaving(false);
    if (!started) return;
    setAttempt(started);
    setActive(null);
    setAnswers({});
    setIndex(0);
    setSelected(null);
    setPhase('question');
  };

  const question = questions[index];
  const feedback = question ? answers[question.id] : undefined;
  const answeredCount = Object.keys(answers).length;
  const percent = total ? Math.round((answeredCount / total) * 100) : 0;
  const isLast = index === total - 1;

  const confirm = async () => {
    if (!attempt || !selected || !question) return;
    setSaving(true);
    const fb = await actions.answerQuestion(attempt.attemptId, question.id, selected);
    setSaving(false);
    if (fb) setAnswers((prev) => ({ ...prev, [question.id]: fb }));
  };

  const next = async () => {
    navigated.current = true;
    if (!isLast) {
      setIndex((i) => i + 1);
      setSelected(null);
      return;
    }
    setPhase('finishing');
    const r = await actions.finishQuizAttempt(attempt!.attemptId);
    if (!r) {
      setPhase('question');
      return;
    }
    setResult(r);
    setHistory((await listQuizAttempts(quiz.id)) ?? history);
    setPhase('result');
  };

  // ---------- Estados ----------
  if (phase === 'loading') return <LoadingMessage text="Carregando pergunta…" />;

  if (phase === 'error') {
    return (
      <StateMessage icon="🍂" title="Não conseguimos carregar esta pergunta." text={loadError ?? undefined} role="alert">
        <button type="button" className="btn btn--primary" onClick={() => setReload((n) => n + 1)}>
          Tentar novamente
        </button>
      </StateMessage>
    );
  }

  if (phase === 'finishing') return <LoadingMessage text="Calculando seu resultado…" />;

  if (phase === 'result' && result) {
    return (
      <div className="stack">
        <QuizResult
          lesson={lesson}
          questions={questions}
          result={result}
          reviewHref={reviewHref}
          canRetry={canStart}
          retrying={saving}
          onRetry={() => void begin(false)}
        />
        <AttemptHistory attempts={history} />
      </div>
    );
  }

  if (phase === 'intro') {
    const xpText = !summary?.passed
      ? `+${quiz.xpReward} XP`
      : quiz.improvementXpReward > 0
        ? `+${quiz.improvementXpReward} XP se superar sua melhor nota`
        : 'Já recebido';
    return (
      <div className="stack">
        <section className="card quiz-intro" aria-labelledby="quiz-intro-title">
          <p className="eyebrow">🧠 Quiz disponível</p>
          <h1 id="quiz-intro-title" className="page-title">
            Teste seu conhecimento
          </h1>
          <p className="quiz-intro__lesson">{lesson.title}</p>
          <dl className="facts quiz-facts">
            <div>
              <dt>Perguntas</dt>
              <dd>{total}</dd>
            </div>
            <div>
              <dt>Dificuldade</dt>
              <dd>{lessonLevelLabels[lesson.difficulty]}</dd>
            </div>
            <div>
              <dt>XP</dt>
              <dd>{xpText}</dd>
            </div>
            <div>
              <dt>Tentativa</dt>
              <dd>
                {active ? active.attemptNumber : history.length + 1}
                {quiz.attemptsAllowed !== null && ` de ${quiz.attemptsAllowed}`}
              </dd>
            </div>
            <div>
              <dt>Aprovação</dt>
              <dd>{quiz.passingScore}%</dd>
            </div>
          </dl>
          {summary?.passed && (
            <p className="status-pill status-pill--done">✅ Aprovado · melhor resultado {summary.score}%</p>
          )}

          {active && activeAnswered < total ? (
            <div className="quiz-resume">
              <p>
                📍 Você começou a tentativa {active.attemptNumber} e respondeu {activeAnswered} de {total} perguntas. Quer
                continuar?
              </p>
              <div className="actions">
                <button type="button" className="btn btn--primary" onClick={() => void begin(true)}>
                  Continuar tentativa
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => void begin(false)} disabled={saving || !canStart}>
                  Começar do zero
                </button>
              </div>
            </div>
          ) : canStart ? (
            <button type="button" className="btn btn--primary btn--lg" onClick={() => void begin(false)} disabled={saving}>
              {saving ? 'Preparando…' : summary?.passed ? 'Refazer quiz' : 'Começar'}
            </button>
          ) : (
            <p className="muted">Você usou todas as tentativas deste quiz.</p>
          )}
        </section>
        <AttemptHistory attempts={history} />
      </div>
    );
  }

  // ---------- Pergunta ----------
  if (!question) return null;
  return (
    <div className="stack quiz-play">
      <div className="quiz-progress" ref={focusRef} tabIndex={-1} aria-live="polite">
        <div className="quiz-progress__row">
          <strong>
            Pergunta {index + 1} de {total}
          </strong>
          <span>{percent}% respondido</span>
        </div>
        <ProgressBar
          value={answeredCount}
          max={total}
          label="Progresso do quiz"
          valueText={`${answeredCount} de ${total} perguntas respondidas`}
          size="sm"
        />
      </div>

      <div className="card">
        <QuestionCard
          key={question.id}
          question={question}
          selectedId={feedback?.selectedOptionId ?? selected}
          correctOptionId={feedback?.correctOptionId ?? null}
          onSelect={setSelected}
          disabled={saving}
        />
      </div>

      {saving && !feedback && <LoadingMessage text="Registrando sua resposta…" />}

      {feedback && (
        <div className={`feedback ${feedback.isCorrect ? 'feedback--right' : 'feedback--learn'}`} role="status">
          <strong>{feedback.isCorrect ? '✅ Resposta correta' : '❌ Resposta incorreta'}</strong>
          {feedback.optionFeedback && <p>{feedback.optionFeedback}</p>}
          {feedback.explanation && <p className="feedback__why">💡 {feedback.explanation}</p>}
        </div>
      )}

      <div className="actions actions--end">
        {feedback ? (
          <button type="button" className="btn btn--primary btn--lg" onClick={() => void next()}>
            {isLast ? 'Ver resultado' : 'Continuar →'}
          </button>
        ) : (
          <button type="button" className="btn btn--primary btn--lg" onClick={() => void confirm()} disabled={!selected || saving}>
            Confirmar resposta
          </button>
        )}
      </div>
    </div>
  );
}
