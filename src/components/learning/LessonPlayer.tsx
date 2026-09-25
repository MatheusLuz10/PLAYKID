import { useEffect, useRef, useState } from 'react';
import { useLessonDetail } from '../../hooks/useLessonDetail';
import { findCategory } from '../../logic/catalog';
import { lessonLevelLabels } from '../../logic/learning';
import type { Lesson, LessonDetail } from '../../models';
import type { ActionResult } from '../../services';
import { useGame } from '../../state/GameContext';
import { ProgressBar } from '../ui/ProgressBar';
import { LoadingMessage, StateMessage } from '../ui/StateMessage';
import { LessonBlocks } from './blocks/LessonBlocks';
import { FavoriteButton } from './FavoriteButton';
import { LessonSummary } from './LessonSummary';
import { safeImageSrc } from '../../logic/safeUrl';

interface LessonPlayerProps {
  lesson: Lesson;
  /** Destino do botão "Fazer quiz" depois da conclusão. */
  quizHref: string;
}

/** Aula em partes: carrega as seções sob demanda e mostra estados de carregamento/erro. */
export function LessonPlayer({ lesson, quizHref }: LessonPlayerProps) {
  const detail = useLessonDetail(lesson.id);

  if (detail.status === 'loading') return <LoadingMessage text="Carregando a aula…" />;
  if (detail.status === 'error') {
    return (
      <StateMessage icon="🍂" title="Não conseguimos carregar este conteúdo." text={detail.error.message} role="alert">
        <button type="button" className="btn btn--primary" onClick={detail.retry}>
          Tentar novamente
        </button>
      </StateMessage>
    );
  }
  if (detail.detail.sections.length === 0) {
    return <StateMessage icon="🚧" title="Conteúdo indisponível" text="Esta aula ainda não tem partes publicadas." />;
  }
  return <LessonReader lesson={lesson} detail={detail.detail} quizHref={quizHref} />;
}

type Phase = 'resume' | 'reading' | 'summary';

function LessonReader({ lesson, detail, quizHref }: { lesson: Lesson; detail: LessonDetail; quizHref: string }) {
  const { content, player, actions } = useGame();
  const category = findCategory(content, lesson.categoryId);
  const total = detail.sections.length;

  // Estado inicial capturado uma vez: onde o jogador parou e se já tinha concluído.
  const [initial] = useState(() => {
    const progress = player.lessons[lesson.id];
    return {
      completed: progress?.status === 'completed',
      resumeIndex: Math.min(Math.max(progress?.lastSectionIndex ?? 0, 0), total - 1),
      inProgress: progress?.status === 'in_progress',
    };
  });
  const [phase, setPhase] = useState<Phase>(initial.inProgress && initial.resumeIndex > 0 ? 'resume' : 'reading');
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const pendingTrack = useRef<Promise<void>>(Promise.resolve());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasNavigated = useRef(false);

  // Salva no Supabase a parte atual (o percentual é calculado pelo servidor).
  const { trackLessonProgress } = actions;
  useEffect(() => {
    if (phase !== 'reading') return;
    pendingTrack.current = trackLessonProgress(lesson.id, index);
  }, [phase, index, lesson.id, trackLessonProgress]);

  // Acessibilidade: ao trocar de parte, o foco vai para o título da nova parte.
  useEffect(() => {
    if (!hasNavigated.current) return;
    window.scrollTo({ top: 0 });
    if (phase === 'summary') document.getElementById('summary-title')?.focus();
    else headingRef.current?.focus();
  }, [index, phase]);

  const goTo = (next: number) => {
    hasNavigated.current = true;
    setIndex(next);
  };

  const finish = async () => {
    setFinishing(true);
    await pendingTrack.current; // garante que a última parte foi registrada
    if (!initial.completed && !result) {
      const r = await actions.completeLesson(lesson.id);
      if (!r) {
        setFinishing(false);
        return;
      }
      setResult(r);
    }
    hasNavigated.current = true;
    setFinishing(false);
    setPhase('summary');
  };

  const header = (
    <header className="lesson-player__head">
      <div>
        <p className="eyebrow">
          <span aria-hidden>{category?.icon}</span> {category?.name} · {lessonLevelLabels[lesson.difficulty]} ·{' '}
          {lesson.durationMinutes} min
        </p>
        <h1 className="page-title">{lesson.title}</h1>
      </div>
      <FavoriteButton lessonId={lesson.id} title={lesson.title} />
    </header>
  );

  if (phase === 'resume') {
    const section = detail.sections[initial.resumeIndex];
    return (
      <div className="stack lesson-player">
        {header}
        <section className="card center stack stack--sm resume-card" aria-labelledby="resume-title">
          <span className="big-icon big-icon--sm" aria-hidden>
            📍
          </span>
          <h2 id="resume-title" className="card__title">
            Você parou aqui. Quer continuar?
          </h2>
          <p className="muted">
            Parte {initial.resumeIndex + 1} de {total}: <strong>{section.title}</strong>
          </p>
          <ProgressBar
            value={initial.resumeIndex + 1}
            max={total}
            label="Progresso da aula"
            valueText={`Parte ${initial.resumeIndex + 1} de ${total}`}
          />
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={() => {
              goTo(initial.resumeIndex);
              setPhase('reading');
            }}
          >
            Continuar
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              goTo(0);
              setPhase('reading');
            }}
          >
            Recomeçar do início
          </button>
        </section>
      </div>
    );
  }

  if (phase === 'summary') {
    return (
      <div className="stack lesson-player">
        {header}
        <ProgressBar value={total} max={total} label="Progresso da aula" valueText="Aula concluída" />
        <LessonSummary
          lesson={lesson}
          detail={detail}
          result={result}
          quizHref={quizHref}
          onReview={() => {
            goTo(0);
            setPhase('reading');
          }}
        />
      </div>
    );
  }

  const section = detail.sections[index];
  const position = index + 1;
  const percent = Math.round((position / total) * 100);
  const isLast = position === total;

  return (
    <div className="stack lesson-player">
      {header}

      <div className="lesson-progress">
        <div className="lesson-progress__text" aria-hidden>
          <strong>
            {position} de {total}
          </strong>
          <span>{percent}% concluído</span>
        </div>
        <ProgressBar
          value={position}
          max={total}
          label="Progresso da aula"
          valueText={`Parte ${position} de ${total}, ${percent}% concluído`}
        />
      </div>

      <article className="card lesson-card lesson-section" key={section.id} aria-labelledby={`section-${section.id}`}>
        <p className="eyebrow">Parte {position}</p>
        <span className="lesson-card__icon" aria-hidden>
          {section.icon}
        </span>
        <h2 id={`section-${section.id}`} ref={headingRef} tabIndex={-1} className="lesson-card__title">
          {section.title}
        </h2>
        {section.imageUrl && (
          <figure className="lesson-figure">
            <img
              src={safeImageSrc(section.imageUrl)}
              alt={section.imageAlt ?? ''}
              className="lesson-figure__img"
              width={640}
              height={360}
              loading="lazy"
              decoding="async"
            />
          </figure>
        )}
        {section.paragraphs.map((p) => (
          <p key={p} className="lesson-card__text">
            {p}
          </p>
        ))}
        {section.highlights.length > 0 && (
          <ul className="checklist">
            {section.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        )}
        <LessonBlocks blocks={section.blocks} />
      </article>

      <div className="actions lesson-nav">
        <button type="button" className="btn btn--ghost" onClick={() => goTo(index - 1)} disabled={index === 0}>
          ← Anterior
        </button>
        {isLast ? (
          <button type="button" className="btn btn--primary" onClick={finish} disabled={finishing}>
            {finishing ? 'Salvando…' : initial.completed || result ? 'Ver resumo' : 'Concluir aula'}
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => goTo(index + 1)}>
            Continuar →
          </button>
        )}
      </div>
    </div>
  );
}
