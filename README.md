# ECO QUEST

Jogo de educação ambiental gamificada: **Aprender → Quiz → Desafio → Comprovar → Acompanhar → Recompensar → Evoluir**.

- **Etapa 1** — fundação visual e navegável.
- **Etapa 2** — dados reais com Supabase (PostgreSQL, Auth, Storage e RLS).
- **Etapa 3** — sistema de aprendizagem (área Aprender, biblioteca, busca, favoritos, aulas em partes com retomada).
- **Etapa 4** — sistema de quiz (tentativas, feedback por alternativa, resultado no servidor, desempenho) + calendário da missão sem burlar datas e foto pela câmera ou galeria.
- **Etapa 5** — sistema de desafios ecológicos (8 desafios, checklist em ordem, evidências com foto ou observação, acompanhamentos com linha do tempo e lembretes, prazo com recomeçar/encerrar, conclusão definitiva idempotente com XP, conquista e item no Mundo).
- **Etapa 6** — gamificação: todo XP nasce de um evento verificado pelo servidor (`process_gamification_event`, sem duplicação), 20 níveis e 18 conquistas configuráveis no banco, XP por origem (conhecimento, ações, conquistas, bônus), celebração de nível/conquista, Minha evolução (histórico de XP, minhas ações, categorias) e galeria de conquistas com progresso.
- **Etapa 7** — mundo virtual ecológico: “Meu Primeiro Ecossistema” com 5 áreas e 32 itens liberados só por ações reais (lições, desafios, conquistas e níveis, verificados no servidor), 7 estágios calculados por itens, desafios e categorias (não por XP), detalhes educativos de cada item, “Por que meu mundo evoluiu?”, história do mundo e animações leves que respeitam `prefers-reduced-motion`.
- **Etapa 8** — integração final: recuperação de senha, sessão expirada, rotas protegidas e página 404, painel `/admin` (métricas reais, usuários, ativar/desativar conteúdo preservando o histórico, registros), exclusão de conta, registro de erros sem dados sensíveis, boas-vindas e “Sua primeira missão”, páginas Sobre/Termos/Privacidade, SEO e instalação como app (manifest), cabeçalhos de segurança (`vercel.json`) e testes completos.

Documentação: [docs/ARQUITETURA.md](docs/ARQUITETURA.md) (mapa do sistema) · [docs/PUBLICACAO.md](docs/PUBLICACAO.md) (deploy e checklist) · [tests/e2e/README.md](tests/e2e/README.md) (testes de ponta a ponta).

## Rodar

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # checagem de tipos + build
npm run test:db      # testa migrations, RLS e funções do banco (sem Docker) — 362 verificações
npm run verify       # test:db + build de produção (use antes de publicar)
npm run db:bundle    # gera supabase/setup.sql (todas as migrations em um arquivo)
npm run content:sql  # gera as migrations 15 (aulas), 17 (quizzes), 20 (desafios), 22 (níveis e conquistas) e 24 (mundo) a partir de content/
```

Sem variáveis de ambiente o app roda em **modo demonstração** (progresso salvo só no navegador,
fotos não são enviadas). Com o Supabase configurado, tudo passa a ser real.

Na demonstração cada jogador tem **login próprio neste aparelho** (nome de usuário e senha; a senha é guardada
só como resumo PBKDF2) e a própria evolução — aulas, quizzes, desafios, XP, conquistas, mundo e casa. A tela
`/jogadores` lista as contas; a conta de demonstração (sem senha) abre com tudo desbloqueado. No Supabase o login
é o do servidor (e-mail e senha), válido em qualquer aparelho.

## Publicação atual (Cloudflare Workers + Neon)

O site está em https://playkid.mluz787.workers.dev: Worker da Cloudflare (site + API de fotos) e Neon
(login, banco pela Data API e fotos no Object Storage). Passo a passo e comandos em `docs/PUBLICACAO.md` (seção 0).
`npm run build` gera a versão com Neon; `npm run build:demo`, a demonstração local (usada nos testes).

## Configurar o Supabase

1. Crie um projeto em <https://supabase.com>.
2. Aplique o banco — escolha **uma** opção:
   - **SQL Editor (mais simples):** rode `npm run db:bundle`, abra `supabase/setup.sql`,
     cole tudo no SQL Editor do painel e execute **uma única vez**.
   - **Supabase CLI:** `supabase link --project-ref <ref>` e depois `supabase db push`
     (usa `supabase/migrations/01…25`).
3. Em **Authentication → Providers**, deixe **Email** habilitado. Para testar sem caixa de e-mail,
   desative “Confirm email” (em produção, mantenha ativado).
4. Em **Authentication → URL Configuration**, adicione `http://localhost:5173` e `http://localhost:5173/redefinir-senha` às Redirect URLs (em produção, o seu domínio — veja docs/PUBLICACAO.md).
5. Copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
   (Project Settings → API). **Nunca** use a `service_role`.
6. `npm run dev`.

### Tornar um usuário administrador

O primeiro administrador é definido no SQL Editor (com privilégios de dono do projeto); os seguintes podem ser promovidos pelo painel `/admin` → Usuários:

```sql
update public.profiles set role = 'admin'
where user_id = (select id from auth.users where email = 'voce@exemplo.com');
```

## Conteúdos educativos

As aulas ficam em `content/lessons.json`, os quizzes em `content/quizzes.json`, os desafios em `content/challenges.json`, os níveis e conquistas em `content/gamification.json` o mundo (áreas, estágios e itens com suas regras de desbloqueio) em `content/world.json` e a casa 3D do módulo 🏡 Meu Lugar (estágios e objetos) em `content/place.json` (fontes únicas). O XP de cada ação fica no próprio conteúdo (`xp_reward` de aulas, quizzes, desafios e etapas; `start_xp_reward` dos desafios). Depois de editar:

1. `npm run content:sql` — valida o conteúdo (categorias, blocos, texto alternativo; 4 alternativas com exatamente 1 correta e feedback em cada uma) e gera `supabase/migrations/15_learning_content.sql`, `17_quiz_content.sql`, `20_challenge_content.sql`, `22_gamification_content.sql`, `24_world_content.sql` e `27_place_content.sql`. Etapas de desafio removidas do JSON são desativadas (não apagadas), preservando o histórico dos jogadores.
2. Aplique o SQL gerado no Supabase (é idempotente: pode ser executado de novo).

O modo demonstração lê o mesmo arquivo, então os dois modos mostram o mesmo conteúdo.
Ilustrações das aulas ficam em `public/lessons/`.

## Estrutura

```
supabase/
  migrations/   01…13 (base) · 14_learning_schema · 15_learning_content (gerada)
                16_quiz_improvements · 17_quiz_content (gerada) · 18_mission_schedule
                19_challenges_system · 20_challenge_content (gerada)
                21_gamification · 22_gamification_content (gerada)
                23_world_system · 24_world_content (gerada) · 25_final_hardening
                26_place_system · 27_place_content (gerada) — Meu Lugar (casa 3D)
  tests/        db.test.mjs — 387 verificações de fluxo e segurança (PGlite)
tests/e2e/       testes de ponta a ponta (Playwright, celular e desktop) — ver tests/e2e/README.md
docs/           ARQUITETURA.md (mapa do sistema) · PUBLICACAO.md (deploy e checklist)
content/        lessons.json · quizzes.json · challenges.json · gamification.json · world.json · place.json — conteúdo (fontes únicas)
src/
  models/       Tipos de domínio (espelham as tabelas)
  data/         avatares + catálogo/gabarito do modo demonstração (espelho do seed)
  services/     supabaseClient, authService, errors, imageService
    backend/    GameBackend (contrato) · SupabaseBackend · LocalBackend · mappers
  logic/        fluxo da missão, níveis (calculateUserLevel), gamificação, catálogo, mundo, datas
  state/        AuthContext (sessão) · GameContext (conteúdo + jogador + ações)
  components/   layout, ui, mission, quiz, world, challenge, achievements, player
  modules/place/ Meu Lugar: casa 3D (three.js, carregada sob demanda), catálogo, regras e tela
  modules/world3d/ Meu Mundo em 3D: as 5 áreas numa paisagem, modelos de todos os itens (o mapa 2D fica como alternativa sem WebGL)
  pages/        telas (inclui Entrar, Criar perfil e pages/mission/*)
  styles/       tokens, base, layout, componentes e páginas
```

## Segurança (resumo)

- RLS em todas as tabelas; o jogador só lê os próprios dados.
- Escritas do jogo apenas via funções `security definer` que validam a ordem
  (aula concluída → quiz aprovado → desafio aceito → evidência → conclusão).
- XP, conquistas, itens do mundo e objetos da casa não podem ser gravados pelo usuário.
- Gabarito (`quiz_options.is_correct`) e explicações não são legíveis; a correção
  vem da função `answer_quiz_question`, depois da resposta.
- Fotos no bucket privado `eco-evidence`, em `users/{user_id}/challenges/{challenge_id}/`.
