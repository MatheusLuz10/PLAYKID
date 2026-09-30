import { Link } from 'react-router-dom';
import { findQuizForLesson } from '../../logic/catalog';
import { useGame } from '../../state/GameContext';
import { Modal } from '../ui/Modal';

/** Aulas (com quiz) da reserva: preservação, reflorestamento e Amazônia. */
const RESERVE_LESSONS = ['por-que-preservar-a-floresta', 'area-de-reflorestamento', 'fauna-e-flora-da-amazonia'];

const FAUNA = [
  { icon: '🐆', name: 'Onça-pintada', text: 'O maior felino das Américas. Nada muito bem e caça à noite.' },
  { icon: '🦜', name: 'Arara-vermelha', text: 'Voa em bandos e espalha sementes das frutas que come.' },
  { icon: '🐦', name: 'Tucano', text: 'Tem um bico enorme e colorido, leve por dentro.' },
  { icon: '🦥', name: 'Preguiça', text: 'Vive pendurada nas árvores e se move bem devagar.' },
  { icon: '🐬', name: 'Boto-cor-de-rosa', text: 'Golfinho de rio: nada nos rios e igarapés da Amazônia.' },
];

const FLORA = [
  { icon: '🌳', name: 'Samaúma', text: 'A "rainha da floresta": uma das maiores árvores da Amazônia.' },
  { icon: '🌰', name: 'Castanheira', text: 'Árvore alta que dá a castanha-do-pará.' },
  { icon: '🌴', name: 'Açaí', text: 'Palmeira fina com cachos de frutinhas roxas.' },
  { icon: '🪷', name: 'Vitória-régia', text: 'Folhas redondas enormes que boiam nos rios.' },
  { icon: '🌿', name: 'Seringueira', text: 'Dá o látex, usado para fazer borracha.' },
];

/**
 * 🌳 Reserva Florestal da Amazônia (tocada no Meu Mundo): o que conhecer
 * (fauna, flora, área de reflorestamento) e os quizzes da reserva.
 */
export function ReserveDialog({ onClose }: { onClose: () => void }) {
  const { content, player } = useGame();
  const lessons = RESERVE_LESSONS.map((slug) => content.lessons.find((l) => l.slug === slug)).filter((l) => l !== undefined);

  return (
    <Modal titleId="reserve-title" title="🌳 Reserva Florestal da Amazônia" onClose={onClose} closeLabel="Fechar">
      <div className="reserve stack stack--sm">
        <p>
          Uma reserva florestal é uma área protegida: a floresta fica em pé e os animais têm onde morar. Aqui ninguém corta
          árvores, caça ou faz fogo.
        </p>

        <section className="reserve__block" aria-labelledby="reserve-reflorestamento">
          <h3 id="reserve-reflorestamento" className="reserve__title">
            🌱 Área de reflorestamento
          </h3>
          <p className="small">
            Onde a floresta foi derrubada, mudas de árvores nativas (como a castanheira e o ipê) são plantadas em fileiras. Com
            água, proteção e muitos anos de paciência, a floresta volta a crescer e os bichos voltam também.
          </p>
        </section>

        <section className="reserve__block" aria-labelledby="reserve-fauna">
          <h3 id="reserve-fauna" className="reserve__title">
            🐾 Fauna da Amazônia (os animais)
          </h3>
          <ul className="reserve__cards">
            {FAUNA.map((f) => (
              <li key={f.name} className="reserve__card">
                <span className="reserve__icon" aria-hidden>
                  {f.icon}
                </span>
                <span>
                  <strong className="block">{f.name}</strong>
                  <span className="small">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="reserve__block" aria-labelledby="reserve-flora">
          <h3 id="reserve-flora" className="reserve__title">
            🌿 Flora da Amazônia (as plantas)
          </h3>
          <ul className="reserve__cards">
            {FLORA.map((f) => (
              <li key={f.name} className="reserve__card">
                <span className="reserve__icon" aria-hidden>
                  {f.icon}
                </span>
                <span>
                  <strong className="block">{f.name}</strong>
                  <span className="small">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="reserve__block" aria-labelledby="reserve-quizzes">
          <h3 id="reserve-quizzes" className="reserve__title">
            🧠 Quizzes da reserva
          </h3>
          <ul className="reserve__quizzes">
            {lessons.map((l) => {
              const quiz = findQuizForLesson(content, l.id);
              const learned = player.lessons[l.id]?.status === 'completed';
              const passed = quiz ? Boolean(player.quizzes[quiz.id]?.passed) : false;
              return (
                <li key={l.id} className="reserve__quiz">
                  <span>
                    <strong className="block">{l.title}</strong>
                    <span className="small muted">
                      {passed ? '✅ Quiz aprovado' : learned ? 'Aula lida: agora é o quiz' : 'Leia a aula curtinha e depois faça o quiz'}
                    </span>
                  </span>
                  <Link
                    to={learned ? `/aula/${l.slug}/quiz` : `/aula/${l.slug}`}
                    className={`btn btn--sm ${passed ? 'btn--ghost' : 'btn--primary'}`}
                    aria-label={`${passed ? 'Refazer o quiz' : learned ? 'Fazer o quiz' : 'Aprender'}: ${l.title}`}
                  >
                    {passed ? 'Refazer' : learned ? '🧠 Fazer o quiz' : '📚 Aprender'}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
