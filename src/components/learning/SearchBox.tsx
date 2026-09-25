import { useId, type FormEvent } from 'react';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  autoFocus?: boolean;
}

export function SearchBox({ value, onChange, onSubmit, autoFocus }: SearchBoxProps) {
  const id = useId();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit?.(value);
  };
  return (
    <form className="search-box" role="search" onSubmit={submit}>
      <label htmlFor={id} className="sr-only">
        Pesquisar conteúdos
      </label>
      <span className="search-box__icon" aria-hidden>
        🔎
      </span>
      <input
        id={id}
        type="search"
        className="input search-box__input"
        placeholder="Pesquisar conteúdos (ex.: árvore)"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
      {onSubmit && (
        <button type="submit" className="btn btn--primary btn--sm">
          Buscar
        </button>
      )}
    </form>
  );
}
