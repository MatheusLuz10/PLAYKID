import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingMessage, StateMessage } from '../components/ui/StateMessage';
import { formatDate } from '../logic/dates';
import { formatXp } from '../logic/xp';
import {
  backend,
  toAppError,
  type AdminContentKind,
  type AdminContentRow,
  type AdminDashboard,
  type AdminLog,
  type AdminUser,
} from '../services';
import { useGame } from '../state/GameContext';

type Tab = 'geral' | 'usuarios' | 'conteudo' | 'registros';

const TABS: { id: Tab; label: string }[] = [
  { id: 'geral', label: '📊 Visão geral' },
  { id: 'usuarios', label: '👥 Usuários' },
  { id: 'conteudo', label: '📚 Conteúdo' },
  { id: 'registros', label: '🧾 Registros' },
];

const KINDS: { id: AdminContentKind; label: string }[] = [
  { id: 'lesson', label: 'Lições' },
  { id: 'quiz', label: 'Quizzes' },
  { id: 'challenge', label: 'Desafios' },
  { id: 'achievement', label: 'Conquistas' },
  { id: 'world_item', label: 'Itens do mundo' },
];

/** Carregamento com estados de "carregando", erro e "tentar novamente". */
function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await load());
    } catch (err) {
      setError(toAppError(err).message);
    } finally {
      setLoading(false);
    }
  }, [load]);
  useEffect(() => {
    void run();
  }, [run]);
  return { data, error, loading, retry: run };
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <StateMessage icon="⚠️" title="Não foi possível carregar" text={message} role="alert">
      <button type="button" className="btn btn--primary" onClick={retry}>
        Tentar novamente
      </button>
    </StateMessage>
  );
}

function Overview() {
  const { data, error, loading, retry } = useLoad<AdminDashboard>(useCallback(() => backend.adminDashboard(), []));
  if (loading && !data) return <LoadingMessage text="Carregando métricas…" />;
  if (error || !data) return <ErrorState message={error ?? ''} retry={retry} />;
  const metrics = [
    ['Usuários cadastrados', data.users],
    ['Usuários ativos (30 dias)', data.activeUsers30d],
    ['Lições concluídas', data.lessonsCompleted],
    ['Quizzes realizados', data.quizzesTaken],
    ['Quizzes aprovados', data.quizzesPassed],
    ['Desafios iniciados', data.challengesStarted],
    ['Desafios concluídos', data.challengesCompleted],
    ['Evidências enviadas', data.evidenceSent],
    ['XP distribuído', formatXp(data.xpDistributed)],
    ['Itens do mundo liberados', data.worldItemsUnlocked],
    ['Erros nas últimas 24 h', data.errors24h],
  ] as const;
  const content = [
    ['Categorias', data.content.categories],
    ['Lições', data.content.lessons],
    ['Quizzes', data.content.quizzes],
    ['Desafios', data.content.challenges],
    ['Conquistas', data.content.achievements],
    ['Itens do mundo', data.content.world_items],
  ] as const;
  return (
    <div className="stack">
      <section className="card" aria-labelledby="admin-metrics">
        <h2 className="section-title" id="admin-metrics">
          Uso do ECO QUEST
        </h2>
        <dl className="stats admin-stats">
          {metrics.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="card" aria-labelledby="admin-content-count">
        <h2 className="section-title" id="admin-content-count">
          Conteúdo cadastrado
        </h2>
        <dl className="stats admin-stats">
          {content.map(([label, c]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                {c.total}
                <span className="block small muted">{c.active} ativos</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

const PAGE_SIZE = 20;

function Users() {
  const { player } = useGame();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string, p: number) => {
    setBusy(true);
    setError(null);
    try {
      const r = await backend.adminListUsers(q, p, PAGE_SIZE);
      setItems((prev) => (p === 0 ? r.items : [...prev, ...r.items]));
      setTotal(r.total);
      setPage(p);
    } catch (err) {
      setError(toAppError(err).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load(query, 0);
  }, [load, query]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setQuery(search.trim());
  };

  const toggleRole = async (u: AdminUser) => {
    const next = u.role === 'admin' ? 'user' : 'admin';
    const verb = next === 'admin' ? 'tornar administrador' : 'remover o acesso de administrador de';
    if (!window.confirm(`Confirmar: ${verb} ${u.displayName ?? u.username ?? 'este usuário'}?`)) return;
    try {
      await backend.adminSetRole(u.userId, next);
      await load(query, 0);
    } catch (err) {
      setError(toAppError(err).message);
    }
  };

  return (
    <section className="card stack" aria-labelledby="admin-users">
      <h2 className="section-title" id="admin-users">
        Usuários <span className="muted">({total})</span>
      </h2>
      <form className="admin-search" onSubmit={submit} role="search">
        <label className="field">
          <span className="field__label">Buscar por nome, usuário ou e-mail</span>
          <input className="input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <button type="submit" className="btn btn--primary">
          Buscar
        </button>
      </form>
      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}
      {busy && items.length === 0 ? (
        <LoadingMessage text="Carregando usuários…" />
      ) : items.length === 0 ? (
        <p className="empty">Nenhum usuário encontrado.</p>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <caption className="sr-only">Usuários cadastrados</caption>
            <thead>
              <tr>
                <th scope="col">Usuário</th>
                <th scope="col">E-mail</th>
                <th scope="col">Nível</th>
                <th scope="col">XP</th>
                <th scope="col">Desafios</th>
                <th scope="col">Cadastro</th>
                <th scope="col">Status</th>
                <th scope="col">Papel</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.userId}>
                  <td data-label="Usuário">
                    <strong>{u.displayName ?? '—'}</strong>
                    {u.username && <span className="block small muted">@{u.username}</span>}
                  </td>
                  <td data-label="E-mail">{u.email ?? '—'}</td>
                  <td data-label="Nível">{u.level}</td>
                  <td data-label="XP">{formatXp(u.totalXp)}</td>
                  <td data-label="Desafios">{u.challengesCompleted}</td>
                  <td data-label="Cadastro">{formatDate(u.createdAt)}</td>
                  <td data-label="Status">
                    <span className={`tag ${u.status === 'active' ? 'tag--done' : ''}`}>{u.status === 'active' ? 'Ativo' : 'Inativo'}</span>
                  </td>
                  <td data-label="Papel">
                    <span className="block">{u.role === 'admin' ? '🔐 Admin' : 'Jogador'}</span>
                    {u.userId !== player.profile.userId && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => toggleRole(u)}>
                        {u.role === 'admin' ? 'Remover admin' : 'Tornar admin'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {items.length < total && (
        <button type="button" className="btn btn--ghost btn--sm load-more" disabled={busy} onClick={() => load(query, page + 1)}>
          {busy ? 'Carregando…' : 'Ver mais'}
        </button>
      )}
      <p className="small muted">Status “ativo” = alguma ação registrada nos últimos 30 dias.</p>
    </section>
  );
}

function Content() {
  const { actions } = useGame();
  const [kind, setKind] = useState<AdminContentKind>('challenge');
  const { data, error, loading, retry } = useLoad<AdminContentRow[]>(useCallback(() => backend.adminListContent(kind), [kind]));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const toggle = async (row: AdminContentRow) => {
    if (row.active && !window.confirm(`Desativar “${row.title}”? Quem já usou mantém o histórico; novos jogadores deixam de ver.`)) return;
    setBusyId(row.id);
    setActionError(null);
    try {
      await backend.adminSetContentActive(kind, row.id, !row.active);
      await retry();
      await actions.reloadContent();
    } catch (err) {
      setActionError(toAppError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="card stack" aria-labelledby="admin-content">
      <h2 className="section-title" id="admin-content">
        Conteúdo
      </h2>
      <div className="filter-group" role="group" aria-label="Tipo de conteúdo">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            className={`filter-chip ${kind === k.id ? 'is-active' : ''}`}
            aria-pressed={kind === k.id}
            onClick={() => setKind(k.id)}
          >
            {k.label}
          </button>
        ))}
      </div>
      <p className="small muted">
        Desativar não apaga nada: o histórico de quem já usou o conteúdo é preservado. Textos e valores são editados no
        conteúdo do projeto (<code>content/*.json</code> → <code>npm run content:sql</code>), para que o banco possa ser
        recriado em qualquer ambiente.
      </p>
      {actionError && (
        <div className="banner banner--error" role="alert">
          {actionError}
        </div>
      )}
      {loading && !data ? (
        <LoadingMessage />
      ) : error || !data ? (
        <ErrorState message={error ?? ''} retry={retry} />
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <caption className="sr-only">{KINDS.find((k) => k.id === kind)?.label}</caption>
            <thead>
              <tr>
                <th scope="col">Título</th>
                <th scope="col">Grupo</th>
                <th scope="col">XP</th>
                <th scope="col">Uso</th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className={row.active ? '' : 'is-inactive'}>
                  <td data-label="Título">
                    <strong>{row.title}</strong>
                  </td>
                  <td data-label="Grupo">{row.group ?? '—'}</td>
                  <td data-label="XP">{row.xpReward ?? '—'}</td>
                  <td data-label="Uso">{row.usage}</td>
                  <td data-label="Situação">
                    <span className={`tag ${row.active ? 'tag--done' : ''}`}>{row.active ? 'Ativo' : 'Desativado'}</span>{' '}
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={busyId === row.id}
                      onClick={() => toggle(row)}
                      aria-label={`${row.active ? 'Desativar' : 'Ativar'} ${row.title}`}
                    >
                      {busyId === row.id ? 'Salvando…' : row.active ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Logs() {
  const { data, error, loading, retry } = useLoad<AdminLog[]>(useCallback(() => backend.adminListLogs(50), []));
  if (loading && !data) return <LoadingMessage />;
  if (error || !data) return <ErrorState message={error ?? ''} retry={retry} />;
  return (
    <section className="card stack" aria-labelledby="admin-logs">
      <h2 className="section-title" id="admin-logs">
        Registros recentes
      </h2>
      <p className="small muted">Erros inesperados e ações administrativas (sem senhas, tokens ou e-mails).</p>
      {data.length === 0 ? (
        <p className="empty">Nenhum registro.</p>
      ) : (
        <ul className="list">
          {data.map((l) => (
            <li key={l.id} className="list__row">
              <span aria-hidden>{l.level === 'error' ? '⚠️' : 'ℹ️'}</span>
              <span>
                <strong>{l.operation}</strong> {l.code && <code className="small">{l.code}</code>}
                <span className="block small">{l.message}</span>
                <span className="block small muted">{formatDate(l.createdAt)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 🔐 Administração: simples e segura (o servidor confere o papel em tudo). */
export function AdminPage() {
  const [tab, setTab] = useState<Tab>('geral');
  return (
    <div className="stack">
      <PageHeader title="🔐 Admin ECO QUEST" subtitle="Visão geral, usuários, conteúdo e registros." />
      <div className="tabs admin-tabs" role="tablist" aria-label="Seções da administração">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`admin-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="admin-panel"
            className={`tabs__tab ${tab === t.id ? 'is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id="admin-panel" role="tabpanel" aria-labelledby={`admin-tab-${tab}`}>
        {tab === 'geral' && <Overview />}
        {tab === 'usuarios' && <Users />}
        {tab === 'conteudo' && <Content />}
        {tab === 'registros' && <Logs />}
      </div>
    </div>
  );
}
