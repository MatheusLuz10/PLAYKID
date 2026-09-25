import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout';

export function TermsPage() {
  return (
    <PublicLayout title="Termos de uso">
      <article className="prose stack">
        <h1 className="page-title">Termos de uso</h1>
        <p className="banner banner--info">
          Versão inicial, escrita para a primeira publicação do ECO QUEST. Antes do uso em larga escala, este texto
          deve ser revisado por uma assessoria jurídica conforme a legislação aplicável.
        </p>

        <h2>1. O que é o ECO QUEST</h2>
        <p>
          Um jogo de educação ambiental: você aprende, responde quizzes, realiza ações reais, registra o que fez e
          acompanha a evolução do seu mundo virtual.
        </p>

        <h2>2. Conta</h2>
        <p>
          Para jogar, você cria uma conta com e-mail e senha. Você é responsável por manter a senha em segredo. Não use
          a conta de outra pessoa.
        </p>

        <h2>3. Ações no mundo real</h2>
        <ul>
          <li>Os desafios são sugestões educativas. Faça apenas o que for seguro para você e para o ambiente.</li>
          <li>Crianças devem realizar os desafios com a ajuda e a supervisão de um adulto responsável.</li>
          <li>Não plante nem faça intervenções em áreas protegidas, públicas ou de terceiros sem autorização.</li>
          <li>O ECO QUEST não se responsabiliza por ações realizadas fora dessas orientações.</li>
        </ul>

        <h2>4. Evidências (fotos e observações)</h2>
        <ul>
          <li>Envie apenas fotos e textos relacionados ao desafio, feitos por você.</li>
          <li>Evite mostrar rostos, documentos, endereços ou outras informações pessoais nas fotos.</li>
          <li>Não envie conteúdo ofensivo, ilegal ou que viole direitos de outras pessoas.</li>
        </ul>

        <h2>5. Recompensas</h2>
        <p>
          XP, níveis, conquistas e elementos do mundo não têm valor financeiro, não podem ser comprados, vendidos nem
          transferidos. Tentativas de manipular o jogo podem levar à desativação da conta.
        </p>

        <h2>6. Exclusão da conta</h2>
        <p>
          Você pode excluir sua conta a qualquer momento no seu Perfil. Os dados são apagados conforme descrito na{' '}
          <Link to="/privacidade">Política de privacidade</Link>.
        </p>

        <h2>7. Mudanças</h2>
        <p>Estes termos podem mudar. Mudanças importantes serão avisadas dentro do app.</p>
      </article>
    </PublicLayout>
  );
}
