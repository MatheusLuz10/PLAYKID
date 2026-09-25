import { useSearchParams } from 'react-router-dom';
import { ChallengeCard } from '../components/challenge/ChallengeCard';
import { ReminderBanner } from '../components/challenge/ReminderBanner';
import { PageHeader } from '../components/layout/PageHeader';
import { StateMessage } from '../components/ui/StateMessage';
import { getChallengeState } from '../logic/challenges';
import type { Challenge, ChallengeStatus } from '../models';
import { useGame } from '../state/GameContext';

type StatusFilter = 'todos' | 'pendentes' | 'disponiveis' | 'andamento' | 'concluidos';

const STATUS_FILTERS: { id: StatusFilter; label: string; statuses: ChallengeStatus[] | null }[] = [
  { id: 'todos', label: 'Todos', statuses: null },
  { id: 'pendentes', label: 'Pendentes', statuses: ['locked', 'available', 'accepted', 'in_progress', 'waiting_follow_up', 'expired'] },
  { id: 'disponiveis', label: 'Disponíveis', statuses: ['available'] },
  { id: 'andamento', label: 'Em andamento', statuses: ['accepted', 'in_progress', 'waiting_follow_up', 'expired'] },
  { id: 'concluidos', label: 'Concluídos', statuses: ['completed'] },
];

const SECTIONS: { title: string; statuses: ChallengeStatus[]; hint?: string }[] = [
  { title: '⏳ Em andamento', statuses: ['accepted', 'in_progress', 'expired'] },
  { title: '🌱 Aguardando acompanhamento', statuses: ['waiting_follow_up'], hint: 'Desafios que pedem uma nova verificação no futuro.' },
  { title: '🔓 Disponíveis', statuses: ['available'], hint: 'Todas as missões estão abertas: é só aceitar (a aula e o quiz ajudam e dão XP).' },
  { title: '🏆 Concluídos', statuses: ['completed'] },
  { title: '🔒 Bloqueados', statuses: ['locked'], hint: 'Conclua a aula e o quiz do tema para liberar.' },
];

export function ChallengesPage() {
  const { content, player } = useGame();
  const [params, setParams] = useSearchParams();
  const category = params.get('categoria') ?? '';
  const statusFilter = (params.get('situacao') ?? 'todos') as StatusFilter;

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const allowed = STATUS_FILTERS.find((f) => f.id === statusFilter)?.statuses ?? null;
  const withState = content.challenges
    .map((c) => ({ challenge: c, state: getChallengeState(content, c, player) }))
    .filter(({ challenge }) => !category || content.categories.find((x) => x.id === challenge.categoryId)?.slug === category)
    .filter(({ state }) => !allowed || allowed.includes(state));

  const sections = SECTIONS.map((section) => ({
    ...section,
    items: withState.filter((x) => section.statuses.includes(x.state)).map((x) => x.challenge),
  })).filter((s) => s.items.length > 0);

  return (
    <div className="stack">
      <PageHeader
        title="🌱 Desafios"
        subtitle="Ações reais no mundo. Todo desafio começa com uma aula e um quiz: primeiro você aprende, depois você age."
      />

      <ReminderBanner />

      <div className="filters">
        <div className="filter-group" role="group" aria-label="Filtrar por categoria">
          <button type="button" className={`filter-chip ${!category ? 'is-active' : ''}`} aria-pressed={!category} onClick={() => setParam('categoria', '')}>
            Todos
          </button>
          {content.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`filter-chip ${category === c.slug ? 'is-active' : ''}`}
              aria-pressed={category === c.slug}
              onClick={() => setParam('categoria', category === c.slug ? '' : c.slug)}
            >
              <span aria-hidden>{c.icon}</span> {c.name}
            </button>
          ))}
        </div>
        <div className="filter-group" role="group" aria-label="Filtrar por situação">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`filter-chip ${statusFilter === f.id ? 'is-active' : ''}`}
              aria-pressed={statusFilter === f.id}
              onClick={() => setParam('situacao', f.id === 'todos' ? '' : f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {sections.length === 0 ? (
        <StateMessage
          icon="🌱"
          title="Nenhum desafio aqui"
          text="Desafios aparecem conforme você aprende. Conclua aulas e quizzes para liberar novas ações no mundo real."
        />
      ) : (
        sections.map((section) => (
          <section key={section.title} className="stack stack--sm" aria-label={section.title}>
            <div className="section-head">
              <h2 className="section-title">
                {section.title} <span className="muted small">({section.items.length})</span>
              </h2>
              {section.hint && <span className="muted small">{section.hint}</span>}
            </div>
            <div className="challenge-grid">
              {section.items.map((c: Challenge) => (
                <ChallengeCard key={c.id} challenge={c} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
