import { useId, useState } from 'react';
import type { LessonBlock } from '../../../models';
import { safeImageSrc } from '../../../logic/safeUrl';

type BlockOf<T extends LessonBlock['type']> = Extract<LessonBlock, { type: T }>;

/** 💡 Curiosidade — "Você sabia?" */
export function FunFactBlock({ block }: { block: BlockOf<'fun_fact'> }) {
  return (
    <aside className="lesson-block lesson-block--fact" aria-label="Curiosidade">
      <span className="lesson-block__icon" aria-hidden>
        💡
      </span>
      <div>
        <strong className="lesson-block__title">{block.title}</strong>
        <p>{block.text}</p>
      </div>
    </aside>
  );
}

/** 🌱 Dica prática */
export function TipBlock({ block }: { block: BlockOf<'tip'> }) {
  return (
    <aside className="lesson-block lesson-block--tip" aria-label="Dica prática">
      <span className="lesson-block__icon" aria-hidden>
        🌱
      </span>
      <div>
        <strong className="lesson-block__title">Dica prática</strong>
        <p>{block.text}</p>
      </div>
    </aside>
  );
}

/** 🤔 Pense — pergunta reflexiva (não é registrada). */
export function ThinkBlock({ block }: { block: BlockOf<'think'> }) {
  return (
    <aside className="lesson-block lesson-block--think" aria-label="Pense">
      <span className="lesson-block__icon" aria-hidden>
        🤔
      </span>
      <div>
        <strong className="lesson-block__title">Pense</strong>
        <p>{block.prompt}</p>
      </div>
    </aside>
  );
}

/** 🔎 Observe — imagem + pergunta; a resposta aparece quando o jogador quiser. */
export function ObserveBlock({ block }: { block: BlockOf<'observe'> }) {
  const [revealed, setRevealed] = useState(false);
  const answerId = useId();
  return (
    <section className="lesson-block lesson-block--observe" aria-label="Observe">
      <div className="lesson-block__head">
        <span className="lesson-block__icon" aria-hidden>
          🔎
        </span>
        <strong className="lesson-block__title">Observe</strong>
      </div>
      {block.imageUrl && (
        <img
          src={safeImageSrc(block.imageUrl)}
          alt={block.imageAlt}
          className="lesson-figure__img"
          width={640}
          height={360}
          loading="lazy"
          decoding="async"
        />
      )}
      <p>{block.prompt}</p>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        aria-expanded={revealed}
        aria-controls={answerId}
        onClick={() => setRevealed((v) => !v)}
      >
        {revealed ? 'Esconder resposta' : 'Mostrar resposta'}
      </button>
      <p id={answerId} className="lesson-block__answer" hidden={!revealed}>
        {block.answer}
      </p>
    </section>
  );
}

/**
 * 🌳 Mini interação de escolha. Serve para manter a aula interessante:
 * não vale nota e não substitui o quiz.
 */
export function ChoiceInteraction({ block }: { block: BlockOf<'choice'> }) {
  const [selected, setSelected] = useState<string | null>(null);
  const groupId = useId();
  const chosen = block.options.find((o) => o.id === selected);

  return (
    <section className="lesson-block lesson-block--choice" aria-labelledby={`${groupId}-prompt`}>
      <p id={`${groupId}-prompt`} className="lesson-block__title">
        {block.prompt}
      </p>
      <div className="choice-options" role="group" aria-label={block.prompt}>
        {block.options.map((option) => {
          const isChosen = option.id === selected;
          const state = !isChosen ? '' : option.isBest ? 'is-best' : 'is-other';
          return (
            <button
              key={option.id}
              type="button"
              className={`choice-option ${state}`}
              aria-pressed={isChosen}
              onClick={() => setSelected(option.id)}
            >
              {option.icon && (
                <span className="choice-option__icon" aria-hidden>
                  {option.icon}
                </span>
              )}
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
      <div aria-live="polite">
        {chosen && (
          <div className={`choice-feedback ${chosen.isBest ? 'choice-feedback--best' : 'choice-feedback--other'}`}>
            <strong>{chosen.isBest ? '✅ Escolha adequada' : '💡 Vamos pensar juntos:'}</strong>
            <p>{chosen.feedback}</p>
            {!chosen.isBest && <p className="small muted">Experimente outra opção.</p>}
          </div>
        )}
      </div>
    </section>
  );
}

export function LessonBlocks({ blocks }: { blocks: LessonBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'fun_fact':
            return <FunFactBlock key={i} block={block} />;
          case 'tip':
            return <TipBlock key={i} block={block} />;
          case 'think':
            return <ThinkBlock key={i} block={block} />;
          case 'observe':
            return <ObserveBlock key={i} block={block} />;
          case 'choice':
            return <ChoiceInteraction key={i} block={block} />;
        }
      })}
    </>
  );
}
