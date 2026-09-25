import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout';

const JOURNEY = [
  { icon: '📚', title: 'Aprender', text: 'Aulas curtas sobre natureza, água, resíduos, energia, biodiversidade e comunidade.' },
  { icon: '🧠', title: 'Comprovar o conhecimento', text: 'Um quiz com explicação em cada resposta. Aprovado, o desafio é liberado.' },
  { icon: '🌳', title: 'Agir no mundo real', text: 'Desafios práticos: plantar, economizar água, separar resíduos, cuidar dos polinizadores…' },
  { icon: '📷', title: 'Comprovar a ação', text: 'Uma foto ou observação registra o que você fez. As fotos são privadas.' },
  { icon: '📅', title: 'Acompanhar', text: 'Algumas ações pedem acompanhamento: a árvore é revisitada aos 30, 90 e 180 dias.' },
  { icon: '🌎', title: 'Ver o mundo evoluir', text: 'XP, níveis e conquistas representam a sua jornada — e o seu mundo virtual cresce com cada ação real.' },
];

export function AboutPage() {
  return (
    <PublicLayout title="Sobre o ECO QUEST">
      <article className="prose stack">
        <h1 className="page-title">🌎 Sobre o ECO QUEST</h1>
        <p className="lead">
          <strong>Aprenda. Faça. Transforme.</strong>
        </p>
        <p>
          O ECO QUEST é um jogo de educação ambiental. O objetivo não é só evoluir dentro do jogo: é fazer o jogo
          representar a evolução das suas atitudes ambientais no mundo real.
        </p>

        <h2>Filosofia</h2>
        <p>
          O jogo não recompensa cliques. Ele recompensa <strong>aprendizado</strong> e <strong>ações reais</strong>. Todo
          XP, conquista e elemento do mundo vem de algo que você aprendeu ou fez — e cada recompensa é concedida uma
          única vez.
        </p>

        <h2>Como funciona</h2>
        <ol className="about-journey">
          {JOURNEY.map((s) => (
            <li key={s.title}>
              <span className="about-journey__icon" aria-hidden>
                {s.icon}
              </span>
              <span>
                <strong className="block">{s.title}</strong>
                <span className="muted">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>

        <h2>O mundo virtual</h2>
        <p>
          Seu mundo começa como um terreno quase vazio. Árvores, flores, hortas, água e animais só aparecem quando você
          realiza as ações correspondentes. Não existe loja, moeda ou item pago: o mundo é a memória visual da sua
          jornada.
        </p>

        <h2>Segurança e cuidado</h2>
        <p>
          Algumas ações envolvem ferramentas, plantio ou saídas de casa. Crianças devem sempre realizá-las com um adulto
          responsável. Veja também os <Link to="/termos">Termos de uso</Link> e a <Link to="/privacidade">Política de
          privacidade</Link>.
        </p>

        <Link to="/entrar" className="btn btn--primary btn--lg">
          Começar minha jornada
        </Link>
      </article>
    </PublicLayout>
  );
}
