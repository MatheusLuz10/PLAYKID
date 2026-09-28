import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { ProgressBar } from '../components/ui/ProgressBar';
import { LoadingMessage } from '../components/ui/StateMessage';
import { WorldItemDialog } from '../components/world/WorldItemDialog';
import { WorldMap } from '../components/world/WorldMap';
import { hasWebGL } from '../modules/place/scene/webgl';
import { serverNow } from '../logic/challenges';
import {
  calculateWorldStage,
  growthMessage,
  relativeDay,
  whyEvolved,
  worldCategories,
  worldHistory,
  worldStatusLabels,
} from '../logic/world';
import type { WorldItem } from '../models';
import { useGame } from '../state/GameContext';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Mundo em 3D e a casa: carregados sob demanda (o three.js fica fora do app principal).
const World3DView = lazy(() => import('../modules/world3d/World3DView'));
const PlacePage = lazy(() => import('../modules/place/PlacePage').then((m) => ({ default: m.PlacePage })));

/** Meu Mundo: o mapa do mundo ou, ao entrar nela, a casa (?casa=1, ou ?casa=andar já andando). */
export function WorldPage() {
  const [params, setParams] = useSearchParams();
  const house = params.get('casa');
  // Saindo da casa, o mapa volta na visão geral (sem voar de novo até os itens novos).
  const [cameBack, setCameBack] = useState(false);
  const enterHouse = useCallback(
    (walk: boolean) => {
      window.scrollTo(0, 0);
      setParams({ casa: walk ? 'andar' : '1' });
    },
    [setParams],
  );
  const leaveHouse = useCallback(
    (fullscreen: boolean) => {
      setCameBack(true);
      window.scrollTo(0, 0);
      setParams(fullscreen ? { tela: 'cheia' } : {});
    },
    [setParams],
  );
  if (house) {
    return (
      <Suspense fallback={<LoadingMessage text="Abrindo a sua casa…" />}>
        <PlacePage key={house} walkIn={house === 'andar'} onLeave={leaveHouse} />
      </Suspense>
    );
  }
  return <WorldMapPage onEnterHouse={enterHouse} fullscreen={params.get('tela') === 'cheia'} cameBack={cameBack} />;
}

/** 👀 Visitar o mundo e a casa de um amigo: só pelo @usuário (não existe lista pública). */
function VisitFriendCard() {
  const { player } = useGame();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const mine = player.profile.username;
  const go = (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim().replace(/^@/, '').toLowerCase();
    if (clean) navigate(`/mundo/visitar/${encodeURIComponent(clean)}`);
  };
  return (
    <section className="card visit-card" aria-labelledby="visit-title">
      <h2 className="section-title" id="visit-title">
        👀 Visitar um amigo
      </h2>
      <p className="small muted">Digite o @usuário de um amigo para conhecer o mundo e a casa dele. Visita é só para olhar.</p>
      <form className="visit-card__form" onSubmit={go}>
        <label className="sr-only" htmlFor="visit-username">
          @usuário do amigo
        </label>
        <input
          id="visit-username"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="@usuario_do_amigo"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={25}
        />
        <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
          Visitar
        </button>
      </form>
      {mine && (
        <p className="small">
          Seu @usuário para os amigos visitarem você: <strong>@{mine}</strong>
        </p>
      )}
    </section>
  );
}

function WorldMapPage({ onEnterHouse, fullscreen, cameBack }: { onEnterHouse: (walk: boolean) => void; fullscreen: boolean; cameBack: boolean }) {
  const { content, player, actions } = useGame();
  const [selected, setSelected] = useState<WorldItem | null>(null);
  const closeDialog = useCallback(() => setSelected(null), []);
  // Sem WebGL (ou se o 3D falhar), o mundo aparece no mapa 2D.
  const [use3d, setUse3d] = useState(hasWebGL);
  const fallbackTo2d = useCallback(() => setUse3d(false), []);
  // Tocar na casa do mundo: entra nela, já andando pelos cômodos.
  const enterHome = useCallback(() => onEnterHouse(true), [onEnterHouse]);

  // Itens que o jogador ainda não viu surgir: animam agora e fecham o ciclo (EVOLUIR).
  const [newlyRevealed] = useState(() =>
    player.world.items.filter((i) => !i.revealed).map((i) => i.worldItemId),
  );
  const revealRequested = useRef(false);
  const { revealWorldItems } = actions;
  useEffect(() => {
    if (newlyRevealed.length === 0 || revealRequested.current) return;
    revealRequested.current = true;
    void revealWorldItems();
  }, [newlyRevealed, revealWorldItems]);

  const { world } = player;
  // Estágio e progresso vêm do servidor; os detalhes explicam o cálculo.
  const info = calculateWorldStage(content, player);
  const stage = content.worldStages.find((s) => s.number === world.stage) ?? info.stage;
  const next = content.worldStages.find((s) => s.number === world.stage + 1) ?? null;
  const newItems = content.worldItems.filter((w) => newlyRevealed.includes(w.id));
  const growth = newItems.length ? growthMessage(newItems) : null;
  const reasons = whyEvolved(content, player);
  const history = worldHistory(content, player);
  const now = serverNow(player);
  const owned = new Map(world.items.map((i) => [i.worldItemId, i]));

  const missing = info.missing
    ? [
        info.missing.items > 0 && plural(info.missing.items, 'item', 'itens'),
        info.missing.challenges > 0 && plural(info.missing.challenges, 'desafio concluído', 'desafios concluídos'),
        info.missing.categories > 0 && plural(info.missing.categories, 'categoria explorada', 'categorias exploradas'),
      ].filter(Boolean)
    : [];

  return (
    <div className="stack">
      <PageHeader title="🌎 Meu Mundo" subtitle="O seu mundo é a consequência das suas ações reais." />

      <section className="card world-hero" aria-labelledby="world-name">
        <div className="world-hero__head">
          <span className="world-hero__icon" aria-hidden>
            {stage.icon}
          </span>
          <div>
            <h2 id="world-name" className="world-hero__name">
              {world.name}
            </h2>
            {world.description && <p className="muted small">{world.description}</p>}
          </div>
        </div>
        <p className="world-hero__stage">
          <span className="eyebrow">
            Estágio {stage.number} de {content.worldStages.length}
          </span>
          <strong className="block">{stage.name}</strong>
          <span className={`tag world-status world-status--${world.status}`}>{worldStatusLabels[world.status]}</span>
        </p>
        <ProgressBar value={world.progress} label="Evolução do mundo" valueText={`${world.progress}% de evolução`} />
        <p className="small">
          <strong>{world.progress}% de evolução</strong>
        </p>
        <p className="small muted">
          {next
            ? missing.length
              ? `Próximo: estágio ${next.number} · ${next.name}. Falta: ${missing.join(', ')}.`
              : `Próximo: estágio ${next.number} · ${next.name}.`
            : 'Seu mundo chegou ao estágio máximo: um ecossistema vivo!'}
        </p>
      </section>

      {growth && (
        <div className="banner banner--success world-growth" role="status">
          <span className="banner__icon" aria-hidden>
            {growth.icon}
          </span>
          <div>
            <strong>{growth.title}</strong>
            {growth.message && <p>{growth.message}</p>}
            <p className="world-growth__items">
              {newItems.map((i) => (
                <span key={i.id} className="tag">
                  <span aria-hidden>{i.icon}</span> {i.name}
                </span>
              ))}
            </p>
          </div>
        </div>
      )}

      <button type="button" className="card library-link" onClick={() => onEnterHouse(false)}>
        <span className="big-icon big-icon--sm" aria-hidden>
          🏡
        </span>
        <span>
          <strong>Minha casa</strong>
          <span className="block muted small">Entre na sua casa e ande pelos cômodos: ela cresce com o que você aprende e faz</span>
        </span>
        <span aria-hidden>→</span>
      </button>

      <VisitFriendCard />

      {use3d ? (
        <Suspense fallback={<div className="world3d-loading" role="status">🌍 Carregando o mundo em 3D…</div>}>
          <World3DView
            content={content}
            player={player}
            highlightIds={cameBack ? [] : newlyRevealed}
            startInside={fullscreen}
            onSelect={setSelected}
            onEnterHome={enterHome}
            onFail={fallbackTo2d}
          />
        </Suspense>
      ) : (
        <>
          <p className="muted small world-tip">Toque em um elemento para saber de onde ele veio. 🔒 mostra o que ainda pode surgir.</p>
          <WorldMap content={content} player={player} highlightIds={newlyRevealed} onSelect={setSelected} />
        </>
      )}

      <section className="card" aria-labelledby="world-progress-title">
        <h2 className="section-title" id="world-progress-title">
          📊 Evolução do mundo
        </h2>
        <dl className="stats stats--4">
          <div>
            <dt>Itens desbloqueados</dt>
            <dd>
              {info.itemsUnlocked} / {info.itemsTotal}
            </dd>
          </div>
          <div>
            <dt>Categorias exploradas</dt>
            <dd>
              {info.categoriesExplored} / {info.categoriesTotal}
            </dd>
          </div>
          <div>
            <dt>Desafios ambientais</dt>
            <dd>{plural(info.challengesCompleted, 'concluído', 'concluídos')}</dd>
          </div>
          <div>
            <dt>Estágio</dt>
            <dd>
              {stage.number} / {content.worldStages.length}
            </dd>
          </div>
        </dl>
        <p className="small muted world-formula">
          O progresso soma itens conquistados (50%), desafios concluídos (30%) e categorias exploradas (20%). XP não entra
          na conta: o mundo mostra as suas ações.
        </p>
      </section>

      <section className="card" aria-labelledby="world-cat-title">
        <h2 className="section-title" id="world-cat-title">
          🗺️ Categorias no mundo
        </h2>
        <ul className="category-progress">
          {worldCategories(content, player).map((c) => (
            <li key={c.category.id}>
              <div className="category-progress__head">
                <span>
                  <span aria-hidden>{c.category.icon}</span> <strong>{c.category.name}</strong>
                </span>
                <span className="small muted">
                  {c.unlocked}/{c.total} {c.total === 1 ? 'elemento' : 'elementos'}
                </span>
              </div>
              <ProgressBar
                value={c.unlocked}
                max={Math.max(c.total, 1)}
                label={`Elementos de ${c.category.name} no mundo`}
                valueText={`${c.unlocked} de ${c.total} elementos`}
                size="sm"
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="world-why-title">
        <h2 className="section-title" id="world-why-title">
          🌱 Por que meu mundo evoluiu?
        </h2>
        {reasons.length ? (
          <>
            <p className="muted small">Seu mundo ganhou vida porque você:</p>
            <ul className="world-reasons">
              {reasons.map((r) => (
                <li key={r.text}>
                  <span aria-hidden>{r.icon}</span> {r.text}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="empty">Conclua uma lição ou um desafio para ver seu mundo começar a mudar.</p>
        )}
      </section>

      <section className="card" aria-labelledby="world-history-title">
        <h2 className="section-title" id="world-history-title">
          📜 História do meu mundo
        </h2>
        <ol className="world-history">
          {history.map((h) => (
            <li key={h.key} className="world-history__item">
              <span className="world-history__icon" aria-hidden>
                {h.icon}
              </span>
              <span>
                <strong className="block">{relativeDay(h.date, now)}</strong>
                <span className="small">{h.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <details className="card world-list">
        <summary>Ver todos os elementos em lista</summary>
        <ul className="list">
          {content.worldItems.map((item) => {
            const mine = owned.get(item.id);
            return (
              <li key={item.id} className="list__row">
                <span aria-hidden>{mine ? item.icon : '🔒'}</span>
                <span>
                  <strong>{item.name}</strong>
                  <span className="muted small block">{mine ? 'No seu mundo' : 'Bloqueado'}</span>
                </span>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelected(item)}>
                  Detalhes
                </button>
              </li>
            );
          })}
        </ul>
      </details>

      {selected && (
        <WorldItemDialog content={content} item={selected} owned={owned.get(selected.id)} onClose={closeDialog} />
      )}
    </div>
  );
}
