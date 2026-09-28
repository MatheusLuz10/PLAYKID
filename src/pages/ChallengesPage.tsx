import { useSearchParams } from 'react-router-dom';
import { ChallengeCard } from '../components/challenge/ChallengeCard';
import { ReminderBanner } from '../components/challenge/ReminderBanner';
import { WaitingList } from '../components/challenge/WaitingList';
import { PageHeader } from '../components/layout/PageHeader';
import { StateMessage } from '../components/ui/StateMessage';
import { getChallengeState, isWaitingQuietly } from '../logic/challenges';
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

// Cada situação é um bloco com cor e título próprios. "Aguardando acompanhamento" vem depois dos
// disponíveis e em lista compacta: quem só espera a próxima data não ocupa a tela. Com um
// acompanhamento liberado, o desafio volta para "Em andamento".
interface Section {
  key: string;
  icon: string;
  title: string;
  statuses: ChallengeStatus[];
  hint: string;
  compact?: boolean;
  byCategory?: boolean;
}

const SECTIONS: Section[] = [
  { key: 'andamento', icon: '⏳', title: 'Em andamento', statuses: ['accepted', 'in_progress', 'expired'], hint: 'Você já aceitou: continue de onde parou.' },
  {
    key: 'disponiveis',
    icon: '🔓',
    title: 'Disponíveis',
    statuses: ['available'],
    hint: 'Escolha um e aceite quando quiser. A aula e o quiz do tema ajudam e dão XP.',
    byCategory: true,
  },
  { key: 'aguardando', icon: '🌱', title: 'Aguardando acompanhamento', statuses: ['waiting_follow_up'], hint: 'Já feitos: é só voltar na data prevista.', compact: true },
  { key: 'concluidos', icon: '🏆', title: 'Concluídos', statuses: ['completed'], hint: 'Missões cumpridas. Veja de novo quando quiser.' },
  { key: 'bloqueados', icon: '🔒', title: 'Bloqueados', statuses: ['locked'], hint: 'Conclua a aula e o quiz do tema para liberar.' },
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
    .map((c) => {
      const state = getChallengeState(content, c, player);
      // acompanhamento liberado ou atrasado: há algo a fazer, então aparece como "Em andamento"
      const due = state === 'waiting_follow_up' && !isWaitingQuietly(c, player.challenges[c.id], player);
      return { challenge: c, state, section: (due ? 'in_progress' : state) as ChallengeStatus };
    })
    .filter(({ challenge }) => !category || content.categories.find((x) => x.id === challenge.categoryId)?.slug === category)
    .filter(({ state }) => !allowed || allowed.includes(state));

  const sections = SECTIONS.map((section) => ({
    ...section,
    items: withState.filter((x) => section.statuses.includes(x.section)).map((x) => x.challenge),
  })).filter((s) => s.items.length > 0);

  // Disponíveis separados por tema (quando nenhum tema está filtrado).
  const groupByCategory = (items: Challenge[]) =>
    content.categories
      .map((cat) => ({ category: cat, items: items.filter((c) => c.categoryId === cat.id) }))
      .filter((g) => g.items.length > 0);

  return (
    <div className="stack">
      <PageHeader
        title="🌱 Desafios"
        subtitle="Ações reais no mundo. Escolha um desafio, aceite e registre o que você fez."
      />

      {sections.length > 1 && (
        <nav className="challenge-summary" aria-label="Resumo dos desafios">
          {sections.map((s) => (
            <a key={s.key} href={`#secao-${s.key}`} className={`challenge-summary__item challenge-summary__item--${s.key}`}>
              <span aria-hidden>{s.icon}</span>
              <strong>{s.items.length}</strong>
              <span>{s.title}</span>
            </a>
          ))}
        </nav>
      )}

      <ReminderBanner />

      <div className="filters">
        <span className="filter-label" aria-hidden>
          Tema
        </span>
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
        <span className="filter-label" aria-hidden>
          Situação
        </span>
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
          <section
            key={section.key}
            id={`secao-${section.key}`}
            className={`challenge-section challenge-section--${section.key}`}
            aria-labelledby={`titulo-${section.key}`}
          >
            <header className="challenge-section__head">
              <span className="challenge-section__icon" aria-hidden>
                {section.icon}
              </span>
              <div>
                <h2 className="challenge-section__title" id={`titulo-${section.key}`}>
                  {section.title} <span className="challenge-section__count">{section.items.length}</span>
                </h2>
                <p className="challenge-section__hint">{section.hint}</p>
              </div>
            </header>
            {section.compact ? (
              <WaitingList challenges={section.items} />
            ) : section.byCategory && !category ? (
              groupByCategory(section.items).map((g) => (
                <div key={g.category.id} className="challenge-group">
                  <h3 className="challenge-group__title">
                    <span aria-hidden>{g.category.icon}</span> {g.category.name}{' '}
                    <span className="muted small">({g.items.length})</span>
                  </h3>
                  <div className="challenge-grid">
                    {g.items.map((c: Challenge) => (
                      <ChallengeCard key={c.id} challenge={c} showStatus={false} showCategory={false} />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="challenge-grid">
                {section.items.map((c: Challenge) => (
                  <ChallengeCard key={c.id} challenge={c} showStatus={section.key === 'andamento'} />
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}
