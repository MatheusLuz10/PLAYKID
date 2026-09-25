const longDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

/** Data LOCAL no formato YYYY-MM-DD (valor de <input type="date">). */
export function dateInputFromIso(iso: string | Date): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Data local de hoje no formato YYYY-MM-DD. */
export function todayDateInput(): string {
  return dateInputFromIso(new Date());
}

/** Formata uma data ISO completa ou YYYY-MM-DD. */
export function formatDate(value: string): string {
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return longDate.format(date);
}

export function addDays(value: string, days: number): string {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}
