import type { Question } from '../../models';

interface QuestionCardProps {
  question: Question;
  selectedId: string | null;
  /** Revelada pelo servidor depois da resposta; null enquanto não respondida. */
  correctOptionId: string | null;
  onSelect: (optionId: string) => void;
  disabled?: boolean;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/** Pergunta de resposta única. Alternativas grandes, navegáveis por teclado (grupo de rádio). */
export function QuestionCard({ question, selectedId, correctOptionId, onSelect, disabled }: QuestionCardProps) {
  const confirmed = correctOptionId !== null;
  return (
    <fieldset className="question" disabled={confirmed || disabled}>
      <legend className="question__prompt">{question.prompt}</legend>
      <div className="question__options">
        {question.options.map((option, i) => {
          const isSelected = option.id === selectedId;
          const isCorrect = option.id === correctOptionId;
          let state = isSelected ? 'selected' : '';
          if (confirmed) {
            if (isCorrect) state = 'correct';
            else if (isSelected) state = 'wrong';
            else state = 'dim';
          }
          return (
            <label key={option.id} className={`option ${state ? `is-${state}` : ''}`}>
              <input
                type="radio"
                name={question.id}
                value={option.id}
                checked={isSelected}
                onChange={() => onSelect(option.id)}
              />
              <span className="option__letter" aria-hidden>
                {LETTERS[i]}
              </span>
              <span className="option__text">
                <span className="sr-only">Alternativa {LETTERS[i]}: </span>
                {option.text}
                {/* Estado por texto, não só por cor */}
                {confirmed && isCorrect && <span className="option__status">✓ Resposta correta</span>}
                {confirmed && isSelected && !isCorrect && <span className="option__status">✕ Sua resposta</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
