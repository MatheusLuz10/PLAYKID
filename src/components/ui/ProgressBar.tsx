interface ProgressBarProps {
  value: number;
  max?: number;
  label: string;
  /** Texto lido por leitores de tela (ex.: "Parte 3 de 5"). */
  valueText?: string;
  tone?: 'leaf' | 'water' | 'sun';
  size?: 'sm' | 'md';
}

export function ProgressBar({ value, max = 100, label, valueText, tone = 'leaf', size = 'md' }: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className={`progress progress--${tone} progress--${size}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
    >
      <div className="progress__fill" style={{ width: `${percent}%` }} />
    </div>
  );
}
