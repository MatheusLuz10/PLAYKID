import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { DeleteAccount } from '../components/player/DeleteAccount';
import { ProfileForm } from '../components/player/ProfileForm';
import { LevelProgress } from '../components/player/LevelProgress';
import { formatDate } from '../logic/dates';
import { computeStats } from '../logic/gamification';
import { useAuth } from '../state/AuthContext';
import { useGame } from '../state/GameContext';
import { safeImageSrc } from '../logic/safeUrl';

export function ProfilePage() {
  const { content, player, mode, actions } = useGame();
  const { email, signOut } = useAuth();
  const navigate = useNavigate();
  const { profile } = player;

  const completedList = content.challenges.filter((c) => player.challenges[c.id]?.status === 'completed');
  const stats = useMemo(() => computeStats(content, player), [content, player]);
  const passedQuizzes = stats.quizzesPassed;

  const reset = async () => {
    if (!window.confirm(`Reiniciar o progresso de ${profile.displayName ?? 'este jogador'}? Os outros jogadores não mudam.`)) return;
    await actions.resetDemo?.();
    navigate('/');
  };

  const leave = async () => {
    try {
      await signOut();
    } finally {
      navigate('/');
    }
  };

  return (
    <div className="stack">
      <PageHeader
        title="Perfil"
        subtitle={
          <>
            {profile.username && <>@{profile.username} · </>}Jogando desde {formatDate(profile.createdAt)}
            {profile.role === 'admin' && <span className="tag tag--new admin-tag">Administrador</span>}
          </>
        }
      />

      <section className="card profile-card" aria-label="Seu nível">
        <div className="profile-card__who">
          <span className="avatar avatar--lg" aria-hidden>
            {safeImageSrc(profile.avatarUrl) ? (
              <img className="avatar__image" src={safeImageSrc(profile.avatarUrl)} alt="" />
            ) : (
              profile.avatar
            )}
          </span>
          <strong className="profile-card__name">{profile.displayName}</strong>
        </div>
        <LevelProgress profile={profile} levels={content.levels} />
      </section>

      <section className="card">
        <h2 className="section-title">Sua jornada</h2>
        <dl className="stats stats--6">
          {[
            { icon: '🏆', label: 'Conquistas', value: `${stats.achievementsUnlocked}/${content.achievements.length}` },
            { icon: '🎯', label: 'Desafios', value: stats.challengesCompleted },
            { icon: '📚', label: 'Lições', value: stats.lessonsCompleted },
            { icon: '🧠', label: 'Quizzes', value: stats.quizzesPassed },
            { icon: '🧭', label: 'Categorias', value: `${stats.categoriesExplored}/${content.categories.length}` },
            { icon: '🌎', label: 'Ações realizadas', value: stats.actions },
          ].map((i) => (
            <div key={i.label}>
              <dt>
                <span aria-hidden>{i.icon}</span> {i.label}
              </dt>
              <dd>{i.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Link to="/perfil/evolucao" className="card library-link">
        <span className="big-icon big-icon--sm" aria-hidden>
          📈
        </span>
        <span>
          <strong>Minha evolução</strong>
          <span className="block muted small">XP por origem, histórico de XP, minhas ações e categorias</span>
        </span>
        <span aria-hidden>→</span>
      </Link>

      {completedList.length > 0 && (
        <section className="card">
          <h2 className="section-title">🏆 Desafios concluídos</h2>
          <ul className="list">
            {completedList.map((c) => (
              <li key={c.id} className="list__row">
                <span aria-hidden>{c.icon}</span>
                <span>
                  {c.title}
                  <span className="block muted small">
                    Concluído em {formatDate(player.challenges[c.id]!.completedAt ?? player.challenges[c.id]!.acceptedAt!)}
                  </span>
                </span>
                <span className="tag tag--done">+{c.xpReward} XP</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link to="/perfil/desempenho" className="card library-link">
        <span className="big-icon big-icon--sm" aria-hidden>
          🧠
        </span>
        <span>
          <strong>Meu desempenho</strong>
          <span className="block muted small">
            {passedQuizzes} {passedQuizzes === 1 ? 'quiz aprovado' : 'quizzes aprovados'} · tentativas, melhores notas e
            conhecimentos dominados
          </span>
        </span>
        <span aria-hidden>→</span>
      </Link>

      <ProfileForm profile={profile} submitLabel="Salvar perfil" onSubmit={actions.updateProfile} />

      {mode === 'demo' ? (
        <section className="card card--muted">
          <h2 className="section-title">Modo demonstração</h2>
          <p className="muted small">
            O Supabase não está configurado, então o progresso fica salvo apenas neste navegador. Cada jogador
            cadastrado aqui tem a sua própria evolução.
          </p>
          <Link to="/jogadores" className="btn btn--ghost">
            👥 Trocar de conta
          </Link>
          <button type="button" className="btn btn--ghost" onClick={leave}>
            Sair
          </button>
          <button type="button" className="btn btn--primary" onClick={() => void actions.completeDemo?.()}>
            🔓 Desbloquear tudo (mundo, casa, conquistas e níveis)
          </button>
          <button type="button" className="btn btn--danger-ghost" onClick={reset}>
            Reiniciar demonstração
          </button>
        </section>
      ) : (
        <section className="card card--muted">
          <h2 className="section-title">Conta</h2>
          <p className="muted small">Conectado como {email}</p>
          <button type="button" className="btn btn--danger-ghost" onClick={leave}>
            Sair
          </button>
        </section>
      )}

      {profile.role === 'admin' && (
        <Link to="/admin" className="card library-link">
          <span className="big-icon big-icon--sm" aria-hidden>
            🔐
          </span>
          <span>
            <strong>Administração</strong>
            <span className="block muted small">Usuários, conteúdo e registros</span>
          </span>
          <span aria-hidden>→</span>
        </Link>
      )}

      <DeleteAccount />

      <nav className="profile-links small" aria-label="Informações">
        <Link to="/sobre">Sobre o ECO QUEST</Link>
        <Link to="/termos">Termos de uso</Link>
        <Link to="/privacidade">Privacidade</Link>
      </nav>
    </div>
  );
}
