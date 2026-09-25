import { PublicLayout } from '../../components/layout/PublicLayout';

export function PrivacyPage() {
  return (
    <PublicLayout title="Privacidade">
      <article className="prose stack">
        <h1 className="page-title">Política de privacidade</h1>
        <p className="banner banner--info">
          Versão inicial. Antes do uso em larga escala, este texto deve ser revisado conforme a legislação de proteção
          de dados aplicável (no Brasil, a LGPD).
        </p>

        <h2>Coletamos apenas o necessário para o jogo funcionar</h2>
        <ul>
          <li>
            <strong>Conta:</strong> e-mail e senha (a senha é guardada pelo serviço de autenticação, de forma protegida;
            o ECO QUEST não tem acesso a ela).
          </li>
          <li>
            <strong>Perfil:</strong> nome, nome de usuário e avatar escolhidos por você.
          </li>
          <li>
            <strong>Progresso:</strong> aulas, respostas dos quizzes, desafios, acompanhamentos, XP, níveis, conquistas e
            o seu mundo virtual.
          </li>
          <li>
            <strong>Evidências:</strong> as fotos e observações que você envia para comprovar as ações.
          </li>
          <li>
            <strong>Registros técnicos de erro:</strong> para corrigir falhas (sem senha, token ou e-mail).
          </li>
        </ul>

        <h2>O que NÃO fazemos</h2>
        <ul>
          <li>Não rastreamos sua localização.</li>
          <li>Não fazemos reconhecimento facial nem analisamos o conteúdo das fotos automaticamente.</li>
          <li>Não vendemos dados nem exibimos anúncios.</li>
          <li>Não existe feed público: suas fotos não são mostradas a outros jogadores.</li>
        </ul>

        <h2>Fotos privadas</h2>
        <p>
          As fotos ficam em armazenamento privado. Somente você pode vê-las (por links temporários). Administradores do
          ECO QUEST podem acessá-las apenas para suporte ou moderação.
        </p>

        <h2>Armazenamento no navegador</h2>
        <p>
          O navegador guarda a sua sessão de login e pequenas preferências (por exemplo, se você já viu as boas-vindas).
          No modo demonstração, sem servidor, todo o progresso fica somente neste navegador.
        </p>

        <h2>Seus direitos</h2>
        <p>
          Você pode corrigir seu perfil a qualquer momento e excluir a conta no Perfil. Ao excluir, apagamos
          permanentemente: perfil, progresso, tentativas de quiz, desafios, evidências (incluindo as fotos), XP,
          conquistas e o mundo virtual. Um registro técnico mínimo, sem identificar você, informa apenas que uma conta foi
          excluída.
        </p>
      </article>
    </PublicLayout>
  );
}
